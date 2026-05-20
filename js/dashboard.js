let acaoPendente = null;
let lixeiraAberta = false;

document.addEventListener('DOMContentLoaded', () => {
    const sessao = Auth.verificarSessao();
    if (!sessao) { window.location.href = 'login.html'; return; }
    if (sessao.perfil === 'usuario') { window.location.href = 'meus-chamados.html'; return; }

    renderizarHeaderUsuario(sessao);
    carregarDashboard();
    atualizarContadorLixeira();

    document.getElementById('filtroStatus').addEventListener('change', carregarDashboard);
    document.getElementById('filtroPrioridade').addEventListener('change', carregarDashboard);
    document.getElementById('filtroBusca').addEventListener('input', carregarDashboard);

    iniciarTempoReal();
});

function iniciarTempoReal() {
    // Polling a cada 5 segundos (compatível com serverless)
    setInterval(() => {
        carregarDashboard();
        atualizarContadorLixeira();
        if (lixeiraAberta) carregarLixeira();
    }, 5000);
}

function renderizarHeaderUsuario(sessao) {
    const nav = document.querySelector('.header-nav');
    if (!nav) return;

    const iniciais = gerarIniciais(sessao.nome);

    const rolesLabel = {
        diretor:     '👑 Diretor(a) de TI',
        estagiario:  '🎓 Estagiário(a)',
        usuario:     '👤 Usuário'
    };

    nav.innerHTML = `
        <a href="index.html" class="btn-nav">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Chamado
        </a>

        <div class="user-menu-wrapper" id="userMenuWrapper">
            <button class="user-menu-btn" id="userMenuBtn" onclick="toggleMenu()">
                <div class="user-menu-avatar">${iniciais}</div>
                <span class="user-menu-nome">${sessao.nome}</span>
                <svg class="user-menu-seta" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </button>

            <div class="user-dropdown" id="userDropdown">
                <div class="dropdown-perfil">
                    <div class="dropdown-perfil-topo">
                        <div class="dropdown-avatar-lg">${iniciais}</div>
                        <div class="dropdown-perfil-info">
                            <div class="dropdown-perfil-nome">${sessao.nome}</div>
                            <div class="dropdown-perfil-cargo">
                                ${sessao.setor || 'Equipe de TI'}
                            </div>
                        </div>
                    </div>
                    <div class="dropdown-perfil-role ${sessao.perfil === 'diretor' ? 'role-diretor' : ''}">
                        ${rolesLabel[sessao.perfil] || sessao.perfil}
                    </div>
                </div>

                <div class="dropdown-sessao">
                    <span class="dropdown-sessao-dot"></span>
                    Sessão ativa
                    <span class="dropdown-sessao-tempo" id="tempoSessao"></span>
                </div>

                <div class="dropdown-nav">
                    <a href="perfil.html" class="dropdown-nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        Meu Perfil
                    </a>
                    <a href="dashboard.html" class="dropdown-nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"/>
                            <rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/>
                            <rect x="14" y="14" width="7" height="7"/>
                        </svg>
                        Dashboard
                    </a>
                    <a href="admin.html" class="dropdown-nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        Gerenciar Usuários(as)
                    </a>
                </div>

                <div class="dropdown-logout-area">
                    <button class="dropdown-logout-btn" onclick="confirmarLogout()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Sair da Conta
                    </button>
                </div>
            </div>
        </div>
    `;

    document.addEventListener('click', fecharMenuFora);
    iniciarContadorSessao(sessao);
}

function toggleMenu() {
    const btn = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    if (!btn || !dropdown) return;
    const aberto = dropdown.classList.contains('aberto');
    btn.classList.toggle('aberto', !aberto);
    dropdown.classList.toggle('aberto', !aberto);
}

function fecharMenu() {
    document.getElementById('userMenuBtn')?.classList.remove('aberto');
    document.getElementById('userDropdown')?.classList.remove('aberto');
}

