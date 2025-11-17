# models.py (COMPLETO E CORRIGIDO)

from peewee import *
import datetime
# Importações necessárias para Login/Segurança
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash 

# Conexão com o banco de dados
db = SqliteDatabase("livros.db")


class BaseModel(Model):
    class Meta:
        database = db


# ------------------------------
# Modelo: Livro
# ------------------------------
class Livro(BaseModel):
    id = AutoField()
    titulo = CharField()
    autor = CharField()
    ano = IntegerField()
    # Campo 'disponivel' removido, pois a disponibilidade é calculada.


# ------------------------------
# Modelo: Emprestimo (CORRIGIDO: Resolve o ImportError)
# ------------------------------
class Emprestimo(BaseModel):
    id = AutoField()
    livro = ForeignKeyField(Livro, backref='emprestimos') 
    nome_usuario = CharField()
    data_emprestimo = DateTimeField(default=datetime.datetime.now)
    data_devolucao = DateTimeField(null=True) 

    class Meta:
        # Garante que um livro não pode ter dois empréstimos abertos
        indexes = (
            (('livro', 'data_devolucao'), False), 
        )


# ------------------------------
# Modelo: Usuario (Para o Login)
# ------------------------------
class Usuario(BaseModel, UserMixin): # Herda de UserMixin para Flask-Login
    id = AutoField()
    username = CharField(unique=True)
    password_hash = CharField()
    is_admin = BooleanField(default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


# ------------------------------
# Criação das tabelas e dados iniciais
# ------------------------------
def init_db():
    db.connect(reuse_if_open=True)
    # Garante que as três tabelas (Livro, Emprestimo, Usuario) sejam criadas
    db.create_tables([Livro, Emprestimo, Usuario], safe=True) 
    
    # Cria um usuário administrador inicial
    if Usuario.select().count() == 0:
        admin = Usuario(username="admin", is_admin=True)
        # Atenção: Altere esta senha em um ambiente real!
        admin.set_password("123456") 
        admin.save()
        print("Usuário Admin criado: username='admin', senha='123456'")

    if Livro.select().count() == 0:
        Livro.create(titulo="Estruturas de Dados", autor="N. Wirth", ano=1976)
        Livro.create(titulo="Clean Code", autor="R. Martin", ano=2008)
        Livro.create(titulo="Python para Iniciantes", autor="Jesiel Pedroza", ano=2025)
    db.close()