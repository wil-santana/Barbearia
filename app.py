from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import timedelta, datetime, date
import json, time
import os, uuid
from filelock import FileLock

app = Flask(__name__)
app.secret_key = 'chave_secreta_barbearia'
app.permanent_session_lifetime = timedelta(days=7) # Duração se "Manter conectado" for marcado

ARQUIVO_AGENDAMENTOS = 'agendamentos.json'
ARQUIVO_USUARIOS = 'usuarios.json'
ARQUIVO_BLOQUEIOS = 'bloqueios.json'
ARQUIVO_CONFIG_AGENDA = 'config_agenda.json'

def inicializar_banco():
    arquivos_lista = [ARQUIVO_AGENDAMENTOS, ARQUIVO_USUARIOS, ARQUIVO_BLOQUEIOS]
    for arquivo in arquivos_lista:
        if not os.path.exists(arquivo) or os.path.getsize(arquivo) == 0:
            with FileLock(f"{arquivo}.lock"):
                with open(arquivo, 'w') as f:
                    json.dump([], f)
                    
    # Inicializa o arquivo de configuração de agenda (Padrão: Dom e Seg fechados)
    if not os.path.exists(ARQUIVO_CONFIG_AGENDA) or os.path.getsize(ARQUIVO_CONFIG_AGENDA) == 0:
        with FileLock(f"{ARQUIVO_CONFIG_AGENDA}.lock"):
            with open(ARQUIVO_CONFIG_AGENDA, 'w') as f:
                json.dump({"dias_fechados": [0, 1], "excecoes": {}}, f, indent=4)

inicializar_banco()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/visitante')
def visitante():
    return render_template('visitante.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/cadastro')
def cadastro():
    return render_template('cadastro.html')

@app.route('/cancelar-agendamento', methods=['POST'])
def cancelar_agendamento():
    dados = request.get_json()
    agendamento_id = dados.get('id')

    if not agendamento_id:
        return jsonify({"status": "erro", "mensagem": "ID do agendamento não informado"}), 400

    with FileLock(f"{ARQUIVO_AGENDAMENTOS}.lock"):
        if os.path.exists(ARQUIVO_AGENDAMENTOS) and os.path.getsize(ARQUIVO_AGENDAMENTOS) > 0:
            with open(ARQUIVO_AGENDAMENTOS, 'r') as f:
                historico = json.load(f)

            encontrou = False
            for reserva in historico:
                if str(reserva.get('id')) == str(agendamento_id):
                    reserva['status'] = 'Cancelado'
                    encontrou = True
                    break

            if encontrou:
                with open(ARQUIVO_AGENDAMENTOS, 'w') as f:
                    json.dump(historico, f, indent=4)
                return jsonify({"status": "sucesso"})

    return jsonify({"status": "erro", "mensagem": "Agendamento não encontrado"}), 404

@app.route('/agendar', methods=['POST'])
def agendar():
    try:
        dados_cliente = request.get_json()
        data_reserva = dados_cliente.get('data_agendamento')
        horario_reserva = dados_cliente.get('horario')
        
        hoje_str = date.today().strftime('%Y-%m-%d')
        agora_str = datetime.now().strftime('%H:%M')
        
        # 1. Validação de segurança: datas ou horários passados
        if data_reserva < hoje_str or (data_reserva == hoje_str and horario_reserva < agora_str):
            return jsonify({"status": "erro", "mensagem": "Não é permitido agendar em datas ou horários passados!"}), 400
        
        # 2. Validação de segurança: dias fechados, feriados e exceções
        config = ler_config_agenda()
        data_obj = datetime.strptime(data_reserva, '%Y-%m-%d').date()
        dia_semana_js = (data_obj.weekday() + 1) % 7  # 0=Domingo, 1=Segunda... 6=Sábado
        
        status_excecao = config["excecoes"].get(data_reserva)
        permitido = True
        
        if status_excecao == 'fechado':
            permitido = False
        elif status_excecao == 'aberto':
            permitido = True
        else:
            if dia_semana_js in config.get("dias_fechados", []):
                permitido = False
                
        if not permitido:
            return jsonify({"status": "erro", "mensagem": "A barbearia está fechada nesta data!"}), 400

        # Continua o salvamento normal...
        with FileLock(f"{ARQUIVO_AGENDAMENTOS}.lock"):
            with open(ARQUIVO_AGENDAMENTOS, 'r') as f:
                historico = json.load(f)
            dados_cliente['id'] = len(historico) + 1

            if 'usuario_id' in session and not dados_cliente.get('usuario_id'):
                dados_cliente['usuario_id'] = session['usuario_id']

            historico.append(dados_cliente)

            with open(ARQUIVO_AGENDAMENTOS, 'w') as f:
                json.dump(historico, f, indent=4)

        return jsonify({"status": "sucesso"})
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