function fecharMenuFora(e) {
    const wrapper = document.getElementById('userMenuWrapper');
    if (wrapper && !wrapper.contains(e.target)) fecharMenu();
}

function confirmarLogout() {
    fecharMenu();
    const modal = document.getElementById('modalConfirmacaoStatus');
    const iconEl = modal.querySelector('.modal-confirmacao-icone');
    iconEl.textContent = '🚪';
    iconEl.style.background = '#fef2f2';
    iconEl.style.color = 'var(--danger)';
    modal.querySelector('.modal-confirmacao-titulo').textContent = 'Sair da Conta?';
    modal.querySelector('.modal-confirmacao-mensagem').innerHTML =
        'Você será <strong>desconectado(a)</strong> do sistema.';
    modal.querySelector('.modal-confirmacao-sub').textContent =
        'Precisará fazer login novamente para acessar o dashboard.';
    const btnConfirmar = modal.querySelector('.btn-confirmar-status');
    btnConfirmar.textContent = 'Sim, Sair';
    btnConfirmar.style.background = 'var(--danger)';
    btnConfirmar.onclick = () => Auth.logout();
    modal.classList.add('active');
}

function iniciarContadorSessao(sessao) {
    function atualizar() {
        const el = document.getElementById('tempoSessao');
        if (!el) return;
        const s = Auth.verificarSessao();
        if (!s) { Auth.logout(); return; }
        const restante = s.expira - Date.now();
        if (restante <= 0) { Auth.logout(); return; }
        const h = Math.floor(restante / 3600000);
        const m = Math.floor((restante % 3600000) / 60000);
        el.textContent = h > 0 ? `expira em ${h}h ${m}m` : `expira em ${m}m`;
    }
    atualizar();
    setInterval(atualizar, 60000);
}

async function getChamados() {
    try {
        const response = await fetch('/api/chamados');
        const data = await response.json();
        if (data.sucesso) {
            return data.chamados;
        }
        return [];
    } catch (error) {
        console.error('Erro ao buscar chamados:', error);
        return [];
    }
}

function salvarChamados(chamados) {
    // Não usado mais - dados são salvos no banco via API
}

async function carregarDashboard() {
    const chamados = await getChamados();
    atualizarEstatisticas(chamados);
    renderizarTabela(chamados);
}

function atualizarEstatisticas(chamados) {
    animarNumero('totalChamados', chamados.length);
    animarNumero('chamadosAbertos', chamados.filter(c => c.status === 'Aberto').length);
    animarNumero('chamadosAndamento', chamados.filter(c => c.status === 'Em Andamento').length);
    animarNumero('chamadosResolvidos', chamados.filter(c => c.status === 'Resolvido').length);
}

function animarNumero(id, valor) {
    const el = document.getElementById(id);
    if (!el || parseInt(el.textContent) === valor) return;
    el.textContent = valor;
    el.style.transform = 'scale(1.2)';
    el.style.transition = 'transform 0.3s ease';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 300);
}

function renderizarTabela(chamados) {
    let filtrados = ordenarPorPrioridade(aplicarFiltros(chamados));

    const abertos = filtrados.filter(c => c.status === 'Aberto');
    const andamento = filtrados.filter(c => c.status === 'Em Andamento');
    const resolvidos = filtrados.filter(c => c.status === 'Resolvido');

    renderizarSecao('Abertos', abertos);
    renderizarSecao('Andamento', andamento);
    renderizarSecao('Resolvidos', resolvidos);
}

function renderizarSecao(nome, lista) {
    const corpo = document.getElementById(`corpoTabela${nome}`);
    const table = document.getElementById(`table${nome}`);
    const empty = document.getElementById(`emptyState${nome}`);
    const count = document.getElementById(`count${nome}`);

    count.textContent = lista.length;

    if (lista.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
    } else {
        table.style.display = 'block';
        empty.style.display = 'none';
        corpo.innerHTML = '';
        lista.forEach(chamado => renderizarLinha(chamado, corpo));
    }
}

