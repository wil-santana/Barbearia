document.addEventListener("DOMContentLoaded", function() {

    // ==========================================
    // FUNÇÕES AUXILIARES
    // ==========================================
    function obterHojeFormatado() {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

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
                .then(resposta => {
                    if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
                    return resposta.json();
                })
                .then(dados => {
                    if (dados.status === "sucesso") {
                        alert("Agendamento cancelado com sucesso!");
                        window.location.reload();
                    } else {
                        alert("Erro ao cancelar: " + dados.mensagem);
                    }
                })
                .catch(erro => alert("Erro ao comunicar com o servidor: " + erro.message));
            }
        });
    });

    // ==========================================
    // 1.1 EXCLUSÃO DE AGENDAMENTOS (TABELA)
    // ==========================================
    const botoesExcluir = document.querySelectorAll(".btn-excluir-admin");

    botoesExcluir.forEach(botao => {
        botao.addEventListener("click", function() {
            const agendamentoId = this.getAttribute("data-id");
            const isAvisoAtivo = this.classList.contains("btn-aviso-ativo");

            if (isAvisoAtivo) {
                alert("⚠️ Este agendamento ainda está ativo!\n\nPara manter o controlo dos horários disponíveis, cancele o agendamento primeiro antes de excluí-lo.");
                return;
            }

            if (confirm("Deseja realmente excluir este agendamento do histórico permanentemente?")) {
                fetch('/admin/excluir-agendamento', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: agendamentoId })
                })
                .then(resposta => {
                    if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
                    return resposta.json();
                })
                .then(dados => {
                    if (dados.status === "sucesso") {
                        alert("Agendamento excluído com sucesso!");
                        window.location.reload();
                    } else {
                        alert("Erro ao excluir: " + dados.mensagem);
                    }
                })
                .catch(erro => alert("Erro ao comunicar com o servidor: " + erro.message));
            }
        });
    });

    // ==========================================
    // 2. GESTÃO DE DIAS E EXCEÇÕES
    // ==========================================
    const listaExcecoes = document.getElementById('lista-excecoes');
    const btnSalvarFixos = document.getElementById('btn-salvar-fixos');
    const btnAddExcecao = document.getElementById('btn-add-excecao');
    const checkSabadoFechado = document.getElementById('check-sabado-fechado');
    const checkSabadoMeio = document.getElementById('check-sabado-meio');

    if (checkSabadoFechado && checkSabadoMeio) {
        checkSabadoFechado.addEventListener('change', function() {
            if (this.checked) checkSabadoMeio.checked = false;
        });
        checkSabadoMeio.addEventListener('change', function() {
            if (this.checked) checkSabadoFechado.checked = false;
        });
    }

    function carregarConfiguracoes() {
        fetch('/admin/config-agenda?t=' + new Date().getTime())
            .then(res => {
                if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
                return res.json();
            })
            .then(dados => {
                const diasFechadosSalvos = (dados.dias_fechados || []).map(num => parseInt(num)); 
                
                document.querySelectorAll('.check-dia').forEach(chk => {
                    chk.checked = diasFechadosSalvos.includes(parseInt(chk.value));
                });

                if (checkSabadoFechado && checkSabadoMeio) {
                    checkSabadoFechado.checked = false;
                    checkSabadoMeio.checked = false;

                    if (diasFechadosSalvos.includes(6)) {
                        if (dados.regra_sabado === 'meio_periodo') {
                            checkSabadoMeio.checked = true;
                        } else {
                            checkSabadoFechado.checked = true;
                        }
                    }
                }

                if (listaExcecoes) {
                    listaExcecoes.innerHTML = '';
                    const excecoesSalvas = dados.excecoes || {}; 
                    
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

    if (btnSalvarFixos) {
        btnSalvarFixos.addEventListener('click', () => {
            const diasFechados = [];
            document.querySelectorAll('.check-dia:checked').forEach(chk => {
                const val = parseInt(chk.value);
                if (!isNaN(val) && !diasFechados.includes(val)) {
                    diasFechados.push(val);
                }
            });

            let regraSabado = "dia_todo";
            if (checkSabadoFechado && checkSabadoFechado.checked) {
                if (!diasFechados.includes(6)) diasFechados.push(6);
                regraSabado = "dia_todo";
            } else if (checkSabadoMeio && checkSabadoMeio.checked) {
                if (!diasFechados.includes(6)) diasFechados.push(6);
                regraSabado = "meio_periodo";
            } else {
                regraSabado = "normal";
            }

            const textoOriginal = btnSalvarFixos.innerText;
            btnSalvarFixos.innerText = "A guardar...";
            btnSalvarFixos.disabled = true;

            fetch('/admin/salvar-dias-fixos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dias_fechados: diasFechados, regra_sabado: regraSabado }) 
            })
            .then(res => res.json())
            .then(dados => {
                if(dados.status === "sucesso") {
                    alert("Dias fixos atualizados com sucesso!");
                } else {
                    alert("Erro ao guardar: " + dados.mensagem);
                }
                btnSalvarFixos.innerText = textoOriginal;
                btnSalvarFixos.disabled = false;
            })
            .catch(() => {
                alert("Erro de ligação ao tentar guardar os dias fixos.");
                btnSalvarFixos.innerText = textoOriginal;
                btnSalvarFixos.disabled = false;
            });
        });
    }

    if (btnAddExcecao) {
        btnAddExcecao.addEventListener('click', () => {
            const dataInput = document.getElementById('data-excecao').value;
            const tipoInput = document.getElementById('tipo-excecao').value;
            
            if(!dataInput) {
                alert("Escolha uma data no calendário!");
                return;
            }

            const textoOriginal = btnAddExcecao.innerText;
            btnAddExcecao.innerText = "A adicionar...";
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
                    alert("Nova regra guardada com sucesso!");
                } else {
                    alert("Erro: " + dados.mensagem);
                }
                btnAddExcecao.innerText = textoOriginal;
                btnAddExcecao.disabled = false;
            })
            .catch(() => {
                alert("Erro de ligação ao adicionar a regra.");
                btnAddExcecao.innerText = textoOriginal;
                btnAddExcecao.disabled = false;
            });
        });
    }

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

    // ==========================================
    // 3. FILTRO DE AGENDAMENTOS POR PERÍODO (VIA BACKEND)
    // ==========================================
    const inputInicio = document.getElementById("filtro-inicio");
    const inputFim = document.getElementById("filtro-fim");
    const btnBuscar = document.getElementById("btn-buscar-periodo");

    if (btnBuscar && inputInicio && inputFim) {
        btnBuscar.addEventListener("click", function() {
            const inicio = inputInicio.value;
            const fim = inputFim.value;

            if (!inicio || !fim) {
                alert("Por favor, selecione as datas de início e fim.");
                return;
            }

            const dInicio = new Date(inicio + "T00:00:00");
            const dFim = new Date(fim + "T00:00:00");
            
            const diffTime = dFim - dInicio;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                alert("A data final não pode ser anterior à data inicial.");
                return;
            }

            if (diffDays > 5) {
                alert("Atenção: A busca máxima permitida é de 5 dias.\n\nPor favor, diminua o período escolhido.");
                return;
            }

            btnBuscar.innerText = "A procurar...";
            window.location.href = `/admin?inicio=${inicio}&fim=${fim}`;
        });
    }

    // Carrega configurações ao abrir o painel
    if (document.querySelector('.admin-grid')) {
        carregarConfiguracoes();
    }

}); // <-- A chave e o parêntese corretos estão aqui!