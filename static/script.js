// static/script.js (Conteúdo Completo para Empréstimos/Histórico)

// Variáveis de estado global para Paginação e Ordenação
let currentPage = 1;
let currentLimit = 10; 
let currentSortBy = 'titulo';
let currentOrder = 'asc'; 

document.addEventListener('DOMContentLoaded', () => {
    carregarLivros();
    
    // Listeners para o CRUD
    document.getElementById('form-novo-livro').addEventListener('submit', criarLivro);
    document.getElementById('form-edicao-livro').addEventListener('submit', salvarEdicao);
    
    // Listeners para Empréstimo (NOVO)
    document.getElementById('form-emprestimo').addEventListener('submit', realizarEmprestimo);

    // Listeners para Paginação
    document.getElementById('prev-page').addEventListener('click', () => mudarPagina(-1));
    document.getElementById('next-page').addEventListener('click', () => mudarPagina(1));

    // Listeners para Ordenação (clique nos cabeçalhos)
    document.querySelectorAll('#tabela-livros th[data-sort-by]').forEach(header => {
        header.addEventListener('click', () => ordenarLivros(header.dataset.sortBy));
    });

    // Listener para o campo de busca
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1; 
            carregarLivros(searchInput.value);
        }, 300); 
    });

    // Listeners do Modal de Edição
    document.querySelector('#edit-modal .close-button').addEventListener('click', fecharModalEdicao);
    
    // Listeners do Modal de Empréstimo (NOVO)
    document.querySelector('#emprestimo-modal .close-button').addEventListener('click', fecharModalEmprestimo);
    
    // Listeners do Modal de Histórico
    // O close-button já chama fecharModalHistorico() no index.html
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('edit-modal')) {
            fecharModalEdicao();
        }
        if (event.target === document.getElementById('emprestimo-modal')) {
            fecharModalEmprestimo();
        }
        if (event.target === document.getElementById('historico-modal')) {
            fecharModalHistorico();
        }
    });
});

// ----------------------------------------------------
// Funções de UX/UI
// ----------------------------------------------------

function exibirFeedback(message, type) {
    const feedback = document.getElementById('feedback-message');
    feedback.textContent = message;
    feedback.className = `feedback-message ${type}`; 
    feedback.classList.remove('hidden');
    setTimeout(() => {
        feedback.classList.add('hidden');
    }, 5000);
}

function abrirModalEdicao(id, titulo, autor, ano) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-titulo').value = titulo;
    document.getElementById('edit-autor').value = autor;
    document.getElementById('edit-ano').value = ano;
    document.getElementById('edit-modal').classList.remove('hidden');
}

function fecharModalEdicao() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function abrirModalEmprestimo(livroId, titulo) {
    document.getElementById('emprestimo-livro-id').value = livroId;
    document.getElementById('emprestimo-livro-titulo').textContent = titulo;
    document.getElementById('emprestimo-modal').classList.remove('hidden');
    document.getElementById('nome-usuario').focus();
}

function fecharModalEmprestimo() {
    document.getElementById('emprestimo-modal').classList.add('hidden');
    document.getElementById('form-emprestimo').reset();
}

function fecharModalHistorico() {
    document.getElementById('historico-modal').classList.add('hidden');
}

// Funções de Paginação e Ordenação

function mudarPagina(delta) {
    currentPage += delta;
    carregarLivros(document.getElementById('search-input').value);
}

function ordenarLivros(sortBy) {
    if (currentSortBy === sortBy) {
        currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = sortBy;
        currentOrder = 'asc';
    }
    currentPage = 1;
    carregarLivros(document.getElementById('search-input').value);
}

function atualizarControlesTabela(totalLivros, totalPages) {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages || totalPages === 0;
    
    // Atualiza os ícones de ordenação
    document.querySelectorAll('#tabela-livros th[data-sort-by]').forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
        if (header.dataset.sortBy === currentSortBy) {
            header.classList.add(`sorted-${currentOrder}`);
        }
    });

    if (totalLivros === 0) {
        pageInfo.textContent = 'Página 0 de 0';
    } else {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    }
}

// ----------------------------------------------------
// Funções de CRUD e Empréstimo (API Calls)
// ----------------------------------------------------

