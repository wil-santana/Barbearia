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
    // 1. EXCLUSÃO DE AGENDAMENTOS (TABELA)
    // ==========================================
    const botoesExcluir = document.querySelectorAll(".btn-excluir-admin");

    botoesExcluir.forEach(botao => {
        botao.addEventListener("click", function() {
            const agendamentoId = this.getAttribute("data-id");
            const isAvisoAtivo = this.classList.contains("btn-aviso-ativo");

            if (isAvisoAtivo) {
                alert("⚠️ Este agendamento ainda está ativo (Agendado)!\n\nUtilize os botões 'Finalizar' ou 'Não Concluído' em vez de excluir. A exclusão serve apenas para limpar o histórico.");
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
    // 3. FILTRO DE AGENDAMENTOS POR PERÍODO
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

    // ==========================================
    // 4. LÓGICA DO MODAL: FINALIZAR ATENDIMENTO
    // ==========================================
    const botoesFinalizar = document.querySelectorAll('.btn-finalizar-admin');
    const modalFinalizar = document.getElementById('modal-finalizar');
    const btnFecharFinalizar = document.getElementById('btn-cancelar-modal-fin');
    const btnConfirmarFinalizacao = document.getElementById('btn-confirmar-finalizacao');
    const inputIdFin = document.getElementById('fin-id-agendamento');
    const displayTotal = document.getElementById('display-total');
    
    const chksServico = document.querySelectorAll('.chk-servico');
    const chkOutros = document.getElementById('chk-outros');
    const inputValOutros = document.getElementById('val-outros');

    // Abrir Modal
    botoesFinalizar.forEach(botao => {
        botao.addEventListener('click', function() {
            inputIdFin.value = this.getAttribute('data-id');
            // Limpa o formulário ao abrir
            chksServico.forEach(chk => { chk.checked = false; });
            document.querySelectorAll('.input-valor-servico').forEach(inp => { 
                inp.value = ''; 
                inp.disabled = true; 
            });
            displayTotal.innerText = "0.00";
            document.getElementById('fin-pagamento').selectedIndex = 0;
            
            modalFinalizar.style.display = 'flex';
        });
    });

    // Fechar Modal
    if (btnFecharFinalizar) {
        btnFecharFinalizar.addEventListener('click', () => modalFinalizar.style.display = 'none');
    }

    // Calcular Total
    function calcularTotal() {
        let total = 0;
        document.querySelectorAll('.input-valor-servico').forEach(input => {
            if (!input.disabled && input.value) {
                total += parseFloat(input.value) || 0;
            }
        });
        displayTotal.innerText = total.toFixed(2);
    }

    // Regras dos Checkboxes
    chksServico.forEach(chk => {
        chk.addEventListener('change', function() {
            const valInput = document.getElementById(`val-${this.value.toLowerCase()}`);
            
            if (this.id === 'chk-outros') {
                if (this.checked) {
                    chksServico.forEach(c => {
                        if (c.id !== 'chk-outros') {
                            c.checked = false;
                            document.getElementById(`val-${c.value.toLowerCase()}`).value = '';
                            document.getElementById(`val-${c.value.toLowerCase()}`).disabled = true;
                        }
                    });
                    valInput.disabled = false;
                    valInput.focus();
                } else {
                    valInput.disabled = true;
                    valInput.value = '';
                }
            } else {
                if (chkOutros.checked) {
                    chkOutros.checked = false;
                    inputValOutros.disabled = true;
                    inputValOutros.value = '';
                }
                
                if (this.checked) {
                    valInput.disabled = false;
                    valInput.focus();
                } else {
                    valInput.disabled = true;
                    valInput.value = '';
                }
            }
            calcularTotal();
        });
    });

    document.querySelectorAll('.input-valor-servico').forEach(input => {
        input.addEventListener('input', calcularTotal);
    });

    // Confirmar e Enviar para o Servidor
    if (btnConfirmarFinalizacao) {
        btnConfirmarFinalizacao.addEventListener('click', function() {
            const servicosRealizados = [];
            let selecionouAlgo = false;
            let faltouValor = false;

            chksServico.forEach(chk => {
                if (chk.checked) {
                    selecionouAlgo = true;
                    const valorDigitado = document.getElementById(`val-${chk.value.toLowerCase()}`).value;
                    if (!valorDigitado || parseFloat(valorDigitado) <= 0) {
                        faltouValor = true;
                    } else {
                        servicosRealizados.push({
                            nome: chk.value,
                            valor: parseFloat(valorDigitado)
                        });
                    }
                }
            });

            if (!selecionouAlgo) {
                alert("Por favor, selecione pelo menos um serviço.");
                return;
            }
            if (faltouValor) {
                alert("Por favor, insira o valor para todos os serviços selecionados.");
                return;
            }

            const dados = {
                id: inputIdFin.value,
                servicos: servicosRealizados,
                pagamento: document.getElementById('fin-pagamento').value,
                total: parseFloat(displayTotal.innerText)
            };

            const textoOriginal = btnConfirmarFinalizacao.innerText;
            btnConfirmarFinalizacao.innerText = "A gravar...";
            btnConfirmarFinalizacao.disabled = true;

            fetch('/admin/finalizar-atendimento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            })
            .then(res => res.json())
            .then(retorno => {
                if (retorno.status === "sucesso") {
                    alert("Atendimento finalizado e registado com sucesso!");
                    window.location.reload();
                } else {
                    alert("Erro: " + retorno.mensagem);
                    btnConfirmarFinalizacao.innerText = textoOriginal;
                    btnConfirmarFinalizacao.disabled = false;
                }
            })
            .catch(() => {
                alert("Erro ao comunicar com o servidor.");
                btnConfirmarFinalizacao.innerText = textoOriginal;
                btnConfirmarFinalizacao.disabled = false;
            });
        });
    }

    // ==========================================
    // 5. LÓGICA DO MODAL: NÃO CONCLUÍDO
    // ==========================================
    const botoesNaoConcluido = document.querySelectorAll('.btn-nao-concluido-admin');
    const modalNaoConcluido = document.getElementById('modal-nao-concluido');
    const btnFecharNao = document.getElementById('btn-cancelar-modal-nao');
    const btnConfirmarNao = document.getElementById('btn-confirmar-nao-concluido');
    const inputIdNao = document.getElementById('nao-id-agendamento');

    botoesNaoConcluido.forEach(botao => {
        botao.addEventListener('click', function() {
            inputIdNao.value = this.getAttribute('data-id');
            document.getElementById('motivo-nao-concluido').selectedIndex = 0;
            modalNaoConcluido.style.display = 'flex';
        });
    });

    if (btnFecharNao) {
        btnFecharNao.addEventListener('click', () => modalNaoConcluido.style.display = 'none');
    }

    if (btnConfirmarNao) {
        btnConfirmarNao.addEventListener('click', function() {
            const motivo = document.getElementById('motivo-nao-concluido').value;
            if (!motivo) {
                alert("Por favor, selecione um motivo.");
                return;
            }

            const textoOriginal = btnConfirmarNao.innerText;
            btnConfirmarNao.innerText = "A gravar...";
            btnConfirmarNao.disabled = true;

            fetch('/admin/nao-concluido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: inputIdNao.value, motivo: motivo })
            })
            .then(res => res.json())
            .then(retorno => {
                if (retorno.status === "sucesso") {
                    alert("Estado atualizado para 'Não Concluído'.");
                    window.location.reload();
                } else {
                    alert("Erro: " + retorno.mensagem);
                    btnConfirmarNao.innerText = textoOriginal;
                    btnConfirmarNao.disabled = false;
                }
            })
            .catch(() => {
                alert("Erro ao comunicar com o servidor.");
                btnConfirmarNao.innerText = textoOriginal;
                btnConfirmarNao.disabled = false;
            });
        });
    }

    // ==========================================
    // 6. LÓGICA DO MODAL: CADASTRO DE CLIENTES
    // ==========================================
    const btnAbrirModalClientes = document.getElementById('btn-abrir-modal-clientes');
    const modalClientes = document.getElementById('modal-clientes');
    const btnFecharClientesX = document.getElementById('btn-fechar-modal-clientes');
    const btnFecharClientesBaixo = document.getElementById('btn-fechar-modal-clientes-baixo');
    const containerListaClientes = document.getElementById('container-lista-clientes');
    const inputBuscaCliente = document.getElementById('input-busca-cliente');

    let cacheClientes = [];

    function renderizarClientes(clientesParaExibir) {
        if (!containerListaClientes) return;

        if (!clientesParaExibir || clientesParaExibir.length === 0) {
            containerListaClientes.innerHTML = '<p style="color: #aaa; text-align: center; padding: 25px;">Nenhum cliente cadastrado ou encontrado.</p>';
            return;
        }

        containerListaClientes.innerHTML = clientesParaExibir.map(c => `
            <a href="/admin/cliente/${c.id}" class="card-item-cliente" title="Ver perfil de ${c.nome}">
                <div class="card-item-cliente-info">
                    <span class="card-item-cliente-nome">👤 ${c.nome}</span>
                    <div class="card-item-cliente-detalhes">
                        ${c.celular ? `<span>📱 ${c.celular}</span>` : ''}
                        ${c.email ? `<span>✉️ ${c.email}</span>` : ''}
                    </div>
                </div>
                <span class="card-item-cliente-seta">➔</span>
            </a>
        `).join('');
    }

    function abrirModalClientes() {
        if (!modalClientes) return;
        modalClientes.style.display = 'flex';
        containerListaClientes.innerHTML = '<p style="color: #aaa; text-align: center; padding: 25px;">Carregando clientes...</p>';
        if (inputBuscaCliente) inputBuscaCliente.value = '';

        fetch('/admin/listar-clientes?t=' + new Date().getTime())
            .then(res => {
                if (!res.ok) throw new Error("Erro ao buscar clientes");
                return res.json();
            })
            .then(dados => {
                if (dados.status === "sucesso") {
                    cacheClientes = dados.clientes || [];
                    renderizarClientes(cacheClientes);
                } else {
                    containerListaClientes.innerHTML = `<p style="color: #dc3545; text-align: center; padding: 20px;">Erro: ${dados.mensagem}</p>`;
                }
            })
            .catch(err => {
                containerListaClientes.innerHTML = `<p style="color: #dc3545; text-align: center; padding: 20px;">Erro ao carregar lista de clientes.</p>`;
            });
    }

    function fecharModalClientes() {
        if (modalClientes) modalClientes.style.display = 'none';
    }

    if (btnAbrirModalClientes) {
        btnAbrirModalClientes.addEventListener('click', abrirModalClientes);
    }
    if (btnFecharClientesX) {
        btnFecharClientesX.addEventListener('click', fecharModalClientes);
    }
    if (btnFecharClientesBaixo) {
        btnFecharClientesBaixo.addEventListener('click', fecharModalClientes);
    }

    if (inputBuscaCliente) {
        inputBuscaCliente.addEventListener('input', function() {
            const termo = this.value.toLowerCase().trim();
            if (!termo) {
                renderizarClientes(cacheClientes);
                return;
            }
            const filtrados = cacheClientes.filter(c => {
                const nome = (c.nome || '').toLowerCase();
                const celular = (c.celular || '').replace(/\D/g, '');
                const email = (c.email || '').toLowerCase();
                const termoLimpo = termo.replace(/\D/g, '');
                return nome.includes(termo) || email.includes(termo) || (termoLimpo && celular.includes(termoLimpo));
            });
            renderizarClientes(filtrados);
        });
    }

    // Carrega as configurações ao abrir o painel
    if (document.querySelector('.admin-grid')) {
        carregarConfiguracoes();
    }

});