@app.route('/horarios-ocupados')
def horarios_ocupados():
    data_escolhida = request.args.get('data')
    ocupados = []
    
    if not data_escolhida or not os.path.exists(ARQUIVO_AGENDAMENTOS):
        return jsonify(ocupados)
        
    if os.path.getsize(ARQUIVO_AGENDAMENTOS) > 0:
        try:
            with open(ARQUIVO_AGENDAMENTOS, 'r') as f:
                historico = json.load(f)
                if isinstance(historico, list):
                    for reserva in historico:
                        if reserva.get('data_agendamento') == data_escolhida and reserva.get('status') == 'Agendado':
                            ocupados.append(reserva.get('horario'))
        except json.JSONDecodeError:
            pass
            
    return jsonify(ocupados)

@app.route('/admin')
def admin():
    todos_agendamentos = []
    if os.path.exists(ARQUIVO_AGENDAMENTOS) and os.path.getsize(ARQUIVO_AGENDAMENTOS) > 0:
        try:
            with open(ARQUIVO_AGENDAMENTOS, 'r') as f:
                conteudo = json.load(f)
                if isinstance(conteudo, list):
                    todos_agendamentos = conteudo
        except json.JSONDecodeError:
            todos_agendamentos = []
            
    return render_template('admin.html', agendamentos=todos_agendamentos)

@app.route('/admin/cliente/<int:usuario_id>')
def admin_ver_cliente(usuario_id):
    usuario_encontrado = None
    if os.path.exists(ARQUIVO_USUARIOS) and os.path.getsize(ARQUIVO_USUARIOS) > 0:
        with open(ARQUIVO_USUARIOS, 'r') as f:
            usuarios = json.load(f)
            for u in usuarios:
                if u.get('id') == usuario_id:
                    usuario_encontrado = u
                    break
                    
    if not usuario_encontrado:
        return "Cliente não encontrado", 404
        
    return render_template('admin_cliente.html', cliente=usuario_encontrado)

@app.route('/fazer-login', methods=['POST'])
def fazer_login():
    dados = request.get_json()
    acesso = dados.get('acesso')
    senha = dados.get('senha')
    
    agora = time.time()
    bloqueios = {}
    
    with FileLock(f"{ARQUIVO_BLOQUEIOS}.lock"):
        if os.path.exists(ARQUIVO_BLOQUEIOS) and os.path.getsize(ARQUIVO_BLOQUEIOS) > 0:
            try:
                with open(ARQUIVO_BLOQUEIOS, 'r') as f:
                    conteudo = json.load(f)
                    if isinstance(conteudo, dict):
                        bloqueios = conteudo
            except json.JSONDecodeError:
                bloqueios = {}
            
        registro = bloqueios.get(acesso, {"tentativas": 0, "bloqueado_ate": 0})
        
        if registro["bloqueado_ate"] > agora:
            minutos = int((registro["bloqueado_ate"] - agora) / 60) + 1
            return jsonify({"status": "erro", "mensagem": f"Acesso bloqueado. Tente novamente em {minutos} minuto(s)."})
            
        senha_correta = False 
        usuario_logado = None
        
        usuarios = []
        if os.path.exists(ARQUIVO_USUARIOS) and os.path.getsize(ARQUIVO_USUARIOS) > 0:
            try:
                with open(ARQUIVO_USUARIOS, 'r') as f:
                    conteudo = json.load(f)
                    if isinstance(conteudo, list):
                        usuarios = conteudo
            except json.JSONDecodeError:
                usuarios = []
                
            for u in usuarios:
                if u.get('celular') == acesso or u.get('email') == acesso:
                    if u.get('senha') == senha:
                        senha_correta = True
                        usuario_logado = u
                    break
        
        if not senha_correta:
            registro["tentativas"] += 1
            if registro["tentativas"] >= 3:
                registro["bloqueado_ate"] = agora + 300
                registro["tentativas"] = 0
                mensagem = "Acesso bloqueado por 5 minutos por segurança."
            else:
                restantes = 3 - registro["tentativas"]
                mensagem = f"Acesso negado! Usuário ou senha incorretos. Você tem mais {restantes} tentativa(s)."
                
            bloqueios[acesso] = registro
            with open(ARQUIVO_BLOQUEIOS, 'w') as f:
                json.dump(bloqueios, f, indent=4)
                
            return jsonify({"status": "erro", "mensagem": mensagem})
        else:
            bloqueios.pop(acesso, None)
            with open(ARQUIVO_BLOQUEIOS, 'w') as f:
                json.dump(bloqueios, f, indent=4)
                
            lembrar = dados.get('lembrar', False)
            session.permanent = lembrar
                
            session['usuario_id'] = usuario_logado['id']
            session['usuario_nome'] = usuario_logado['nome']
            
            return jsonify({"status": "sucesso"})
        
