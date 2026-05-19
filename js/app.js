document.addEventListener('DOMContentLoaded', () => {
    const sessao = Auth.verificarSessao();
    if (!sessao) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('formChamado').addEventListener('submit', enviarChamado);
    mostrarMeusChamados();
    renderizarHeaderIndex();

    const nomeInput = document.getElementById('nome');
    if (nomeInput && sessao.nome) {
        nomeInput.value = sessao.nome;
    }
    const emailInput = document.getElementById('emailChamado');
    if (emailInput && sessao.email) {
        emailInput.value = sessao.email;
    }
    const setorInput = document.getElementById('setor');
    if (setorInput && sessao.setor) {
        setorInput.value = sessao.setor;
    }
});

function renderizarHeaderIndex() {
    const nav = document.querySelector('.header nav');
    if (!nav) return;

    const sessao = Auth.verificarSessao();

    if (sessao) {
        const iniciais = sessao.nome.split(' ').filter(p => p).slice(0, 2).map(p => p[0].toUpperCase()).join('');

        const rolesLabel = {
            diretor:     '👑 Diretor(a) de TI',
            estagiario:  '🎓 Estagiário(a)',
            usuario:     '👤 Usuário'
        };

        const navLink = sessao.perfil === 'usuario'
            ? `<a href="meus-chamados.html" class="btn-nav">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                Meus Chamados
            </a>`
            : `<a href="dashboard.html" class="btn-nav">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                </svg>
                Dashboard TI
            </a>`;

        nav.innerHTML = `
            ${navLink}

            <div class="user-menu-wrapper" id="userMenuWrapper">
                <button class="user-menu-btn" id="userMenuBtn" onclick="toggleMenuIndex()">
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
                                    ${sessao.setor || 'Usuário'}
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
                    </div>

                    <div class="dropdown-nav">
                        <a href="perfil.html" class="dropdown-nav-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                            Meu Perfil
                        </a>
                        ${sessao.perfil === 'usuario' ? `
                        <a href="meus-chamados.html" class="dropdown-nav-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            Meus Chamados
                        </a>
                        ` : `
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
                        `}
                    </div>

                    <div class="dropdown-logout-area">
                        <button class="dropdown-logout-btn" onclick="Auth.logout()">
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
}

function toggleMenuIndex() {
    const btn = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    if (!btn || !dropdown) return;
    const aberto = dropdown.classList.contains('aberto');
    btn.classList.toggle('aberto', !aberto);
    dropdown.classList.toggle('aberto', !aberto);
}

async function enviarChamado(e) {
    e.preventDefault();

    const sessao = Auth.verificarSessao();
    const nome = document.getElementById('nome').value.trim();
    const emailChamado = document.getElementById('emailChamado').value.trim();
    const setor = document.getElementById('setor').value;
    const problema = document.getElementById('problema').value;
    const prioridade = document.querySelector('input[name="prioridade"]:checked');
    const descricao = document.getElementById('descricao').value.trim();

    if (!nome || !setor || !problema || !prioridade || !descricao) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    const numero = await gerarNumeroChamado();

    const chamado = {
        numero: numero,
        nome: nome,
        email: emailChamado,
        setor: setor,
        problema: problema,
        prioridade: prioridade.value,
        descricao: descricao,
        status: 'Aberto',
        data_hora: new Date().toLocaleString('pt-BR'),
        timestamp: Date.now(),
        usuario_id: sessao ? sessao.id : null
    };

    await salvarChamado(chamado);

    document.getElementById('numeroChamado').textContent = `#${numero}`;
    document.getElementById('modalSucesso').classList.add('active');
    document.getElementById('formChamado').reset();
    if (sessao && sessao.nome) document.getElementById('nome').value = sessao.nome;
    if (sessao && sessao.email) document.getElementById('emailChamado').value = sessao.email;
    if (sessao && sessao.setor) document.getElementById('setor').value = sessao.setor;
    mostrarMeusChamados();
}

async function gerarNumeroChamado() {
    try {
        const response = await fetch('/api/chamados/proximo-numero');
        const data = await response.json();
        if (data.sucesso) {
            return data.numero;
        }
        return '0001';
    } catch (error) {
        console.error('Erro ao gerar número:', error);
        return '0001';
    }
}

async function salvarChamado(chamado) {
    try {
        const response = await fetch('/api/chamados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chamado)
        });
        const data = await response.json();
        if (!data.sucesso) {
            console.error('Erro ao salvar chamado:', data.erro);
            alert('Erro ao salvar chamado: ' + data.erro);
        }
    } catch (error) {
        console.error('Erro ao salvar chamado:', error);
        alert('Erro ao salvar chamado. Tente novamente.');
    }
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

function fecharModal() {
    document.getElementById('modalSucesso').classList.remove('active');
}

async function mostrarMeusChamados() {
    const chamados = await getChamados();
    const container = document.getElementById('meusChamadosContainer');
    const lista = document.getElementById('listaMeusChamados');

    if (chamados.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    lista.innerHTML = '';

    chamados.slice(-5).reverse().forEach(chamado => {
        const item = document.createElement('div');
        item.className = 'meu-chamado-item';
        item.innerHTML = `
            <div class="meu-chamado-info">
                <strong>#${chamado.numero}</strong>
                <span>${chamado.problema}</span>
                <span class="badge-status ${getStatusClass(chamado.status)}">${chamado.status}</span>
            </div>
            <span style="font-size:0.8rem; color:var(--text-light);">${chamado.data_hora}</span>
        `;
        lista.appendChild(item);
    });
}

function getStatusClass(status) {
    const map = { 'Aberto': 'aberto', 'Em Andamento': 'andamento', 'Resolvido': 'resolvido' };
    return map[status] || '';
}

document.getElementById('modalSucesso').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalSucesso')) fecharModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
});