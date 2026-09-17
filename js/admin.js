// =====================================================================
// Módulo ADMIN: gestão de usuários (criar, ativar/desativar, mudar papel)
// =====================================================================
import { supabase, createIsolatedClient, ROLE_LABELS, SETORES } from "./supabase.js";
import { esc, fmtDate, toast, pageHeader, confirmDialog } from "./ui.js";
import { setorLogin, toLoginEmail, LOGIN_DOMAIN } from "./auth.js";

let container, profile;

export async function render(el, prof) {
  container = el;
  profile = prof;
  const users = await loadUsers();
  draw(users);
}

async function loadUsers() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw error;
  return data || [];
}

function roleOptions(selected, allowAdmin = false) {
  const ocultos = ["estoque", "compras"];
  if (!allowAdmin) ocultos.push("admin");
  return Object.entries(ROLE_LABELS)
    .filter(([v]) => !ocultos.includes(v))
    .map(([v, l]) => `<option value="${v}" ${v === selected ? "selected" : ""}>${l}</option>`)
    .join("");
}

function setorOptions(selected) {
  return ['<option value="">-- selecione --</option>']
    .concat(SETORES.map((s) => `<option value="${esc(s)}" ${s === selected ? "selected" : ""}>${esc(s)}</option>`))
    .join("");
}

function draw(users) {
  const bloquearAdmin = profile.role !== "admin";

  container.innerHTML = `
    ${pageHeader("Usuários", "Crie e gerencie os acessos do sistema")}

    <section class="card">
      <div class="card-head"><h3>Criar novo usuário</h3></div>
      <form id="form-user" class="inline-form">
        <label>Nome<input name="nome" required /></label>
        <label>Setor<select name="setor" required>${setorOptions("")}</select></label>
        <label>Login<input name="email" type="text" autocapitalize="none" spellcheck="false" placeholder="selecione o setor" required /></label>
        <label>Senha inicial<input name="senha" type="password" minlength="6" required /></label>
        <label>Papel<select name="role">${roleOptions("estoque_compras", true)}</select></label>
        <button type="submit" class="btn">Criar usuário</button>
      </form>
      <p class="muted">O login segue o padrão <code>setor@${LOGIN_DOMAIN}</code> e é preenchido automaticamente ao escolher o setor. Se o setor já tiver um login, acrescente um número (ex.: <code>compras2@${LOGIN_DOMAIN}</code>). O usuário poderá alterar a senha depois; guarde a senha inicial para repassá-la.</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>Usuários cadastrados (${users.length})</h3></div>
      <p class="muted">Para trocar o login de qualquer usuário, edite o campo e clique em <strong>Salvar</strong> (ou pressione Enter). Digitar apenas o setor completa <code>@${LOGIN_DOMAIN}</code> automaticamente.</p>
      <table class="table">
        <thead><tr><th>Nome</th><th>Setor</th><th>Login</th><th>Papel</th><th>Status</th><th>Criado</th><th></th></tr></thead>
        <tbody>
          ${users.map(rowUser).join("")}
        </tbody>
      </table>
    </section>
  `;

  const formUser = container.querySelector("#form-user");
  formUser.addEventListener("submit", criarUsuario);
  formUser.setor.addEventListener("change", () => {
    formUser.email.value = setorLogin(formUser.setor.value);
  });
  container.querySelectorAll("select[data-role]").forEach((s) =>
    s.addEventListener("change", () => mudarRole(s.dataset.role, s.value)));
  container.querySelectorAll("select[data-setor]").forEach((s) =>
    s.addEventListener("change", () => mudarSetor(s.dataset.setor, s.value)));
  container.querySelectorAll("[data-salvar-login]").forEach((b) =>
    b.addEventListener("click", () => salvarLogin(b.dataset.salvarLogin)));
  container.querySelectorAll("input[data-login]").forEach((i) =>
    i.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); salvarLogin(i.dataset.login); }
    }));
  container.querySelectorAll("[data-toggle]").forEach((b) =>
    b.addEventListener("click", () => toggleAtivo(b.dataset.toggle, b.dataset.ativo === "true")));
  container.querySelectorAll("[data-excluir]").forEach((b) =>
    b.addEventListener("click", () => excluirUsuario(b.dataset.excluir, b.dataset.nome)));
}

