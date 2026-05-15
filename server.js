require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("Conectado ao banco de dados PostgreSQL"))
  .catch(err => console.error("Erro ao conectar ao banco:", err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// SSE - Server-Sent Events para tempo real
let sseClients = [];

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);
  console.log(`SSE cliente conectado. Total: ${sseClients.length}`);

  req.on("close", () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`SSE cliente desconectado. Total: ${sseClients.length}`);
  });
});

function notificarClientes(evento, dados) {
  sseClients.forEach(client => {
    client.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
  });
}

// Abre a página inicial
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// Inicialização das tabelas
async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        usuario TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'tecnico',
        cargo TEXT DEFAULT '',
        bloqueado INTEGER NOT NULL DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chamados (
        id SERIAL PRIMARY KEY,
        numero TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL,
        setor TEXT NOT NULL,
        problema TEXT NOT NULL,
        prioridade TEXT NOT NULL,
        descricao TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Aberto',
        data_hora TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        excluido_em TEXT DEFAULT NULL
      )
    `);

    // Usuário padrão para teste
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE usuario = $1`,
      ["gustavo.ti"]
    );

    if (parseInt(rows[0].total) === 0) {
      const senhaHash = await bcrypt.hash("Admin@2024", 10);
      await pool.query(
        `INSERT INTO usuarios (nome, usuario, senha, perfil, cargo, bloqueado)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["Gustavo TI", "gustavo.ti", senhaHash, "coordenador", "Coordenador(a) de TI", 0]
      );
      console.log("Usuário padrão criado: gustavo.ti / Admin@2024");
    }
  } catch (err) {
    console.error("Erro ao inicializar banco:", err);
  }
}

inicializarBanco();

// Login
app.post("/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ sucesso: false, erro: "Informe usuário e senha." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM usuarios WHERE usuario = $1`,
      [usuario.trim().toLowerCase()]
    );
    const row = rows[0];

    if (!row) {
      return res.status(401).json({ sucesso: false, erro: "Usuário(a) ou senha incorretos." });
    }
    if (row.bloqueado === 1) {
      return res.status(403).json({ sucesso: false, erro: "Usuário(a) bloqueado(a). Contate o(a) Diretor(a) de TI." });
    }

    const senhaOk = await bcrypt.compare(senha, row.senha);
    if (!senhaOk) {
      return res.status(401).json({ sucesso: false, erro: "Usuário(a) ou senha incorretos." });
    }

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso!",
      usuario: { id: row.id, nome: row.nome, usuario: row.usuario, perfil: row.perfil, cargo: row.cargo }
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro no servidor." });
  }
});

// Criar chamado
app.post("/api/chamados", async (req, res) => {
  const { numero, nome, setor, problema, prioridade, descricao, status, data_hora, timestamp } = req.body;

  if (!numero || !nome || !setor || !problema || !prioridade || !descricao) {
    return res.status(400).json({ sucesso: false, erro: "Todos os campos são obrigatórios." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO chamados (numero, nome, setor, problema, prioridade, descricao, status, data_hora, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [numero, nome, setor, problema, prioridade, descricao, status || 'Aberto', data_hora, timestamp]
    );

    const novoChamado = { id: rows[0].id, numero, nome, setor, problema, prioridade, descricao, status: status || 'Aberto', data_hora, timestamp };
    notificarClientes('novo_chamado', novoChamado);
    res.json({ sucesso: true, mensagem: "Chamado criado com sucesso!", chamado: novoChamado });
  } catch (err) {
    console.error("Erro ao criar chamado:", err.message);
    return res.status(500).json({ sucesso: false, erro: "Erro ao criar chamado: " + err.message });
  }
});

// Listar chamados (exclui os da lixeira)
app.get("/api/chamados", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM chamados WHERE excluido_em IS NULL ORDER BY timestamp DESC`);
    res.json({ sucesso: true, chamados: rows });
  } catch (err) {
    console.error("Erro ao listar chamados:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao listar chamados." });
  }
});

// Atualizar status do chamado
app.put("/api/chamados/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ sucesso: false, erro: "Status é obrigatório." });
  }

  try {
    const result = await pool.query(`UPDATE chamados SET status = $1 WHERE id = $2`, [status, id]);
    if (result.rowCount === 0) return res.status(404).json({ sucesso: false, erro: "Chamado não encontrado." });
    notificarClientes('status_chamado', { id: parseInt(id), status });
    res.json({ sucesso: true, mensagem: "Chamado atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar chamado:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao atualizar chamado." });
  }
});

// Soft-delete chamado (mover para lixeira)
app.delete("/api/chamados/:id", async (req, res) => {
  const { id } = req.params;
  const agora = new Date().toISOString();

  try {
    const result = await pool.query(`UPDATE chamados SET excluido_em = $1 WHERE id = $2 AND excluido_em IS NULL`, [agora, id]);
    if (result.rowCount === 0) return res.status(404).json({ sucesso: false, erro: "Chamado não encontrado." });
    notificarClientes('chamado_excluido', { id: parseInt(id) });
    res.json({ sucesso: true, mensagem: "Chamado movido para a lixeira!" });
  } catch (err) {
    console.error("Erro ao excluir chamado:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao excluir chamado." });
  }
});

// Listar chamados na lixeira
app.get("/api/chamados/lixeira", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM chamados WHERE excluido_em IS NOT NULL ORDER BY excluido_em DESC`);
    res.json({ sucesso: true, chamados: rows });
  } catch (err) {
    console.error("Erro ao listar lixeira:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao listar lixeira." });
  }
});

