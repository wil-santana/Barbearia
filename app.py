import os
import time
import uuid
import requests
from datetime import timedelta, datetime, date
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env
load_dotenv()

app = Flask(__name__)
app.secret_key = 'chave_secreta_barbearia'
app.permanent_session_lifetime = timedelta(days=7)

# ==========================================
# CREDENCIAIS DO ADMINISTRADOR
# ==========================================
ADMIN_EMAIL = "admin@barbearia.com"
ADMIN_SENHA = "admin123" # Altere aqui para a senha desejada do painel

# ==========================================
# CONFIGURAÇÃO DO JSONBIN (BANCO DE DADOS NA NUVEM)
# ==========================================
BIN_ID = os.getenv("BIN_ID", "").strip()
API_KEY = os.getenv("API_KEY", "").strip()

URL_JSONBIN = f"https://api.jsonbin.io/v3/b/{BIN_ID}" if BIN_ID else ""

print(f"DEBUG BIN_ID: {BIN_ID}")
print(f"DEBUG API_KEY: {API_KEY}")

HEADERS = {
    "Content-Type": "application/json",
    "X-Master-Key": API_KEY
}

def obter_dados_nuvem():
    if not BIN_ID or not API_KEY:
        print("AVISO: Chaves do JSONBin não configuradas no .env")
        return {"agendamentos": [], "usuarios": [], "bloqueios": {}, "config_agenda": {"dias_fechados": [0, 1], "excecoes": {}}}
        
    resposta = requests.get(URL_JSONBIN, headers=HEADERS)
    if resposta.status_code == 200:
        dados = resposta.json().get("record", {})
    else:
        print(f"❌ ERRO AO LER DO JSONBIN (Código {resposta.status_code}): {resposta.text}")
        dados = {}

    precisa_salvar = False
    if "agendamentos" not in dados:
        dados["agendamentos"] = []
        precisa_salvar = True
    if "usuarios" not in dados:
        dados["usuarios"] = []
        precisa_salvar = True
    if "bloqueios" not in dados:
        dados["bloqueios"] = {}
        precisa_salvar = True
    if "config_agenda" not in dados:
        dados["config_agenda"] = {"dias_fechados": [0, 1], "excecoes": {}}
        precisa_salvar = True
        
    if precisa_salvar:
        salvar_dados_nuvem(dados)
        
    return dados

def salvar_dados_nuvem(dados):
    if BIN_ID and API_KEY:
        print("A tentar enviar dados para o JSONBin...")
        resposta = requests.put(URL_JSONBIN, json=dados, headers=HEADERS)
        if resposta.status_code == 200:
            print("✅ SUCESSO! Dados gravados na nuvem.")
        else:
            print(f"❌ ERRO AO GRAVAR NO JSONBIN (Código {resposta.status_code}): {resposta.text}")

# ==========================================
# ROTAS PÚBLICAS E AUTENTICAÇÃO
# ==========================================

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/visitante')
def visitante():
    return redirect(url_for('home'))

@app.route('/login')
def login():
    return redirect(url_for('home'))

@app.route('/cadastro')
def cadastro():
    return redirect(url_for('home'))

@app.route('/fazer-login', methods=['POST'])
def fazer_login():
    dados_req = request.get_json()
    acesso = dados_req.get('acesso')
    senha = dados_req.get('senha')
    
    # 1. VERIFICA SE É O ADMINISTRADOR TENTANDO LOGAR
    if acesso == ADMIN_EMAIL and senha == ADMIN_SENHA:
        session.permanent = True
        session['admin_logado'] = True
        return jsonify({"status": "sucesso", "redirect": "/admin"})

    agora = time.time()
    banco = obter_dados_nuvem()
    bloqueios = banco["bloqueios"]
    
    registro = bloqueios.get(acesso, {"tentativas": 0, "bloqueado_ate": 0})
    
    if registro["bloqueado_ate"] > agora:
        minutos = int((registro["bloqueado_ate"] - agora) / 60) + 1
        return jsonify({"status": "erro", "mensagem": f"Acesso bloqueado. Tente novamente em {minutos} minuto(s)."})
        
    senha_correta = False 
    usuario_logado = None
    
    for u in banco["usuarios"]:
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
        banco["bloqueios"] = bloqueios
        salvar_dados_nuvem(banco)
        return jsonify({"status": "erro", "mensagem": mensagem})
    else:
        bloqueios.pop(acesso, None)
        banco["bloqueios"] = bloqueios
        salvar_dados_nuvem(banco)
            
        lembrar = dados_req.get('lembrar', False)
        session.permanent = lembrar
        session['usuario_id'] = usuario_logado['id']
        session['usuario_nome'] = usuario_logado['nome']
        
        return jsonify({"status": "sucesso", "redirect": "/perfil"})

