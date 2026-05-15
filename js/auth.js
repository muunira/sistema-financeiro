const Auth = (() => {

    const KEYS = {
        USUARIOS: 'ti_usuarios',
        SESSAO: 'ti_sessao'
    };

    function init() {
    const usuarios = getUsuarios();
    if (usuarios.length === 0) {
        const diretor = {
            id: 'USR0001',
            nome: 'Gustavo TI',
            usuario: 'gustavo.ti',
            senha: hashSenha('Admin@2024'),
            perfil: 'gustavo',
            cargo: 'Diretor(a) de TI',
            criadoEm: new Date().toLocaleString('pt-BR'),
            bloqueado: false
        };
        salvarUsuarios([diretor]);
    }
}

    function hashSenha(senha) {
        let hash = 0;
        const str = senha + 'ti_salt_2024';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'h_' + Math.abs(hash).toString(36) + '_' + btoa(senha).replace(/=/g, '');
    }

    async function getUsuarios() {
        try {
            const response = await fetch('/api/usuarios');
            const data = await response.json();
            if (data.sucesso) {
                return data.usuarios;
            }
            return [];
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            return [];
        }
    }

    function salvarUsuarios(usuarios) {
        // Não usado mais - dados são salvos no banco via API
    }

    function gerarIdUsuario() {
        // Não usado mais - ID é gerado pelo banco
        return '';
    }

    async function login(usuario, senha) {
    const alertaErro = document.getElementById('alertaErro');
    const alertaSucesso = document.getElementById('alertaSucesso');
    const msgErro = document.getElementById('msgErro');
    const btn = document.getElementById('btnLogin');

    btn.disabled = true;
    btn.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Verificando...
    `;

    try {
        const resposta = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                usuario,
                senha
            })
        });

        const dados = await resposta.json();

        if (!dados.sucesso) {
            alertaErro.style.display = 'flex';
            alertaSucesso.style.display = 'none';
            msgErro.textContent = dados.erro || 'Usuário(a) ou senha incorretos.';

            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Entrar
            `;
            return;
        }

        const sessao = {
            id: dados.usuario.id,
            nome: dados.usuario.nome,
            usuario: dados.usuario.usuario,
            perfil: dados.usuario.perfil,
            cargo: dados.usuario.cargo,
            loginEm: new Date().toLocaleString('pt-BR'),
            expira: Date.now() + (8 * 60 * 60 * 1000)
        };

        localStorage.setItem(KEYS.SESSAO, JSON.stringify(sessao));

        alertaErro.style.display = 'none';
        alertaSucesso.style.display = 'flex';

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);

    } catch (error) {
        alertaErro.style.display = 'flex';
        alertaSucesso.style.display = 'none';
        msgErro.textContent = 'Erro ao conectar com o servidor.';

        btn.disabled = false;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Entrar
        `;
    }
}

    function logout() {
        localStorage.removeItem(KEYS.SESSAO);
        window.location.href = 'login.html';
    }

    function verificarSessao() {
        const data = localStorage.getItem(KEYS.SESSAO);
        if (!data) return null;
        const sessao = JSON.parse(data);
        if (Date.now() > sessao.expira) {
            localStorage.removeItem(KEYS.SESSAO);
            return null;
        }
        return sessao;
    }

    function protegerPagina(apenasAdmin = false) {
        const sessao = verificarSessao();
        if (!sessao) {
            window.location.href = 'login.html';
            return null;
        }
        // Removida a restrição: qualquer perfil logado acessa tudo
        return sessao;
    }

    async function criarUsuario(dados) {
        const { nome, usuario, senha, cargo, perfil } = dados;

        if (senha.length < 6) {
            return { sucesso: false, msg: 'A senha deve ter no mínimo 6 caracteres.' };
        }

        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nome, usuario, senha, cargo, perfil })
            });
            const data = await response.json();
            if (data.sucesso) {
                return { sucesso: true, msg: data.mensagem };
            } else {
                return { sucesso: false, msg: data.erro };
            }
        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            return { sucesso: false, msg: 'Erro ao criar usuário. Tente novamente.' };
        }
    }

    async function removerUsuario(id) {
        try {
            const response = await fetch(`/api/usuarios/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.sucesso) {
                return { sucesso: true, msg: data.mensagem };
            } else {
                return { sucesso: false, msg: data.erro };
            }
        } catch (error) {
            console.error('Erro ao remover usuário:', error);
            return { sucesso: false, msg: 'Erro ao remover usuário. Tente novamente.' };
        }
    }

    async function redefinirSenha(id, novaSenha) {
        if (novaSenha.length < 6) {
            return { sucesso: false, msg: 'A senha deve ter no mínimo 6 caracteres.' };
        }
        try {
            const response = await fetch(`/api/usuarios/${id}/senha`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ senha: novaSenha })
            });
            const data = await response.json();
            if (data.sucesso) {
                return { sucesso: true, msg: data.mensagem };
            } else {
                return { sucesso: false, msg: data.erro };
            }
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            return { sucesso: false, msg: 'Erro ao redefinir senha. Tente novamente.' };
        }
    }

    // init() removido - usuário padrão é criado no servidor

// ─── Editar usuário ───────────────────────────────────────────────
async function editarUsuario(id, dados) {
    // Validar nome
    if (!dados.nome || dados.nome.trim().length < 2) {
        return { sucesso: false, msg: 'O nome deve ter no mínimo 2 caracteres.' };
    }

    // Validar login
    if (!dados.usuario || dados.usuario.trim().length < 3) {
        return { sucesso: false, msg: 'O login deve ter no mínimo 3 caracteres.' };
    }

    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome: dados.nome, usuario: dados.usuario, cargo: dados.cargo })
        });
        const data = await response.json();
        if (data.sucesso) {
            // Atualizar sessão se o usuário editado for o logado
            const sessao = verificarSessao();
            if (sessao && sessao.id === id) {
                sessao.nome = dados.nome.trim();
                sessao.usuario = dados.usuario.trim().toLowerCase();
                sessao.cargo = dados.cargo || '';
                localStorage.setItem(KEYS.SESSAO, JSON.stringify(sessao));
            }
            return { sucesso: true, msg: data.mensagem };
        } else {
            return { sucesso: false, msg: data.erro };
        }
    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        return { sucesso: false, msg: 'Erro ao editar usuário. Tente novamente.' };
    }
}

    return {
        login, logout, verificarSessao, protegerPagina,
        getUsuarios, criarUsuario, removerUsuario, redefinirSenha,
        editarUsuario    // ← NOVO
    };
})();

const styleAuth = document.createElement('style');
styleAuth.textContent = `
    .spin { width:20px; height:20px; animation:giro .8s linear infinite; }
    @keyframes giro { to { transform:rotate(360deg); } }
`;
document.head.appendChild(styleAuth);