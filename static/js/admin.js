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
    const checkSabado = document.getElementById('check-sabado');
    const selectSabado = document.getElementById('opcao-sabado');

    // Carrega as configurações do Python ao abrir a página
    function carregarConfiguracoes() {
        fetch('/admin/config-agenda')
            .then(res => res.json())
            .then(dados => {
                // TRAVA DE SEGURANÇA: Se 'dias_fechados' não existir no JSON, cria uma lista vazia
                const diasFechadosSalvos = dados.dias_fechados || []; 
                
                // Marca os checkboxes corretamente (compara números e converte textos para garantir)
                const checkboxesDias = document.querySelectorAll('.check-dia');
                checkboxesDias.forEach(chk => {
                    chk.checked = diasFechadosSalvos.some(dia => parseInt(dia) === parseInt(chk.value));
                });
                if (checkSabado && selectSabado) {
                    // Restaura a configuração salva
                    if (diasFechadosSalvos.includes(6)) {
                        selectSabado.classList.remove('escondido');
                        selectSabado.value = dados.regra_sabado || 'dia_todo';
                    }
                    
                    // Mostra/esconde o select ao clicar no checkbox do sábado
                    checkSabado.addEventListener('change', function() {
                        if (this.checked) {
                            selectSabado.classList.remove('escondido');
                        } else {
                            selectSabado.classList.add('escondido');
                        }
                    });
                }
                // Renderiza a lista de regras/exceções
                if (listaExcecoes) {
                    listaExcecoes.innerHTML = '';
                    const excecoesSalvas = dados.excecoes || {}; // Trava de segurança para exceções
                    
                    for (const [data, tipo] of Object.entries(excecoesSalvas)) {
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
            // Pega TODOS os checkboxes marcados na tela
            document.querySelectorAll('.check-dia:checked').forEach(chk => {
                diasFechados.push(parseInt(chk.value));
            });

            const textoOriginal = btnSalvarFixos.innerText;
            btnSalvarFixos.innerText = "Salvando...";
            btnSalvarFixos.disabled = true;

            // Pega o valor do select do sábado
            const regraSabado = document.getElementById('opcao-sabado') ? document.getElementById('opcao-sabado').value : 'dia_todo';

            fetch('/admin/salvar-dias-fixos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Envia a lista e a regra juntas
                body: JSON.stringify({ dias_fechados: diasFechados, regra_sabado: regraSabado }) 
            })
            .then(res => res.json())
            .then(dados => {
                if(dados.status === "sucesso") {
                    alert("Dias fixos atualizados com sucesso!");
                } else {
                    alert("Erro ao salvar: " + dados.mensagem);
                }
                btnSalvarFixos.innerText = textoOriginal;
                btnSalvarFixos.disabled = false;
            })
            .catch(() => {
                alert("Erro de conexão ao tentar salvar os dias fixos.");
                btnSalvarFixos.innerText = textoOriginal;
                btnSalvarFixos.disabled = false;
            });
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

            const textoOriginal = btnAddExcecao.innerText;
            btnAddExcecao.innerText = "Adicionando...";
            btnAddExcecao.disabled = true;

            fetch('/admin/add-excecao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: dataInput, tipo: tipoInput })
            })
            .then(res => res.json())
            .then(dados => {
                if (dados.status === "sucesso") {
                    document.getElementById('data-excecao').value = '';
                    carregarConfiguracoes(); 
                    alert("Nova regra salva com sucesso!");
                } else {
                    alert("Erro: " + dados.mensagem);
                }
                btnAddExcecao.innerText = textoOriginal;
                btnAddExcecao.disabled = false;
            })
            .catch(() => {
                alert("Erro de conexão ao adicionar a regra.");
                btnAddExcecao.innerText = textoOriginal;
                btnAddExcecao.disabled = false;
            });
        });
    }

    // Remover regra
    if (listaExcecoes) {
        listaExcecoes.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('btn-remover')) {
                const dataParaRemover = e.target.getAttribute('data-data');
                
                if (confirm("Remover esta regra de calendário?")) {
                    fetch('/admin/remover-excecao', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: dataParaRemover })
                    })
                    .then(res => res.json())
                    .then(dados => {
                        if(dados.status === "sucesso") {
                            carregarConfiguracoes();
                        }
                    })
                    .catch(() => alert("Erro ao remover a regra."));
                }
            }
        });
    }

    // Inicializa a tela garantindo que só rode se estiver na página de admin
    if (document.querySelector('.admin-grid')) {
        carregarConfiguracoes();
    }

});