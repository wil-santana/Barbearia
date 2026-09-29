document.addEventListener("DOMContentLoaded", function() {

    // ==========================================
    // 1. MODAL DE VISITANTE (AGENDAMENTO)
    // ==========================================
    const modalVisitante = document.getElementById("modal-visitante");
    const btnAbrirVisitante = document.getElementById("btn-abrir-visitante");
    const btnFecharVisitante = document.getElementById("fechar-modal-visitante");
    
    const inputData = document.getElementById("data");
    const selectHorario = document.getElementById("horario");
    const btnAgendar = document.getElementById("btn-agendar");

    // Abrir modal
    if (btnAbrirVisitante && modalVisitante) {
        btnAbrirVisitante.addEventListener("click", () => {
            modalVisitante.classList.remove("escondido");
            const hojeStr = new Date().toISOString().split('T')[0];
            if(inputData) inputData.setAttribute('min', hojeStr);
        });
    }

    // Fechar modal no X
    if (btnFecharVisitante && modalVisitante) {
        btnFecharVisitante.addEventListener("click", () => {
            modalVisitante.classList.add("escondido");
        });
    }

    // Fechar clicando fora do modal
    if (modalVisitante) {
        window.addEventListener("click", (e) => {
            if (e.target === modalVisitante) {
                modalVisitante.classList.add("escondido");
            }
        });
    }

    if (inputData && selectHorario && btnAgendar) {
        inputData.addEventListener("change", function() {
            const dataEscolhida = this.value;
            if (!dataEscolhida) return;

            fetch('/admin/config-agenda')
            .then(res => res.json())
            .then(config => {
                const dataObj = new Date(dataEscolhida + 'T00:00:00'); 
                const diaSemana = dataObj.getDay(); 
                let fechado = false;
                
                if (config.excecoes && config.excecoes[dataEscolhida] !== undefined) {
                    if (config.excecoes[dataEscolhida] === 'fechado') fechado = true;
                    if (config.excecoes[dataEscolhida] === 'aberto') fechado = false;
                } else {
                    if (config.dias_fechados && config.dias_fechados.includes(diaSemana)) {
                        fechado = true;
                    }
                }

                if (fechado) {
                    alert("A barbearia está fechada nesta data!");
                    inputData.value = ""; 
                    Array.from(selectHorario.options).forEach(opcao => {
                        if (opcao.value !== "") opcao.disabled = true;
                    });
                    return; 
                }

                const agora = new Date();
                const ano = agora.getFullYear();
                const mes = String(agora.getMonth() + 1).padStart(2, '0');
                const dia = String(agora.getDate()).padStart(2, '0');
                const hojeStr = `${ano}-${mes}-${dia}`;
                
                const horaAtual = agora.getHours();
                const minutoAtual = agora.getMinutes();
                const tempoAtualMinutos = horaAtual * 60 + minutoAtual;

                if (dataEscolhida < hojeStr) {
                    alert("Você não pode selecionar uma data que já passou!");
                    this.value = "";
                    return;
                }

                Array.from(selectHorario.options).forEach(opcao => {
                    if (opcao.value !== "") {
                        opcao.disabled = false;
                        opcao.text = opcao.value; 
                    }
                });

                if (dataEscolhida === hojeStr) {
                    Array.from(selectHorario.options).forEach(opcao => {
                        if (opcao.value !== "") {
                            const partes = opcao.value.split(":");
                            const horarioMinutos = parseInt(partes[0]) * 60 + parseInt(partes[1]);
                            
                            if (horarioMinutos <= tempoAtualMinutos) {
                                opcao.disabled = true;
                                opcao.text = opcao.value + " (Passou)";
                            }
                        }
                    });
                }

                fetch('/horarios-ocupados?data=' + dataEscolhida)
                .then(resposta => resposta.json())
                .then(ocupados => {
                    Array.from(selectHorario.options).forEach(opcao => {
                        if (ocupados.includes(opcao.value)) {
                            opcao.disabled = true;
                            opcao.text = opcao.value + " (Ocupado)";
                        }
                    });
                });
            });
        });
    }

    if (btnAgendar && !document.getElementById("btn-confirmar-agendamento-logado")) { 
        btnAgendar.addEventListener("click", function(e) {
            e.preventDefault(); 
            
            const nome = document.getElementById("nome").value;
            const telefone = document.getElementById("telefone").value;
            const dataAg = inputData.value;
            const horario = selectHorario.value;

            if (!nome || !telefone || !dataAg || !horario) {
                alert("Por favor, preencha todos os campos e escolha um horário!");
                return;
            }

            const dados = {
                cliente_nome: nome,
                cliente_telefone: telefone,
                data_agendamento: dataAg,
                horario: horario,
                status: "Agendado"
            };

            const textoOriginal = btnAgendar.innerText;
            btnAgendar.innerText = "Salvando...";
            btnAgendar.disabled = true;

            fetch('/agendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            })
            .then(resposta => resposta.json())
            .then(retorno => {
                if (retorno.status === "sucesso") {
                    alert("Seu horário das " + horario + " foi marcado com sucesso!");
                    modalVisitante.classList.add("escondido");
                    
                    document.getElementById("nome").value = "";
                    document.getElementById("telefone").value = "";
                    inputData.value = "";
                    selectHorario.selectedIndex = 0;
                } else {
                    alert("Erro: " + retorno.mensagem);
                }
                btnAgendar.innerText = textoOriginal;
                btnAgendar.disabled = false;
            })
            .catch(() => {
                alert("Erro de comunicação com o servidor.");
                btnAgendar.innerText = textoOriginal;
                btnAgendar.disabled = false;
            });
        });
    }

    // ==========================================
    // 2. LÓGICA DO MODAL DE LOGIN 
    // ==========================================
    const btnAbrirModalLogin = document.getElementById("btn-abrir-modal-login");
    const modalLogin = document.getElementById("modal");
    const btnFecharModalLogin = document.getElementById("btn-fechar-modal");

    if (btnAbrirModalLogin && modalLogin) {
        btnAbrirModalLogin.addEventListener("click", function() {
            modalLogin.classList.remove("escondido");
        });
    }

    if (btnFecharModalLogin && modalLogin) {
        btnFecharModalLogin.addEventListener("click", function() {
            modalLogin.classList.add("escondido");
        });
    }

    if (modalLogin) {
        modalLogin.addEventListener("click", function(e) {
            if (e.target === modalLogin) {
                modalLogin.classList.add("escondido");
            }
        });
    }

    const btnEntrar = document.getElementById("btn-entrar");
    if (btnEntrar) {
        btnEntrar.addEventListener("click", function() {
            const acesso = document.getElementById("acesso").value;
            const senha = document.getElementById("senha").value;
            const manterConectado = document.getElementById("manter-conectado") ? document.getElementById("manter-conectado").checked : false;

            if (!acesso || !senha) {
                alert("Por favor, preencha o acesso e a senha!");
                return;
            }

            const textoOriginal = btnEntrar.innerText;
            btnEntrar.innerText = "Autenticando...";
            btnEntrar.disabled = true;

            fetch('/fazer-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ acesso: acesso, senha: senha, lembrar: manterConectado })
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if (dados.status === "erro") {
                    alert(dados.mensagem);
                    btnEntrar.innerText = textoOriginal;
                    btnEntrar.disabled = false;
                } else {
                    window.location.href = "/perfil"; 
                }
            })
            .catch(erro => {
                alert("Erro de conexão com o servidor!");
                btnEntrar.innerText = textoOriginal;
                btnEntrar.disabled = false;
            });
        });
    }

    // ==========================================
    // 3. LÓGICA DO MODAL DE CADASTRO
    // ==========================================
    const modalCadastro = document.getElementById("modal-cadastro");
    const btnAbrirCadastro = document.getElementById("btn-abrir-modal-cadastro");
    const btnFecharCadastro = document.getElementById("fechar-modal-cadastro");
    const linkAbrirCadastro = document.getElementById("link-abrir-cadastro");

    if (btnAbrirCadastro && modalCadastro) {
        btnAbrirCadastro.addEventListener("click", () => {
            modalCadastro.classList.remove("escondido");
        });
    }

    if (btnFecharCadastro && modalCadastro) {
        btnFecharCadastro.addEventListener("click", () => {
            modalCadastro.classList.add("escondido");
        });
    }

    if (modalCadastro) {
        window.addEventListener("click", (e) => {
            if (e.target === modalCadastro) {
                modalCadastro.classList.add("escondido");
            }
        });
    }

    if (linkAbrirCadastro && modalLogin && modalCadastro) {
        linkAbrirCadastro.addEventListener("click", (e) => {
            e.preventDefault(); 
            modalLogin.classList.add("escondido"); 
            modalCadastro.classList.remove("escondido"); 
        });
    }

    const formCadastro = document.getElementById("form-cadastro");
    if (formCadastro) {
        formCadastro.addEventListener("submit", function(event) {
            event.preventDefault();
            
            const btnSubmit = formCadastro.querySelector('button[type="submit"]');
            const nome = document.getElementById("cad-nome").value;
            const celular = document.getElementById("cad-celular").value;
            const email = document.getElementById("cad-email").value;
            const nascimento = document.getElementById("cad-nascimento").value;
            const senha = document.getElementById("cad-senha").value;
            const confirmaSenha = document.getElementById("cad-confirmar-senha").value;

            if (senha !== confirmaSenha) {
                alert("As senhas não coincidem. Digite novamente!");
                return; 
            }

            const textoOriginal = btnSubmit.innerText;
            btnSubmit.innerText = "Criando conta...";
            btnSubmit.disabled = true;

            const novoUsuario = { nome, celular, email, nascimento, senha };

            fetch('/salvar-cadastro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoUsuario)
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if(dados.status === "sucesso") {
                    alert("Cadastro realizado com sucesso! Faça seu login.");
                    formCadastro.reset();
                    modalCadastro.classList.add("escondido");
                    if(modalLogin) modalLogin.classList.remove("escondido");
                } else {
                    alert("Erro: " + dados.mensagem);
                }
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            })
            .catch(erro => {
                alert("Erro ao cadastrar.");
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            });
        });
    }
    
    // ==========================================
    // 4. FLUXO SEGURO DE RECUPERAÇÃO DE SENHA
    // ==========================================
    const formRecuperar = document.getElementById("formRecuperar");
    if (formRecuperar) {
        const selectCanal = document.getElementById("canal");
        const labelAcesso = document.getElementById("label-acesso");
        const inputAcesso = document.getElementById("acesso");

        selectCanal.addEventListener("change", function() {
            if (this.value === "email") {
                if(labelAcesso) labelAcesso.textContent = "Informe seu E-mail:";
                inputAcesso.type = "email";
                inputAcesso.placeholder = "seu@email.com";
            } else {
                if(labelAcesso) labelAcesso.textContent = "Informe seu Celular:";
                inputAcesso.type = "tel";
                inputAcesso.placeholder = "(00) 00000-0000";
            }
            inputAcesso.value = "";
        });

        formRecuperar.addEventListener("submit", function(e) {
            e.preventDefault();
            const canal = selectCanal.value;
            const acesso = inputAcesso.value;
            
            fetch('/solicitar-recuperacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ canal, acesso })
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if (dados.status === "sucesso") {
                    if (dados.canal === "whatsapp") {
                        const texto = encodeURIComponent(`Olá! Aqui está o seu link seguro para redefinir a senha da barbearia: ${dados.link}`);
                        window.open(`https://wa.me/55${dados.acesso.replace(/\D/g,'')}?text=${texto}`, '_blank');
                    } else {
                        alert("Link de recuperação gerado com sucesso! (Link de teste): " + dados.link);
                    }
                    window.location.href = "/login";
                } else {
                    alert("Erro: " + dados.mensagem);
                }
            })
            .catch(erro => alert("Erro ao se comunicar com o servidor."));
        });
    }

    const formRedefinir = document.getElementById("formRedefinir");
    if (formRedefinir) {
        formRedefinir.addEventListener("submit", function(e) {
            e.preventDefault();
            const token = document.getElementById("token").value;
            const nova_senha = document.getElementById("nova_senha").value;
            
            fetch('/salvar-nova-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, nova_senha })
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if (dados.status === "sucesso") {
                    alert("Senha alterada com sucesso! Faça login com a nova senha.");
                    window.location.href = "/login";
                } else {
                    alert("Erro: " + dados.mensagem);
                }
            })
            .catch(erro => alert("Erro ao se comunicar com o servidor."));
        });
    }

    // ==========================================
    // 5. ATUALIZAÇÃO DE PERFIL DO CLIENTE
    // ==========================================
    const formPerfil = document.getElementById("formPerfil");
    if (formPerfil) {
        formPerfil.addEventListener("submit", function(e) {
            e.preventDefault();
            const dadosAtualizados = {
                nome: document.getElementById("perfil-nome").value,
                celular: document.getElementById("perfil-celular").value,
                email: document.getElementById("perfil-email").value,
                nascimento: document.getElementById("perfil-nascimento").value,
                nova_senha: document.getElementById("perfil-nova-senha").value
            };
            
            fetch('/atualizar-perfil', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosAtualizados)
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if (dados.status === "sucesso") {
                    alert("Alterações salvas com sucesso!");
                    window.location.reload();
                } else {
                    alert("Erro: " + dados.mensagem);
                }
            })
            .catch(erro => alert("Erro ao se comunicar com o servidor."));
        });
    }

    // ==========================================
    // 6. TOGGLE DO FORMULÁRIO DE PERFIL
    // ==========================================
    const btnTogglePerfil = document.getElementById("btn-toggle-perfil");
    const secaoFormPerfil = document.getElementById("secao-form-perfil");
    if (btnTogglePerfil && secaoFormPerfil) {
        btnTogglePerfil.addEventListener("click", function() {
            if (secaoFormPerfil.style.display === "none") {
                secaoFormPerfil.style.display = "block";
                btnTogglePerfil.textContent = "Ocultar Formulário";
            } else {
                secaoFormPerfil.style.display = "none";
                btnTogglePerfil.textContent = "Atualizar Dados";
            }
        });
    }
    
    // ==========================================
    // 7. CANCELAMENTO DE AGENDAMENTO (PERFIL)
    // ==========================================
    const botoesCancelar = document.querySelectorAll(".btn-cancelar");
    botoesCancelar.forEach(botao => {
        botao.addEventListener("click", function() {
            const agendamentoId = this.getAttribute("data-id");
            if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
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
    // 8. MODAL DE AGENDAMENTO (CLIENTE LOGADO)
    // ==========================================
    const modalAgendarLogado = document.getElementById("modal-agendar");
    const btnAbrirModalAgendar = document.getElementById("btn-abrir-modal-agendar");
    const btnFecharModalAgendar = document.getElementById("fechar-modal-agendar");
    const inputDataLogado = document.getElementById("data-logado");
    const selectHorarioLogado = document.getElementById("horario-logado");
    const btnConfirmarLogado = document.getElementById("btn-confirmar-agendamento-logado");

    if (btnAbrirModalAgendar && modalAgendarLogado) {
        btnAbrirModalAgendar.addEventListener("click", () => {
            modalAgendarLogado.classList.remove("escondido");
            const hojeStr = new Date().toISOString().split('T')[0];
            if(inputDataLogado) inputDataLogado.setAttribute('min', hojeStr);
        });
    }

    if (btnFecharModalAgendar && modalAgendarLogado) {
        btnFecharModalAgendar.addEventListener("click", () => {
            modalAgendarLogado.classList.add("escondido");
        });
    }

    if (modalAgendarLogado) {
        window.addEventListener("click", (e) => {
            if (e.target === modalAgendarLogado) {
                modalAgendarLogado.classList.add("escondido");
            }
        });
    }
    
    // Validação de datas e horários bloqueados para cliente logado
    if (inputDataLogado && selectHorarioLogado) {
       inputDataLogado.addEventListener("change", function() {
            const dataEscolhida = this.value;
            if (!dataEscolhida) return;

            // Busca as regras no banco de dados sem usar cache
            fetch('/admin/config-agenda?t=' + new Date().getTime())
            .then(res => res.json())
            .then(config => {
                const dataObj = new Date(dataEscolhida + 'T00:00:00'); 
                const diaSemana = dataObj.getDay(); 
                let fechado = false;
                let sabadoMeioPeriodo = false;
                
                // Força o Javascript a ler a lista de dias como números inteiros
                const diasFechados = (config.dias_fechados || []).map(num => parseInt(num));
                
                if (config.excecoes && config.excecoes[dataEscolhida] !== undefined) {
                    if (config.excecoes[dataEscolhida] === 'fechado') fechado = true;
                    if (config.excecoes[dataEscolhida] === 'aberto') fechado = false;
                } else {
                    if (diasFechados.includes(diaSemana)) {
                        // Se for Sábado (6) e estiver marcado como meio período
                        if (diaSemana === 6 && config.regra_sabado === 'meio_periodo') {
                            fechado = false; 
                            sabadoMeioPeriodo = true;
                        } else {
                            fechado = true;
                        }
                    }
                }

                if (fechado) {
                    alert("A barbearia está fechada nesta data!");
                    inputDataLogado.value = ""; 
                    Array.from(selectHorarioLogado.options).forEach(opcao => {
                        if (opcao.value !== "") opcao.disabled = true;
                    });
                    return; 
                }

                const agora = new Date();
                const hojeStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
                const tempoAtualMinutos = agora.getHours() * 60 + agora.getMinutes();

                if (dataEscolhida < hojeStr) {
                    alert("Você não pode selecionar uma data que já passou!");
                    this.value = "";
                    return;
                }

                // 1. APLICA A REGRA DO SÁBADO E DE HORÁRIOS PASSADOS HOJE
                Array.from(selectHorarioLogado.options).forEach(opcao => {
                    if (opcao.value !== "") {
                        opcao.disabled = false;
                        opcao.text = opcao.value; 
                        
                        // Bloqueia a tarde do sábado se for a regra
                        if (sabadoMeioPeriodo) {
                            const partes = opcao.value.split(":");
                            const minHorario = parseInt(partes[0]) * 60 + parseInt(partes[1]);
                            if (minHorario > 780) { // 780 minutos = 13:00
                                opcao.disabled = true;
                                opcao.text = opcao.value + " (Indisponível)";
                            }
                        }

                        // Bloqueia horários que já passaram no dia de hoje
                        if (dataEscolhida === hojeStr && !opcao.disabled) {
                            const partes = opcao.value.split(":");
                            const horarioMinutos = parseInt(partes[0]) * 60 + parseInt(partes[1]);
                            if (horarioMinutos <= tempoAtualMinutos) {
                                opcao.disabled = true;
                                opcao.text = opcao.value + " (Indisponível)";
                            }
                        }
                    }
                });

                // 2. APLICA A REGRA DOS HORÁRIOS JÁ AGENDADOS POR OUTROS
                fetch('/horarios-ocupados?data=' + dataEscolhida + '&t=' + new Date().getTime())
                .then(resposta => resposta.json())
                .then(ocupados => {
                    Array.from(selectHorarioLogado.options).forEach(opcao => {
                        if (ocupados.includes(opcao.value)) {
                            opcao.disabled = true;
                            opcao.text = opcao.value + " (Indisponível)";
                        }
                    });
                });
            });
        });
    }
    // Envio do agendamento logado
    if (btnConfirmarLogado) {
        btnConfirmarLogado.addEventListener("click", function(e) {
            e.preventDefault();
            
            const nome = document.getElementById("nome-logado").value;
            const telefone = document.getElementById("telefone-logado").value;
            const dataAg = inputDataLogado.value;
            const horario = selectHorarioLogado.value;
            
            // Pega o ID do usuário para vincular à conta
            const campoId = document.getElementById("usuario-id");
            const usuarioId = campoId ? campoId.value : null;

            if (!dataAg || !horario) {
                alert("Por favor, selecione a data e o horário!");
                return;
            }

            const dados = {
                cliente_nome: nome,
                cliente_telefone: telefone,
                data_agendamento: dataAg,
                horario: horario,
                status: "Agendado",
                usuario_id: usuarioId
            };

            const textoOriginal = btnConfirmarLogado.innerText;
            btnConfirmarLogado.innerText = "Confirmando...";
            btnConfirmarLogado.disabled = true;

            fetch('/agendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            })
            .then(resposta => resposta.json())
            .then(retorno => {
                if (retorno.status === "sucesso") {
                    alert("Agendamento realizado com sucesso!");
                    modalAgendarLogado.classList.add("escondido");
                    window.location.reload(); // Recarrega a página para exibir o horário na tabela!
                } else {
                    alert("Erro: " + retorno.mensagem);
                    btnConfirmarLogado.innerText = textoOriginal;
                    btnConfirmarLogado.disabled = false;
                }
            })
            .catch(() => {
                alert("Erro de comunicação com o servidor.");
                btnConfirmarLogado.innerText = textoOriginal;
                btnConfirmarLogado.disabled = false;
            });
        });
    }

});