// =====================================================================
// Módulo ZERAR PEDIDOS: acesso restrito ao admin
// =====================================================================
import { supabase } from "./supabase.js";
import { esc, toast, pageHeader, confirmDialog } from "./ui.js";

let container, profile;

export async function render(el, prof) {
  container = el;
  profile = prof;
  draw();
}

function draw(mensagem = null) {
  container.innerHTML = `
    ${pageHeader("Zerar pedidos", "Use com cautela: apaga todos os pedidos, itens, cotações, histórico e arquivos.")}

    <section class="card">
      <div class="card-head"><h3>Limpar dados de pedidos</h3></div>
      <p>Esta ação irá:</p>
      <ul>
        <li>Apagar <strong>todos os pedidos</strong> do banco;</li>
        <li>Apagar itens, cotações e histórico de status associados;</li>
        <li>Apagar os arquivos dos buckets <strong>boletos</strong>, <strong>comprovantes</strong> e <strong>cotacoes</strong>;</li>
        <li>Resetar a numeração dos pedidos para começar em <strong>#1</strong>;</li>
      </ul>
      <p class="muted">⚠️ Não é reversível. Faça backup antes se necessário.</p>

      <label style="display:flex;align-items:center;gap:.5rem;margin:1rem 0">
        <input type="checkbox" id="chk-confirma" style="width:auto" />
        <span>Entendo que todos os dados de pedidos serão apagados.</span>
      </label>

      <div class="actions">
        <button class="btn btn-danger" id="btn-zerar" disabled>Zerar pedidos e arquivos</button>
      </div>
      ${mensagem ? `<p class="muted">${esc(mensagem)}</p>` : ""}
    </section>
  `;

  const chk = container.querySelector("#chk-confirma");
  const btn = container.querySelector("#btn-zerar");
  chk.addEventListener("change", () => { btn.disabled = !chk.checked; });
  btn.addEventListener("click", zerar);
}

async function zerar() {
  const chk = container.querySelector("#chk-confirma");
  if (!chk?.checked) return toast("Marque a confirmação para prosseguir.", "error");

  const ok = await confirmDialog(
    "Zerar todos os pedidos",
    "Tem certeza? Esta ação apagará permanentemente todos os pedidos, itens, cotações, histórico, arquivos e resetará a numeração."
  );
  if (!ok) return;

  try {
    const { error: rpcError } = await supabase.rpc("limpar_pedidos");
    if (rpcError) throw rpcError;

    // Limpa os três buckets
    const buckets = ["boletos", "comprovantes", "cotacoes"];
    for (const bucket of buckets) {
      await limparBucket(bucket);
    }

    toast("Pedidos e arquivos zerados com sucesso. A numeração recomeçará em #1.");
    draw("Pedidos zerados. Recarregue a página para começar novos testes.");
  } catch (err) {
    toast("Erro ao zerar: " + err.message, "error");
  }
}

async function limparBucket(bucket) {
  const paths = await listarPaths(bucket);
  if (!paths.length) return;

  // O remove aceita no máximo 100 por chamada
  const chunk = 100;
  for (let i = 0; i < paths.length; i += chunk) {
    const slice = paths.slice(i, i + chunk);
    const { error } = await supabase.storage.from(bucket).remove(slice);
    if (error) {
      console.error(`Erro ao remover arquivos de ${bucket}:`, error);
      throw error;
    }
  }
}

async function listarPaths(bucket, path = "") {
  const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000 });
  if (error) {
    // Se a pasta não existir, ignora
    if (error.message?.includes("Not found")) return [];
    throw error;
  }

  let files = [];
  for (const item of data || []) {
    const itemPath = path ? `${path}/${item.name}` : item.name;
    if (item.metadata) {
      // É um arquivo
      files.push(itemPath);
    } else {
      // É uma pasta (prefixo) — lista recursivamente
      const nested = await listarPaths(bucket, itemPath);
      files = files.concat(nested);
    }
  }
  return files;
}