@app.route('/salvar-cadastro', methods=['POST'])
def salvar_cadastro():
    novo_usuario = request.get_json()
    banco = obter_dados_nuvem()
    
    novo_usuario['id'] = len(banco["usuarios"]) + 1
    banco["usuarios"].append(novo_usuario)
    salvar_dados_nuvem(banco)
        
    return jsonify({"status": "sucesso"})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

@app.route('/logout-admin')
def logout_admin():
    session.pop('admin_logado', None)
    return redirect(url_for('home'))

# ==========================================
# ROTAS DE AGENDAMENTO
# ==========================================

@app.route('/agendar', methods=['POST'])
def agendar():
    try:
        dados_cliente = request.get_json()
        data_reserva = dados_cliente.get('data_agendamento')
        horario_reserva = dados_cliente.get('horario')
        
        hoje_str = date.today().strftime('%Y-%m-%d')
        agora_str = datetime.now().strftime('%H:%M')
        
        if data_reserva < hoje_str or (data_reserva == hoje_str and horario_reserva < agora_str):
            return jsonify({"status": "erro", "mensagem": "Não é permitido agendar em datas ou horários passados!"}), 400
        
        banco = obter_dados_nuvem()
        config = banco["config_agenda"]
        
        data_obj = datetime.strptime(data_reserva, '%Y-%m-%d').date()
        dia_semana_js = (data_obj.weekday() + 1) % 7
        
        status_excecao = config["excecoes"].get(data_reserva)
        permitido = True
        
        if status_excecao == 'fechado':
            permitido = False
        elif status_excecao == 'aberto':
            permitido = True
        else:
            if dia_semana_js in config.get("dias_fechados", []):
                if dia_semana_js == 6 and config.get("regra_sabado") == "meio_periodo":
                    horas, minutos = map(int, horario_reserva.split(':'))
                    total_minutos = horas * 60 + minutos
                    if total_minutos > 780:
                        permitido = False
                else:
                    permitido = False
                
        if not permitido:
            return jsonify({"status": "erro", "mensagem": "Horário indisponível. A barbearia pode estar fechada nesta data ou horário!"}), 400

        dados_cliente['id'] = len(banco["agendamentos"]) + 1
        if 'usuario_id' in session and not dados_cliente.get('usuario_id'):
            dados_cliente['usuario_id'] = session['usuario_id']

        banco["agendamentos"].append(dados_cliente)
        salvar_dados_nuvem(banco)

        return jsonify({"status": "sucesso"})
    except Exception as e:
        return jsonify({"status": "erro", "mensagem": str(e)}), 500

@app.route('/horarios-ocupados')
def horarios_ocupados():
    data_escolhida = request.args.get('data')
    ocupados = []
    
    if not data_escolhida:
        return jsonify(ocupados)
        
    banco = obter_dados_nuvem()
    for reserva in banco["agendamentos"]:
        if reserva.get('data_agendamento') == data_escolhida and reserva.get('status') == 'Agendado':
            ocupados.append(reserva.get('horario'))
            
    return jsonify(ocupados)

@app.route('/cancelar-agendamento', methods=['POST'])
def cancelar_agendamento():
    dados = request.get_json()
    agendamento_id = dados.get('id')

    if not agendamento_id:
        return jsonify({"status": "erro", "mensagem": "ID do agendamento não informado"}), 400

    banco = obter_dados_nuvem()
    encontrou = False
    
    for reserva in banco["agendamentos"]:
        if str(reserva.get('id')) == str(agendamento_id):
            reserva['status'] = 'Cancelado'
            encontrou = True
            break

    if encontrou:
        salvar_dados_nuvem(banco)
        return jsonify({"status": "sucesso"})

    return jsonify({"status": "erro", "mensagem": "Agendamento não encontrado"}), 404

@app.route('/agendar-logado')
def agendar_logado():
    return redirect(url_for('perfil'))

# ==========================================
# PERFIL E RECUPERAÇÃO DE SENHA
# ==========================================

@app.route('/perfil')
def perfil():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return redirect(url_for('home'))
        
    banco = obter_dados_nuvem()
    usuario_atual = next((u for u in banco["usuarios"] if u.get('id') == usuario_id), None)
        
    if not usuario_atual:
        return "Usuário não encontrado", 404
        
    agendamentos_usuario = [a for a in banco["agendamentos"] if a.get('usuario_id') == usuario_id]
                
    return render_template('perfil.html', usuario=usuario_atual, nome=usuario_atual.get('nome'), agendamentos=agendamentos_usuario)