function rowUser(u) {
  const isSelf = u.id === profile.id;
  return `<tr class="${u.ativo ? "" : "row-muted"}">
    <td>${esc(u.nome)} ${isSelf ? "<span class='muted'>(você)</span>" : ""}</td>
    <td><select data-setor="${u.id}">${setorOptions(u.setor || "")}</select></td>
    <td class="cell-login">
      <input type="text" data-login="${u.id}" value="${esc(u.email || "")}" autocapitalize="none" spellcheck="false" />
      <button class="btn-link" data-salvar-login="${u.id}">Salvar</button>
    </td>
    <td><select data-role="${u.id}" ${u.role === "admin" ? "disabled" : ""}>${u.role === "admin" ? `<option value="admin" selected>Administrador</option>` : roleOptions(u.role, false)}</select></td>
    <td>${u.ativo ? "<span class='badge badge-aprovado'>Ativo</span>" : "<span class='badge badge-rejeitado'>Inativo</span>"}</td>
    <td>${fmtDate(u.created_at)}</td>
    <td>${isSelf || u.role === "admin" ? "" : `<button class="btn-link" data-toggle="${u.id}" data-ativo="${u.ativo}">${u.ativo ? "Desativar" : "Ativar"}</button> ${u.ativo ? "" : `<button class="btn-link" data-excluir="${u.id}" data-nome="${esc(u.nome)}">Excluir</button>`}`}</td>
  </tr>`;
}

async function criarUsuario(e) {
  e.preventDefault();
  const f = e.target;
  const nome = f.nome.value.trim();
  const setor = f.setor.value;
  const email = toLoginEmail(f.email.value);
  const senha = f.senha.value;
  const role = f.role.value;

  if (!setor) return toast("Selecione o setor.", "error");
  if (!email) return toast("Informe o login.", "error");


  // Usa um cliente isolado para não derrubar a sessão do admin
  const iso = createIsolatedClient();
  const { data, error } = await iso.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, role, setor } },
  });
  if (error) return toast("Erro ao criar: " + error.message, "error");

  // Garante que o perfil foi criado/atualizado com os dados corretos
  const userId = data?.user?.id;
  if (userId) {
    const { error: e2 } = await supabase.from("profiles").upsert({
      id: userId,
      nome,
      email,
      role,
      setor,
      ativo: true,
    }, { onConflict: "id" });
    if (e2) console.error("Erro ao salvar perfil:", e2);
  }

  toast(`Usuário ${nome} criado com o login ${email}. Repasse a senha inicial.`);
  f.reset();
  render(container, profile);
}

async function salvarLogin(id) {
  const input = container.querySelector(`input[data-login="${id}"]`);
  if (!input) return;
  const email = toLoginEmail(input.value);
  if (!email) return toast("Informe o login.", "error");
  input.value = email;

  const btn = container.querySelector(`[data-salvar-login="${id}"]`);
  if (btn) btn.disabled = true;
  try {
    const { error, data } = await supabase.functions.invoke("update-user-login", {
      body: { user_id: id, email },
    });
    if (error || data?.error) throw new Error(data?.error || error.message);
    toast(`Login atualizado para ${email}.`);
    if (id === profile.id) profile.email = email;
    render(container, profile);
  } catch (err) {
    toast("Erro ao atualizar login: " + err.message, "error");
    if (btn) btn.disabled = false;
  }
}

async function mudarRole(id, role) {
  if (role === "admin") return toast("O papel Administrador não pode ser atribuído.", "error");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return toast("Erro: " + error.message, "error");
  toast("Papel atualizado.");
}

async function mudarSetor(id, setor) {
  const { error } = await supabase.from("profiles").update({ setor: setor || null }).eq("id", id);
  if (error) return toast("Erro: " + error.message, "error");
  toast("Setor atualizado.");
}

async function toggleAtivo(id, ativoAtual) {
  const user = (await supabase.from("profiles").select("role").eq("id", id).single()).data;
  if (user?.role === "admin") return toast("O usuário administrador não pode ser desativado.", "error");
  const { error } = await supabase.from("profiles").update({ ativo: !ativoAtual }).eq("id", id);
  if (error) return toast("Erro: " + error.message, "error");
  toast(ativoAtual ? "Usuário desativado." : "Usuário ativado.");
  render(container, profile);
}

async function excluirUsuario(id, nome) {
  const ok = await confirmDialog("Excluir usuário", `Tem certeza que deseja excluir "${nome}" permanentemente? O mesmo login poderá ser usado novamente.`);
  if (!ok) return;
  try {
    const { error, data } = await supabase.functions.invoke("delete-user", {
      body: { user_id: id },
    });
    if (error || data?.error) throw new Error(data?.error || error.message);
    toast(`Usuário "${nome}" excluído.`);
    render(container, profile);
  } catch (err) {
    toast("Erro ao excluir: " + err.message, "error");
  }
}