@app.route('/salvar-cadastro', methods=['POST'])
def salvar_cadastro():
    novo_usuario = request.get_json()
    
    with FileLock(f"{ARQUIVO_USUARIOS}.lock"):
        usuarios = []
        if os.path.exists(ARQUIVO_USUARIOS) and os.path.getsize(ARQUIVO_USUARIOS) > 0:
            try:
                with open(ARQUIVO_USUARIOS, 'r') as f:
                    conteudo = json.load(f)
                    if isinstance(conteudo, list):
                        usuarios = conteudo
            except json.JSONDecodeError:
                usuarios = []
            
        novo_usuario['id'] = len(usuarios) + 1
        usuarios.append(novo_usuario)
        
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump(usuarios, f, indent=4)
            
    return jsonify({"status": "sucesso"})

@app.route('/agendar-logado')
def agendar_logado():
    if 'usuario_id' not in session:
        return redirect(url_for('home'))
        
    usuario_id = session['usuario_id']
    usuario_encontrado = None
    
    if os.path.exists(ARQUIVO_USUARIOS):
        with open(ARQUIVO_USUARIOS, 'r') as f:
            usuarios = json.load(f)
            for u in usuarios:
                if u.get('id') == usuario_id:
                    usuario_encontrado = u
                    break
                    
    return render_template('agendar_logado.html', usuario=usuario_encontrado)

@app.route('/esqueci-senha')
def esqueci_senha():
    return render_template('esqueci_senha.html')

@app.route('/atualizar-senha', methods=['POST'])
def atualizar_senha():
    dados = request.get_json()
    acesso = dados.get('acesso')
    nova_senha = dados.get('nova_senha')
    
    if not acesso or not nova_senha:
        return jsonify({"status": "erro", "mensagem": "Preencha todos os campos!"}), 400
        
    with FileLock(f"{ARQUIVO_USUARIOS}.lock"):
        if not os.path.exists(ARQUIVO_USUARIOS) or os.path.getsize(ARQUIVO_USUARIOS) == 0:
            return jsonify({"status": "erro", "mensagem": "Nenhum usuário cadastrado no sistema."}), 404
            
        try:
            with open(ARQUIVO_USUARIOS, 'r') as f:
                usuarios = json.load(f)
        except json.JSONDecodeError:
            usuarios = []
            
        encontrou = False
        for u in usuarios:
            if u.get('celular') == acesso or u.get('email') == acesso:
                u['senha'] = nova_senha
                encontrou = True
                break
                
        if not encontrou:
            return jsonify({"status": "erro", "mensagem": "E-mail ou celular não encontrado no sistema."}), 404
            
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump(usuarios, f, indent=4)
            
    return jsonify({"status": "sucesso", "mensagem": "Senha alterada com sucesso!"})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