@app.route('/atualizar-perfil', methods=['POST'])
def atualizar_perfil():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"status": "erro", "mensagem": "Sessão expirada. Faça login novamente."}), 401
        
    dados = request.get_json()
    banco = obter_dados_nuvem()
    
    encontrou = False
    for u in banco["usuarios"]:
        if u.get('id') == usuario_id:
            u['nome'] = dados.get('nome')
            u['celular'] = dados.get('celular')
            u['email'] = dados.get('email')
            u['nascimento'] = dados.get('nascimento')
            if dados.get('nova_senha') and dados.get('nova_senha').strip() != "":
                u['senha'] = dados.get('nova_senha').strip()
            encontrou = True
            break
            
    if not encontrou:
        return jsonify({"status": "erro", "mensagem": "Usuário não encontrado."}), 404
        
    salvar_dados_nuvem(banco)
    session['usuario_nome'] = dados.get('nome')
    return jsonify({"status": "sucesso", "mensagem": "Perfil atualizado com sucesso!"})

@app.route('/esqueci-senha')
def esqueci_senha():
    return render_template('esqueci_senha.html')

@app.route('/solicitar-recuperacao', methods=['POST'])
def solicitar_recuperacao():
    dados = request.get_json()
    canal = dados.get('canal')
    acesso = dados.get('acesso')
    
    if not acesso:
        return jsonify({"status": "erro", "mensagem": "Informe o e-mail ou celular!"}), 400
        
    banco = obter_dados_nuvem()
    if not banco["usuarios"]:
        return jsonify({"status": "erro", "mensagem": "Nenhum usuário cadastrado."}), 404
            
    encontrou = False
    token = uuid.uuid4().hex
    expiracao = time.time() + 900
    
    for u in banco["usuarios"]:
        if u.get('celular') == acesso or u.get('email') == acesso:
            u['token_recuperacao'] = token
            u['token_expiracao'] = expiracao
            encontrou = True
            break
            
    if not encontrou:
        return jsonify({"status": "erro", "mensagem": "E-mail ou celular não encontrado no sistema."}), 404
        
    salvar_dados_nuvem(banco)
            
    link_redefinicao = f"http://127.0.0.1:5000/redefinir-senha?token={token}"
    return jsonify({"status": "sucesso", "canal": canal, "link": link_redefinicao, "acesso": acesso})

@app.route('/redefinir-senha')
def redefinir_senha():
    token = request.args.get('token')
    if not token:
        return "Token inválido.", 400
        
    banco = obter_dados_nuvem()
    for u in banco["usuarios"]:
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
        
    banco = obter_dados_nuvem()
    encontrou = False
    
    for u in banco["usuarios"]:
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
        
    salvar_dados_nuvem(banco)
    return jsonify({"status": "sucesso", "mensagem": "Senha alterada com sucesso!"})

# ==========================================
# PAINEL ADMIN (PROTEGIDO)
# ==========================================

@app.route('/admin')
def admin():
    # 🔒 BLOQUEIA O ACESSO SE NÃO ESTIVER LOGADO COMO ADMIN
    if not session.get('admin_logado'):
        return redirect(url_for('home'))

    hoje = date.today()
    hoje_str = hoje.strftime('%Y-%m-%d')
    agora_str = datetime.now().strftime('%H:%M')
    
    data_inicio_str = request.args.get('inicio', hoje_str)
    data_fim_str = request.args.get('fim', hoje_str)
    
    try:
        d_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
        d_fim = datetime.strptime(data_fim_str, '%Y-%m-%d').date()
    except ValueError:
        d_inicio, d_fim = hoje, hoje
        data_inicio_str, data_fim_str = hoje_str, hoje_str

    mensagem_aviso = None
    if (d_fim - d_inicio).days > 5:
        d_fim = d_inicio + timedelta(days=5)
        data_fim_str = d_fim.strftime('%Y-%m-%d')
        mensagem_aviso = "O período de busca foi ajustado para o máximo permitido (5 dias)."
    elif (d_fim - d_inicio).days < 0:
        d_fim = d_inicio
        data_fim_str = data_inicio_str
    
    banco = obter_dados_nuvem()
    todos_agendamentos = banco["agendamentos"]
            
    agendamentos_filtrados = [
        a for a in todos_agendamentos 
        if data_inicio_str <= a.get('data_agendamento', '') <= data_fim_str
    ]
    
    agendamentos_filtrados = sorted(
        agendamentos_filtrados, 
        key=lambda x: (x.get('data_agendamento', ''), x.get('horario', ''))
    )
    
    return render_template(
        'admin.html', 
        agendamentos=agendamentos_filtrados, 
        hoje=hoje_str, 
        agora=agora_str,
        data_inicio=data_inicio_str,
        data_fim=data_fim_str,
        aviso_filtro=mensagem_aviso
    )