function renderizarLinha(chamado, corpo) {
    const tr = document.createElement('tr');
    if (chamado.prioridade === 'Crítica' && chamado.status !== 'Resolvido') {
        tr.className = 'prioridade-critica';
    }
    const displayId = chamado.numero || chamado.id;
    const displayData = chamado.data_hora || chamado.dataHora;
    tr.innerHTML = `
        <td><strong>#${displayId}</strong></td>
        <td>${getBadgePrioridade(chamado.prioridade)}</td>
        <td>${chamado.nome}</td>
        <td>${chamado.setor}</td>
        <td>${chamado.problema}</td>
        <td><div class="descricao-truncada" title="${escapeHtml(chamado.descricao)}">${escapeHtml(chamado.descricao)}</div></td>
        <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-light);">${displayData}</td>
        <td>${getBadgeStatus(chamado.status)}</td>
        <td>${renderizarAcoes(chamado)}</td>
    `;
    corpo.appendChild(tr);
}

function renderizarAcoes(chamado) {
    const { id, numero, status } = chamado;
    const displayId = numero || id;
    const transicoes = {
        'Aberto': `
            <button class="btn-acao btn-andamento" onclick="confirmarMudancaStatus('${displayId}','Em Andamento')">⚙ Iniciar</button>
            <button class="btn-acao btn-resolver" onclick="abrirModalFeedback('${displayId}')">✔ Resolver</button>`,
        'Em Andamento': `
            <button class="btn-acao btn-reverter" onclick="confirmarMudancaStatus('${displayId}','Aberto')">↩ Reverter</button>
            <button class="btn-acao btn-resolver" onclick="abrirModalFeedback('${displayId}')">✔ Resolver</button>`,
        'Resolvido': `
            <button class="btn-acao btn-reverter" onclick="confirmarMudancaStatus('${displayId}','Em Andamento')">↩ Reabrir</button>`
    };
    return `
        <div class="acoes-btns">
            <button class="btn-acao btn-ver" onclick="verDetalhes('${displayId}')">👁 Ver</button>
            ${transicoes[status] || ''}
            <button class="btn-acao btn-excluir" onclick="excluirChamado('${displayId}')">✕</button>
        </div>`;
}

const configTransicoes = {
    'Aberto|Em Andamento': {
        titulo: 'Iniciar Atendimento?',
        mensagem: 'O chamado <strong>#ID</strong> será marcado como <strong>Em Andamento</strong>.',
        sub: 'Você poderá reverter clicando em "Reverter".',
        icone: '⚙', corIcone: 'var(--warning)', corFundo: 'var(--warning-bg)',
        txtBtn: 'Sim, Iniciar', corBtn: 'var(--warning)'
    },
    'Em Andamento|Aberto': {
        titulo: 'Reverter para Aberto?',
        mensagem: 'O chamado <strong>#ID</strong> voltará ao status <strong>Aberto</strong>.',
        sub: 'Use se clicou em "Iniciar" por engano.',
        icone: '↩', corIcone: 'var(--info)', corFundo: 'var(--info-bg)',
        txtBtn: 'Sim, Reverter', corBtn: 'var(--info)'
    },
    'Resolvido|Em Andamento': {
        titulo: 'Reabrir Chamado?',
        mensagem: 'O chamado <strong>#ID</strong> voltará ao status <strong>Em Andamento</strong>.',
        sub: 'Use se o problema não foi totalmente resolvido.',
        icone: '↩', corIcone: 'var(--info)', corFundo: 'var(--info-bg)',
        txtBtn: 'Sim, Reabrir', corBtn: 'var(--info)'
    }
};

