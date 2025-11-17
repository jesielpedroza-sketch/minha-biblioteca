# routes.py (Versão Final e Corrigida)

from flask import Blueprint, jsonify, request, abort
from peewee import IntegrityError
from models import Livro, Emprestimo, db
import datetime

# Define o Blueprint para agrupar as rotas
livraria_bp = Blueprint('livraria', __name__, url_prefix='/api')


# ----------------------------------
# Variáveis e Funções Auxiliares (Faltando na sua versão)
# ----------------------------------

SORT_FIELDS = {
    'titulo': Livro.titulo,
    'autor': Livro.autor,
    'ano': Livro.ano,
    'id': Livro.id
}

def get_emprestimo_aberto(livro_id):
    """Retorna o objeto Emprestimo aberto ou None."""
    try:
        return Emprestimo.get(
            (Emprestimo.livro_id == livro_id) & (Emprestimo.data_devolucao.is_null())
        )
    except Emprestimo.DoesNotExist:
        return None

def is_livro_emprestado(livro_id):
    """Verifica se há um Empréstimo em aberto para o livro."""
    return Emprestimo.select().where(
        (Emprestimo.livro_id == livro_id) & (Emprestimo.data_devolucao.is_null())
    ).exists()

# ----------------------------------
# Rotas de Livros (Listagem/Paginação/Busca - VERSÃO CORRETA E COMPLETA)
# ----------------------------------
@livraria_bp.get("/livros")
def listar_livros():
    search_query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    sort_by = request.args.get('sort_by', 'titulo')
    order = request.args.get('order', 'asc').lower()
    
    if sort_by not in SORT_FIELDS or order not in ['asc', 'desc']:
        abort(400, description="Parâmetros de ordenação inválidos.")
    
    query = Livro.select()
    
    if search_query:
        query = query.where(
            (Livro.titulo.contains(search_query)) | 
            (Livro.autor.contains(search_query))
        )

    order_field = SORT_FIELDS[sort_by]
    if order == 'desc':
        query = query.order_by(order_field.desc())
    else:
        query = query.order_by(order_field.asc())

    total_livros = query.count()
    total_pages = (total_livros + limit - 1) // limit if total_livros > 0 else 1

    if page < 1 or page > total_pages:
        page = 1 if total_livros > 0 else 0

    offset = (page - 1) * limit
    paginated_query = query.limit(limit).offset(offset)

    lst = []
    for livro in paginated_query:
        # **Calcula a disponibilidade usando o novo modelo Emprestimo**
        emprestimo_aberto = get_emprestimo_aberto(livro.id)
        
        item = {
            'id': livro.id,
            'titulo': livro.titulo,
            'autor': livro.autor,
            'ano': livro.ano,
            'disponivel': emprestimo_aberto is None, # Calculado!
            'emprestado_para': emprestimo_aberto.nome_usuario if emprestimo_aberto else None
        }
        lst.append(item)
    
    return jsonify({
        'livros': lst,
        'total_livros': total_livros,
        'total_pages': total_pages,
        'current_page': page,
        'limit': limit
    })

# Rota POST /api/livros
@livraria_bp.post("/livros")
def criar_livro():
    data = request.get_json(force=True) or {}
    obrig = ["titulo", "autor", "ano"]
    if not all(k in data for k in obrig):
        abort(400, description="Campos obrigatórios: titulo, autor, ano.")

    titulo = str(data["titulo"]).strip()
    autor = str(data["autor"]).strip()
    
    if not titulo or not autor:
        abort(400, description="Título e Autor não podem ser vazios.")

    try:
        ano = int(data["ano"])
        if ano > datetime.date.today().year + 1 or ano < 1000:
             abort(400, description="O ano do livro é inválido.")
    except ValueError:
        abort(400, description="O campo 'ano' deve ser um número inteiro.")

    try:
        livro_criado = Livro.create(titulo=titulo, autor=autor, ano=ano)
    except IntegrityError:
        abort(400, description="Erro ao salvar o livro no banco de dados.")

    return jsonify({
        'id': livro_criado.id,
        'titulo': livro_criado.titulo,
        'autor': livro_criado.autor,
        'ano': livro_criado.ano,
        'disponivel': True,
        'emprestado_para': None
    }), 201