@app.route('/solicitar-recuperacao', methods=['POST'])
def solicitar_recuperacao():
    dados = request.get_json()
    canal = dados.get('canal')
    acesso = dados.get('acesso')
    
    if not acesso:
        return jsonify({"status": "erro", "mensagem": "Informe o e-mail ou celular!"}), 400
        
    with FileLock(f"{ARQUIVO_USUARIOS}.lock"):
        if not os.path.exists(ARQUIVO_USUARIOS) or os.path.getsize(ARQUIVO_USUARIOS) == 0:
            return jsonify({"status": "erro", "mensagem": "Nenhum usuário cadastrado."}), 404
            
        try:
            with open(ARQUIVO_USUARIOS, 'r') as f:
                usuarios = json.load(f)
        except json.JSONDecodeError:
            usuarios = []
            
        encontrou = False
        token = uuid.uuid4().hex
        expiracao = time.time() + 900
        
        for u in usuarios:
            if u.get('celular') == acesso or u.get('email') == acesso:
                u['token_recuperacao'] = token
                u['token_expiracao'] = expiracao
                encontrou = True
                break
                
        if not encontrou:
            return jsonify({"status": "erro", "mensagem": "E-mail ou celular não encontrado no sistema."}), 404
            
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump(usuarios, f, indent=4)
            
    link_redefinicao = f"http://127.0.0.1:5000/redefinir-senha?token={token}"
    return jsonify({"status": "sucesso", "canal": canal, "link": link_redefinicao, "acesso": acesso})

@app.route('/redefinir-senha')
def redefinir_senha():
    token = request.args.get('token')
    if not token:
        return "Token inválido.", 400
        
    with FileLock(f"{ARQUIVO_USUARIOS}.lock"):
        if os.path.exists(ARQUIVO_USUARIOS) and os.path.getsize(ARQUIVO_USUARIOS) > 0:
            try:
                with open(ARQUIVO_USUARIOS, 'r') as f:
                    usuarios = json.load(f)
            except json.JSONDecodeError:
                usuarios = []
                
            for u in usuarios:
                if u.get('token_recuperacao') == token:
                    if time.time() > u.get('token_expiracao', 0):
                        return "Este link de recuperação expirou. Solicite um novo.", 400
                    return render_template('redefinir_senha.html', token=token)
                    
    return "Token inválido ou expirado.", 400

@app.route('/salvar-nova-senha', methods=['POST'])
def salvar_nova_senha():
    dados = request.get_json()
    token = dados.get('token')
    nova_senha = dados.get('nova_senha')
    
    if not token or not nova_senha:
        return jsonify({"status": "erro", "mensagem": "Dados incompletos."}), 400
        
    with FileLock(f"{ARQUIVO_USUARIOS}.lock"):
        if not os.path.exists(ARQUIVO_USUARIOS) or os.path.getsize(ARQUIVO_USUARIOS) == 0:
            return jsonify({"status": "erro", "mensagem": "Erro no sistema."}), 404
            
        try:
            with open(ARQUIVO_USUARIOS, 'r') as f:
                usuarios = json.load(f)
        except json.JSONDecodeError:
            usuarios = []
            
        encontrou = False
        for u in usuarios:
            if u.get('token_recuperacao') == token:
                if time.time() > u.get('token_expiracao', 0):
                    return jsonify({"status": "erro", "mensagem": "Token expirado."}), 400
                
                u['senha'] = nova_senha
                u.pop('token_recuperacao', None)
                u.pop('token_expiracao', None)
                encontrou = True
                break
                
        if not encontrou:
            return jsonify({"status": "erro", "mensagem": "Token inválido."}), 400
            
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump(usuarios, f, indent=4)
            
    return jsonify({"status": "sucesso", "mensagem": "Senha alterada com sucesso!"})

@app.route('/perfil')
def perfil():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return redirect(url_for('home'))
        
    usuario_atual = None
    if os.path.exists(ARQUIVO_USUARIOS) and os.path.getsize(ARQUIVO_USUARIOS) > 0:
        with open(ARQUIVO_USUARIOS, 'r') as f:
            try:
                usuarios = json.load(f)
                for u in usuarios:
                    if u.get('id') == usuario_id:
                        usuario_atual = u
                        break
            except json.JSONDecodeError:
                pass
                
    if not usuario_atual:
        return "Usuário não encontrado", 404
        
    agendamentos_usuario = []
    if os.path.exists(ARQUIVO_AGENDAMENTOS) and os.path.getsize(ARQUIVO_AGENDAMENTOS) > 0:
        with open(ARQUIVO_AGENDAMENTOS, 'r') as f:
            try:
                todos_agendamentos = json.load(f)
                agendamentos_usuario = [a for a in todos_agendamentos if a.get('usuario_id') == usuario_id]
            except json.JSONDecodeError:
                pass
                
    return render_template(
        'perfil.html', 
        usuario=usuario_atual, 
        nome=usuario_atual.get('nome'), 
        agendamentos=agendamentos_usuario
    )