async function confirmarMudancaStatus(id, novoStatus) {
    const chamados = await getChamados();
    const chamado = chamados.find(c => c.numero === id || c.id === id);
    if (!chamado) return;
    const config = configTransicoes[`${chamado.status}|${novoStatus}`];
    if (!config) return;

    acaoPendente = { id, novoStatus };

    const modal = document.getElementById('modalConfirmacaoStatus');
    const iconEl = modal.querySelector('.modal-confirmacao-icone');
    iconEl.textContent = config.icone;
    iconEl.style.background = config.corFundo;
    iconEl.style.color = config.corIcone;

    modal.querySelector('.modal-confirmacao-titulo').textContent = config.titulo;
    modal.querySelector('.modal-confirmacao-mensagem').innerHTML = config.mensagem.replace('ID', id);
    modal.querySelector('.modal-confirmacao-sub').textContent = config.sub;

    // Mostrar campo de prazo apenas ao iniciar atendimento
    const prazoContainer = document.getElementById('prazoContainer');
    const prazoInput = document.getElementById('prazoResolucao');
    if (novoStatus === 'Em Andamento' && chamado.status === 'Aberto') {
        prazoContainer.style.display = 'block';
        prazoInput.value = '';
    } else {
        prazoContainer.style.display = 'none';
        prazoInput.value = '';
    }

    const btnConfirmar = modal.querySelector('.btn-confirmar-status');
    btnConfirmar.textContent = config.txtBtn;
    btnConfirmar.style.background = config.corBtn;
    btnConfirmar.onclick = confirmarAcaoStatus;

    modal.classList.add('active');
}

function confirmarAcaoStatus() {
    if (!acaoPendente) return;
    const { id, novoStatus } = acaoPendente;
    const prazoInput = document.getElementById('prazoResolucao');
    const prazo = prazoInput ? prazoInput.value : '';
    mudarStatus(id, novoStatus, prazo);
    fecharModalConfirmacao();
    const msgs = {
        'Aberto': '↩ Chamado revertido para Aberto.',
        'Em Andamento': '⚙ Chamado iniciado!',
        'Resolvido': '✔ Chamado resolvido!'
    };
    const tipos = { 'Aberto': 'info', 'Em Andamento': 'warning', 'Resolvido': 'success' };
    mostrarToast(msgs[novoStatus] || 'Atualizado.', tipos[novoStatus] || 'info');
}

function fecharModalConfirmacao() {
    document.getElementById('modalConfirmacaoStatus').classList.remove('active');
    acaoPendente = null;
}