// Restaurar chamado da lixeira
app.put("/api/chamados/:id/restaurar", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`UPDATE chamados SET excluido_em = NULL WHERE id = $1 AND excluido_em IS NOT NULL`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ sucesso: false, erro: "Chamado não encontrado na lixeira." });
    notificarClientes('chamado_restaurado', { id: parseInt(id) });
    res.json({ sucesso: true, mensagem: "Chamado restaurado com sucesso!" });
  } catch (err) {
    console.error("Erro ao restaurar chamado:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao restaurar chamado." });
  }
});

// Excluir permanentemente
app.delete("/api/chamados/:id/permanente", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`DELETE FROM chamados WHERE id = $1 AND excluido_em IS NOT NULL`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ sucesso: false, erro: "Chamado não encontrado na lixeira." });
    res.json({ sucesso: true, mensagem: "Chamado excluído permanentemente!" });
  } catch (err) {
    console.error("Erro ao excluir permanentemente:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao excluir permanentemente." });
  }
});

// Limpeza automática: exclui permanentemente chamados na lixeira há mais de 30 dias
async function limparLixeira() {
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const result = await pool.query(`DELETE FROM chamados WHERE excluido_em IS NOT NULL AND excluido_em < $1`, [limite]);
    if (result.rowCount > 0) console.log(`Lixeira: ${result.rowCount} chamado(s) excluído(s) permanentemente.`);
  } catch (err) {
    console.error("Erro na limpeza da lixeira:", err);
  }
}

// Em ambiente não-serverless, executa limpeza periódica
if (process.env.NODE_ENV !== "production") {
  setInterval(limparLixeira, 60 * 60 * 1000);
  limparLixeira();
}

// Gerar próximo número de chamado
app.get("/api/chamados/proximo-numero", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT numero FROM chamados ORDER BY CAST(numero AS INTEGER) DESC LIMIT 1`);
    const ultimoNumero = rows.length > 0 ? parseInt(rows[0].numero) : 0;
    const proximoNumero = String(ultimoNumero + 1).padStart(4, '0');
    res.json({ sucesso: true, numero: proximoNumero });
  } catch (err) {
    console.error("Erro ao buscar próximo número:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao buscar próximo número." });
  }
});

// Listar usuários
app.get("/api/usuarios", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, nome, usuario, perfil, cargo, bloqueado FROM usuarios ORDER BY id ASC`);
    const usuariosComData = rows.map(u => ({ ...u, id: String(u.id), criadoEm: 'N/A' }));
    res.json({ sucesso: true, usuarios: usuariosComData });
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao listar usuários." });
  }
});

// Criar usuário
app.post("/api/usuarios", async (req, res) => {
  const { nome, usuario, senha, cargo, perfil } = req.body;

  if (!nome || !usuario || !senha) {
    return res.status(400).json({ sucesso: false, erro: "Nome, usuário e senha são obrigatórios." });
  }
  if (senha.length < 6) {
    return res.status(400).json({ sucesso: false, erro: "A senha deve ter no mínimo 6 caracteres." });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, usuario, senha, perfil, cargo, bloqueado)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [nome, usuario.trim().toLowerCase(), senhaHash, perfil || 'tecnico', cargo || '', 0]
    );
    res.json({
      sucesso: true,
      mensagem: "Usuário criado com sucesso!",
      usuario: { id: String(rows[0].id), nome, usuario: usuario.trim().toLowerCase(), perfil: perfil || 'tecnico', cargo: cargo || '' }
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ sucesso: false, erro: "Este nome de usuário já está em uso." });
    console.error("Erro ao criar usuário:", err.message);
    return res.status(500).json({ sucesso: false, erro: "Erro ao criar usuário: " + err.message });
  }
});

// Atualizar usuário
app.put("/api/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, usuario, cargo } = req.body;

  if (!nome || !usuario) {
    return res.status(400).json({ sucesso: false, erro: "Nome e usuário são obrigatórios." });
  }

  try {
    const check = await pool.query(`SELECT * FROM usuarios WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado." });

    await pool.query(`UPDATE usuarios SET nome = $1, usuario = $2, cargo = $3 WHERE id = $4`, [nome, usuario.trim().toLowerCase(), cargo || '', id]);
    res.json({ sucesso: true, mensagem: "Usuário atualizado com sucesso!" });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ sucesso: false, erro: "Este login já está sendo usado por outro usuário." });
    console.error("Erro ao atualizar usuário:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao atualizar usuário." });
  }
});

// Remover usuário
app.delete("/api/usuarios/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const check = await pool.query(`SELECT * FROM usuarios WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado." });
    if (check.rows[0].perfil === 'diretor') return res.status(403).json({ sucesso: false, erro: "O Diretor de TI não pode ser removido." });

    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id]);
    res.json({ sucesso: true, mensagem: "Usuário removido com sucesso!" });
  } catch (err) {
    console.error("Erro ao remover usuário:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao remover usuário." });
  }
});

// Redefinir senha
app.put("/api/usuarios/:id/senha", async (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;

  if (!senha || senha.length < 6) {
    return res.status(400).json({ sucesso: false, erro: "A senha deve ter no mínimo 6 caracteres." });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query(`UPDATE usuarios SET senha = $1 WHERE id = $2`, [senhaHash, id]);
    if (result.rowCount === 0) return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado." });
    res.json({ sucesso: true, mensagem: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error("Erro ao redefinir senha:", err);
    return res.status(500).json({ sucesso: false, erro: "Erro ao redefinir senha." });
  }
});

// Exporta para Vercel serverless
module.exports = app;

// Inicia servidor apenas localmente
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}