@app.route('/atualizar-perfil', methods=['POST'])
def atualizar_perfil():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"status": "erro", "mensagem": "Sessão expirada. Faça login novamente."}), 401
        
    dados = request.get_json()
    nome = dados.get('nome')
    celular = dados.get('celular')
    email = dados.get('email')
    nascimento = dados.get('nascimento')
    nova_senha = dados.get('nova_senha')
    
    with FileLock(f"{ARQUIVO_USUARIOS}.lock"):
        if not os.path.exists(ARQUIVO_USUARIOS) or os.path.getsize(ARQUIVO_USUARIOS) == 0:
            return jsonify({"status": "erro", "mensagem": "Erro no banco de dados."}), 500
            
        try:
            with open(ARQUIVO_USUARIOS, 'r') as f:
                usuarios = json.load(f)
        except json.JSONDecodeError:
            usuarios = []
            
        encontrou = False
        for u in usuarios:
            if u.get('id') == usuario_id:
                u['nome'] = nome
                u['celular'] = celular
                u['email'] = email
                u['nascimento'] = nascimento
                if nova_senha and nova_senha.strip() != "":
                    u['senha'] = nova_senha.strip()
                encontrou = True
                break
                
        if not encontrou:
            return jsonify({"status": "erro", "mensagem": "Usuário não encontrado."}), 404
            
        with open(ARQUIVO_USUARIOS, 'w') as f:
            json.dump(usuarios, f, indent=4)
            
    session['usuario_nome'] = nome
    return jsonify({"status": "sucesso", "mensagem": "Perfil atualizado com sucesso!"})


# ==========================================
# ROTAS DO PAINEL ADMIN (CONTROLE DE AGENDA)
# ==========================================

def ler_config_agenda():
    if not os.path.exists(ARQUIVO_CONFIG_AGENDA) or os.path.getsize(ARQUIVO_CONFIG_AGENDA) == 0:
        padrao = {"dias_fechados": [0, 1], "excecoes": {}}
        with FileLock(f"{ARQUIVO_CONFIG_AGENDA}.lock"):
            with open(ARQUIVO_CONFIG_AGENDA, 'w') as f:
                json.dump(padrao, f, indent=4)
        return padrao
    with open(ARQUIVO_CONFIG_AGENDA, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"dias_fechados": [0, 1], "excecoes": {}}

def salvar_config_agenda(dados):
    with FileLock(f"{ARQUIVO_CONFIG_AGENDA}.lock"):
        with open(ARQUIVO_CONFIG_AGENDA, 'w') as f:
            json.dump(dados, f, indent=4)

@app.route('/admin/config-agenda', methods=['GET'])
def get_config_agenda():
    return jsonify(ler_config_agenda())

@app.route('/admin/salvar-dias-fixos', methods=['POST'])
def salvar_dias_fixos():
    dados_req = request.get_json()
    config = ler_config_agenda()
    config["dias_fechados"] = dados_req.get("dias_fechados", [])
    salvar_config_agenda(config)
    return jsonify({"status": "sucesso"})

@app.route('/admin/add-excecao', methods=['POST'])
def add_excecao():
    dados_req = request.get_json()
    data = dados_req.get("data")
    tipo = dados_req.get("tipo")
    if not data:
        return jsonify({"status": "erro", "mensagem": "Data não informada"}), 400
    config = ler_config_agenda()
    config["excecoes"][data] = tipo
    salvar_config_agenda(config)
    return jsonify({"status": "sucesso"})

@app.route('/admin/remover-excecao', methods=['POST'])
def remover_excecao():
    dados_req = request.get_json()
    data = dados_req.get("data")
    config = ler_config_agenda()
    if data in config["excecoes"]:
        del config["excecoes"][data]
        salvar_config_agenda(config)
    return jsonify({"status": "sucesso"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)