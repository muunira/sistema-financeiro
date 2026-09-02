// =====================================================================
// Módulo FINANCEIRO: pagar pedidos enviados pelo setor de Compras
// =====================================================================
import { esc, fmtDate, fmtMoney, statusBadge, toast, pageHeader, modalContent } from "./ui.js";
import { fetchPedidos, updatePedido, itensTexto, abrirComprovante } from "./pedidos.js";
import { supabase } from "./supabase.js";

let container, profile;
let abaAtiva = "pagar";

function mostrarAba(nome) {
  abaAtiva = nome;
  container.querySelectorAll("[data-sec]").forEach((s) => {
    s.style.display = s.dataset.sec === nome ? "block" : "none";
  });
  container.querySelectorAll("[data-tab]").forEach((b) => {
    b.className = b.dataset.tab === nome ? "btn btn-ok" : "btn";
  });
}

export async function render(el, prof, aba = "pagar") {
  container = el;
  profile = prof;
  abaAtiva = aba;
  const aPagar = await fetchPedidos(["aguardando_pagamento", "recebido"]);
  const todos = await fetchPedidos();
  draw(aPagar, todos);
}

const TITULO_FINANCEIRO = {
  pagar: "Aguardando pagamento",
  realizados: "Pagamentos realizados",
};

function draw(aPagar, todos) {
  const pagos = todos.filter((p) => ["pago", "concluido"].includes(p.status));
  const totalPago = pagos.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const titulo = TITULO_FINANCEIRO[abaAtiva] || "Financeiro";
  container.innerHTML = `
    ${pageHeader(titulo, "")}

    <section class="card" data-sec="pagar" style="display:none">
      <div class="card-head"><h3>Aguardando pagamento (${aPagar.length})</h3></div>
      ${aPagar.map(cardPedido).join("") || `<p class="muted">Nenhum pedido aguardando pagamento.</p>`}
    </section>

    <section class="card" data-sec="realizados" style="display:none">
      <div class="card-head"><h3>Pagamentos realizados · total ${fmtMoney(totalPago)}</h3></div>
      <table class="table">
        <thead><tr><th>#</th><th>Fornecedor</th><th>Valor</th><th>Forma</th><th>Status</th><th>Data</th><th>Comprovante</th></tr></thead>
        <tbody>
          ${todos.map((p) => `<tr data-detalhes="${p.id}" style="cursor:pointer">
            <td>${p.numero}</td><td>${esc(p.fornecedor || "-")}</td>
            <td>${fmtMoney(p.valor_pago || p.valor_estimado || 0)}</td>
            <td>${esc(p.forma_pagamento || "-")}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${fmtDate(p.data_pagamento || p.data_decisao || p.created_at)}</td>
            <td>${p.comprovante_path
              ? `<button class="btn-link" data-comprovante="${esc(p.comprovante_path)}">Ver comprovante</button>`
              : "-"}</td>
          </tr>`).join("") || `<tr><td colspan="7" class="muted">Nenhum pedido ainda.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  container.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => mostrarAba(b.dataset.tab)));
  container.querySelectorAll("form[data-pedido]").forEach((f) =>
    f.addEventListener("submit", (e) => pagar(e, f.dataset.pedido)));
  container.querySelectorAll("[data-detalhes]").forEach((r) =>
    r.addEventListener("click", (e) => {
      if (e.target.closest("[data-comprovante], [data-boleto]")) return;
      verDetalhesPagamento(r.dataset.detalhes);
    }));
  container.querySelectorAll("[data-comprovante]").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); abrirComprovante(b.dataset.comprovante); }));
  container.querySelectorAll("[data-boleto]").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); abrirBoleto(b.dataset.boleto); }));
  container.querySelectorAll("[data-relatorio]").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); gerarRelatorio((window.__aPagar || []).find((p) => p.id === b.dataset.relatorio)); }));

  window.__aPagar = aPagar;
  window.__pagos = todos;
  mostrarAba(abaAtiva);
}

function detalhesPagamento(p) {
  const forma = p.forma_pagamento || "-";
  if (forma === "Boleto") {
    return `<div><strong>Boleto:</strong> ${p.boleto_path
      ? `<button class="btn-link" data-boleto="${esc(p.boleto_path)}">Ver boleto</button>`
      : "Não anexado"}</div>`;
  }
  if (forma === "Transferência") {
    return `<div class="pagamento-detalhes">
      <div><strong>Banco:</strong> ${esc(p.banco || "-")}</div>
      <div><strong>Agência:</strong> ${esc(p.agencia || "-")}</div>
      <div><strong>Conta:</strong> ${esc(p.conta || "-")}</div>
      <div><strong>Razão social:</strong> ${esc(p.razao_social || "-")}</div>
      <div><strong>CPF/CNPJ:</strong> ${esc(p.cpf_cnpj || "-")}</div>
      <div><strong>PIX:</strong> ${esc(p.pix || "-")}</div>
    </div>`;
  }
  if (forma === "PIX") {
    return `<div><strong>Chave PIX:</strong> ${esc(p.pix || "-")}</div>`;
  }
  return `<div class="muted">Sem dados adicionais de pagamento.</div>`;
}

