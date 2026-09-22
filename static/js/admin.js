document.addEventListener("DOMContentLoaded", function() {

    // ==========================================
    // 1. CANCELAMENTO DE AGENDAMENTOS (TABELA)
    // ==========================================
    const botoesCancelar = document.querySelectorAll(".btn-cancelar-admin");
    
    botoesCancelar.forEach(botao => {
        botao.addEventListener("click", function() {
            const agendamentoId = this.getAttribute("data-id");
            
            if (confirm("Deseja realmente cancelar este agendamento pelo painel administrativo?")) {
                fetch('/cancelar-agendamento', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: agendamentoId })
                })
                .then(resposta => resposta.json())
                .then(dados => {
                    if (dados.status === "sucesso") {
                        alert("Agendamento cancelado com sucesso!");
                        window.location.reload();
                    } else {
                        alert("Erro ao cancelar: " + dados.mensagem);
                    }
                })
                .catch(erro => alert("Erro ao se comunicar com o servidor."));
            }
        });
    });

    // ==========================================
    // 2. GERENCIAMENTO DE DIAS E EXCEÇÕES
    // ==========================================
    const listaExcecoes = document.getElementById('lista-excecoes');
    const btnSalvarFixos = document.getElementById('btn-salvar-fixos');
    const btnAddExcecao = document.getElementById('btn-add-excecao');

    // Carrega as configurações do Python ao abrir a página
    function carregarConfiguracoes() {
        fetch('/admin/config-agenda')
            .then(res => res.json())
            .then(dados => {
                // Marca os checkboxes dos dias fixos
                if(document.getElementById('check-domingo')) {
                    document.getElementById('check-domingo').checked = dados.dias_fechados.includes(0);
                    document.getElementById('check-segunda').checked = dados.dias_fechados.includes(1);
                    document.getElementById('check-terca').checked = dados.dias_fechados.includes(2);
                }

                // Renderiza a lista de regras/exceções
                if(listaExcecoes) {
                    listaExcecoes.innerHTML = '';
                    for (const [data, tipo] of Object.entries(dados.excecoes)) {
                        const li = document.createElement('li');
                        li.className = 'item-regra';
                        
                        const dataFormatada = data.split('-').reverse().join('/');
                        const iconeTexto = tipo === 'fechado' ? '🔴 Fechado (Feriado/Bloqueio)' : '🟢 Aberto (Exceção/Extra)';
                        
                        li.innerHTML = `
                            <span>📅 <b>${dataFormatada}</b> - ${iconeTexto}</span>
                            <button class="btn-remover" data-data="${data}">X Remover</button>
                        `;
                        listaExcecoes.appendChild(li);
                    }
                }
            })
            .catch(erro => console.error("Erro ao carregar configurações de agenda.", erro));
    }

    // Salvar dias da semana fixos
    if (btnSalvarFixos) {
        btnSalvarFixos.addEventListener('click', () => {
            const diasFechados = [];
            if(document.getElementById('check-domingo').checked) diasFechados.push(0);
            if(document.getElementById('check-segunda').checked) diasFechados.push(1);
            if(document.getElementById('check-terca').checked) diasFechados.push(2);

            fetch('/admin/salvar-dias-fixos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dias_fechados: diasFechados })
            })
            .then(res => res.json())
            .then(() => alert("Dias fixos atualizados com sucesso!"))
            .catch(() => alert("Erro ao salvar dias fixos."));
        });
    }

    // Adicionar regra/exceção específica
    if (btnAddExcecao) {
        btnAddExcecao.addEventListener('click', () => {
            const dataInput = document.getElementById('data-excecao').value;
            const tipoInput = document.getElementById('tipo-excecao').value;
            
            if(!dataInput) {
                alert("Escolha uma data no calendário!");
                return;
            }

            fetch('/admin/add-excecao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: dataInput, tipo: tipoInput })
            })
            .then(res => res.json())
            .then(() => {
                document.getElementById('data-excecao').value = '';
                carregarConfiguracoes();
            })
            .catch(() => alert("Erro ao adicionar a regra."));
        });
    }

    // Remover regra (Delegação de Eventos para os botões gerados dinamicamente)
    if (listaExcecoes) {
        listaExcecoes.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('btn-remover')) {
                const dataParaRemover = e.target.getAttribute('data-data');
                
                fetch('/admin/remover-excecao', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: dataParaRemover })
                })
                .then(res => res.json())
                .then(() => carregarConfiguracoes())
                .catch(() => alert("Erro ao remover a regra."));
            }
        });
    }

    // Inicializa a tela
    carregarConfiguracoes();
});