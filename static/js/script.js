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

    if (btnAbrirVisitante && modalVisitante) {
        btnAbrirVisitante.addEventListener("click", () => {
            modalVisitante.classList.remove("escondido");
            const hojeStr = new Date().toISOString().split('T')[0];
            if(inputData) inputData.setAttribute('min', hojeStr);
        });
    }

    if (btnFecharVisitante && modalVisitante) {
        btnFecharVisitante.addEventListener("click", () => {
            modalVisitante.classList.add("escondido");
        });
    }

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

            fetch('/admin/config-agenda?t=' + new Date().getTime())
            .then(res => res.json())
            .then(config => {
                const dataObj = new Date(dataEscolhida + 'T00:00:00'); 
                const diaSemana = dataObj.getDay(); 
                let fechado = false;
                let sabadoMeioPeriodo = false;
                
                const diasFechados = (config.dias_fechados || []).map(num => parseInt(num));
                
                if (config.excecoes && config.excecoes[dataEscolhida] !== undefined) {
                    if (config.excecoes[dataEscolhida] === 'fechado') fechado = true;
                    if (config.excecoes[dataEscolhida] === 'aberto') fechado = false;
                } else {
                    if (diasFechados.includes(diaSemana)) {
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

                        if (sabadoMeioPeriodo) {
                            const partes = opcao.value.split(":");
                            const minHorario = parseInt(partes[0]) * 60 + parseInt(partes[1]);
                            if (minHorario > 780) { 
                                opcao.disabled = true;
                                opcao.text = opcao.value + " (Indisponível)";
                            }
                        }
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
    // 2. LÓGICA DO MODAL DE LOGIN (COM SUPORTE AO ADMIN)
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
                    // Redireciona para onde o servidor mandar (seja /admin ou /perfil)
                    window.location.href = dados.redirect || "/perfil"; 
                }
            })
            .catch(() => {
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
            .catch(() => {
                alert("Erro ao cadastrar.");
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            });
        });
    }
});