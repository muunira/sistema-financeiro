(function() {
    let ultimosChamadosIds = [];

    function tocarSomNotificacao() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    }

    function mostrarNotificacaoGlobal(mensagem) {
        const anterior = document.getElementById('notificacaoGlobal');
        if (anterior) anterior.remove();

        const toast = document.createElement('div');
        toast.id = 'notificacaoGlobal';
        toast.style.cssText = `
            position:fixed; bottom:2rem; right:2rem; background:#3b82f6;
            color:white; padding:14px 22px; border-radius:10px; font-size:0.9rem;
            font-weight:600; font-family:'Inter',sans-serif; box-shadow:0 8px 25px rgba(0,0,0,0.2);
            z-index:99999; max-width:380px; animation:slideInToast .4s cubic-bezier(.34,1.56,.64,1);
            cursor:pointer;
        `;
        toast.textContent = mensagem;
        toast.onclick = () => {
            window.location.href = 'dashboard.html';
        };
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutToast .3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    async function verificarNovosChamados() {
        try {
            const resp = await fetch('/api/chamados');
            const data = await resp.json();
            if (!data.sucesso) return;

            const idsAtuais = data.chamados.map(c => c.id);

            if (ultimosChamadosIds.length > 0) {
                const novos = data.chamados.filter(c => !ultimosChamadosIds.includes(c.id));
                novos.forEach(chamado => {
                    tocarSomNotificacao();
                    mostrarNotificacaoGlobal(`🆕 Novo chamado #${chamado.numero} - ${chamado.problema}`);
                });
            }

            ultimosChamadosIds = idsAtuais;
        } catch(e) {
            console.warn('Erro ao verificar novos chamados:', e);
        }
    }

    function iniciarNotificacoes() {
        const sessao = localStorage.getItem('ti_sessao');
        if (!sessao) return;

        try {
            const dados = JSON.parse(sessao);
            if (!dados || !dados.usuario) return;
        } catch(e) { return; }

        // Polling a cada 5 segundos
        verificarNovosChamados();
        setInterval(verificarNovosChamados, 5000);
    }

    document.addEventListener('DOMContentLoaded', iniciarNotificacoes);
})();
