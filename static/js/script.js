document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. TELA DE VISITANTE (AGENDAMENTO)
    // ==========================================
    const btnAgendar = document.getElementById("btn-agendar");
    const inputData = document.getElementById("data");
    const selectHorario = document.getElementById("horario");

    if (inputData && selectHorario && btnAgendar) {
        inputData.addEventListener("change", function() {
            const dataEscolhida = this.value;
            
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

            if (dataEscolhida) {
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
            }
        });
        
        btnAgendar.addEventListener("click", function() {
            const data = inputData.value;
            const nome = document.getElementById("nome").value;
            const telefone = document.getElementById("telefone").value;
            const horario = selectHorario.value;

            if(!data || !nome || !telefone || !horario) {
                alert("Por favor, preencha todos os campos e escolha um horário!");
                return;
            }

            const reserva = {
                cliente_nome: nome,
                cliente_telefone: telefone,
                data_agendamento: data,
                horario: horario,
                status: "Agendado"
            };

            fetch('/agendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reserva)
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if(dados.status === "sucesso") {
                    alert("Seu horário das " + horario + " foi marcado com sucesso!");
                    const inputUsuarioId = document.getElementById("usuario-id");
                    if (inputUsuarioId) {
                        window.location.href = "/perfil";
                    } else {
                        inputData.dispatchEvent(new Event('change')); 
                    }
                }
            });
        });
    }

    // ==========================================
    // 2. TELA DE CADASTRO
    // ==========================================
    const formCadastro = document.getElementById("form-cadastro");
    if (formCadastro) {
        formCadastro.addEventListener("submit", function(event) {
            event.preventDefault();
            
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

            const novoUsuario = { nome, celular, email, nascimento, senha };

            fetch('/salvar-cadastro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoUsuario)
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if(dados.status === "sucesso") {
                    alert("Cadastro realizado com sucesso! Vamos para o login.");
                    window.location.href = "/login"; 
                }
            })
            .catch(erro => alert("Erro ao cadastrar."));
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
                labelAcesso.textContent = "Informe seu E-mail:";
                inputAcesso.type = "email";
                inputAcesso.placeholder = "seu@email.com";
            } else {
                labelAcesso.textContent = "Informe seu Celular:";
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
    // 6. ATUALIZAÇÃO DE PERFIL DO CLIENTE
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
    // 7. TOGGLE DO FORMULÁRIO DE PERFIL
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
    // 5. CANCELAMENTO DE AGENDAMENTO (PERFIL)
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
    // LÓGICA DO MODAL DE LOGIN (Página Inicial)
    // ==========================================
    const btnAbrirModal = document.getElementById("btn-abrir-modal-login");
    const modalLogin = document.getElementById("modal");
    const btnFecharModal = document.getElementById("btn-fechar-modal");

    // 1. Abrir modal ao clicar em "Acessar Perfil"
    if (btnAbrirModal && modalLogin) {
        btnAbrirModal.addEventListener("click", function() {
            modalLogin.classList.remove("escondido");
        });
    }

    // 2. Fechar modal no botão (X)
    if (btnFecharModal && modalLogin) {
        btnFecharModal.addEventListener("click", function() {
            modalLogin.classList.add("escondido");
        });
    }

    // 3. Fechar modal clicando fora da caixa branca
    if (modalLogin) {
        modalLogin.addEventListener("click", function(e) {
            if (e.target === modalLogin) {
                modalLogin.classList.add("escondido");
            }
        });
    }

    // ==========================================
    // LÓGICA DE LOGIN (Enviando os dados)
    // ==========================================
    const btnEntrar = document.getElementById("btn-entrar");
    if (btnEntrar) {
        btnEntrar.addEventListener("click", function() {
            const acesso = document.getElementById("acesso").value;
            const senha = document.getElementById("senha").value;
            const manterConectado = document.getElementById("manter-conectado").checked;

            if (!acesso || !senha) {
                alert("Por favor, preencha o acesso e a senha!");
                return;
            }

            // Altera o texto para dar feedback visual ao usuário
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
                    // Login com sucesso, redireciona para o painel!
                    window.location.href = "/perfil"; 
                }
            })
            .catch(erro => {
                alert("Erro de conexão com o servidor!");
                console.error(erro);
                btnEntrar.innerText = textoOriginal;
                btnEntrar.disabled = false;
            });
        });
    }

});