function cardPedido(p) {
  return `<div class="pedido-box">
    <div class="pedido-top">
      <strong>Pedido #${p.numero}</strong> ${statusBadge(p.status)}
      <span class="muted"> · aprovado em ${fmtDate(p.data_decisao)}</span>
    </div>
    <div class="pedido-itens"><strong>Itens:</strong> ${esc(itensTexto(p))}</div>
    <div><strong>Solicitante:</strong> ${esc(p.criador?.nome || "-")} (${esc(p.criador?.setor || "-")})</div>
    <div><strong>Fornecedor aprovado:</strong> ${esc(p.fornecedor || "-")} ·
         <strong>Valor aprovado:</strong> ${fmtMoney(p.valor_estimado)}</div>
    <div><strong>Forma de pagamento:</strong> ${esc(p.forma_pagamento || "-")}</div>
    ${detalhesPagamento(p)}
    <div style="margin-top:.8rem">
      <button type="button" class="btn" data-relatorio="${p.id}">Ver relatório de pagamento</button>
    </div>
    <form data-pedido="${p.id}" class="inline-form" style="margin-top:.8rem">
      <label>Valor pago (R$)
        <input name="valor" type="number" step="0.01" min="0" value="${p.valor_estimado ?? ""}" required />
      </label>
      <label>Comprovante (PDF/IMG, máx. 5MB)
        <input name="arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
      </label>
      <button type="submit" class="btn btn-ok">Registrar pagamento</button>
    </form>
  </div>`;
}

async function abrirBoleto(path) {
  try {
    const { data, error } = await supabase.storage.from("boletos").createSignedUrl(path, 120);
    if (error) throw error;
    window.open(data.signedUrl, "_blank");
  } catch (err) {
    toast("Não foi possível abrir o boleto: " + err.message, "error");
  }
}

function verDetalhesPagamento(id) {
  const p = (window.__pagos || []).find((x) => x.id === id);
  if (!p) return;
  const itens = (p.pedido_itens || []).map((i) => `<li>${esc(i.descricao)} — ${Number(i.quantidade)}</li>`).join("") || "<li class='muted'>Sem itens.</li>";
  const ehBoleto = p.forma_pagamento === "Boleto";
  const btnBoleto = ehBoleto && p.boleto_path
    ? `<button class="btn" data-boleto="${esc(p.boleto_path)}">Ver boleto</button>`
    : "";
  const btnDados = !ehBoleto
    ? `<button class="btn" data-dados="${p.id}">Ver dados de transferência</button>`
    : "";
  const btnComprovante = p.comprovante_path
    ? `<button class="btn" data-comprovante="${esc(p.comprovante_path)}">Ver comprovante de pagamento</button>`
    : "";
  const dadosTransferencia = !ehBoleto ? `
    <div data-sec-dados="${p.id}" style="display:none;margin-top:.8rem">
      <p><strong>Banco:</strong> ${esc(p.banco || "-")}</p>
      <p><strong>Agência:</strong> ${esc(p.agencia || "-")}</p>
      <p><strong>Conta:</strong> ${esc(p.conta || "-")}</p>
      <p><strong>Razão social:</strong> ${esc(p.razao_social || "-")}</p>
      <p><strong>CPF/CNPJ:</strong> ${esc(p.cpf_cnpj || "-")}</p>
      <p><strong>PIX:</strong> ${esc(p.pix || "-")}</p>
    </div>
  ` : "";
  const html = `
    <p><strong>Pedido:</strong> #${p.numero}</p>
    <p><strong>Nº solicitação:</strong> ${esc(p.numero_solicitacao || "-")}</p>
    <p><strong>Especificação:</strong> ${esc(p.tipo || "-")}</p>
    <p><strong>Centro de Custo / Local de Faturamento:</strong> ${esc(p.centro_custo || "-")}</p>
    <p><strong>Fornecedor:</strong> ${esc(p.fornecedor || "-")}</p>
    <p><strong>Valor pago:</strong> ${fmtMoney(p.valor_pago)}</p>
    <p><strong>Forma:</strong> ${esc(p.forma_pagamento || "-")}</p>
    <p><strong>Dias para pagar:</strong> ${p.dias_pagamento ?? "-"}</p>
    <p><strong>Pago em:</strong> ${fmtDate(p.data_pagamento)}</p>
    <p><strong>Comprador:</strong> ${esc(p.comprador?.nome || "-")}</p>
    <p><strong>Solicitante:</strong> ${esc(p.criador?.nome || "-")} (${esc(p.criador?.setor || "-")})</p>
    <h4 style="margin:.8rem 0 .2rem">Itens</h4>
    <ul class="item-list">${itens}</ul>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem">${btnBoleto}${btnDados}${btnComprovante}</div>
    ${dadosTransferencia}
  `;
  const overlay = modalContent(`Detalhes do pagamento #${p.numero}`, html);
  overlay.querySelector("[data-boleto]")?.addEventListener("click", (e) => { e.stopPropagation(); abrirBoleto(e.target.dataset.boleto); });
  overlay.querySelector("[data-comprovante]")?.addEventListener("click", (e) => { e.stopPropagation(); abrirComprovante(e.target.dataset.comprovante); });
  overlay.querySelector("[data-dados]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const el = overlay.querySelector(`[data-sec-dados="${p.id}"]`);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
  });
}

