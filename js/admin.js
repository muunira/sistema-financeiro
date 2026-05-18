let usuarioParaEditar = null;
let usuarioParaEditarDados = null;

document.addEventListener('DOMContentLoaded', () => {
    const sessao = Auth.protegerPagina();
    if (!sessao) return;
    if (sessao.perfil === 'usuario') { window.location.href = 'meus-chamados.html'; return; }

    renderizarUserInfo(sessao);
    renderizarUsuarios();

    document.getElementById('formNovoUsuario').addEventListener('submit', (e) => {
        e.preventDefault();
        criarUsuario();
    });

    document.getElementById('formEditarUsuario').addEventListener('submit', (e) => {
        e.preventDefault();
        salvarEdicaoUsuario();
    });
});

// ================================================================
// HEADER COM MENU DROPDOWN
// ================================================================

function renderizarUserInfo(sessao) {
    const headerNav = document.querySelector('.header-nav');
    if (!headerNav) return;

    const iniciais = sessao.nome.split(' ').filter(p => p).slice(0, 2).map(p => p[0].toUpperCase()).join('');

    const rolesLabel = {
        diretor:     '👑 Diretor(a) de TI',
        estagiario:  '🎓 Estagiário(a)',
        usuario:     '👤 Usuário'
    };

    headerNav.innerHTML = `
        <a href="dashboard.html" class="btn-nav">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
            </svg>
            Dashboard
        </a>

        <div class="user-menu-wrapper" id="userMenuWrapper">
            <button class="user-menu-btn" id="userMenuBtn" onclick="toggleMenuAdmin()">
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
                            <div class="dropdown-perfil-cargo">${sessao.setor || 'Equipe de TI'}</div>
                        </div>
                    </div>
                    <div class="dropdown-perfil-role ${sessao.perfil === 'diretor' ? 'role-diretor' : ''}">
                        ${rolesLabel[sessao.perfil] || sessao.perfil}
                    </div>
                </div>

                <div class="dropdown-sessao">
                    <span class="dropdown-sessao-dot"></span>
                    Sessão ativa
                </div>

                <div class="dropdown-nav">
                    <a href="perfil.html" class="dropdown-nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        Meu Perfil
                    </a>
                    <a href="index.html" class="dropdown-nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Abrir Novo Chamado
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
                    <button class="dropdown-logout-btn" onclick="confirmarLogoutAdmin()">
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

    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('userMenuWrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            document.getElementById('userMenuBtn')?.classList.remove('aberto');
            document.getElementById('userDropdown')?.classList.remove('aberto');
        }
    });
}

function toggleMenuAdmin() {
    const btn = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    if (!btn || !dropdown) return;
    const aberto = dropdown.classList.contains('aberto');
    btn.classList.toggle('aberto', !aberto);
    dropdown.classList.toggle('aberto', !aberto);
}

function confirmarLogoutAdmin() {
    document.getElementById('userMenuBtn')?.classList.remove('aberto');
    document.getElementById('userDropdown')?.classList.remove('aberto');

    const modal = document.getElementById('modalConfirmacaoStatus');
    const iconEl = modal.querySelector('.modal-confirmacao-icone');
    iconEl.textContent = '🚪';
    iconEl.style.background = '#fef2f2';
    iconEl.style.color = 'var(--danger)';
    modal.querySelector('.modal-confirmacao-titulo').textContent = 'Sair da Conta?';
    modal.querySelector('.modal-confirmacao-mensagem').innerHTML =
        'Você será <strong>desconectado(a)</strong> do sistema.';
    modal.querySelector('.modal-confirmacao-sub').textContent =
        'Precisará fazer login novamente.';

    const btn = document.getElementById('btnConfirmarAdmin');
    btn.textContent = 'Sim, Sair';
    btn.style.background = 'var(--danger)';
    btn.onclick = () => Auth.logout();

    modal.classList.add('active');
}

function fecharModalConfirmacaoAdmin() {
    document.getElementById('modalConfirmacaoStatus').classList.remove('active');
}

// ================================================================
// LISTA DE USUÁRIOS
// ================================================================

async function renderizarUsuarios() {
    const usuarios = await Auth.getUsuarios();
    const container = document.getElementById('listaUsuarios');
    const total = document.getElementById('totalUsuarios');

    total.textContent = usuarios.length;
    container.innerHTML = '';

    usuarios.forEach(usuario => {
        container.appendChild(criarCardUsuario(usuario));
    });
}

function criarCardUsuario(usuario) {
    const div = document.createElement('div');
    div.className = `usuario-card ${usuario.perfil === 'diretor' ? 'diretor-card' : ''}`;

    const iniciais = usuario.nome.split(' ').filter(p => p).slice(0, 2).map(p => p[0].toUpperCase()).join('');
    const isDiretor = usuario.perfil === 'diretor';

    const perfilLabels = {
        diretor:     '👑 Diretor(a)',
        estagiario:  '🎓 Estagiário(a)',
        usuario:     '👤 Usuário'
    };

    div.innerHTML = `
        <div class="usuario-card-header">
            <div class="usuario-avatar">${iniciais}</div>
            <div class="usuario-info">
                <strong>${usuario.nome}</strong>
                <span>@${usuario.usuario}</span>
            </div>
            <span class="perfil-badge perfil-${usuario.perfil}">
                ${perfilLabels[usuario.perfil] || usuario.perfil}
            </span>
        </div>
        <div class="usuario-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
            </svg>
            ${usuario.email || 'Sem e-mail'}
        </div>
        <div class="usuario-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Criado(a) em ${usuario.criadoEm}
        </div>
        <div class="usuario-acoes">
            <button class="btn-acao-sm btn-editar"
                onclick="abrirModalEditar('${usuario.id}')">
                ✏️ Editar
            </button>
            <button class="btn-acao-sm btn-editar-senha"
                onclick="abrirModalSenha('${usuario.id}', '${escapeAttr(usuario.nome)}')">
                🔑 Senha
            </button>
            ${!isDiretor ? `
                <button class="btn-acao-sm btn-remover"
                    onclick="removerUsuario('${usuario.id}', '${escapeAttr(usuario.nome)}')">
                    🗑 Remover
                </button>
            ` : `<span class="lock-icon">🔒 Protegido(a)</span>`}
        </div>
    `;

    return div;
}

// ================================================================
// CRIAR USUÁRIO
// ================================================================

async function criarUsuario() {
    const nome = document.getElementById('novoNome').value.trim();
    const usuario = document.getElementById('novoUsuario').value.trim();
    const senha = document.getElementById('novaSenha').value;
    const email = document.getElementById('novoEmail').value.trim();
    const perfil = document.getElementById('novoPerfil').value;

    const erroCadastro = document.getElementById('alertaErroCadastro');
    const sucessoCadastro = document.getElementById('alertaSucessoCadastro');
    const msgErro = document.getElementById('msgErroCadastro');
    const msgSucesso = document.getElementById('msgSucessoCadastro');

    erroCadastro.style.display = 'none';
    sucessoCadastro.style.display = 'none';

    if (!nome || !usuario || !senha) {
        erroCadastro.style.display = 'flex';
        msgErro.textContent = 'Preencha todos os campos obrigatórios.';
        return;
    }

    const resultado = await Auth.criarUsuario({ nome, usuario, senha, perfil, email });

    if (!resultado.sucesso) {
        erroCadastro.style.display = 'flex';
        msgErro.textContent = resultado.msg;
        return;
    }

    sucessoCadastro.style.display = 'flex';
    msgSucesso.textContent = resultado.msg;

    document.getElementById('formNovoUsuario').reset();
    renderizarUsuarios();

    setTimeout(() => { sucessoCadastro.style.display = 'none'; }, 4000);
}

// ================================================================
// EDITAR USUÁRIO(A)
// ================================================================

async function abrirModalEditar(id) {
    const usuarios = await Auth.getUsuarios();
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;

    usuarioParaEditarDados = id;

    document.getElementById('editarId').value = usuario.id;
    document.getElementById('editarNome').value = usuario.nome;
    document.getElementById('editarLogin').value = usuario.usuario;
    document.getElementById('editarEmail').value = usuario.email || '';

    document.getElementById('alertaErroEdicao').style.display = 'none';

    document.getElementById('modalEditarUsuario').classList.add('active');

    setTimeout(() => {
        document.getElementById('editarNome').focus();
        document.getElementById('editarNome').select();
    }, 300);
}

function fecharModalEditar() {
    usuarioParaEditarDados = null;
    document.getElementById('modalEditarUsuario').classList.remove('active');
    document.getElementById('alertaErroEdicao').style.display = 'none';
}

async function salvarEdicaoUsuario() {
    if (!usuarioParaEditarDados) return;

    const nome = document.getElementById('editarNome').value.trim();
    const login = document.getElementById('editarLogin').value.trim();
    const email = document.getElementById('editarEmail').value.trim();

    const erroEl = document.getElementById('alertaErroEdicao');
    const msgErro = document.getElementById('msgErroEdicao');

    erroEl.style.display = 'none';

    if (!nome || !login) {
        erroEl.style.display = 'flex';
        msgErro.textContent = 'Nome e login são obrigatórios.';
        return;
    }

    const resultado = await Auth.editarUsuario(usuarioParaEditarDados, {
        nome: nome,
        usuario: login,
        email: email
    });

    if (!resultado.sucesso) {
        erroEl.style.display = 'flex';
        msgErro.textContent = resultado.msg;
        return;
    }

    fecharModalEditar();
    renderizarUsuarios();

    const sessao = Auth.verificarSessao();
    if (sessao) renderizarUserInfo(sessao);

    mostrarToastAdmin('✅ ' + resultado.msg, 'success');
}

// ================================================================
// REMOVER USUÁRIO
// ================================================================

async function removerUsuario(id, nome) {
    if (!confirm(`Deseja remover "${nome}"?\nEle(a) perderá o acesso imediatamente.`)) return;
    const resultado = await Auth.removerUsuario(id);
    if (!resultado.sucesso) { alert(resultado.msg); return; }
    renderizarUsuarios();
    mostrarToastAdmin('🗑 Usuário(a) removido(a) com sucesso.', 'error');
}

// ================================================================
// REDEFINIR SENHA
// ================================================================

function abrirModalSenha(id, nome) {
    usuarioParaEditar = id;
    document.getElementById('editarUsuarioNome').textContent = nome;
    document.getElementById('novaSenhaEdicao').value = '';
    document.getElementById('modalEditarSenha').classList.add('active');
}

function fecharModalSenha() {
    usuarioParaEditar = null;
    document.getElementById('modalEditarSenha').classList.remove('active');
}

async function salvarNovaSenha() {
    const novaSenha = document.getElementById('novaSenhaEdicao').value;
    const resultado = await Auth.redefinirSenha(usuarioParaEditar, novaSenha);
    if (!resultado.sucesso) { alert(resultado.msg); return; }
    fecharModalSenha();
    mostrarToastAdmin('🔑 ' + resultado.msg, 'success');
}

// ================================================================
// TOAST PARA ADMIN
// ================================================================

function mostrarToastAdmin(mensagem, tipo = 'success') {
    const anterior = document.getElementById('toastAdmin');
    if (anterior) anterior.remove();

    const cores = {
        success: '#10b981',
        warning: '#d97706',
        info: '#3b82f6',
        error: '#ef4444'
    };

    const toast = document.createElement('div');
    toast.id = 'toastAdmin';
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${cores[tipo] || cores.success};
        color: white;
        padding: 14px 22px;
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        max-width: 340px;
        animation: slideInToast 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    toast.textContent = mensagem;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutToast 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ================================================================
// UTILITÁRIOS
// ================================================================

function toggleSenhaCadastro() {
    const input = document.getElementById('novaSenha');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

document.getElementById('modalEditarSenha')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalEditarSenha') fecharModalSenha();
});

document.getElementById('modalEditarUsuario')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalEditarUsuario') fecharModalEditar();
});

document.getElementById('modalConfirmacaoStatus')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalConfirmacaoStatus') fecharModalConfirmacaoAdmin();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharModalSenha();
        fecharModalEditar();
        fecharModalConfirmacaoAdmin();
    }
});