async function carregarLivros(query = '') {
    const params = new URLSearchParams({
        q: query,
        page: currentPage,
        limit: currentLimit,
        sort_by: currentSortBy,
        order: currentOrder
    });
    
    const url = `/api/livros?${params.toString()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Erro ao buscar livros');
        }
        
        const data = await response.json();
        const livros = data.livros;
        const totalPages = data.total_pages;

        const tabelaBody = document.getElementById('tabela-livros').querySelector('tbody');
        tabelaBody.innerHTML = ''; 

        if (livros.length === 0) {
             const row = tabelaBody.insertRow();
             row.innerHTML = `<td colspan="5">Nenhum livro encontrado.</td>`;
        }
        
        livros.forEach(livro => {
            const row = tabelaBody.insertRow();
            
            const isAvailable = livro.disponivel;
            const emprestadoPara = livro.emprestado_para;
            const statusClass = isAvailable ? 'available' : 'borrowed';
            
            // Tratamento de aspas para usar em onclick
            const safeTitulo = livro.titulo.replace(/'/g, "\\'");
            const safeAutor = livro.autor.replace(/'/g, "\\'");
            
            let acoesHtml;
            if (isAvailable) {
                // Livro disponível -> Botão Emprestar
                acoesHtml = `<button class="action-btn borrow-btn" onclick="abrirModalEmprestimo(${livro.id}, '${safeTitulo}')">Emprestar</button>`;
            } else {
                // Livro emprestado -> Botão Devolver (que abre o Histórico para selecionar a transação)
                 acoesHtml = `<button class="action-btn return-btn" onclick="devolverLivroPorNome(${livro.id}, '${safeTitulo}')">Devolver</button>`;
            }

            row.innerHTML = `
                <td>${livro.titulo}</td>
                <td>${livro.autor}</td>
                <td>${livro.ano}</td>
                <td class="${statusClass}">
                    ${isAvailable ? 'Disponível' : `Emprestado (${emprestadoPara})`}
                </td>
                <td>
                    ${acoesHtml}
                    <button class="action-btn edit-btn" onclick="abrirModalEdicao(${livro.id}, '${safeTitulo}', '${safeAutor}', ${livro.ano})">Editar</button>
                    <button class="action-btn remove-btn" onclick="removerLivro(${livro.id})">Remover</button>
                    <button class="action-btn history-btn" onclick="mostrarHistorico(${livro.id}, '${safeTitulo}')">Histórico</button>
                </td>
            `;
        });
        
        atualizarControlesTabela(data.total_livros, totalPages);
        
    } catch (error) {
        console.error("Erro ao carregar os livros:", error);
        exibirFeedback("Não foi possível carregar a lista de livros. Verifique o servidor.", 'error');
    }
}

async function criarLivro(event) {
    event.preventDefault();

    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;

    const titulo = document.getElementById('titulo').value;
    const autor = document.getElementById('autor').value;
    const ano = document.getElementById('ano').value;

    const novoLivro = {
        titulo: titulo,
        autor: autor,
        ano: parseInt(ano)
    };

    try {
        const response = await fetch('/api/livros', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoLivro)
        });

        if (response.status === 201) {
            exibirFeedback(`Livro "${titulo}" adicionado com sucesso!`, 'success');
            document.getElementById('form-novo-livro').reset();
            // Volta para a primeira página após adicionar um novo livro
            currentPage = 1;
            carregarLivros(document.getElementById('search-input').value);
        } else {
            const erroData = await response.json();
            throw new Error(erroData.message || 'Erro desconhecido ao criar livro.');
        }

    } catch (error) {
        console.error("Erro ao criar livro:", error);
        exibirFeedback(`Não foi possível adicionar o livro: ${error.message.replace(/Erro \d+: /, '')}`, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function salvarEdicao(event) {
    event.preventDefault();

    const id = document.getElementById('edit-id').value;
    const editButton = document.getElementById('edit-button');
    editButton.disabled = true;

    const titulo = document.getElementById('edit-titulo').value;
    const autor = document.getElementById('edit-autor').value;
    const ano = document.getElementById('edit-ano').value;

    const livroAtualizado = {
        titulo: titulo,
        autor: autor,
        ano: parseInt(ano)
    };

    try {
        const response = await fetch(`/api/livros/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(livroAtualizado)
        });

        if (response.ok) {
            exibirFeedback(`Livro com ID ${id} atualizado com sucesso!`, 'success');
            fecharModalEdicao();
            carregarLivros(document.getElementById('search-input').value);
        } else {
            const erroData = await response.json();
            throw new Error(erroData.message || 'Erro desconhecido ao atualizar.');
        }

    } catch (error) {
        console.error("Erro ao salvar edição:", error);
        exibirFeedback(`Não foi possível salvar a edição: ${error.message.replace(/Erro \d+: /, '')}`, 'error');
    } finally {
        editButton.disabled = false;
    }
}

