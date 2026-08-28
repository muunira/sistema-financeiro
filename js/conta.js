// =====================================================================
// Módulo MINHA CONTA: trocar a própria senha e ajustar o nome
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, toast, pageHeader } from "./ui.js";

let container, profile;

export async function render(el, prof) {
  container = el;
  profile = prof;
  draw();
}

function draw() {
  container.innerHTML = `
    ${pageHeader("Minha conta", "Atualize seus dados de acesso")}

    <section class="card">
      <div class="card-head"><h3>Meus dados</h3></div>
      <form id="form-nome" class="inline-form">
        <label>Nome<input name="nome" value="${esc(profile.nome)}" required /></label>
        <label>E-mail<input name="email" type="email" value="${esc(profile.email)}" required /></label>
        <button type="submit" class="btn">Salvar dados</button>
      </form>
      <p class="muted">A alteração de e-mail pode exigir confirmação por e-mail.</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>Trocar senha</h3></div>
      <form id="form-senha" class="inline-form">
        <label>Nova senha<input name="senha" type="password" minlength="6" required /></label>
        <label>Confirmar senha<input name="senha2" type="password" minlength="6" required /></label>
        <button type="submit" class="btn">Alterar senha</button>
      </form>
      <p class="muted">A senha deve ter pelo menos 6 caracteres.</p>
    </section>
  `;

  container.querySelector("#form-nome").addEventListener("submit", salvarDados);
  container.querySelector("#form-senha").addEventListener("submit", trocarSenha);
}

async function salvarDados(e) {
  e.preventDefault();
  const nome = e.target.nome.value.trim();
  const email = e.target.email.value.trim();
  if (!nome) return toast("Informe o nome.", "error");
  if (!email) return toast("Informe o e-mail.", "error");

  const { error: e1 } = await supabase.from("profiles").update({ nome, email }).eq("id", profile.id);
  if (e1) return toast("Erro: " + e1.message, "error");

  if (email !== profile.email) {
    const { error: e2 } = await supabase.auth.updateUser({ email });
    if (e2) return toast("Erro ao atualizar e-mail no auth: " + e2.message, "error");
  }

  profile.nome = nome;
  profile.email = email;

  const meta = document.querySelector("#user-info .user-meta strong");
  const avatar = document.querySelector("#user-info .avatar");
  if (meta) meta.textContent = nome;
  if (avatar) {
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    avatar.textContent = (parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] || "?").slice(0, 2)).toUpperCase();
  }
  toast("Dados atualizados.");
}

async function trocarSenha(e) {
  e.preventDefault();
  const f = e.target;
  if (f.senha.value !== f.senha2.value) {
    return toast("As senhas não conferem.", "error");
  }
  const { error } = await supabase.auth.updateUser({ password: f.senha.value });
  if (error) return toast("Erro: " + error.message, "error");
  f.reset();
  toast("Senha alterada com sucesso.");
}