async function gerarRelatorio(p) {
  const itens = (p.pedido_itens || []).map((i) =>
    `<tr><td>${esc(i.descricao)}</td><td>${Number(i.quantidade)}</td></tr>`
  ).join("");
  const total = fmtMoney(p.valor_estimado);

  const pagamento = p.forma_pagamento === "Boleto"
    ? ""
    : `<div style="margin:1rem 0">
        <p><strong>Banco:</strong> ${esc(p.banco || "-")}</p>
        <p><strong>Agência:</strong> ${esc(p.agencia || "-")}</p>
        <p><strong>Conta:</strong> ${esc(p.conta || "-")}</p>
        <p><strong>Razão social:</strong> ${esc(p.razao_social || "-")}</p>
        <p><strong>CPF/CNPJ:</strong> ${esc(p.cpf_cnpj || "-")}</p>
        <p><strong>PIX:</strong> ${esc(p.pix || "-")}</p>
       </div>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Pagamento - Pedido #${p.numero}</title>
  <style>
    @page { size: A4; margin: 1.5cm; }
    body { font-family: Arial, sans-serif; padding: 2rem; color: #333; width: 210mm; min-height: 297mm; margin: 0 auto; box-sizing: border-box; }
    h1 { border-bottom: 2px solid #333; padding-bottom: .5rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: .5rem; text-align: left; }
    th { background: #f2f2f2; }
    .total { text-align: right; font-weight: bold; font-size: 1.2rem; margin-top: 1rem; }
    .section { margin: 1.5rem 0; }
    .linha { display: inline-block; border-bottom: 1px solid #333; width: 300px; }
    @media print { body { width: 100%; padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="padding:.5rem 1rem;font-size:1rem;cursor:pointer">Imprimir / Salvar PDF</button>
  <h1>Relatório de Pagamento</h1>
  <div class="section">
    <p><strong>Pedido:</strong> #${p.numero}</p>
    <p><strong>Nº solicitação:</strong> ${esc(p.numero_solicitacao || "-")}</p>
    <p><strong>Especificação:</strong> ${esc(p.tipo || "-")}</p>
    <p><strong>Centro de Custo / Local de Faturamento:</strong> ${esc(p.centro_custo || "-")}</p>
    <p><strong>Solicitante:</strong> ${esc(p.criador?.nome || "-")} (${esc(p.criador?.setor || "-")})</p>
    <p><strong>Comprador:</strong> ${esc(p.comprador?.nome || "-")}</p>
    <p><strong>Aprovado por</strong> ${esc(p.aprovador?.nome || "-")} <strong>em</strong> ${fmtDate(p.data_decisao)}</p>
  </div>

  <div class="section">
    <h2>Fornecedor escolhido</h2>
    <p><strong>Nome:</strong> ${esc(p.fornecedor || "-")}</p>
    <p><strong>Forma de pagamento:</strong> ${esc(p.forma_pagamento || "-")}</p>
    <p><strong>Dias para pagar:</strong> ${p.dias_pagamento ?? "-"}</p>
    <p><strong>Valor final:</strong> ${total}</p>
    ${pagamento}
  </div>

  <div class="section">
    <h2>Itens</h2>
    <table>
      <thead><tr><th>Item</th><th>Qtd</th></tr></thead>
      <tbody>${itens}</tbody>
    </table>
    <p class="total">Total: ${total}</p>
  </div>

  ${p.justificativa ? `<div class="section"><h2>Justificativa</h2><p>${esc(p.justificativa)}</p></div>` : ""}
  ${p.obs_compras ? `<div class="section"><h2>Observações</h2><p>${esc(p.obs_compras)}</p></div>` : ""}
</body>
</html>`;

  const janela = window.open("", `relatorio-${p.id}`, "width=800,height=600");
  if (janela) {
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
  }
}

async function pagar(e, id) {
  e.preventDefault();
  const f = e.target;
  const pedido = (window.__aPagar || []).find((p) => p.id === id);
  const file = f.arquivo.files[0];
  if (!file) return toast("Selecione o comprovante.", "error");
  if (file.size > 5 * 1024 * 1024) return toast("Arquivo deve ter no máximo 5MB.", "error");

  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${pedido.id}/${Date.now()}.${ext}`;

  try {
    const { error: upErr } = await supabase.storage
      .from("comprovantes")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) throw upErr;

    const novoStatus = pedido.status === "concluido" ? "concluido" : "pago";
    await updatePedido(pedido, {
      pago_por: profile.id,
      data_pagamento: new Date().toISOString(),
      valor_pago: Number(f.valor.value),
      comprovante_path: path,
    }, novoStatus, profile.id, `Comprovante: ${path}`);

    toast(`Pagamento do pedido #${pedido.numero} registrado.`);
    render(container, profile);
  } catch (err) {
    toast("Erro: " + err.message, "error");
  }
}