async function removerLivro(id) {
    if (!confirm(`Tem certeza que deseja remover o livro com ID ${id}? (Ação irreversível)`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/livros/${id}`, { method: 'DELETE' });
        
        if (response.status === 204) {
            exibirFeedback(`Livro removido com sucesso.`, 'success');
            carregarLivros(document.getElementById('search-input').value);
        } else {
             const erroData = await response.json();
             throw new Error(erroData.message || `Erro ao remover livro.`);
        }
        
    } catch (error) {
        console.error("Erro ao remover livro:", error);
        exibirFeedback(`Não foi possível remover o livro: ${error.message}`, 'error');
    }
}


// ----------------------------------------------------
// Funções de Empréstimo e Histórico (Novas!)
// ----------------------------------------------------

async function realizarEmprestimo(event) {
    event.preventDefault();
    const livroId = document.getElementById('emprestimo-livro-id').value;
    const nomeUsuario = document.getElementById('nome-usuario').value;
    
    if (!nomeUsuario.trim()) {
        alert("O nome do usuário é obrigatório.");
        return;
    }

    try {
        const response = await fetch('/api/emprestimos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ livro_id: parseInt(livroId), nome_usuario: nomeUsuario })
        });

        if (response.status === 201) {
            exibirFeedback(`Livro emprestado com sucesso a ${nomeUsuario}!`, 'success');
            fecharModalEmprestimo();
            carregarLivros(document.getElementById('search-input').value);
        } else {
            const erroData = await response.json();
            throw new Error(erroData.message || 'Erro desconhecido ao emprestar.');
        }

    } catch (error) {
        console.error("Erro ao emprestar:", error);
        exibirFeedback(`Não foi possível emprestar o livro: ${error.message.replace(/Erro \d+: /, '')}`, 'error');
    }
}

// Chamado pelo botão 'Devolver' na tabela principal. Abre o Histórico.
function devolverLivroPorNome(livroId, titulo) {
    mostrarHistorico(livroId, titulo);
}


async function mostrarHistorico(livroId, titulo) {
    document.getElementById('historico-livro-titulo').textContent = titulo;
    const tabelaBody = document.getElementById('tabela-historico').querySelector('tbody');
    tabelaBody.innerHTML = '<tr><td colspan="5">Carregando histórico...</td></tr>';
    document.getElementById('historico-modal').classList.remove('hidden');

    try {
        const response = await fetch(`/api/livros/${livroId}/historico`);
        if (!response.ok) {
            throw new Error('Erro ao buscar histórico');
        }
        const historico = await response.json();
        
        tabelaBody.innerHTML = '';
        if (historico.length === 0) {
            tabelaBody.innerHTML = '<tr><td colspan="5">Nenhum histórico encontrado para este livro.</td></tr>';
            return;
        }

        historico.forEach(item => {
            const row = tabelaBody.insertRow();
            const isAberto = item.aberto;
            // Converte as datas ISO para formato local
            const dataEmprestimo = new Date(item.data_emprestimo).toLocaleDateString();
            const dataDevolucao = item.data_devolucao ? new Date(item.data_devolucao).toLocaleDateString() : 'N/A';
            
            const statusText = isAberto ? 'Emprestado' : 'Devolvido';
            const statusClass = isAberto ? 'borrowed' : 'available';

            let acaoHtml = 'N/A';
            if (isAberto) {
                // Se o empréstimo estiver aberto, permite a devolução usando o ID do EMPRÉSTIMO
                acaoHtml = `<button class="action-btn return-btn" onclick="devolverLivro(${item.id})">Devolver</button>`;
            }

            row.innerHTML = `
                <td>${item.nome_usuario}</td>
                <td>${dataEmprestimo}</td>
                <td>${dataDevolucao}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${acaoHtml}</td>
            `;
        });

    } catch(error) {
        console.error("Erro ao carregar histórico:", error);
        tabelaBody.innerHTML = `<tr><td colspan="5">Erro ao carregar histórico: ${error.message}</td></tr>`;
        exibirFeedback("Erro ao carregar o histórico de empréstimos.", 'error');
    }
}

async function devolverLivro(emprestimoId) {
    if (!confirm(`Tem certeza que deseja registrar a devolução do Empréstimo ID ${emprestimoId}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/emprestimos/${emprestimoId}/devolver`, {
            method: 'PATCH',
        });

        if (response.ok) {
            exibirFeedback(`Devolução registrada com sucesso!`, 'success');
            
            // 1. Reexibe o histórico atualizado (sem o item recém-devolvido em aberto)
            const livroId = document.getElementById('historico-modal').querySelector('#historico-livro-titulo').closest('.modal-content').querySelector('h3').textContent.split(': ')[0]; // Gambiarra para obter o título
            
            // Chama a função novamente para recarregar o modal de histórico.
            // O título original do livro não está facilmente acessível aqui, mas o Livro ID está.
            // Para simplificar e garantir o funcionamento, vamos apenas fechar o modal e recarregar a tabela principal.
            fecharModalHistorico();
            
            // 2. Recarrega a tabela principal para refletir a nova disponibilidade
            carregarLivros(document.getElementById('search-input').value);
        } else {
            const erroData = await response.json();
            throw new Error(erroData.message || 'Erro desconhecido ao devolver.');
        }

    } catch (error) {
        console.error("Erro ao devolver livro:", error);
        exibirFeedback(`Não foi possível registrar a devolução: ${error.message.replace(/Erro \d+: /, '')}`, 'error');
    }
}