@app.route('/admin/cliente/<int:usuario_id>')
def admin_ver_cliente(usuario_id):
    if not session.get('admin_logado'):
        return redirect(url_for('home'))

    banco = obter_dados_nuvem()
    usuario_encontrado = next((u for u in banco["usuarios"] if u.get('id') == usuario_id), None)
                    
    if not usuario_encontrado:
        return "Cliente não encontrado", 404
        
    return render_template('admin_cliente.html', cliente=usuario_encontrado)

@app.route('/admin/config-agenda', methods=['GET'])
def get_config_agenda():
    banco = obter_dados_nuvem()
    return jsonify(banco["config_agenda"])

@app.route('/admin/salvar-dias-fixos', methods=['POST'])
def salvar_dias_fixos():
    if not session.get('admin_logado'):
        return jsonify({"status": "erro", "mensagem": "Não autorizado"}), 401

    dados_req = request.get_json()
    banco = obter_dados_nuvem()
    
    banco["config_agenda"]["dias_fechados"] = dados_req.get("dias_fechados", [])
    banco["config_agenda"]["regra_sabado"] = dados_req.get("regra_sabado", "dia_todo")
    
    salvar_dados_nuvem(banco)
    return jsonify({"status": "sucesso"})

@app.route('/admin/add-excecao', methods=['POST'])
def add_excecao():
    if not session.get('admin_logado'):
        return jsonify({"status": "erro", "mensagem": "Não autorizado"}), 401

    dados_req = request.get_json()
    data = dados_req.get("data")
    tipo = dados_req.get("tipo")
    if not data:
        return jsonify({"status": "erro", "mensagem": "Data não informada"}), 400
        
    banco = obter_dados_nuvem()
    banco["config_agenda"]["excecoes"][data] = tipo
    salvar_dados_nuvem(banco)
    return jsonify({"status": "sucesso"})

@app.route('/admin/remover-excecao', methods=['POST'])
def remover_excecao():
    if not session.get('admin_logado'):
        return jsonify({"status": "erro", "mensagem": "Não autorizado"}), 401

    dados_req = request.get_json()
    data = dados_req.get("data")
    
    banco = obter_dados_nuvem()
    if data in banco["config_agenda"]["excecoes"]:
        del banco["config_agenda"]["excecoes"][data]
        salvar_dados_nuvem(banco)
        
    return jsonify({"status": "sucesso"})

@app.route('/admin/excluir-agendamento', methods=['POST'])
def admin_excluir_agendamento():
    if not session.get('admin_logado'):
        return jsonify({"status": "erro", "mensagem": "Não autorizado"}), 401

    dados = request.get_json()
    agendamento_id = dados.get('id')

    if not agendamento_id:
        return jsonify({"status": "erro", "mensagem": "ID do agendamento não informado."}), 400

    hoje_str = date.today().strftime('%Y-%m-%d')
    agora_str = datetime.now().strftime('%H:%M')

    banco = obter_dados_nuvem()
    historico = banco["agendamentos"]

    reserva_alvo = None
    index_alvo = -1
    for i, r in enumerate(historico):
        if str(r.get('id')) == str(agendamento_id):
            reserva_alvo = r
            index_alvo = i
            break

    if not reserva_alvo:
        return jsonify({"status": "erro", "mensagem": "Agendamento não encontrado."}), 404

    data_reserva = reserva_alvo.get('data_agendamento', '')
    horario_reserva = reserva_alvo.get('horario', '')
    status_reserva = reserva_alvo.get('status', '')

    is_passado = (data_reserva < hoje_str) or (data_reserva == hoje_str and horario_reserva < agora_str)
    is_cancelado = (status_reserva == 'Cancelado')

    if not (is_cancelado or is_passado):
        return jsonify({
            "status": "erro",
            "mensagem": "Este agendamento ainda está ativo! Cancele o agendamento antes de excluí-lo."
        }), 400

    historico.pop(index_alvo)
    banco["agendamentos"] = historico
    salvar_dados_nuvem(banco)

    return jsonify({"status": "sucesso"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)