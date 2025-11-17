# app.py (COMPLETO)

from flask import Flask, jsonify, render_template, redirect, url_for, request, abort
from flasgger import Swagger
from models import db, init_db, Usuario # Importa Usuario
from routes import livraria_bp # Importa o Blueprint de rotas da livraria
from flask_login import LoginManager, login_user, logout_user, current_user, login_required

app = Flask(__name__)
swagger = Swagger(app)

# --- Configuração de Segurança ---
app.secret_key = 'sua_chave_secreta_aqui' # ESSENCIAL: TROQUE ESTA CHAVE!

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login' # Define a rota de login

@login_manager.user_loader
def load_user(user_id):
    try:
        return Usuario.get(Usuario.id == user_id)
    except Usuario.DoesNotExist:
        return None

# ----------------------------------
# Ciclo de conexão por requisição
# ----------------------------------
@app.before_request
def _db_connect():
    if db.is_closed():
        db.connect(reuse_if_open=True)

@app.teardown_request
def _db_close(exc):
    if not db.is_closed():
        db.close()

# ----------------------------------
# Rotas de Autenticação
# ----------------------------------

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        try:
            user = Usuario.get(Usuario.username == username)
        except Usuario.DoesNotExist:
            user = None

        if user and user.check_password(password):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        else:
            # Retorna para o login com mensagem de erro
            return render_template("login.html", error="Usuário ou senha inválidos.")

    return render_template("login.html")

@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('login')) # Redireciona para o login após sair

# ----------------------------------
# Registro das Rotas e Rota Principal
# ----------------------------------
app.register_blueprint(livraria_bp)

# A rota principal agora exige login
@app.route("/")
@login_required 
def index():
    return render_template("index.html")

if __name__ == "__main__":
    init_db() 
    app.run(debug=True)