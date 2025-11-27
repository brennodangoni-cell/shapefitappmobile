
/**
 * Script Inline Protegido - inline_4
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

let checkinData = window.checkinData || null;
let currentQuestionIndex = 0;
let checkinResponses = {};
let savedResponses = {};
let answeredQuestionIds = [];

function openCheckinModal() {
    const modal = document.getElementById('checkinModal');
    if (!modal) {
        console.error('Modal de checkin não encontrado');
        return;
    }
    
    // Verificar se há checkin disponível
    if (!checkinData && window.checkinData) {
        checkinData = window.checkinData;
    }
    
    if (!checkinData) {
        console.error('Nenhum checkin disponível');
        alert('Nenhum check-in disponível no momento.');
        return;
    }
    
    // Abrir modal - garantir que está visível
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.setAttribute('aria-hidden', 'false');
    
        // Bloquear scroll do body (sem alterar posicionamento fixo do layout)
        document.body.classList.add('checkin-modal-open');
    
    // Limpar mensagens anteriores
    const messagesContainer = document.getElementById('checkinMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    
    // Configurar event listeners quando o modal abre
    setupCheckinModalEvents();
    
    // Garantir que o scroll funcione no chat (touch) - SOLUÇÃO ROBUSTA
    setTimeout(() => {
        const messagesContainer = document.getElementById('checkinMessages');
        if (messagesContainer) {
            // Forçar propriedades de scroll touch via JavaScript
            messagesContainer.style.overflowY = 'scroll';
            messagesContainer.style.webkitOverflowScrolling = 'touch';
            messagesContainer.style.touchAction = 'pan-y';
            messagesContainer.style.overflowScrolling = 'touch';
            messagesContainer.style.pointerEvents = 'auto';
            
            // Remover qualquer listener que possa estar bloqueando
            messagesContainer.addEventListener('touchstart', function(e) {
                // Permitir que o scroll aconteça naturalmente
                // Não fazer preventDefault aqui
            }, { passive: true });
            
            messagesContainer.addEventListener('touchmove', function(e) {
                // Permitir scroll natural - NÃO bloquear
                // Se o elemento está scrollando, não fazer nada
                const element = e.currentTarget;
                const isScrolling = element.scrollHeight > element.clientHeight;
                
                if (isScrolling) {
                    // Se há conteúdo para scrollar, permitir
                    // Não fazer preventDefault
                }
            }, { passive: true });
            
            messagesContainer.addEventListener('touchend', function(e) {
                // Permitir que o touch end aconteça normalmente
            }, { passive: true });
            
            // Garantir que o elemento tenha conteúdo suficiente para scrollar
            if (messagesContainer.scrollHeight <= messagesContainer.clientHeight) {
                // Adicionar padding bottom temporário para forçar scroll
                messagesContainer.style.paddingBottom = '100px';
            }
            
            console.log('[Check-in] Scroll touch configurado - scrollHeight:', messagesContainer.scrollHeight, 'clientHeight:', messagesContainer.clientHeight);
        }
    }, 100);
    
    // Carregar progresso salvo
    loadCheckinProgress();
}

// Flag para evitar adicionar listeners múltiplas vezes
let checkinModalEventsSetup = false;

function setupCheckinModalEvents() {
    const modal = document.getElementById('checkinModal');
    if (!modal) return;
    
    // Se já configurado, não fazer novamente
    if (checkinModalEventsSetup && modal.dataset.eventsSetup === 'true') {
        return;
    }
    
    // Fechar ao clicar no background (fora do container)
    modal.addEventListener('click', function modalClickHandler(e) {
        // Se clicou diretamente no modal (background), fechar
        // MAS não fechar se o clique foi no container ou dentro dele
        const container = modal.querySelector('.checkin-chat-container');
        if (e.target === modal || (e.target.classList.contains('checkin-modal') && !container.contains(e.target))) {
            e.preventDefault();
            e.stopPropagation();
            closeCheckinModal();
            return false;
        }
    });
    
    // Também funcionar com touch - mas só se não foi no container
    modal.addEventListener('touchend', function modalTouchHandler(e) {
        const container = modal.querySelector('.checkin-chat-container');
        if ((e.target === modal || e.target.classList.contains('checkin-modal')) && !container.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            closeCheckinModal();
            return false;
        }
    }, { passive: false });
    
    // Garantir que o botão de fechar funcione
    const closeBtn = modal.querySelector('.checkin-close-btn');
    if (closeBtn) {
        // Remover todos os event listeners antigos
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        // Adicionar event listeners diretos
        newCloseBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Check-in] Botão X clicado');
            closeCheckinModal();
            return false;
        };
        
        newCloseBtn.ontouchend = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Check-in] Botão X tocado');
            closeCheckinModal();
            return false;
        };
        
        // Também adicionar via addEventListener como backup
        newCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeCheckinModal();
        }, true);
        
        newCloseBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeCheckinModal();
        }, true);
    }
    
    // Prevenir que cliques dentro do container fechem o modal
    const container = modal.querySelector('.checkin-chat-container');
    if (container) {
        container.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Marcar como configurado
    modal.dataset.eventsSetup = 'true';
    checkinModalEventsSetup = true;
}

function closeCheckinModal() {
    const modal = document.getElementById('checkinModal');
    if (!modal) {
        console.error('[Check-in] Modal não encontrado para fechar');
        return;
    }
    
    // Salvar progresso antes de fechar o modal
    if (checkinData && Object.keys(checkinResponses).length > 0) {
        saveCheckinProgressToLocalStorage();
        console.log('[Check-in] Progresso salvo ao fechar modal');
    }
    
    // Forçar fechamento do modal - múltiplas formas para garantir
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.setAttribute('aria-hidden', 'true');
    
    // Restaurar scroll do body
    document.body.classList.remove('checkin-modal-open');
    
    console.log('[Check-in] Modal fechado - display:', modal.style.display, 'classList:', modal.classList.toString());
    
    // Não resetar o progresso - manter para continuar depois
}

// Configurar eventos iniciais do modal (fallback caso o modal já esteja no DOM)
document.addEventListener('DOMContentLoaded', function() {
    setupCheckinModalEvents();
});

// Função para calcular o domingo da semana atual (mesma lógica do backend)
function getCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, etc.
    const diff = dayOfWeek; // Diferença até o domingo (0 se já for domingo)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - diff);
    sunday.setHours(0, 0, 0, 0);
    // Formato YYYY-MM-DD
    return sunday.toISOString().split('T')[0];
}

function loadCheckinProgress() {
    // Primeiro, tentar carregar do localStorage (progresso local)
    const currentWeek = getCurrentWeekStart();
    const storageKey = `checkin_progress_${checkinData.id}_${currentWeek}`;
    const savedProgress = localStorage.getItem(storageKey);
    
    if (savedProgress) {
        try {
            const progress = JSON.parse(savedProgress);
            console.log('[Check-in] Progresso carregado do localStorage:', progress);
            
            // Verificar se o progresso é da semana atual
            const savedWeek = progress.week_start || progress.week_date;
            if (savedWeek !== currentWeek) {
                console.log('[Check-in] Progresso de semana diferente detectado. Limpando localStorage antigo.');
                console.log('[Check-in] Semana salva:', savedWeek, '| Semana atual:', currentWeek);
                // Limpar progresso antigo
                localStorage.removeItem(storageKey);
                // Limpar também chaves antigas sem semana (compatibilidade)
                const oldKey = `checkin_progress_${checkinData.id}`;
                localStorage.removeItem(oldKey);
                // Começar do zero
                currentQuestionIndex = 0;
                checkinResponses = {};
                const textInput = document.getElementById('checkinTextInput');
                const sendBtn = document.getElementById('checkinSendBtn');
                textInput.disabled = true;
                sendBtn.disabled = true;
                textInput.value = '';
                renderNextQuestion();
                return;
            }
            
            // Restaurar respostas e índice - fazer deep copy para evitar referências
            const loadedResponses = progress.responses || {};
            checkinResponses = {};
            
            // Fazer deep copy das respostas carregadas
            Object.keys(loadedResponses).forEach(key => {
                const numKey = Number(key);
                checkinResponses[numKey] = {
                    response_text: loadedResponses[key].response_text || null,
                    response_value: loadedResponses[key].response_value || null
                };
                // Manter também a chave original para compatibilidade
                checkinResponses[key] = checkinResponses[numKey];
            });
            
            currentQuestionIndex = Number(progress.currentQuestionIndex) || 0;
            
            // Garantir que as chaves de savedResponses sejam numéricas
            savedResponses = {};
            Object.keys(checkinResponses).forEach(key => {
                const numKey = Number(key);
                if (!isNaN(numKey)) {
                    savedResponses[numKey] = checkinResponses[numKey];
                }
                savedResponses[key] = checkinResponses[key]; // Manter ambas as formas para compatibilidade
            });
            
            answeredQuestionIds = Object.keys(checkinResponses)
                .filter(key => !isNaN(Number(key)))
                .map(id => Number(id));
            
            console.log('[Check-in] Respostas salvas localmente:', savedResponses);
            console.log('[Check-in] IDs de perguntas respondidas:', answeredQuestionIds);
            
            // Se já temos respostas salvas, restaurar o chat
            if (answeredQuestionIds.length > 0) {
                console.log('[Check-in] Restaurando chat do progresso salvo localmente...');
                restoreChatFromProgress();
                return; // Não precisa buscar do servidor
            }
        } catch (error) {
            console.error('[Check-in] Erro ao carregar do localStorage:', error);
            // Continuar para buscar do servidor como fallback
        }
    }
    
    // Se não tem no localStorage, verificar no servidor (apenas para checkins já completados)
    // Mas não vamos salvar individualmente durante o fluxo, então isso é só para verificar se já foi completado
    const formData = new FormData();
    formData.append('action', 'load_progress');
    formData.append('config_id', checkinData.id);
    
    authenticatedFetch(`${window.BASE_APP_URL}/api/checkin.php`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response) return null;
        return response.json();
    })
    .then(data => {
        console.log('[Check-in] Dados do servidor:', data);
        if (data && data.success) {
            // Se o servidor retornou respostas vazias, significa que o checkin já foi completado
            // ou não há progresso salvo. Nesse caso, começar do início
            if (!data.responses || Object.keys(data.responses).length === 0) {
                console.log('[Check-in] Nenhuma resposta salva encontrada, começando do início');
                currentQuestionIndex = 0;
                checkinResponses = {};
                const textInput = document.getElementById('checkinTextInput');
                const sendBtn = document.getElementById('checkinSendBtn');
                textInput.disabled = true;
                sendBtn.disabled = true;
                textInput.value = '';
                renderNextQuestion();
            } else {
                // Se o servidor tem respostas, usar elas (caso raro de sincronização)
                savedResponses = {};
                const responses = data.responses || {};
                Object.keys(responses).forEach(key => {
                    const numKey = Number(key);
                    savedResponses[numKey] = responses[key];
                    savedResponses[key] = responses[key];
                });
                
                answeredQuestionIds = (data.answered_questions || []).map(id => Number(id));
                checkinResponses = savedResponses;
                
                console.log('[Check-in] Restaurando chat do progresso do servidor...');
                restoreChatFromProgress();
            }
        } else {
            // Se erro, começar do início
            currentQuestionIndex = 0;
            checkinResponses = {};
            const textInput = document.getElementById('checkinTextInput');
            const sendBtn = document.getElementById('checkinSendBtn');
            textInput.disabled = true;
            sendBtn.disabled = true;
            textInput.value = '';
            renderNextQuestion();
        }
    })
    .catch(error => {
        console.error('Erro ao carregar progresso do servidor:', error);
        // Em caso de erro, começar do início
        currentQuestionIndex = 0;
        checkinResponses = {};
        const textInput = document.getElementById('checkinTextInput');
        const sendBtn = document.getElementById('checkinSendBtn');
        textInput.disabled = true;
        sendBtn.disabled = true;
        textInput.value = '';
        renderNextQuestion();
    });
}

function restoreChatFromProgress() {
    const messagesDiv = document.getElementById('checkinMessages');
    messagesDiv.innerHTML = ''; // Limpar mensagens anteriores
    
    console.log('[Check-in] Restaurando chat - Total de perguntas:', checkinData.questions.length);
    console.log('[Check-in] Perguntas respondidas:', answeredQuestionIds);
    console.log('[Check-in] Índice atual da pergunta:', currentQuestionIndex);
    
    // Garantir que answeredQuestionIds e question.id são do mesmo tipo para comparação
    const answeredQuestionIdsNum = answeredQuestionIds.map(id => Number(id));
    
    // Renderizar todas as perguntas já respondidas
    for (let i = 0; i < checkinData.questions.length; i++) {
        const question = checkinData.questions[i];
        const questionIdNum = Number(question.id);
        
        if (answeredQuestionIdsNum.includes(questionIdNum)) {
            console.log('[Check-in] Restaurando pergunta:', questionIdNum, question.question_text);
            // Renderizar pergunta
            addMessage(question.question_text, 'bot');
            
            // Se for múltipla escolha ou escala, renderizar as opções (desabilitadas)
            if ((question.question_type === 'scale' || question.question_type === 'multiple_choice') && question.options) {
                const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options);
                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'checkin-options';
                
                options.forEach(option => {
                    const btn = document.createElement('button');
                    btn.className = 'checkin-option-btn';
                    btn.type = 'button';
                    btn.textContent = option;
                    btn.disabled = true;
                    btn.style.opacity = '0.4';
                    btn.style.cursor = 'not-allowed';
                    optionsDiv.appendChild(btn);
                });
                
                messagesDiv.appendChild(optionsDiv);
            }
            
            // Renderizar resposta do usuário
            const savedResponse = savedResponses[questionIdNum] || savedResponses[question.id];
            if (savedResponse) {
                if (savedResponse.response_text) {
                    addMessage(savedResponse.response_text, 'user');
                } else if (savedResponse.response_value) {
                    addMessage(savedResponse.response_value, 'user');
                }
            }
            
            // Garantir que a resposta está no checkinResponses
            checkinResponses[questionIdNum] = savedResponse;
        }
    }
    
    // Usar o currentQuestionIndex que já foi carregado do localStorage (ou calcular se não foi)
    // Se currentQuestionIndex não foi definido, calcular baseado nas respostas
    if (currentQuestionIndex === undefined || currentQuestionIndex === null) {
        let lastAnsweredIndex = -1;
        for (let i = 0; i < checkinData.questions.length; i++) {
            const question = checkinData.questions[i];
            const questionIdNum = Number(question.id);
            if (answeredQuestionIdsNum.includes(questionIdNum)) {
                lastAnsweredIndex = i;
            }
        }
        currentQuestionIndex = lastAnsweredIndex + 1;
    }
    
    // Verificar se todas as perguntas foram respondidas
    // Mas só completar se realmente todas foram respondidas E não foram puladas por lógica condicional
    let totalAnswered = 0;
    for (let i = 0; i < checkinData.questions.length; i++) {
        const question = checkinData.questions[i];
        const questionIdNum = Number(question.id);
        // Contar apenas perguntas que foram respondidas OU que foram puladas por lógica condicional
        if (answeredQuestionIdsNum.includes(questionIdNum) || !shouldShowQuestion(question)) {
            totalAnswered++;
        }
    }
    
    console.log('[Check-in] Total respondido:', totalAnswered, 'de', checkinData.questions.length);
    console.log('[Check-in] Próximo índice:', currentQuestionIndex);
    
    if (currentQuestionIndex >= checkinData.questions.length || totalAnswered >= checkinData.questions.length) {
        // Todas as perguntas foram respondidas
        addMessage('Obrigado pelo seu feedback! Seu check-in foi salvo com sucesso.', 'bot');
        const textInput = document.getElementById('checkinTextInput');
        const sendBtn = document.getElementById('checkinSendBtn');
        textInput.disabled = true;
        sendBtn.disabled = true;
        textInput.value = '';
        textInput.placeholder = 'Check-in finalizado';
        
        // Marcar como completo
        markCheckinComplete();
    } else {
        // Renderizar próxima pergunta
        renderNextQuestion();
    }
}

// Função para verificar se uma pergunta deve ser mostrada baseada em condições
function shouldShowQuestion(question) {
    // Se não tem lógica condicional, sempre mostrar
    if (!question.conditional_logic) {
        return true;
    }
    
    try {
        const condition = typeof question.conditional_logic === 'string' 
            ? JSON.parse(question.conditional_logic) 
            : question.conditional_logic;
        
        // Verificar se depende de uma pergunta anterior
        if (condition.depends_on_question_id) {
            const dependsOnId = condition.depends_on_question_id;
            const previousResponse = checkinResponses[dependsOnId];
            
            if (!previousResponse) {
                // Se não há resposta para a pergunta dependente, não mostrar
                return false;
            }
            
            // Verificar o valor da resposta
            const responseValue = previousResponse.response_value || previousResponse.response_text || '';
            
            // Se show_if_value é um array, verificar se a resposta está no array
            if (Array.isArray(condition.show_if_value)) {
                return condition.show_if_value.includes(responseValue);
            }
            // Se é um valor único, verificar se corresponde
            else if (condition.show_if_value) {
                return responseValue === condition.show_if_value;
            }
            // Se não especifica valor, mostrar se houver resposta
            else {
                return true;
            }
        }
        
        // Se não tem dependência definida, mostrar
        return true;
    } catch (e) {
        console.error('Erro ao processar lógica condicional:', e);
        // Em caso de erro, mostrar a pergunta por segurança
        return true;
    }
}

function renderNextQuestion() {
    const messagesDiv = document.getElementById('checkinMessages');
    const inputContainer = document.getElementById('checkinInputContainer');
    const textInput = document.getElementById('checkinTextInput');
    const sendBtn = document.getElementById('checkinSendBtn');
    
    // Pular perguntas que não devem ser mostradas
    while (currentQuestionIndex < checkinData.questions.length) {
        const question = checkinData.questions[currentQuestionIndex];
        
        if (shouldShowQuestion(question)) {
            // Esta pergunta deve ser mostrada
            break;
        } else {
            // Pular esta pergunta
            console.log('Pulando pergunta', question.id, 'devido a condição não atendida');
            currentQuestionIndex++;
        }
    }
    
    if (currentQuestionIndex >= checkinData.questions.length) {
        // Todas as perguntas foram respondidas ou puladas
        addMessage('Obrigado pelo seu feedback! Seu check-in foi salvo com sucesso.', 'bot');
        textInput.disabled = true;
        sendBtn.disabled = true;
        textInput.value = '';
        textInput.placeholder = 'Check-in finalizado';
        
        // Marcar como completo (todas as respostas já foram salvas individualmente)
        markCheckinComplete();
        return;
    }
    
    const question = checkinData.questions[currentQuestionIndex];
    
    // Adicionar mensagem da pergunta
    addMessage(question.question_text, 'bot');
    
    // Habilitar ou desabilitar input baseado no tipo
    if (question.question_type === 'text') {
        textInput.disabled = false;
        sendBtn.disabled = false;
        textInput.value = '';
        textInput.placeholder = 'Digite sua resposta...';
    } else {
        // Múltipla escolha ou escala - desabilitar input
        textInput.disabled = true;
        sendBtn.disabled = true;
        textInput.value = '';
        textInput.placeholder = 'Selecione uma opção acima...';
        showQuestionOptions(question);
    }
}

function showQuestionOptions(question) {
    const messagesDiv = document.getElementById('checkinMessages');
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'checkin-options';
    
    if ((question.question_type === 'scale' || question.question_type === 'multiple_choice') && question.options) {
        const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options);
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'checkin-option-btn';
            btn.type = 'button';
            btn.textContent = option;
            btn.onclick = () => selectOption(option);
            optionsDiv.appendChild(btn);
        });
        
        messagesDiv.appendChild(optionsDiv);
        // Scroll suave para o final
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);
    }
}

function selectOption(option) {
    // Desabilitar todos os botões de opção para evitar múltiplos cliques
    const optionButtons = document.querySelectorAll('.checkin-option-btn');
    optionButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
    });
    
    const question = checkinData.questions[currentQuestionIndex];
    const questionId = Number(question.id); // Garantir que seja numérico
    const response = {
        response_value: option,
        response_text: null
    };
    
    // Salvar com chave numérica para consistência
    checkinResponses[questionId] = response;
    
    addMessage(option, 'user');
    
    // Salvar progresso no localStorage (não no backend ainda)
    saveCheckinProgressToLocalStorage();
    
    currentQuestionIndex++;
    setTimeout(() => renderNextQuestion(), 500);
}

function sendCheckinResponse() {
    const input = document.getElementById('checkinTextInput');
    const sendBtn = document.getElementById('checkinSendBtn');
    
    // Verificar se está desabilitado
    if (input.disabled) return;
    
    const response = input.value.trim();
    if (!response) return;
    
    const question = checkinData.questions[currentQuestionIndex];
    const questionId = Number(question.id); // Garantir que seja numérico
    const responseData = {
        response_text: response,
        response_value: null
    };
    
    // Salvar com chave numérica para consistência
    checkinResponses[questionId] = responseData;
    
    addMessage(response, 'user');
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    
    // Salvar progresso no localStorage (não no backend ainda)
    saveCheckinProgressToLocalStorage();
    
    currentQuestionIndex++;
    setTimeout(() => renderNextQuestion(), 500);
}

// Variável para controlar debounce do salvamento
let saveCheckinProgressTimeout = null;

function saveCheckinProgressToLocalStorage() {
    // Salvar progresso no localStorage em vez de salvar individualmente no backend
    // Fazer deep copy para garantir que o objeto seja salvo corretamente
    if (!checkinData || !checkinData.id) {
        console.error('[Check-in] checkinData não está disponível para salvar');
        return;
    }
    
    // Debounce: cancelar salvamento anterior se houver um pendente
    if (saveCheckinProgressTimeout) {
        clearTimeout(saveCheckinProgressTimeout);
    }
    
    // Executar salvamento após pequeno delay para evitar múltiplas escritas
    saveCheckinProgressTimeout = setTimeout(() => {
        _saveCheckinProgressToLocalStorage();
        saveCheckinProgressTimeout = null;
    }, 100);
}

function _saveCheckinProgressToLocalStorage() {
    // Incluir a semana atual na chave para isolar progresso por semana
    const currentWeek = getCurrentWeekStart();
    const storageKey = `checkin_progress_${checkinData.id}_${currentWeek}`;
    
    // Limpar progressos antigos de outras semanas para o mesmo checkin
    clearOldCheckinProgressForConfig(checkinData.id, currentWeek);
    
    // Criar uma cópia profunda das respostas para garantir que seja salva corretamente
    // Filtrar apenas chaves numéricas válidas
    const responsesCopy = {};
    Object.keys(checkinResponses).forEach(key => {
        const numKey = Number(key);
        // Só incluir se for uma chave numérica válida e tiver dados
        if (!isNaN(numKey) && checkinResponses[key]) {
            responsesCopy[numKey] = {
                response_text: checkinResponses[key].response_text || null,
                response_value: checkinResponses[key].response_value || null
            };
        }
    });
    
    const progress = {
        responses: responsesCopy,
        currentQuestionIndex: Number(currentQuestionIndex) || 0,
        timestamp: Date.now(),
        config_id: Number(checkinData.id),
        week_start: currentWeek // Salvar a semana para validação
    };
    
    try {
        const serialized = JSON.stringify(progress);
        localStorage.setItem(storageKey, serialized);
        console.log('[Check-in] Progresso salvo no localStorage:', {
            total_responses: Object.keys(responsesCopy).length,
            current_index: currentQuestionIndex,
            question_ids: Object.keys(responsesCopy).join(', ')
        });
    } catch (error) {
        console.error('[Check-in] Erro ao salvar no localStorage:', error);
        // Se o localStorage estiver cheio, tentar limpar dados antigos
        if (error.name === 'QuotaExceededError' || error.code === 22) {
            console.warn('[Check-in] localStorage cheio, tentando limpar dados antigos...');
            clearOldCheckinProgress();
            // Tentar novamente
            try {
                localStorage.setItem(storageKey, JSON.stringify(progress));
                console.log('[Check-in] Progresso salvo após limpeza');
            } catch (retryError) {
                console.error('[Check-in] Erro ao salvar após limpeza:', retryError);
            }
        }
    }
}

function clearOldCheckinProgress() {
    // Limpar progressos antigos (mais de 7 dias)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('checkin_progress_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data.timestamp && data.timestamp < sevenDaysAgo) {
                    keysToRemove.push(key);
                }
            } catch (e) {
                // Se não conseguir parsear, remover também
                keysToRemove.push(key);
            }
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('[Check-in] Removido progresso antigo:', key);
    });
}

function clearCheckinProgressFromLocalStorage() {
    // Limpar progresso do localStorage após completar o checkin
    if (!checkinData || !checkinData.id) return;
    
    const currentWeek = getCurrentWeekStart();
    const storageKey = `checkin_progress_${checkinData.id}_${currentWeek}`;
    
    try {
        localStorage.removeItem(storageKey);
        console.log('[Check-in] Progresso removido do localStorage');
        
        // Limpar também chave antiga sem semana (compatibilidade)
        const oldKey = `checkin_progress_${checkinData.id}`;
        localStorage.removeItem(oldKey);
    } catch (error) {
        console.error('[Check-in] Erro ao limpar localStorage:', error);
    }
}

function clearOldCheckinProgressForConfig(configId, currentWeek) {
    // Limpar progressos antigos do mesmo checkin mas de semanas diferentes
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`checkin_progress_${configId}_`)) {
            // Se não é da semana atual, remover
            if (!key.endsWith(`_${currentWeek}`)) {
                keysToRemove.push(key);
            }
        }
        // Também limpar chaves antigas sem semana (compatibilidade)
        if (key === `checkin_progress_${configId}`) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('[Check-in] Removido progresso antigo:', key);
    });
}

function addMessage(text, type) {
    const messagesDiv = document.getElementById('checkinMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `checkin-message ${type}`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    // Scroll suave para o final
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 50);
}

function markCheckinComplete() {
    const formData = new FormData();
    formData.append('action', 'submit_checkin');
    formData.append('config_id', checkinData.id);
    formData.append('responses', JSON.stringify(checkinResponses));
    
    authenticatedFetch(`${window.BASE_APP_URL}/api/checkin.php`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response) return null;
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Check-in completo!', data);
            
            // Limpar progresso do localStorage após enviar com sucesso
            clearCheckinProgressFromLocalStorage();
            
            // Fechar o modal imediatamente
                closeCheckinModal();
            
            // Remover o botão flutuante permanentemente (não apenas esconder)
            const floatingBtn = document.querySelector('.checkin-floating-btn');
            if (floatingBtn) {
                floatingBtn.remove(); // Remove do DOM completamente
            }
            
            // Remover o modal também do DOM
            const modal = document.getElementById('checkinModal');
            if (modal) {
                modal.remove();
            }
            
            // Salvar dados da resposta para usar na animação
            window.lastCheckinResponse = data;
            
            // Sempre mostrar popup de congratulação (com ou sem pontos)
            // Pequeno delay para garantir que o modal fechou antes do popup aparecer
            setTimeout(() => {
                const points = data.points_awarded || 0;
                const newTotalPoints = data.new_total_points;
                
                // Se ganhou pontos, mostrar popup e depois atualizar com animação
                if (points > 0 && newTotalPoints !== undefined) {
                    showCheckinCongratsPopup(points);
                    // A atualização dos pontos será feita pela animação da estrela
                } else {
                    // Se não ganhou pontos, apenas mostrar popup
                    showCheckinCongratsPopup(0);
                    // Atualizar pontos normalmente se houver
                    if (newTotalPoints !== undefined) {
                        const pointsDisplay = document.getElementById('user-points-display');
                        if (pointsDisplay) {
                            pointsDisplay.textContent = new Intl.NumberFormat('pt-BR').format(newTotalPoints);
                        }
                    }
                }
            }, 300);
        } else {
            console.error('Erro ao marcar check-in como completo:', data.message);
            alert('Erro ao completar check-in: ' + (data.message || 'Erro desconhecido'));
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao completar check-in. Tente novamente.');
    });
}

function showCheckinCongratsPopup(points) {
    // Remover qualquer popup anterior se existir
    const existingPopup = document.querySelector('.checkin-congrats-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.className = 'checkin-congrats-popup';
    
    if (points > 0) {
        popup.innerHTML = `
            <i class="fas fa-trophy congrats-icon"></i>
            <div class="congrats-message">Parabéns!</div>
            <div class="congrats-subtitle">Você completou seu check-in semanal</div>
            <div class="congrats-points" id="congratsPointsContainer">
                <i class="fas fa-star star-icon" id="congratsStarIcon"></i>
                <span>+${points} Pontos</span>
            </div>
        `;
    } else {
        popup.innerHTML = `
            <i class="fas fa-check-circle congrats-icon"></i>
            <div class="congrats-message">Check-in Completo!</div>
            <div class="congrats-subtitle">Seu check-in foi salvo com sucesso</div>
        `;
    }
    
    document.body.appendChild(popup);
    
    // Forçar reflow para garantir que a animação funcione
    popup.offsetHeight;
    
    // Se ganhou pontos, animar estrela voando para o badge
    if (points > 0) {
        // Esperar 2.5 segundos (quando popup está quase fechando) para iniciar animação
        setTimeout(() => {
            animateStarToBadge(points);
        }, 2500);
    }
    
    // Remover após a animação (3.5 segundos)
    setTimeout(() => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 3500);
}

function animateStarToBadge(points) {
    const starIcon = document.getElementById('congratsStarIcon');
    const pointsBadge = document.querySelector('.points-counter-badge');
    const pointsDisplay = document.getElementById('user-points-display');
    
    if (!starIcon || !pointsBadge || !pointsDisplay) {
        return;
    }
    
    // Obter posições EXATAS
    const starRect = starIcon.getBoundingClientRect();
    const badgeRect = pointsBadge.getBoundingClientRect();
    
    // Encontrar o ícone da estrela DENTRO do badge (não apenas o centro)
    const badgeStarIcon = pointsBadge.querySelector('i.fa-star');
    let endX, endY;
    
    if (badgeStarIcon) {
        // Se encontrou o ícone, usar sua posição exata
        const badgeStarRect = badgeStarIcon.getBoundingClientRect();
        endX = badgeStarRect.left + badgeStarRect.width / 2;
        endY = badgeStarRect.top + badgeStarRect.height / 2;
    } else {
        // Fallback: centro do badge
        endX = badgeRect.left + badgeRect.width / 2;
        endY = badgeRect.top + badgeRect.height / 2;
    }
    
    // Posição inicial (centro do ícone da estrela no popup)
    const startX = starRect.left + starRect.width / 2;
    const startY = starRect.top + starRect.height / 2;
    
    // Calcular distância total
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Duração baseada na distância
    const baseDuration = 1800;
    const duration = Math.min(Math.max(baseDuration, distance * 0.8), 2500);
    
    // Obter valor atual dos pontos
    const currentPointsText = pointsDisplay.textContent.replace(/\./g, '').replace(/,/g, '');
    const currentPoints = parseInt(currentPointsText) || 0;
    
    // Criar estrela voadora
    const flyingStar = document.createElement('div');
    flyingStar.className = 'flying-star';
    flyingStar.innerHTML = '<i class="fas fa-star"></i>';
    // Posicionar inicialmente usando left/top para garantir que fique na posição correta
    flyingStar.style.left = `${startX}px`;
    flyingStar.style.top = `${startY}px`;
    flyingStar.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
    flyingStar.style.willChange = 'transform, opacity';
    
    document.body.appendChild(flyingStar);
    
    // Forçar reflow
    flyingStar.offsetHeight;
    
    // Função de easing tipo videogame
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    // Animação com requestAnimationFrame
    // RECALCULA POSIÇÕES EM TEMPO REAL para acompanhar scroll
    const startTime = performance.now();
    let animationFrameId;
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // RECALCULAR posição final do badge EM TEMPO REAL (para acompanhar scroll)
        let currentEndX, currentEndY;
        const currentBadgeRect = pointsBadge.getBoundingClientRect();
        const currentBadgeStarIcon = pointsBadge.querySelector('i.fa-star');
        
        if (currentBadgeStarIcon) {
            const currentBadgeStarRect = currentBadgeStarIcon.getBoundingClientRect();
            currentEndX = currentBadgeStarRect.left + currentBadgeStarRect.width / 2;
            currentEndY = currentBadgeStarRect.top + currentBadgeStarRect.height / 2;
        } else {
            currentEndX = currentBadgeRect.left + currentBadgeRect.width / 2;
            currentEndY = currentBadgeRect.top + currentBadgeRect.height / 2;
        }
        
        // RECALCULAR posição inicial também (caso elemento fonte tenha se movido)
        const currentStarRect = starIcon.getBoundingClientRect();
        const currentStartX = currentStarRect.left + currentStarRect.width / 2;
        const currentStartY = currentStarRect.top + currentStarRect.height / 2;
        
        // Calcular delta atualizado
        const currentDeltaX = currentEndX - currentStartX;
        const currentDeltaY = currentEndY - currentStartY;
        const currentDistance = Math.sqrt(currentDeltaX * currentDeltaX + currentDeltaY * currentDeltaY);
        
        // Easing suave
        const easedProgress = easeOutCubic(progress);
        
        // Calcular posição atual baseada nas posições RECALCULADAS
        const currentX = currentStartX + (currentDeltaX * easedProgress);
        const currentY = currentStartY + (currentDeltaY * easedProgress);
        
        // Adicionar curva suave (parábola) - reduzida para evitar tremores
        const curveHeight = Math.min(currentDistance * 0.12, 80);
        const curveProgress = Math.sin(progress * Math.PI);
        const curveOffset = -curveHeight * curveProgress;
        
        // ESCALA SUAVIZADA - evitar mudanças bruscas
        let scale;
        if (progress < 0.2) {
            // Início: escala aumenta suavemente
            const scaleProgress = progress / 0.2;
            scale = 1 + (0.3 * easeOutCubic(scaleProgress));
        } else if (progress < 0.75) {
            // Meio: escala diminui suavemente
            const scaleProgress = (progress - 0.2) / 0.55;
            const easedScaleProgress = easeOutCubic(scaleProgress);
            scale = 1.3 - (0.4 * easedScaleProgress);
        } else {
            // Final: escala aumenta ligeiramente antes de desaparecer
            const finalProgress = (progress - 0.75) / 0.25;
            const easedFinalProgress = easeOutCubic(finalProgress);
            scale = 0.9 + (0.2 * easedFinalProgress);
        }
        
        // Rotação dinâmica - suavizada
        const rotation = progress * 360 * 1.5;
        
        // Opacidade (fade out suave no final)
        let opacity = 1;
        if (progress > 0.9) {
            opacity = 1 - ((progress - 0.9) / 0.1);
        }
        
        // Usar left/top + transform para garantir que a estrela não saia da viewport
        flyingStar.style.left = `${currentX}px`;
        flyingStar.style.top = `${currentY + curveOffset}px`;
        flyingStar.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
        flyingStar.style.opacity = opacity;
        
        // Continuar ou finalizar
        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Animação completa
            if (flyingStar.parentNode) {
                flyingStar.parentNode.removeChild(flyingStar);
            }
            
            // Atualizar pontos
            const checkinData = window.lastCheckinResponse || {};
            const newTotalPoints = checkinData.new_total_points;
            const newPoints = newTotalPoints !== undefined ? newTotalPoints : (currentPoints + points);
            
            // Adicionar classe de animação no badge
            pointsBadge.classList.add('points-updated');
            
            // Animar contagem dos pontos
            pointsDisplay.classList.add('points-counting');
            
            // Atualizar valor com animação de contagem
            animatePointsCount(pointsDisplay, currentPoints, newPoints, 1500);
            
            // Remover classes de animação após animação
            setTimeout(() => {
                pointsBadge.classList.remove('points-updated');
                pointsDisplay.classList.remove('points-counting');
            }, 2000);
        }
    }
    
    // Iniciar animação
    animationFrameId = requestAnimationFrame(animate);
    flyingStar._animationId = animationFrameId;
}

function animatePointsCount(element, startValue, endValue, duration) {
    const startTime = performance.now();
    const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);
    
    // Usar easing mais suave (ease-in-out cubic)
    function easeInOutCubic(t) {
        return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing mais fluido
        const easedProgress = easeInOutCubic(progress);
        
        const currentValue = Math.floor(startValue + (endValue - startValue) * easedProgress);
        element.textContent = formatNumber(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            // Garantir valor final exato
            element.textContent = formatNumber(endValue);
        }
    }
    
    requestAnimationFrame(update);
}

// ========================================
// CARREGAR E RENDERIZAR DASHBOARD
// ========================================
(async function() {
    // Aguardar um pouco para garantir que www-config.js foi executado
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // AGUARDAR que main_app_inline_2.js tenha exposto as funções globais
    // Como o script pode ser recarregado pelo router, aguardar até 1 segundo
    let attempts = 0;
    while ((!window.showCurrentMission || !window.initializeMissionsCarousel) && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 10));
        attempts++;
    }
    
    if (!window.showCurrentMission || !window.initializeMissionsCarousel) {
        console.warn('[Dashboard] Funções de missões não foram carregadas após espera');
        // Tentar criar stubs básicos para evitar erros
        if (!window.showCurrentMission) {
            window.showCurrentMission = function() {
                const slides = window.missionSlides || [];
                const card = window.completionCard;
                const pending = window.pendingSlides || [];
                slides.forEach(s => { if (s && s.classList) s.classList.remove('active'); });
                if (card && card.classList) card.classList.remove('active');
                if (pending.length > 0 && pending[0] && pending[0].classList) {
                    pending[0].classList.add('active');
                } else if (card && card.classList) {
                    card.classList.add('active');
                }
            };
        }
        if (!window.initializeMissionsCarousel) {
            window.initializeMissionsCarousel = function() {
                console.warn('[Dashboard] initializeMissionsCarousel stub chamado - script não carregou');
            };
        }
    }
    
    // Verificar se BASE_APP_URL foi definido
    // Em desenvolvimento, localhost é válido para BASE_APP_URL (redirecionamentos internos)
    // Apenas verificar se está definido, não se contém localhost
    if (!window.BASE_APP_URL) {
        console.error('[ERRO] BASE_APP_URL não foi definido!');
        const container = document.getElementById('dashboard-container');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-primary);"><p>Erro: BASE_APP_URL não foi definido</p></div>';
            container.style.display = 'block';
        }
        return;
    }
    
    const BASE_URL = window.BASE_APP_URL;
    console.log('[Dashboard] BASE_URL:', BASE_URL);
    console.log('[Dashboard] Token:', getAuthToken() ? 'SIM' : 'NÃO');
    
    // Verificar se há token na URL (vindo do login.php)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
        console.log('Token encontrado na URL, salvando...');
        // Salvar token no localStorage
        setAuthToken(tokenFromUrl);
        // Remover token da URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Verificar autenticação
    console.log('Verificando autenticação...');
    const authenticated = await requireAuth();
    console.log('Autenticado?', authenticated);
    if (!authenticated) {
        console.log('Não autenticado, redirecionando...');
        return;
    }
    
    try {
        // Carregar dados do dashboard (usar URL relativa para proxy)
        console.log('[Dashboard] Carregando dados de: /api/get_dashboard_data.php');
        const response = await authenticatedFetch('/api/get_dashboard_data.php');
        if (!response) {
            console.error('Response é null - token inválido ou erro de autenticação');
            return;
        }
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.get('content-type'));
        
        // Clonar a resposta para poder ler como texto E como JSON
        const responseClone = response.clone();
        
        // Ler como texto para debug (sem consumir a resposta original)
        const responseText = await responseClone.text();
        console.log('Response text (primeiros 500 chars):', responseText.substring(0, 500));
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Resposta não é JSON. Conteúdo completo:', responseText);
            throw new Error('A API retornou um formato inválido. Verifique o console para mais detalhes.');
        }
        
        // Tentar fazer parse do JSON da resposta original
        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            console.error('Texto recebido:', responseText);
            throw new Error('Resposta da API não é JSON válido. Verifique o console.');
        }
        console.log('Result:', result);
        
        if (!result.success) {
            throw new Error(result.message || 'Erro ao carregar dados');
        }
        
        const data = result.data;
        
        // Renderizar dashboard
        renderDashboard(data);
        
        // Mostrar container
        document.getElementById('dashboard-container').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        console.error('Stack:', error.stack);
        const errorMsg = error.message || 'Erro desconhecido';
        document.getElementById('dashboard-container').innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-primary);">
                <p>Erro ao carregar dados: ${errorMsg}</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 10px;">Verifique o console para mais detalhes.</p>
            </div>
        `;
        document.getElementById('dashboard-container').style.display = 'block';
    }
})();

function renderDashboard(data) {
    // Atualizar pontos
    const pointsDisplay = document.getElementById('user-points-display');
    if (pointsDisplay && data.points !== undefined) {
        pointsDisplay.textContent = new Intl.NumberFormat('pt-BR').format(data.points);
    }
    
    // Atualizar avatar (usar domínio remoto para imagens + cache-busting)
    const IMAGES_BASE_URL = 'https://appshapefit.com';
    const cacheBuster = Date.now();
    const profileIcon = document.getElementById('profile-icon-link');
    if (profileIcon && data.profile_image) {
        const img = profileIcon.querySelector('img') || document.createElement('img');
        img.src = `${IMAGES_BASE_URL}/assets/images/users/${data.profile_image}?t=${cacheBuster}`;
        img.alt = 'Foto de Perfil';
        img.onerror = function() {
            // Se a imagem falhar, tentar thumbnail
            this.onerror = null;
            this.src = `${IMAGES_BASE_URL}/assets/images/users/thumb_${data.profile_image}?t=${cacheBuster}`;
            this.onerror = function() {
                // Se thumbnail também falhar, mostrar ícone
                this.style.display = 'none';
                const icon = profileIcon.querySelector('i') || document.createElement('i');
                icon.className = 'fas fa-user';
                icon.style.display = 'flex';
                if (!profileIcon.querySelector('i')) {
                    profileIcon.appendChild(icon);
                }
            };
        };
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        if (!profileIcon.querySelector('img')) {
            profileIcon.innerHTML = '';
            profileIcon.appendChild(img);
        }
    }
    
    // Renderizar card de peso
    renderWeightCard(data);
    
    // Renderizar hidratação
    renderHydration(data);
    
    // Renderizar consumo
    renderConsumption(data);
    
    // Renderizar rotinas/missões
    renderRoutines(data);
    
    // Renderizar ranking
    renderRanking(data);
    
    // Renderizar sugestões de refeições
    renderMealSuggestions(data);
    
    // Renderizar desafios
    renderChallenges(data);
    
    // Mostrar botão de check-in se disponível
    if (data.available_checkin) {
        const checkinBtn = document.getElementById('checkin-floating-btn');
        const checkinModal = document.getElementById('checkinModal');
        
        if (checkinBtn) {
            checkinBtn.style.display = 'flex';
        }
        
        // Inicializar dados do checkin
        if (data.available_checkin) {
            window.checkinData = data.available_checkin;
            checkinData = data.available_checkin;
            
            // Atualizar título do modal se existir
            const checkinTitle = document.getElementById('checkin-title');
            if (checkinTitle && data.available_checkin.name) {
                checkinTitle.textContent = data.available_checkin.name;
            }
            
            // Garantir que o modal está disponível (remover display: none se estiver)
            if (checkinModal) {
                checkinModal.style.display = '';
            }
        }
    } else {
        // Esconder botão e modal se não houver checkin disponível
        const checkinBtn = document.getElementById('checkin-floating-btn');
        const checkinModal = document.getElementById('checkinModal');
        if (checkinBtn) {
            checkinBtn.style.display = 'none';
        }
        if (checkinModal) {
            checkinModal.style.display = 'none';
        }
    }
    
    // Inicializar carrossel de missões após renderizar
    setTimeout(() => {
        if (window.initializeMissionsCarousel) {
            window.initializeMissionsCarousel();
        } else {
            console.warn('[Dashboard] initializeMissionsCarousel não está disponível ainda');
        }
    }, 100);
}

function renderWeightCard(data) {
    const weightCard = document.getElementById('weight-card');
    if (!weightCard) return;
    
    const weightData = data.weight_banner || {};
    let currentWeight = weightData.current_weight || '--';
    // Remover "kg" se estiver no formato string
    if (typeof currentWeight === 'string' && currentWeight.endsWith('kg')) {
        currentWeight = currentWeight.replace('kg', '').trim();
    }
    const daysUntil = weightData.days_until_update || weightData.days_until_next_weight_update || 0;
    const showEdit = weightData.show_edit_button !== false;
    
    let html = '';
    
    if (showEdit) {
        // Mostrar peso atual com botão de editar
        html += `<span>Peso Atual</span>`;
        html += `<strong id="current-weight-value">${typeof currentWeight === 'number' ? currentWeight.toFixed(1).replace('.', ',') : currentWeight}kg</strong>`;
        html += `<button data-action="open-weight-modal" class="edit-button" aria-label="Editar peso">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>`;
    } else {
        // Mostrar countdown de próxima atualização
        html += `<span>Próxima atualização em</span>`;
        html += `<strong class="countdown">${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}</strong>`;
    }
    
    weightCard.innerHTML = html;
}

function renderHydration(data) {
    const waterData = data.water || {};
    const waterConsumed = (waterData.consumed_cups || 0) * (waterData.cup_size_ml || 250);
    const waterGoal = waterData.goal_ml || 2000;
    
    // Atualizar display
    const waterAmountDisplay = document.getElementById('water-amount-display');
    const waterGoalDisplay = document.getElementById('water-goal-display');
    if (waterAmountDisplay) waterAmountDisplay.textContent = Math.round(waterConsumed);
    if (waterGoalDisplay) waterGoalDisplay.textContent = `${Math.round(waterGoal)} ml`;
    
    // Atualizar gota d'água
    const waterLevelGroup = document.getElementById('water-level-group');
    if (waterLevelGroup) {
        const percentage = waterGoal > 0 ? Math.min(waterConsumed / waterGoal, 1) : 0;
        const dropHeight = 275.785;
        const yTranslate = dropHeight * (1 - percentage);
        waterLevelGroup.setAttribute('transform', `translate(0, ${yTranslate})`);
    }
    
    // Atualizar variável global para os controles
    window.currentWater = waterConsumed;
    
    // Atualizar a gota d'água visualmente (igual ao main_app.html original)
    // Aguardar um pouco para garantir que os elementos DOM estejam prontos
    setTimeout(() => {
        const waterLevelGroupEl = document.getElementById('water-level-group');
        const waterAmountDisplayEl = document.getElementById('water-amount-display');
        
        if (waterLevelGroupEl) {
            const percentage = waterGoal > 0 ? Math.min(waterConsumed / waterGoal, 1) : 0;
            const dropHeight = 275.785;
            const yTranslate = dropHeight * (1 - percentage);
            waterLevelGroupEl.setAttribute('transform', `translate(0, ${yTranslate})`);
        }
        
        if (waterAmountDisplayEl) {
            waterAmountDisplayEl.textContent = Math.round(waterConsumed);
        }
        
        // Se a função updateWaterDrop estiver disponível, usar ela também (atualiza display)
        if (window.updateWaterDrop) {
            window.updateWaterDrop(false); // false = sem animação
        }
    }, 100);
}

function renderConsumption(data) {
    const summary = data.daily_summary || {};
    
    const kcal = summary.kcal?.consumed || 0;
    const protein = summary.protein?.consumed || 0;
    const carbs = summary.carbs?.consumed || 0;
    const fat = summary.fat?.consumed || 0;
    
    const kcalGoal = summary.kcal?.goal || 2000;
    const proteinGoal = summary.protein?.goal || 150;
    const carbsGoal = summary.carbs?.goal || 200;
    const fatGoal = summary.fat?.goal || 65;
    
    // Atualizar círculo de calorias
    updateCaloriesCircle(kcal, kcalGoal);
    
    // Atualizar barras de macros
    updateMacroBar('carbs', carbs, carbsGoal);
    updateMacroBar('protein', protein, proteinGoal);
    updateMacroBar('fat', fat, fatGoal);
}

function updateCaloriesCircle(value, goal) {
    const circleElement = document.getElementById('kcal-circle');
    if (!circleElement) return;
    
    const percentage = goal > 0 ? Math.min(Math.max(value / goal, 0), 1) : 0;
    const circle = circleElement.querySelector('.circle');
    const valueDisplay = document.getElementById('kcal-value-display');
    
    if (circle) {
        // Calcular a circunferência do círculo (raio = 15.9155 no viewBox 40x40)
        const radius = 15.9155;
        const circumference = 2 * Math.PI * radius;
        
        // Configurar stroke-dasharray e stroke-dashoffset
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference - (percentage * circumference);
        circle.style.visibility = 'visible';
        circle.style.opacity = '1';
    }
    
    if (valueDisplay) {
        valueDisplay.textContent = Math.round(value);
    }
}

function updateMacroBar(type, value, goal) {
    const valueEl = document.getElementById(`${type}-value-display`);
    const goalEl = document.getElementById(`${type}-goal-display`);
    const progressBar = document.getElementById(`${type}-progress-bar`);
    
    if (valueEl) {
        valueEl.textContent = Math.round(value);
    }
    
    if (goalEl) {
        goalEl.textContent = Math.round(goal);
    }
    
    if (progressBar) {
        const percentage = goal > 0 ? Math.min(Math.max((value / goal) * 100, 0), 100) : 0;
        progressBar.style.width = `${percentage}%`;
    }
}

function renderRoutines(data) {
    const missionsCard = document.getElementById('missions-card');
    if (!missionsCard) return;
    
    const routineData = data.routine || {};
    const routines = routineData.items || [];
    const completedCount = routineData.completed_missions || 0;
    const totalCount = routineData.total_missions || routines.length;
    
    // Atualizar progresso
    const progressText = document.getElementById('missions-progress-text');
    const progressBar = document.getElementById('missions-progress-bar');
    if (progressText) progressText.textContent = `${completedCount} de ${totalCount}`;
    if (progressBar) {
        const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
    }
    
    // Atualizar variáveis globais
    window.completedMissionsCount = completedCount;
    window.totalMissionsCount = totalCount;
    
    // Renderizar slides de missões
    const missionsCarousel = document.getElementById('missions-carousel');
    if (!missionsCarousel) return;
    
    if (routines.length === 0) {
        missionsCard.style.display = 'none';
        return;
    }
    
    missionsCard.style.display = 'block';
    
    let html = '';
    const pendingRoutines = routines.filter(r => r.completion_status != 1);
    let firstPendingIndex = -1;
    
    routines.forEach((routine, index) => {
        const isCompleted = routine.completion_status == 1;
        if (!isCompleted && firstPendingIndex === -1) {
            firstPendingIndex = index;
        }
    });
    
    routines.forEach((routine, index) => {
        const isCompleted = routine.completion_status == 1;
        const missionId = routine.id || `routine_${index}`;
        const title = routine.title || 'Tarefa';
        const icon = routine.icon_class || 'fa-check-circle';
        const isExercise = routine.is_exercise == 1;
        const exerciseType = routine.exercise_type || '';
        const hasDuration = routine.duration_minutes !== null && routine.duration_minutes !== undefined;
        const duration = routine.duration_minutes || null;
        
        // Determinar se precisa de duração ou sono (igual ao main_app.php)
        let isDuration = false;
        let isSleep = false;
        
        if (String(missionId).indexOf('onboarding_') === 0) {
            // Exercício onboarding - sempre é duração
            isDuration = true;
        } else if (isExercise) {
            // Verificar se é sono ou duração baseado no exercise_type
            if (exerciseType === 'sleep') {
                isSleep = true;
            } else if (exerciseType === 'duration') {
                isDuration = true;
            }
        } else if (title.toLowerCase().indexOf('sono') !== -1) {
            // Fallback para verificação por título
            isSleep = true;
        }
        
        // Se é exercício onboarding, usar prefixo onboarding_
        const displayMissionId = isExercise && exerciseType === 'duration' ? `onboarding_${title}` : missionId;
        
        // Primeira missão pendente fica ativa
        const isFirstPending = index === firstPendingIndex && !isCompleted;
        
        html += `
            <div class="mission-slide ${isFirstPending ? 'active' : ''}" data-mission-id="${displayMissionId}" data-completed="${isCompleted ? '1' : '0'}">
                <div class="mission-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="mission-details">
                    <h4>${escapeHtml(title)}</h4>
                    <small class="mission-duration-display" style="display: none;"></small>
                </div>
                <div class="mission-actions">
                    <button class="mission-action-btn skip-btn" aria-label="Pular Missão"><i class="fas fa-times"></i></button>
                    ${isDuration ? `
                        <button class="mission-action-btn duration-btn" aria-label="Definir Duração" data-mission-id="${displayMissionId}">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="mission-action-btn complete-btn disabled" aria-label="Completar Missão">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : isSleep ? `
                        <button class="mission-action-btn sleep-btn" aria-label="Registrar Sono" data-mission-id="${displayMissionId}">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="mission-action-btn complete-btn disabled" aria-label="Completar Missão">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : `
                        <button class="mission-action-btn complete-btn" aria-label="Completar Missão">
                            <i class="fas fa-check"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    });
    
    // Adicionar card de conclusão se todas completas (igual ao main_app.php)
    if (completedCount === totalCount && totalCount > 0) {
        html += `
            <div class="mission-slide completion-message" id="all-missions-completed-card">
                <div class="mission-details"><h4>Parabéns!</h4><p>Você completou sua jornada de hoje.</p></div>
            </div>
        `;
    }
    
    // Limpar completamente antes de adicionar novo conteúdo
    missionsCarousel.innerHTML = '';
    
    // Adicionar novo HTML
    missionsCarousel.innerHTML = html;
    
    // Reconfigurar event listeners e variáveis após renderizar
    // Isso garante que não haja referências antigas
    // Atualizar variáveis globais para que showCurrentMission possa usá-las
    window.missionSlides = Array.from(missionsCarousel.querySelectorAll('.mission-slide:not(.completion-message)'));
    window.completionCard = document.getElementById('all-missions-completed-card');
    window.pendingSlides = window.missionSlides.filter(slide => slide.dataset.completed === '0');
    
    // Aguardar um pouco para garantir que o DOM foi atualizado
    setTimeout(() => {
        // Garantir que apenas uma missão fique ativa
        if (window.showCurrentMission) {
            window.showCurrentMission();
        } else {
            console.warn('[Dashboard] showCurrentMission não está disponível ainda');
        }
        
        // Reinicializar o carrossel de missões para configurar event listeners
        if (window.initializeMissionsCarousel) {
            window.initializeMissionsCarousel();
        } else {
            console.warn('[Dashboard] initializeMissionsCarousel não está disponível ainda');
        }
    }, 100);
}

function renderRanking(data) {
    const rankingCard = document.getElementById('ranking-card');
    if (!rankingCard) return;
    
    const ranking = data.ranking || {};
    console.log('🔍 [Ranking] Dados recebidos:', ranking);
    console.log('🔍 [Ranking] Opponent data:', ranking.opponent);
    
    if (!ranking.my_rank || ranking.my_rank === 0) {
        rankingCard.style.display = 'none';
        return;
    }
    
    rankingCard.style.display = 'block';
    // Usar domínio remoto para imagens (igual ao profile icon)
    const IMAGES_URL = 'https://appshapefit.com';
    
    // 1. Renderizar foto do usuário (esquerda)
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
        const profileImage = data.profile_image;
        if (profileImage) {
            // Tentar imagem original primeiro, depois thumbnail, depois ícone
            const imageUrl = `${IMAGES_URL}/assets/images/users/${profileImage}?t=${Date.now()}`;
            const thumbUrl = `${IMAGES_URL}/assets/images/users/thumb_${profileImage}?t=${Date.now()}`;
            userAvatar.innerHTML = `
                <img src="${imageUrl}" alt="Sua foto" onerror="this.onerror=null; this.src='${thumbUrl}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}">
                <i class="fas fa-user" style="display:none;"></i>
            `;
        } else {
            userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
    
    // 2. Atualizar título e posição
    const clashTitle = document.getElementById('clash-title');
    const myRankEl = document.getElementById('my-rank');
    const progressBar = document.getElementById('ranking-progress-bar');
    
    if (clashTitle) {
        if (ranking.my_rank == 1) {
            clashTitle.textContent = 'Você está no Topo!';
            clashTitle.classList.add('winner');
        } else {
            clashTitle.textContent = 'Disputa de Pontos';
            clashTitle.classList.remove('winner');
        }
    }
    
    if (myRankEl) {
        myRankEl.textContent = `${ranking.my_rank}º`;
    }
    
    if (progressBar && ranking.progress_percentage !== undefined) {
        progressBar.style.width = `${ranking.progress_percentage}%`;
    }
    
    // 3. Renderizar oponente (direita)
    const opponentInfo = document.getElementById('opponent-info');
    const opponentName = document.getElementById('opponent-name');
    
    // Verificar se há oponente (pode ser null ou objeto com dados)
    // No PHP: <?php if (isset($opponent_data)): ?>
    // A API retorna opponent_data que pode ser null ou um objeto
    console.log('🔍 [Ranking] Verificando oponente:', {
        hasOpponent: !!ranking.opponent,
        opponentIsNull: ranking.opponent === null,
        opponentName: ranking.opponent?.name,
        opponentImage: ranking.opponent?.profile_image_filename
    });
    
    // Verificar se há oponente (igual ao PHP: <?php if (isset($opponent_data)): ?>)
    // A API retorna opponent_data que pode ser null ou um objeto com id, name, points, profile_image_filename, etc.
    if (ranking.opponent && ranking.opponent !== null && typeof ranking.opponent === 'object' && ranking.opponent.name) {
        console.log('✅ [Ranking] Renderizando oponente:', ranking.opponent);
        
        // Mostrar oponente
        if (opponentInfo) {
            const opponentAvatar = opponentInfo.querySelector('.player-avatar');
            if (opponentAvatar) {
                const opponentImage = ranking.opponent.profile_image_filename;
                console.log('🖼️ [Ranking] Foto do oponente:', opponentImage);
                
                if (opponentImage) {
                    // Tentar imagem original primeiro, depois thumbnail, depois ícone (igual ao PHP)
                    const opponentImageUrl = `${IMAGES_URL}/assets/images/users/${opponentImage}`;
                    const opponentThumbUrl = `${IMAGES_URL}/assets/images/users/thumb_${opponentImage}`;
                    opponentAvatar.innerHTML = `
                        <img src="${opponentImageUrl}" alt="Foto do oponente" onerror="this.onerror=null; this.src='${opponentThumbUrl}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}">
                        <i class="fas fa-user" style="display:none;"></i>
                    `;
                } else {
                    console.log('⚠️ [Ranking] Oponente sem foto, usando ícone padrão');
                    opponentAvatar.innerHTML = '<i class="fas fa-user"></i>';
                }
            }
        }
        
        // Nome do oponente (apenas primeiro nome) - igual ao PHP: explode(' ', $opponent_data['name'])[0]
        if (opponentName && ranking.opponent.name) {
            const firstName = ranking.opponent.name.split(' ')[0];
            console.log('👤 [Ranking] Nome do oponente:', firstName);
            opponentName.textContent = firstName;
        }
    } else {
        // Se não há oponente, mostrar ícone padrão (igual ao PHP quando não há oponente)
        if (opponentInfo) {
            const opponentAvatar = opponentInfo.querySelector('.player-avatar');
            if (opponentAvatar) {
                opponentAvatar.innerHTML = '<i class="fas fa-user"></i>';
            }
        }
        if (opponentName) {
            opponentName.textContent = '-';
        }
    }
}

function renderMealSuggestions(data) {
    const mealCtaCard = document.getElementById('meal-cta-card');
    const suggestionsCard = document.getElementById('suggestions-card');
    
    const mealSuggestion = data.meal_suggestion || {};
    const suggestions = mealSuggestion.recipes || [];
    const BASE_URL = window.BASE_APP_URL;
    
    if (mealCtaCard) {
        const greeting = mealSuggestion.greeting || 'O que você vai comer agora?';
        const mealTypeId = mealSuggestion.db_param || mealSuggestion.meal_type_id || 'lunch';
        mealCtaCard.querySelector('h2').textContent = greeting;
        const addBtn = document.getElementById('add-meal-btn');
        if (addBtn) {
            const currentDate = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
            addBtn.href = `./add_food_to_diary.html?meal_type=${mealTypeId}&date=${currentDate}`;
        }
    }
    
    if (suggestionsCard) {
        if (suggestions.length > 0) {
            suggestionsCard.style.display = 'block';
            
            // Atualizar título
            const titleEl = document.getElementById('suggestions-title');
            if (titleEl) {
                titleEl.innerHTML = `Sugestões para <span>${escapeHtml(mealSuggestion.display_name || 'Refeição')}</span>`;
            }
            
            // Atualizar link "Ver mais"
            const viewAllLink = document.getElementById('suggestions-view-all');
            if (viewAllLink && mealSuggestion.category_id) {
                viewAllLink.href = `./explore_recipes.html?categories=${mealSuggestion.category_id}`;
            }
            
            const carousel = document.getElementById('suggestions-carousel');
            if (carousel) {
                let html = '';
                suggestions.forEach(recipe => {
                    // Construir URL da imagem (usar image_url se disponível, senão construir)
                    const imageUrl = recipe.image_url 
                        || (recipe.image_filename 
                            ? `${BASE_URL}/assets/images/recipes/${recipe.image_filename}`
                            : `${BASE_URL}/assets/images/recipes/placeholder_food.jpg`);
                    
                    html += `
                        <div class="suggestion-item glass-card">
                            <a href="./view_recipe.html?id=${recipe.id}" class="suggestion-link">
                                <div class="suggestion-image-container">
                                    <img src="${imageUrl}" alt="${escapeHtml(recipe.name)}" onerror="this.src='${BASE_URL}/assets/images/recipes/placeholder_food.jpg'">
                                </div>
                                <div class="recipe-info">
                                    <h4>${escapeHtml(recipe.name)}</h4>
                                    <span><i class="fas fa-fire-alt"></i> ${Math.round(recipe.kcal_per_serving || 0)} kcal</span>
                                </div>
                            </a>
                        </div>
                    `;
                });
                carousel.innerHTML = html;
            }
        } else {
            // Mostrar mensagem de "nenhuma sugestão" igual ao PHP
            suggestionsCard.style.display = 'block';
            const carousel = document.getElementById('suggestions-carousel');
            if (carousel) {
                carousel.innerHTML = `
                    <div class="no-suggestions-card glass-card">
                        <p>Nenhuma sugestão para esta refeição no momento.</p>
                    </div>
                `;
            }
        }
    }
}

function renderChallenges(data) {
    const challengesCard = document.getElementById('challenges-card');
    if (!challengesCard) return;
    
    const challengeGroups = data.challenge_groups || [];
    const viewAllLink = document.getElementById('challenges-view-all');
    const emptyState = document.getElementById('challenges-empty-state');
    const challengesList = document.getElementById('challenges-list');
    
    if (challengeGroups.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (challengesList) challengesList.style.display = 'none';
        if (viewAllLink) viewAllLink.style.display = 'none';
        challengesCard.style.display = 'block';
        return;
    }
    
    challengesCard.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (viewAllLink) viewAllLink.style.display = 'block';
    if (challengesList) {
        challengesList.style.display = 'block';
        let html = '';
        
        challengeGroups.forEach(challenge => {
            // Calcular status e datas (igual ao PHP)
            const startDate = new Date(challenge.start_date);
            const endDate = new Date(challenge.end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let currentStatus, statusText, statusColor;
            if (today < startDate) {
                currentStatus = 'scheduled';
                statusText = 'Agendado';
                statusColor = 'var(--text-secondary)';
            } else if (today >= startDate && today <= endDate) {
                currentStatus = 'active';
                statusText = 'Em andamento';
                statusColor = 'var(--accent-orange)';
            } else {
                currentStatus = 'completed';
                statusText = 'Concluído';
                statusColor = '#4CAF50';
            }
            
            // Calcular progresso (dias)
            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const daysPassed = today > startDate ? Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) : 0;
            const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
            const progressPercentage = totalDays > 0 ? Math.min(100, Math.round((daysPassed / totalDays) * 100)) : 0;
            
            // Formatar datas
            const formatDate = (date) => {
                const d = new Date(date);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            };
            
            html += `
                <a href="./challenges.html?id=${challenge.id}" class="challenge-item">
                    <div class="challenge-item-header">
                        <h4>${escapeHtml(challenge.name)}</h4>
                        <span class="challenge-status" style="color: ${statusColor};">
                            ${escapeHtml(statusText)}
                        </span>
                    </div>
                    ${challenge.description ? `
                        <p class="challenge-description">${escapeHtml(challenge.description.length > 100 ? challenge.description.substring(0, 100) + '...' : challenge.description)}</p>
                    ` : ''}
                    <div class="challenge-meta">
                        <span class="challenge-date">
                            <i class="fas fa-calendar"></i>
                            ${formatDate(challenge.start_date)} - ${formatDate(challenge.end_date)}
                        </span>
                        <span class="challenge-participants">
                            <i class="fas fa-users"></i>
                            ${challenge.total_participants || 0} participante${(challenge.total_participants || 0) > 1 ? 's' : ''}
                        </span>
                    </div>
                    ${currentStatus === 'active' ? `
                        <div class="challenge-progress">
                            <div class="challenge-progress-info">
                                <span>${daysRemaining} dia${daysRemaining > 1 ? 's' : ''} restante${daysRemaining > 1 ? 's' : ''}</span>
                                <span>${progressPercentage}%</span>
                            </div>
                            <div class="progress-bar-challenge">
                                <div class="progress-bar-challenge-fill" style="width: ${progressPercentage}%;"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${challenge.goals && challenge.goals.length > 0 ? `
                        <div class="challenge-goals-preview">
                            ${challenge.goals.map(goal => {
                                const goalIcons = {
                                    'calories': 'fas fa-fire',
                                    'water': 'fas fa-tint',
                                    'exercise': 'fas fa-dumbbell',
                                    'sleep': 'fas fa-bed'
                                };
                                const goalLabels = {
                                    'calories': 'Calorias',
                                    'water': 'Água',
                                    'exercise': 'Exercício',
                                    'sleep': 'Sono'
                                };
                                const icon = goalIcons[goal.type] || 'fas fa-bullseye';
                                const label = goalLabels[goal.type] || goal.type.charAt(0).toUpperCase() + goal.type.slice(1);
                                let unit = '';
                                if (goal.value) {
                                    if (goal.type === 'calories') unit = 'kcal';
                                    else if (goal.type === 'water') unit = 'ml';
                                    else if (goal.type === 'exercise') unit = 'min';
                                    else if (goal.type === 'sleep') unit = 'h';
                                }
                                return `
                                    <span class="challenge-goal-badge">
                                        <i class="${icon}"></i>
                                        ${escapeHtml(label)}
                                        ${goal.value ? `<span>${goal.value}${unit}</span>` : ''}
                                    </span>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                </a>
            `;
        });
        
        challengesList.innerHTML = html;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Função para configurar event listeners do modal de peso
function setupWeightModalListeners() {
    const saveWeightBtn = document.getElementById('save-weight-btn');
    if (saveWeightBtn) {
        // Remover listener antigo se existir
        const newSaveBtn = saveWeightBtn.cloneNode(true);
        saveWeightBtn.parentNode.replaceChild(newSaveBtn, saveWeightBtn);
        
        newSaveBtn.addEventListener('click', async function() {
            const input = document.getElementById('new-weight-input');
            if (!input) {
                console.error('[Weight] Input não encontrado');
                return;
            }
            
            // Normalizar o valor: remover espaços, substituir vírgula por ponto
            let weightValue = input.value.toString().trim().replace(',', '.');
            
            // Converter para número
            let weight = parseFloat(weightValue);
            
            console.log('[Weight] Valor original:', input.value);
            console.log('[Weight] Valor normalizado:', weightValue);
            console.log('[Weight] Valor parseFloat:', weight);
            console.log('[Weight] É NaN?', isNaN(weight));
            
            // Validar se é um número válido
            if (isNaN(weight) || weight <= 0) {
                alert('Por favor, insira um peso válido.');
                return;
            }
            
            // Validar range realista (30kg a 300kg)
            if (weight < 30 || weight > 300) {
                alert('Por favor, insira um peso entre 30kg e 300kg.');
                return;
            }
            
            // Arredondar para 1 casa decimal
            weight = Math.round(weight * 10) / 10;
            
            console.log('[Weight] Valor final (arredondado):', weight);
            
            // Desabilitar botão durante requisição
            newSaveBtn.disabled = true;
            newSaveBtn.textContent = 'Salvando...';
            
            try {
                // Usar /api/ para que o proxy do serve.js intercepte em desenvolvimento
                const apiUrl = '/api/update_weight.php';
                
                // O PHP espera $_POST['weight'] com form data, não JSON
                const formData = new FormData();
                formData.append('weight', weight.toString());
                
                console.log('[Weight] Atualizando peso via:', apiUrl);
                console.log('[Weight] Campo weight:', weight);
                
                const response = await authenticatedFetch(apiUrl, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response) {
                    newSaveBtn.disabled = false;
                    newSaveBtn.textContent = 'Salvar';
                    return;
                }
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error('[Weight] Erro HTTP:', response.status, text);
                    
                    // Tentar parsear como JSON para mostrar mensagem específica
                    let errorMessage = 'Erro ao atualizar peso. Tente novamente.';
                    try {
                        const errorJson = JSON.parse(text);
                        if (errorJson.message) {
                            errorMessage = errorJson.message;
                        }
                    } catch (e) {
                        // Se não for JSON, usar mensagem padrão
                    }
                    
                    alert(errorMessage);
                    newSaveBtn.disabled = false;
                    newSaveBtn.textContent = 'Salvar';
                    return;
                }
                
                const result = await response.json();
                console.log('[Weight] Resposta da API:', result);
                
                if (result.success || result.status === 'success') {
                    // Fechar modal
                    const modal = document.getElementById('edit-weight-modal');
                    if (modal) {
                        modal.classList.remove('modal-visible');
                        document.body.style.overflow = '';
                    }
                    
                    // Atualizar card de peso dinamicamente (sem recarregar a página)
                    const weightCard = document.getElementById('weight-card');
                    if (weightCard) {
                        // Mostrar countdown de 7 dias com o novo peso
                        weightCard.innerHTML = `
                            <span>Próxima atualização em</span>
                            <strong class="countdown">7 dias</strong>
                        `;
                    }
                    
                    // Mostrar feedback de sucesso
                    if (window.showToast) {
                        window.showToast('Peso atualizado com sucesso!', 'success');
                    }
                    
                    console.log('[Weight] Peso atualizado com sucesso! Novo peso:', weight);
                } else {
                    alert(result.message || 'Erro ao atualizar peso.');
                    newSaveBtn.disabled = false;
                    newSaveBtn.textContent = 'Salvar';
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro ao atualizar peso. Tente novamente.');
                newSaveBtn.disabled = false;
                newSaveBtn.textContent = 'Salvar';
            }
        });
    }
    
    // Abrir modal de peso ao clicar no botão (usar event delegation para funcionar no SPA)
    // Remover listener antigo se existir
    const existingHandler = document._weightModalHandler;
    if (existingHandler) {
        document.removeEventListener('click', existingHandler);
    }
    
    document._weightModalHandler = function(e) {
        if (e.target.closest('[data-action="open-weight-modal"]')) {
            const modal = document.getElementById('edit-weight-modal');
            if (modal) {
                modal.classList.add('modal-visible');
                document.body.style.overflow = 'hidden';
                // Preencher input com peso atual
                const currentWeightEl = document.getElementById('current-weight-value');
                if (currentWeightEl) {
                    const currentWeightText = currentWeightEl.textContent.replace('kg', '').trim().replace(',', '.');
                    const weightInput = document.getElementById('new-weight-input');
                    if (weightInput) {
                        weightInput.value = parseFloat(currentWeightText) || '';
                    }
                }
            }
        }
    };
    
    document.addEventListener('click', document._weightModalHandler);
}

// Executar no DOMContentLoaded (páginas HTML completas)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWeightModalListeners);
} else {
    setupWeightModalListeners();
}

// Executar no SPA quando fragmento é carregado
window.addEventListener('fragmentReady', function() {
    setTimeout(setupWeightModalListeners, 100);
});

window.addEventListener('pageLoaded', function() {
    setTimeout(setupWeightModalListeners, 150);
});

// Adicionar CSRF token hidden input (necessário para algumas ações)
if (!document.getElementById('csrf_token_main_app')) {
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.id = 'csrf_token_main_app';
    csrfInput.value = ''; // Será preenchido se necessário
    document.body.appendChild(csrfInput);
}


})();