# Rota PUT /api/livros/<int:lid> (Edição)
@livraria_bp.put("/livros/<int:lid>")
def atualizar_livro(lid):
    data = request.get_json(force=True) or {}
    obrig = ["titulo", "autor", "ano"] 
    if not all(k in data for k in obrig):
        abort(400, description="Campos obrigatórios: titulo, autor, ano.")

    try:
        livro = Livro.get(Livro.id == lid)
    except Livro.DoesNotExist:
        abort(404, description="Livro não encontrado")

    titulo = str(data["titulo"]).strip()
    autor = str(data["autor"]).strip()

    if not titulo or not autor:
        abort(400, description="Título e Autor não podem ser vazios.")

    try:
        ano = int(data["ano"])
        if ano > datetime.date.today().year + 1 or ano < 1000:
             abort(400, description="O ano do livro é inválido.")
    except ValueError:
        abort(400, description="O campo 'ano' deve ser um número inteiro.")

    livro.titulo = titulo
    livro.autor = autor
    livro.ano = ano
    livro.save()
    
    emprestimo_aberto = get_emprestimo_aberto(livro.id)
    return jsonify({
        'id': livro.id,
        'titulo': livro.titulo,
        'autor': livro.autor,
        'ano': livro.ano,
        'disponivel': emprestimo_aberto is None,
        'emprestado_para': emprestimo_aberto.nome_usuario if emprestimo_aberto else None
    })

# Rota DELETE /api/livros/<int:lid>
@livraria_bp.delete("/livros/<int:lid>")
def remover_livro(lid):
    try:
        livro = Livro.get(Livro.id == lid)
    except Livro.DoesNotExist:
        abort(404, description="Livro não encontrado")

    # Verifica se há empréstimo aberto (Usa a função auxiliar CORRETA)
    if is_livro_emprestado(lid):
         abort(400, description="Não é possível remover o livro, pois ele está emprestado.")
        
    livro.delete_instance()
    
    return "", 204

# ----------------------------------
# Rotas de Empréstimos (CORRIGIDAS)
# ----------------------------------

# Rota POST /api/emprestimos (Emprestar um livro)
@livraria_bp.post("/emprestimos")
def emprestar_livro():
    data = request.get_json(force=True) or {}
    if not all(k in data for k in ["livro_id", "nome_usuario"]):
        abort(400, description="Campos obrigatórios: livro_id, nome_usuario.")
    
    livro_id = data["livro_id"]
    nome_usuario = str(data["nome_usuario"]).strip()

    if not nome_usuario:
        abort(400, description="Nome do usuário não pode ser vazio.")

    try:
        livro = Livro.get(Livro.id == livro_id)
    except Livro.DoesNotExist:
        abort(404, description="Livro não encontrado.")

    if is_livro_emprestado(livro_id):
        abort(400, description="O livro já está emprestado.")

    try:
        # AQUI USAMOS O OBJETO 'livro' (ForeignKeyField)
        novo_emprestimo = Emprestimo.create(
            livro=livro, 
            nome_usuario=nome_usuario
        )
    except IntegrityError:
         abort(500, description="Erro interno ao registrar empréstimo.")
    
    return jsonify({
        'id': novo_emprestimo.id,
        'livro_id': livro_id,
        'nome_usuario': nome_usuario,
        'data_emprestimo': novo_emprestimo.data_emprestimo.isoformat()
    }), 201

# Rota PATCH /api/emprestimos/<int:eid>/devolver (Devolver um livro)
@livraria_bp.patch("/emprestimos/<int:eid>/devolver")
def devolver_livro(eid):
    try:
        emprestimo = Emprestimo.get(Emprestimo.id == eid)
    except Emprestimo.DoesNotExist:
        abort(404, description="Empréstimo não encontrado.")

    if emprestimo.data_devolucao is not None:
        abort(400, description="Este empréstimo já foi devolvido.")

    emprestimo.data_devolucao = datetime.datetime.now()
    emprestimo.save()

    return jsonify({
        'id': emprestimo.id,
        'livro_id': emprestimo.livro_id,
        'nome_usuario': emprestimo.nome_usuario,
        'data_devolucao': emprestimo.data_devolucao.isoformat()
    })

# Rota GET /api/livros/<int:lid>/historico (Histórico de Empréstimos)
@livraria_bp.get("/livros/<int:lid>/historico")
def historico_emprestimos(lid):
    """Lista o histórico de empréstimos de um livro."""
    try:
        livro = Livro.get(Livro.id == lid)
    except Livro.DoesNotExist:
        abort(404, description="Livro não encontrado.")

    # Filtra usando o objeto 'livro'
    historico = Emprestimo.select().where(Emprestimo.livro == livro).order_by(Emprestimo.data_emprestimo.desc())

    lst = []
    for emp in historico:
        lst.append({
            'id': emp.id,
            'nome_usuario': emp.nome_usuario,
            'data_emprestimo': emp.data_emprestimo.isoformat(),
            'data_devolucao': emp.data_devolucao.isoformat() if emp.data_devolucao else None,
            'aberto': emp.data_devolucao is None
        })
    
    return jsonify(lst)