async function mudarStatus(id, novoStatus, prazo) {
    try {
        const chamados = await getChamados();
        const chamado = chamados.find(c => c.numero === id || c.id === id);
        if (!chamado) {
            mostrarToast('Chamado não encontrado.', 'error');
            return;
        }
        const body = { status: novoStatus };
        if (prazo) body.prazo_resolucao = prazo;
        const response = await fetch(`/api/chamados/${chamado.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (data.sucesso) {
            carregarDashboard();
        } else {
            mostrarToast('Erro ao atualizar status: ' + data.erro, 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        mostrarToast('Erro ao atualizar status. Tente novamente.', 'error');
    }
}

async function excluirChamado(id) {
    if (!confirm(`Excluir chamado #${id}?\nEssa ação não pode ser desfeita.`)) return;
    try {
        const chamados = await getChamados();
        const chamado = chamados.find(c => c.numero === id || c.id === id);
        if (!chamado) {
            mostrarToast('Chamado não encontrado.', 'error');
            return;
        }
        const response = await fetch(`/api/chamados/${chamado.id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.sucesso) {
            carregarDashboard();
            mostrarToast(`🗑 Chamado #${id} excluído.`, 'error');
        } else {
            mostrarToast('Erro ao excluir: ' + data.erro, 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir chamado:', error);
        mostrarToast('Erro ao excluir chamado. Tente novamente.', 'error');
    }
}

function mostrarToast(mensagem, tipo = 'success') {
    const anterior = document.getElementById('toastFeedback');
    if (anterior) anterior.remove();
    const cores = { success: '#10b981', warning: '#d97706', info: '#3b82f6', error: '#ef4444' };
    const toast = document.createElement('div');
    toast.id = 'toastFeedback';
    toast.style.cssText = `
        position:fixed; bottom:2rem; right:2rem; background:${cores[tipo] || cores.success};
        color:white; padding:14px 22px; border-radius:10px; font-size:0.9rem;
        font-weight:600; font-family:'Inter',sans-serif; box-shadow:0 8px 25px rgba(0,0,0,0.2);
        z-index:9999; max-width:340px; animation:slideInToast .4s cubic-bezier(.34,1.56,.64,1);
    `;
    toast.textContent = mensagem;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutToast .3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

async function verDetalhes(id) {
    const chamados = await getChamados();
    const chamado = chamados.find(c => c.numero === id || c.id === id);
    if (!chamado) return;
    document.getElementById('detalheNumero').textContent = `#${chamado.numero}`;
    document.getElementById('detalheNome').textContent = chamado.nome;
    document.getElementById('detalheSetor').textContent = chamado.setor;
    document.getElementById('detalheProblema').textContent = chamado.problema;
    document.getElementById('detalhePrioridade').innerHTML = getBadgePrioridade(chamado.prioridade);
    function formatarBrasilia(data) {
    if (!data) return '—';

    // Se vier no formato BR: 19/05/2026, 15:10:37
function formatarBrasilia(data) {
    if (!data) return '—';

    try {

        // Se vier no formato brasileiro
        if (typeof data === 'string' && data.includes('/')) {

            const partes = data.split(' ');

            const dataParte = partes[0].replace(',', '');
            const horaParte = partes[1];

            const [dia, mes, ano] = dataParte.split('/');
            const [hora, minuto, segundo = '00'] = horaParte.split(':');

            const d = new Date(Date.UTC(
                Number(ano),
                Number(mes) - 1,
                Number(dia),
                Number(hora),
                Number(minuto),
                Number(segundo)
            ));

            return new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(d);
        }

        // Outros formatos
        const d = new Date(data);

        if (isNaN(d.getTime())) return '—';

        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(d);

    } catch {
        return '—';
    }
}

    const d = new Date(valor);

    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(d);
}

    const d = new Date(data);

    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(d);
}   

    document.getElementById('detalheData').textContent = formatarBrasilia(chamado.data_hora);
    document.getElementById('detalheUltimaAtt').textContent = formatarBrasilia(chamado.atualizado_em);
    document.getElementById('detalheStatus').innerHTML = getBadgeStatus(chamado.status);
    document.getElementById('detalheDescricao').textContent = chamado.descricao;

    const prazoSection = document.getElementById('detalhePrazoSection');
    const prazoEl = document.getElementById('detalhePrazo');
    if (chamado.prazo_resolucao) {
        prazoSection.style.display = 'block';
        const d = new Date(chamado.prazo_resolucao);
        prazoEl.textContent = d.toLocaleString('pt-BR');
    } else {
        prazoSection.style.display = 'none';
    }

    const feedbackSection = document.getElementById('detalheFeedbackSection');
    const feedbackEl = document.getElementById('detalheFeedback');
    if (chamado.feedback) {
        feedbackSection.style.display = 'block';
        feedbackEl.textContent = chamado.feedback;
    } else {
        feedbackSection.style.display = 'none';
    }

    document.getElementById('modalDetalhes').classList.add('active');

// ================================================================
// FEEDBACK AO RESOLVER
// ================================================================
let chamadoParaFeedback = null;

function abrirModalFeedback(id) {
    chamadoParaFeedback = id;
    document.getElementById('feedbackChamadoId').textContent = `#${id}`;
    document.getElementById('feedbackTexto').value = '';
    document.getElementById('modalFeedback').classList.add('active');
}

function fecharModalFeedback() {
    chamadoParaFeedback = null;
    document.getElementById('modalFeedback').classList.remove('active');
}

async function enviarFeedbackEResolver() {
    if (!chamadoParaFeedback) return;
    const feedback = document.getElementById('feedbackTexto').value.trim();

    const chamados = await getChamados();
    const chamado = chamados.find(c => c.numero === chamadoParaFeedback || c.id === chamadoParaFeedback);
    if (!chamado) { fecharModalFeedback(); return; }

    try {
        const response = await fetch(`/api/chamados/${chamado.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Resolvido', feedback: feedback || null })
        });
        const data = await response.json();
        if (data.sucesso) {
            carregarDashboard();
            mostrarToast('✔ Chamado resolvido com feedback!', 'success');
        } else {
            mostrarToast('Erro: ' + data.erro, 'error');
        }
    } catch (error) {
        mostrarToast('Erro ao resolver chamado.', 'error');
    }
    fecharModalFeedback();
}

function fecharModalDetalhes() {
    document.getElementById('modalDetalhes').classList.remove('active');
}

function aplicarFiltros(chamados) {
    const status = document.getElementById('filtroStatus').value;
    const prioridade = document.getElementById('filtroPrioridade').value;
    const busca = document.getElementById('filtroBusca').value.toLowerCase().trim();
    return chamados.filter(c => {
        return (status === 'todos' || c.status === status)
            && (prioridade === 'todos' || c.prioridade === prioridade)
            && (!busca || (c.nome || '').toLowerCase().includes(busca)
                || (c.setor || '').toLowerCase().includes(busca)
                || (c.problema || '').toLowerCase().includes(busca)
                || (c.descricao || '').toLowerCase().includes(busca)
                || (c.numero || '').toString().includes(busca));
    });
}

function ordenarPorPrioridade(chamados) {
    const oP = { 'Crítica': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 };
    const oS = { 'Aberto': 0, 'Em Andamento': 1, 'Resolvido': 2 };
    return [...chamados].sort((a, b) => {
        const ds = oS[a.status] - oS[b.status];
        if (ds !== 0) return ds;
        const dp = oP[a.prioridade] - oP[b.prioridade];
        if (dp !== 0) return dp;
        return b.timestamp - a.timestamp;
    });
}

function getBadgePrioridade(p) {
    const cls = { 'Crítica': 'badge-critica', 'Alta': 'badge-alta', 'Média': 'badge-media', 'Baixa': 'badge-baixa' };
    return `<span class="badge ${cls[p]}"><span class="dot-badge"></span>${p}</span>`;
}

function getBadgeStatus(s) {
    const cls = { 'Aberto': 'aberto', 'Em Andamento': 'andamento', 'Resolvido': 'resolvido' };
    return `<span class="badge-status ${cls[s]}">${s}</span>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function gerarIniciais(nome) {
    return nome.split(' ').filter(p => p).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

document.getElementById('modalDetalhes')?.addEventListener('click', e => {
    if (e.target.id === 'modalDetalhes') fecharModalDetalhes();
});
document.getElementById('modalConfirmacaoStatus')?.addEventListener('click', e => {
    if (e.target.id === 'modalConfirmacaoStatus') fecharModalConfirmacao();
});
document.getElementById('modalFeedback')?.addEventListener('click', e => {
    if (e.target.id === 'modalFeedback') fecharModalFeedback();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { fecharMenu(); fecharModalDetalhes(); fecharModalConfirmacao(); fecharModalFeedback(); }
});

// ================================================================
// LIXEIRA DE CHAMADOS
// ================================================================

async function atualizarContadorLixeira() {
    try {
        const response = await fetch('/api/chamados/lixeira');
        const data = await response.json();
        if (data.sucesso) {
            const total = data.chamados.length;
            const badge = document.getElementById('lixeiraBadge');
            const contador = document.getElementById('lixeiraContador');
            if (badge) badge.textContent = total;
            if (contador) contador.textContent = `${total} chamado${total !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        console.error('Erro ao contar lixeira:', error);
    }
}

function toggleLixeira() {
    const section = document.getElementById('lixeiraSection');
    if (!section) return;
    lixeiraAberta = !lixeiraAberta;
    section.style.display = lixeiraAberta ? 'block' : 'none';
    if (lixeiraAberta) carregarLixeira();
}

async function carregarLixeira() {
    try {
        const response = await fetch('/api/chamados/lixeira');
        const data = await response.json();
        if (!data.sucesso) return;

        const chamados = data.chamados;
        const corpo = document.getElementById('corpoLixeira');
        const tableWrapper = document.getElementById('lixeiraTableWrapper');
        const vazia = document.getElementById('lixeiraVazia');

        atualizarContadorLixeira();

        if (chamados.length === 0) {
            tableWrapper.style.display = 'none';
            vazia.style.display = 'block';
            return;
        }

        tableWrapper.style.display = 'block';
        vazia.style.display = 'none';
        corpo.innerHTML = '';

        chamados.forEach(chamado => {
            const displayId = chamado.numero || chamado.id;
            const excData = new Date(chamado.excluido_em);
            const expiraData = new Date(excData.getTime() + 30 * 24 * 60 * 60 * 1000);
            const diasRestantes = Math.max(0, Math.ceil((expiraData - Date.now()) / (24 * 60 * 60 * 1000)));

            const tr = document.createElement('tr');
            tr.style.opacity = '0.7';
            tr.innerHTML = `
                <td><strong>#${displayId}</strong></td>
                <td>${getBadgePrioridade(chamado.prioridade)}</td>
                <td>${chamado.nome}</td>
                <td>${chamado.setor}</td>
                <td>${chamado.problema}</td>
                <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-light);">${excData.toLocaleString('pt-BR')}</td>
                <td style="white-space:nowrap; font-size:0.8rem;">
                    <span style="color:${diasRestantes <= 7 ? 'var(--danger)' : 'var(--text-light)'}; font-weight:${diasRestantes <= 7 ? '600' : '400'}">
                        ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}
                    </span>
                </td>
                <td>
                    <div class="acoes-btns">
                        <button class="btn-acao btn-andamento" onclick="restaurarChamado(${chamado.id}, '${displayId}')">↩ Restaurar</button>
                        <button class="btn-acao btn-excluir" onclick="excluirPermanente(${chamado.id}, '${displayId}')">✕ Excluir</button>
                    </div>
                </td>
            `;
            corpo.appendChild(tr);
        });
    } catch (error) {
        console.error('Erro ao carregar lixeira:', error);
    }
}

async function restaurarChamado(id, numero) {
    try {
        const response = await fetch(`/api/chamados/${id}/restaurar`, { method: 'PUT' });
        const data = await response.json();
        if (data.sucesso) {
            carregarDashboard();
            carregarLixeira();
            mostrarToast(`↩ Chamado #${numero} restaurado!`, 'success');
        } else {
            mostrarToast('Erro: ' + data.erro, 'error');
        }
    } catch (error) {
        console.error('Erro ao restaurar:', error);
        mostrarToast('Erro ao restaurar chamado.', 'error');
    }
}

async function excluirPermanente(id, numero) {
    if (!confirm(`Excluir PERMANENTEMENTE o chamado #${numero}?\n\nEssa ação NÃO pode ser desfeita!`)) return;
    try {
        const response = await fetch(`/api/chamados/${id}/permanente`, { method: 'DELETE' });
        const data = await response.json();
        if (data.sucesso) {
            carregarLixeira();
            mostrarToast(`🗑 Chamado #${numero} excluído permanentemente.`, 'error');
        } else {
            mostrarToast('Erro: ' + data.erro, 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir permanentemente:', error);
        mostrarToast('Erro ao excluir chamado.', 'error');
    }
}