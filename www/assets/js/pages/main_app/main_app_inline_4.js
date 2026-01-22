
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
    let modal = document.getElementById('checkinModal');
    
    // ✅ CRIAR MODAL SE NÃO EXISTIR
    if (!modal) {
        console.log('[Check-in] Modal não encontrado, criando...');
        if (!checkinData && window.checkinData) {
            checkinData = window.checkinData;
        }
        
        if (!checkinData) {
            console.error('[Check-in] Não é possível criar modal: checkinData não disponível');
            return;
        }
        
        modal = document.createElement('div');
        modal.id = 'checkinModal';
        modal.className = 'checkin-modal';
        modal.innerHTML = `
            <div class="checkin-chat-container">
                <div class="checkin-chat-header">
                    <h3 id="checkin-title">${checkinData.name || 'Check-in'}</h3>
                    <button class="checkin-close-btn" id="checkin-close-btn" style="display: none !important;">&times;</button>
                </div>
                <div class="checkin-messages" id="checkinMessages"></div>
                <div class="checkin-input-container" id="checkinInputContainer">
                    <input type="text" class="checkin-text-input" id="checkinTextInput" placeholder="Digite sua resposta..." onkeypress="if(event.key === 'Enter') sendCheckinResponse()" disabled>
                    <button class="checkin-send-btn" onclick="sendCheckinResponse()" id="checkinSendBtn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        // Inserir no body
        const appContainer = document.getElementById('app-container');
        if (appContainer && appContainer.nextSibling) {
            document.body.insertBefore(modal, appContainer.nextSibling);
        } else {
            document.body.appendChild(modal);
        }
        console.log('[Check-in] Modal criado dinamicamente em openCheckinModal');
    }
    
    // Verificar se há checkin disponível
    if (!checkinData && window.checkinData) {
        checkinData = window.checkinData;
    }
    
    if (!checkinData) {
        console.error('[Check-in] Nenhum checkin disponível');
        // NÃO mostrar alert - apenas logar
        console.log('[Check-in] checkinData não disponível, fechando modal');
        modal.style.display = 'none';
        return;
    }
    
    console.log('[Check-in] Abrindo modal com checkinData:', checkinData.id);
    
    // ✅ RESETAR FLAG DE COMPLETADO quando modal é aberto (novo checkin ou continuação)
    isCheckinCompleted = false;
    
    // Abrir modal - garantir que está visível e acima de tudo
    console.log('[Check-in] Aplicando estilos para exibir modal');
    modal.classList.add('active');
    modal.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999999 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
    `;
    modal.setAttribute('aria-hidden', 'false');
    console.log('[Check-in] Modal deve estar visível agora. display:', modal.style.display, 'z-index:', modal.style.zIndex);
    
    // Bloquear scroll do body (sem alterar posicionamento fixo do layout)
    document.body.classList.add('checkin-modal-open');
    
    // ✅ BLOQUEAR APP COMPLETAMENTE quando checkin não está completo (obrigatório)
    if (checkinData && checkinData.questions) {
        const totalQuestions = checkinData.questions.length;
        const answeredCount = Object.keys(checkinResponses).length;
        
        if (answeredCount < totalQuestions) {
            // Bloquear interação com o app
            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.style.pointerEvents = 'none';
                appContainer.style.opacity = '0.3';
            }
            
            // Esconder botão X
            const closeBtn = modal.querySelector('.checkin-close-btn');
            if (closeBtn) {
                closeBtn.style.display = 'none !important';
                closeBtn.style.visibility = 'hidden';
                closeBtn.style.opacity = '0';
                closeBtn.style.pointerEvents = 'none';
            }
        }
    }
    
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
            
            // Scroll touch configurado
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
    
    // ✅ IMPEDIR FECHAR AO CLICAR NO BACKGROUND (check-in obrigatório)
    // NUNCA permitir fechar ao clicar fora quando check-in não está completo
    if (checkinData && checkinData.questions) {
        const totalQuestions = checkinData.questions.length;
        const answeredCount = Object.keys(checkinResponses).length;
        
        // Se não está completo, IMPEDIR fechar ao clicar fora
        if (answeredCount < totalQuestions) {
            // Bloquear qualquer tentativa de fechar ao clicar fora
            modal.addEventListener('click', function modalClickHandler(e) {
                // Se clicou no background, PREVENIR fechamento
                const container = modal.querySelector('.checkin-chat-container');
                if (e.target === modal || (e.target.classList.contains('checkin-modal') && !container.contains(e.target))) {
                    e.preventDefault();
                    e.stopPropagation();
                    // NÃO fechar - checkin obrigatório
                    return false;
                }
            }, true);
            
            // Também bloquear touch
            modal.addEventListener('touchend', function modalTouchHandler(e) {
                const container = modal.querySelector('.checkin-chat-container');
                if ((e.target === modal || e.target.classList.contains('checkin-modal')) && !container.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    // NÃO fechar - checkin obrigatório
                    return false;
                }
            }, { passive: false, capture: true });
        } else {
            // Só permitir fechar ao clicar fora se estiver completo
            modal.addEventListener('click', function modalClickHandler(e) {
                const container = modal.querySelector('.checkin-chat-container');
                if (e.target === modal || (e.target.classList.contains('checkin-modal') && !container.contains(e.target))) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeCheckinModal();
                    return false;
                }
            });
            
            modal.addEventListener('touchend', function modalTouchHandler(e) {
                const container = modal.querySelector('.checkin-chat-container');
                if ((e.target === modal || e.target.classList.contains('checkin-modal')) && !container.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeCheckinModal();
                    return false;
                }
            }, { passive: false });
        }
    }
    
    // ✅ BOTÃO DE FECHAR - SEMPRE ESCONDIDO quando check-in não está completo (obrigatório)
    const closeBtn = modal.querySelector('.checkin-close-btn');
    if (closeBtn) {
        // Verificar se check-in está completo
        if (checkinData && checkinData.questions) {
            const totalQuestions = checkinData.questions.length;
            const answeredCount = Object.keys(checkinResponses).length;
            
            // Se não completou, SEMPRE esconder botão de fechar (obrigatório)
            if (answeredCount < totalQuestions) {
                closeBtn.style.display = 'none !important';
                closeBtn.style.visibility = 'hidden';
                closeBtn.style.opacity = '0';
                closeBtn.style.pointerEvents = 'none';
            } else {
                // Só mostrar quando completo
                closeBtn.style.display = 'block';
                closeBtn.style.visibility = 'visible';
                closeBtn.style.opacity = '1';
                closeBtn.style.pointerEvents = 'auto';
            }
        }
        
        // Remover todos os event listeners antigos
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        // Adicionar event listeners diretos
        newCloseBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Botão X clicado
            closeCheckinModal();
            return false;
        };
        
        newCloseBtn.ontouchend = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Botão X tocado
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
    
    // ✅ VERIFICAR SE CHECK-IN ESTÁ COMPLETO ANTES DE PERMITIR FECHAR
    if (checkinData && checkinData.questions) {
        const totalQuestions = checkinData.questions.length;
        const answeredCount = Object.keys(checkinResponses).length;
        
        // Se não completou todas as perguntas, NÃO PERMITIR FECHAR (OBRIGATÓRIO)
        if (answeredCount < totalQuestions) {
            // Verificar se todas as perguntas visíveis foram respondidas
            let visibleQuestionsCount = 0;
            let answeredVisibleCount = 0;
            
            for (let i = 0; i < checkinData.questions.length; i++) {
                const question = checkinData.questions[i];
                if (shouldShowQuestion(question)) {
                    visibleQuestionsCount++;
                    const questionId = Number(question.id);
                    if (checkinResponses[questionId]) {
                        answeredVisibleCount++;
                    }
                }
            }
            
            // Se ainda há perguntas visíveis não respondidas, não permitir fechar
            if (answeredVisibleCount < visibleQuestionsCount) {
                // Mostrar mensagem informando que precisa completar
                alert('Por favor, complete o check-in antes de fechar. É obrigatório responder todas as perguntas.');
                return;
            }
        }
    }
    
    // Salvar progresso antes de fechar o modal
    if (checkinData && Object.keys(checkinResponses).length > 0) {
        saveCheckinProgressToLocalStorage();
        // Progresso salvo ao fechar modal
    }
    
    // Forçar fechamento do modal - múltiplas formas para garantir
    modal.classList.remove('active');
    modal.style.display = 'none !important';
    modal.style.visibility = 'hidden !important';
    modal.style.opacity = '0 !important';
    modal.setAttribute('aria-hidden', 'true');
    
    // Restaurar scroll do body
    document.body.classList.remove('checkin-modal-open');
    
    // ✅ LIBERAR APP (permitir interação novamente)
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.pointerEvents = 'auto';
        appContainer.style.opacity = '1';
    }
    
    // Modal fechado
    
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
            // Progresso carregado do localStorage
            // Verificar se o progresso é da semana atual
            const savedWeek = progress.week_start || progress.week_date;
            if (savedWeek !== currentWeek) {
                // Progresso de semana diferente detectado - limpando localStorage antigo
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
            
            // Se já temos respostas salvas, restaurar o chat
            if (answeredQuestionIds.length > 0) {
                // Restaurando chat do progresso salvo localmente
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
        // Dados do servidor carregados
        if (data && data.success) {
            // Se o servidor retornou respostas vazias, significa que o checkin já foi completado
            // ou não há progresso salvo. Nesse caso, começar do início
            if (!data.responses || Object.keys(data.responses).length === 0) {
                // Nenhuma resposta salva encontrada, começando do início
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
                
                // Restaurando chat do progresso do servidor
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
    
    // Restaurando chat
    
    // Garantir que answeredQuestionIds e question.id são do mesmo tipo para comparação
    const answeredQuestionIdsNum = answeredQuestionIds.map(id => Number(id));
    
    // Renderizar todas as perguntas já respondidas
    for (let i = 0; i < checkinData.questions.length; i++) {
        const question = checkinData.questions[i];
        const questionIdNum = Number(question.id);
        
        if (answeredQuestionIdsNum.includes(questionIdNum)) {
            // Restaurando pergunta
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
    
    // Verificando progresso
    
    if (currentQuestionIndex >= checkinData.questions.length || totalAnswered >= checkinData.questions.length) {
        // Todas as perguntas foram respondidas
        addMessage('Obrigado pelo seu feedback! Seu check-in foi salvo com sucesso.', 'bot');
        const textInput = document.getElementById('checkinTextInput');
        const sendBtn = document.getElementById('checkinSendBtn');
        textInput.disabled = true;
        sendBtn.disabled = true;
        textInput.value = '';
        textInput.placeholder = 'Check-in finalizado';
        
        // ✅ MOSTRAR BOTÃO DE FECHAR AGORA QUE ESTÁ COMPLETO
        const closeBtn = document.getElementById('checkin-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'block';
        }
        
        // Marcar como completo
        markCheckinComplete();
    } else {
        // ✅ GARANTIR QUE BOTÃO X ESTÁ ESCONDIDO (ainda há perguntas pendentes)
        const closeBtn = document.getElementById('checkin-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'none !important';
            closeBtn.style.visibility = 'hidden';
            closeBtn.style.opacity = '0';
            closeBtn.style.pointerEvents = 'none';
        }
        
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
            // Pulando pergunta devido a condição não atendida
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
        
        // ✅ MOSTRAR BOTÃO DE FECHAR AGORA QUE ESTÁ COMPLETO
        const closeBtn = document.getElementById('checkin-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'block';
        }
        
        // Marcar como completo (todas as respostas já foram salvas individualmente)
        markCheckinComplete();
        return;
    }
    
    const question = checkinData.questions[currentQuestionIndex];
    
    // ✅ GARANTIR QUE BOTÃO X ESTÁ ESCONDIDO (ainda há perguntas pendentes)
    const closeBtn = document.getElementById('checkin-close-btn');
    if (closeBtn) {
        closeBtn.style.display = 'none !important';
        closeBtn.style.visibility = 'hidden';
        closeBtn.style.opacity = '0';
        closeBtn.style.pointerEvents = 'none';
    }
    
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
// ✅ Flag para indicar que o checkin foi completado (evitar salvar após conclusão)
let isCheckinCompleted = false;

function saveCheckinProgressToLocalStorage() {
    // ✅ NÃO SALVAR se o checkin já foi completado
    if (isCheckinCompleted) {
        console.log('[Check-in] Checkin já foi completado, não salvando progresso');
        return;
    }
    
    // Salvar progresso no localStorage em vez de salvar individualmente no backend
    // Fazer deep copy para garantir que o objeto seja salvo corretamente
    
    // ✅ Usar window.checkinData como fallback se checkinData local não estiver disponível
    const dataToUse = checkinData || window.checkinData;
    if (!dataToUse || !dataToUse.id) {
        console.warn('[Check-in] checkinData não está disponível para salvar (pode ter sido completado)');
        return;
    }
    
    // Debounce: cancelar salvamento anterior se houver um pendente
    if (saveCheckinProgressTimeout) {
        clearTimeout(saveCheckinProgressTimeout);
    }
    
    // Executar salvamento após pequeno delay para evitar múltiplas escritas
    saveCheckinProgressTimeout = setTimeout(() => {
        // ✅ Verificar novamente se foi completado antes de salvar
        if (!isCheckinCompleted) {
            _saveCheckinProgressToLocalStorage();
        }
        saveCheckinProgressTimeout = null;
    }, 100);
}

function _saveCheckinProgressToLocalStorage() {
    // ✅ VERIFICAÇÃO DE SEGURANÇA: Garantir que checkinData existe
    const dataToUse = checkinData || window.checkinData;
    if (!dataToUse || !dataToUse.id) {
        console.warn('[Check-in] Não é possível salvar progresso: checkinData não está disponível (pode ter sido completado)');
        return; // Sair silenciosamente se não houver dados
    }
    
    // Incluir a semana atual na chave para isolar progresso por semana
    const currentWeek = getCurrentWeekStart();
    const storageKey = `checkin_progress_${dataToUse.id}_${currentWeek}`;
    
    // Limpar progressos antigos de outras semanas para o mesmo checkin
    clearOldCheckinProgressForConfig(dataToUse.id, currentWeek);
    
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
        config_id: Number(dataToUse.id),
        week_start: currentWeek // Salvar a semana para validação
    };
    
    try {
        const serialized = JSON.stringify(progress);
        localStorage.setItem(storageKey, serialized);
        // Progresso salvo no localStorage
    } catch (error) {
        console.error('[Check-in] Erro ao salvar no localStorage:', error);
        // Se o localStorage estiver cheio, tentar limpar dados antigos
        if (error.name === 'QuotaExceededError' || error.code === 22) {
            
            clearOldCheckinProgress();
            // Tentar novamente
            try {
                localStorage.setItem(storageKey, JSON.stringify(progress));
                // Progresso salvo após limpeza
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
        // Removido progresso antigo
    });
}

function clearCheckinProgressFromLocalStorage() {
    // Limpar progresso do localStorage após completar o checkin
    // ✅ Usar window.checkinData como fallback se checkinData local não estiver disponível
    const dataToUse = checkinData || window.checkinData;
    if (!dataToUse || !dataToUse.id) {
        console.warn('[Check-in] Não é possível limpar progresso: checkinData não disponível');
        return;
    }
    
    const currentWeek = getCurrentWeekStart();
    const storageKey = `checkin_progress_${dataToUse.id}_${currentWeek}`;
    
    try {
        localStorage.removeItem(storageKey);
        console.log('[Check-in] Progresso removido do localStorage');
        
        // Limpar também chave antiga sem semana (compatibilidade)
        const oldKey = `checkin_progress_${dataToUse.id}`;
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
        // Removido progresso antigo
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
    // ✅ VERIFICAÇÃO DE SEGURANÇA: Garantir que checkinData existe
    if (!checkinData || !checkinData.id) {
        // Tentar usar window.checkinData como fallback
        if (window.checkinData && window.checkinData.id) {
            checkinData = window.checkinData;
        } else {
            console.error('[Check-in] Não é possível completar check-in: checkinData não está disponível');
            alert('Erro: Dados do check-in não estão disponíveis. Por favor, recarregue a página.');
            return;
        }
    }
    
    // ✅ MARCAR COMO COMPLETADO ANTES DE ENVIAR (evitar salvar progresso durante envio)
    isCheckinCompleted = true;
    
    // ✅ CANCELAR QUALQUER TIMEOUT PENDENTE DE SALVAMENTO
    if (saveCheckinProgressTimeout) {
        clearTimeout(saveCheckinProgressTimeout);
        saveCheckinProgressTimeout = null;
    }
    
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
            // Check-in completo
            
            // ✅ SALVAR checkinData ANTES DE LIMPAR (para usar nas funções abaixo)
            const savedCheckinData = checkinData || window.checkinData;
            
            // Limpar progresso do localStorage após enviar com sucesso
            // (usar savedCheckinData se checkinData já foi limpo)
            if (savedCheckinData && savedCheckinData.id) {
                const currentWeek = getCurrentWeekStart();
                const storageKey = `checkin_progress_${savedCheckinData.id}_${currentWeek}`;
                try {
                    localStorage.removeItem(storageKey);
                    const oldKey = `checkin_progress_${savedCheckinData.id}`;
                    localStorage.removeItem(oldKey);
                    console.log('[Check-in] Progresso removido do localStorage após completar');
                } catch (error) {
                    console.error('[Check-in] Erro ao limpar localStorage:', error);
                }
            }
            
            // ✅ LIBERAR APP (permitir interação novamente)
            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.style.pointerEvents = 'auto';
                appContainer.style.opacity = '1';
            }
            
            // ✅ MOSTRAR BOTÃO DE FECHAR AGORA QUE ESTÁ COMPLETO
            const closeBtn = document.getElementById('checkin-close-btn');
            if (closeBtn) {
                closeBtn.style.display = 'block';
                closeBtn.style.visibility = 'visible';
                closeBtn.style.opacity = '1';
                closeBtn.style.pointerEvents = 'auto';
            }
            
            // Fechar o modal imediatamente
            closeCheckinModal();
            
            // ✅ NÃO REMOVER O BOTÃO - Ele agora é para WhatsApp e deve ficar sempre visível
            // O botão flutuante agora é para suporte WhatsApp, não para check-in
            
            // Esconder o modal
            const modal = document.getElementById('checkinModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
            
            // ✅ Limpar dados do check-in APÓS todas as operações necessárias
            window.checkinData = null;
            checkinData = null;
            
            // ✅ Limpar também as respostas e índice
            checkinResponses = {};
            currentQuestionIndex = 0;
            
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

/**
 * Função reutilizável para carregar dados do dashboard
 * Pode ser chamada na inicialização e quando a conexão volta
 */
async function loadDashboardData() {
    // Verificar se BASE_APP_URL foi definido
    if (!window.BASE_APP_URL) {
        console.error('[ERRO] BASE_APP_URL não foi definido!');
        const container = document.getElementById('dashboard-container');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-primary);"><p>Erro: BASE_APP_URL não foi definido</p></div>';
            container.style.display = 'block';
        }
        return;
    }
    
    // Verificar se há token na URL (vindo do login.php)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
        setAuthToken(tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Verificar autenticação
    const authenticated = await requireAuth();
    if (!authenticated) {
        return;
    }
    
    // ✅ Verificar se está offline ANTES de tentar carregar
    // Se estiver offline, não mostrar erro - o modal offline já está cuidando disso
    if (!navigator.onLine) {
        return;
    }
    
    const container = document.getElementById('dashboard-container');
    if (!container) {
        console.error('[Dashboard] Container não encontrado');
        return;
    }
    
    try {
        // Mostrar skeleton/loading enquanto carrega
        container.style.display = 'block';
        
        // Verificar se há token antes de fazer requisição
        const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                     (localStorage.getItem('shapefit_auth_token') || null);
        
        if (!token) {
            // Sem token, redirecionar para login silenciosamente
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return;
        }
        
        // Carregar dados do dashboard
        const response = await authenticatedFetch('/api/get_dashboard_data.php');
        if (!response) {
            // Token inválido ou erro de autenticação - redirecionar para login
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return;
        }
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.clone().text();
            console.error('Resposta não é JSON. Conteúdo completo:', responseText);
            throw new Error('A API retornou um formato inválido. Verifique o console para mais detalhes.');
        }
        
        // Tentar fazer parse do JSON
        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            const responseText = await response.clone().text();
            console.error('Erro ao fazer parse do JSON:', parseError);
            throw new Error('Resposta da API não é JSON válido. Verifique o console.');
        }
        
        if (!result.success) {
            throw new Error(result.message || 'Erro ao carregar dados');
        }
        
        const data = result.data;
        
        // ✅ RENDERIZAÇÃO INCREMENTAL - Não bloquear thread
        renderDashboardOptimized(data).catch(err => {
            console.error('Erro na renderização incremental:', err);
            // Fallback: renderização direta
            renderDashboard(data);
        });
        
        // Mostrar container
        container.style.display = 'block';
        
        // ✅ PÁGINA PRONTA - Remover skeleton APÓS renderização completa
        if (window.PageLoader) window.PageLoader.ready();
        
    } catch (error) {
        // ✅ Verificar se é erro de rede/offline
        const isNetworkError = error.message && (
            error.message.includes('Network request failed') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.name === 'NetworkError' ||
            error.silent === true
        );
        
        // Se for erro de rede e estiver offline, não mostrar erro
        // O modal offline já está cuidando disso
        if (isNetworkError && (!navigator.onLine || (window.isOffline && window.isOffline()))) {
            return;
        }
        
        console.error('Erro ao carregar dashboard:', error);
        console.error('Stack:', error.stack);
        const errorMsg = error.message || 'Erro desconhecido';
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-primary);">
                <p>Erro ao carregar dados: ${errorMsg}</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 10px;">Verifique o console para mais detalhes.</p>
            </div>
        `;
        container.style.display = 'block';
        
        // ✅ Mesmo com erro, remover skeleton
        if (window.PageLoader) window.PageLoader.ready();
    }
}

// ✅ Função para verificar e abrir check-in pendente
function checkAndOpenPendingCheckin() {
    if (!checkinData && window.checkinData) {
        checkinData = window.checkinData;
    }
    
    if (!checkinData || !checkinData.id) {
        console.log('[Check-in] Nenhum check-in disponível para abrir');
        return; // Não há check-in disponível
    }
    
    let modal = document.getElementById('checkinModal');
    
    // ✅ CRIAR MODAL SE NÃO EXISTIR
    if (!modal) {
        console.log('[Check-in] Modal não existe, criando...');
        modal = document.createElement('div');
        modal.id = 'checkinModal';
        modal.className = 'checkin-modal';
        modal.innerHTML = `
            <div class="checkin-chat-container">
                <div class="checkin-chat-header">
                    <h3 id="checkin-title">${checkinData.name || 'Check-in'}</h3>
                    <button class="checkin-close-btn" id="checkin-close-btn" style="display: none !important;">&times;</button>
                </div>
                <div class="checkin-messages" id="checkinMessages"></div>
                <div class="checkin-input-container" id="checkinInputContainer">
                    <input type="text" class="checkin-text-input" id="checkinTextInput" placeholder="Digite sua resposta..." onkeypress="if(event.key === 'Enter') sendCheckinResponse()" disabled>
                    <button class="checkin-send-btn" onclick="sendCheckinResponse()" id="checkinSendBtn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        // Inserir no body
        const appContainer = document.getElementById('app-container');
        if (appContainer && appContainer.nextSibling) {
            document.body.insertBefore(modal, appContainer.nextSibling);
        } else {
            document.body.appendChild(modal);
        }
        console.log('[Check-in] Modal criado dinamicamente em checkAndOpenPendingCheckin');
    }
    
    // Verificar se modal já está aberto
    if (modal.classList.contains('active') || modal.style.display === 'flex') {
        console.log('[Check-in] Modal já está aberto');
        return; // Já está aberto
    }
    
    // Verificar se check-in está completo
    const currentWeek = getCurrentWeekStart();
    const storageKey = `checkin_progress_${checkinData.id}_${currentWeek}`;
    const savedProgress = localStorage.getItem(storageKey);
    
    let isCheckinComplete = false;
    if (savedProgress) {
        try {
            const progress = JSON.parse(savedProgress);
            const totalQuestions = checkinData.questions ? checkinData.questions.length : 0;
            const answeredCount = progress.responses ? Object.keys(progress.responses).length : 0;
            
            if (answeredCount >= totalQuestions && totalQuestions > 0) {
                isCheckinComplete = true;
            }
        } catch (e) {
            console.error('[Check-in] Erro ao verificar progresso:', e);
        }
    }
    
    // Se não está completo, abrir modal OBRIGATORIAMENTE
    if (!isCheckinComplete) {
        // Esconder botão X
        const closeBtn = modal.querySelector('.checkin-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'none !important';
            closeBtn.style.visibility = 'hidden';
            closeBtn.style.opacity = '0';
            closeBtn.style.pointerEvents = 'none';
        }
        
        // Bloquear app
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.pointerEvents = 'none';
            appContainer.style.opacity = '0.3';
        }
        
        // Configurar eventos
        setupCheckinModalEvents();
        
        // ✅ FORÇAR ABERTURA DO MODAL - checkin obrigatório
        console.log('[Check-in] FORÇANDO abertura do modal obrigatório via checkAndOpenPendingCheckin');
        
        // Abrir imediatamente
        openCheckinModal();
        
        // Verificar se realmente abriu e forçar se necessário
        setTimeout(() => {
            const modalCheck = document.getElementById('checkinModal');
            if (modalCheck) {
                const isVisible = modalCheck.style.display === 'flex' || 
                                 modalCheck.classList.contains('active') ||
                                 window.getComputedStyle(modalCheck).display === 'flex';
                
                if (!isVisible) {
                    console.log('[Check-in] Modal não está visível, FORÇANDO abertura');
                    modalCheck.style.cssText = `
                        display: flex !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        z-index: 999999 !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                    `;
                    modalCheck.classList.add('active');
                    document.body.classList.add('checkin-modal-open');
                }
            }
        }, 200);
    } else {
        console.log('[Check-in] Check-in já está completo');
    }
}

// Inicialização principal
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
        // Funções de missões não foram carregadas após espera
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
                // initializeMissionsCarousel stub chamado
            };
        }
    }
    
    // Carregar dados inicialmente
    await loadDashboardData();
    
    // ✅ Verificar check-in pendente após carregar dados (com delay maior para garantir que renderDashboardOptimized terminou)
    setTimeout(() => {
        console.log('[Check-in] Verificando check-in pendente após loadDashboardData');
        checkAndOpenPendingCheckin();
    }, 2000);
    
    // ✅ FORÇAR INICIALIZAÇÃO DO CARROSSEL APÓS DADOS CARREGAREM
    // Aguardar um pouco para garantir que o DOM está pronto
    setTimeout(() => {
        if (window.tryInitCarousel && typeof window.tryInitCarousel === 'function') {
            window.tryInitCarousel();
        } else if (typeof tryInitCarousel === 'function') {
            tryInitCarousel();
        }
    }, 500);
    
    // ✅ ESCUTAR EVENTO DE RECONEXÃO
    // Quando a internet volta, recarregar os dados automaticamente
    window.addEventListener('reloadPageData', async function(e) {
        if (e.detail && e.detail.reason === 'connection-restored') {
            // Limpar mensagens de erro anteriores
            const container = document.getElementById('dashboard-container');
            if (container) {
                // Remover qualquer mensagem de erro que possa estar visível
                const errorDivs = container.querySelectorAll('div[style*="text-align: center"]');
                errorDivs.forEach(div => {
                    if (div.textContent.includes('Erro ao carregar dados')) {
                        div.remove();
                    }
                });
            }
            
            // Recarregar dados
            await loadDashboardData();
        }
    });
    
    // ✅ TAMBÉM ESCUTAR EVENTO ONLINE DIRETO (backup)
    // Caso o evento reloadPageData não seja disparado
    window.addEventListener('online', async function() {
        // Aguardar um pouco para garantir que a conexão está estável
        setTimeout(async () => {
            // Verificar se realmente está online
            if (navigator.onLine) {
                const container = document.getElementById('dashboard-container');
                if (container) {
                    // Verificar se há mensagem de erro visível
                    const hasError = container.innerHTML.includes('Erro ao carregar dados');
                    if (hasError) {
                        await loadDashboardData();
                        // Verificar check-in pendente após recarregar
                        setTimeout(() => {
                            checkAndOpenPendingCheckin();
                        }, 1000);
                    }
                }
            }
        }, 1000);
    });
    
    // ✅ ESCUTAR EVENTO DE APP VOLTANDO DO BACKGROUND (Capacitor)
    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                // App voltou para foreground, verificar check-in pendente
                setTimeout(() => {
                    checkAndOpenPendingCheckin();
                }, 500);
            }
        });
    }
    
    // ✅ ESCUTAR VISIBILITY CHANGE (fallback para web)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Página voltou a ficar visível, verificar check-in pendente
            setTimeout(() => {
                checkAndOpenPendingCheckin();
            }, 500);
        }
    });
})();

/**
 * ✅ RENDERIZAÇÃO OTIMIZADA - Incremental com requestAnimationFrame
 * Não bloqueia o thread principal, mantém skeleton fluido
 */
async function renderDashboardOptimized(data) {
    return new Promise((resolve) => {
        let step = 0;
        const steps = [
            // Passo 1: Elementos críticos (header)
            () => {
                const pointsDisplay = document.getElementById('user-points-display');
                if (pointsDisplay && data.points !== undefined) {
                    pointsDisplay.textContent = new Intl.NumberFormat('pt-BR').format(data.points);
                }
                
                // Avatar
                const IMAGES_BASE_URL = 'https://appshapefit.com';
                const cacheBuster = Date.now();
                const profileIcon = document.getElementById('profile-icon-link');
                if (profileIcon && data.profile_image) {
                    const img = profileIcon.querySelector('img') || document.createElement('img');
                    img.src = `${IMAGES_BASE_URL}/assets/images/users/${data.profile_image}?t=${cacheBuster}`;
                    img.alt = 'Foto de Perfil';
                    img.onerror = function() {
                        this.onerror = null;
                        this.src = `${IMAGES_BASE_URL}/assets/images/users/thumb_${data.profile_image}?t=${cacheBuster}`;
                        this.onerror = function() {
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
            },
            // Passo 2: Cards principais
            () => {
                renderWeightCard(data);
                renderHydration(data);
            },
            // Passo 3: Consumo
            () => {
                renderConsumption(data);
            },
            // Passo 4: Rotinas
            () => {
                renderRoutines(data);
            },
            // Passo 5: Ranking
            () => {
                renderRanking(data);
            },
            // Passo 6: Sugestões
            () => {
                renderMealSuggestions(data);
            },
            // Passo 7: Desafios
            () => {
                renderChallenges(data);
            },
            // Passo 8: Botão WhatsApp (SEMPRE) e Check-in obrigatório
            () => {
                // Verificar se estamos na página main_app antes de criar/exibir o botão
                const isMainAppPage = document.getElementById('dashboard-container') || 
                                     document.querySelector('.main-app-container') ||
                                     window.location.pathname.includes('main_app') ||
                                     window.location.pathname === '/' ||
                                     window.location.pathname === '/index.html';
                
                if (!isMainAppPage) {
                    // Não estamos na página main_app, esconder o botão se existir
                    const existingBtn = document.getElementById('checkin-floating-btn');
                    if (existingBtn) {
                        existingBtn.style.display = 'none';
                        existingBtn.style.visibility = 'hidden';
                        existingBtn.style.opacity = '0';
                    }
                    return;
                }
                
                // ✅ BOTÃO WHATSAPP SEMPRE VISÍVEL - Criar/garantir que existe sempre (independente de checkin)
                let whatsappBtn = document.getElementById('checkin-floating-btn');
                if (!whatsappBtn) {
                    // Criar o botão se não existir
                    whatsappBtn = document.createElement('button');
                    whatsappBtn.id = 'checkin-floating-btn';
                    whatsappBtn.className = 'checkin-floating-btn';
                    whatsappBtn.setAttribute('aria-label', 'Abrir WhatsApp Suporte');
                    whatsappBtn.innerHTML = '<i class="fas fa-comments"></i>';
                    
                    // Inserir no body, DEPOIS do app-container (não dentro dele)
                    const appContainer = document.getElementById('app-container');
                    if (appContainer && appContainer.nextSibling) {
                        document.body.insertBefore(whatsappBtn, appContainer.nextSibling);
                    } else {
                        document.body.appendChild(whatsappBtn);
                    }
                    console.log('[WhatsApp] Botão criado dinamicamente e adicionado ao body');
                }
                
                // ✅ BOTÃO SEMPRE REDIRECIONA PARA WHATSAPP (independente de checkin)
                whatsappBtn.onclick = function() {
                    const whatsappNumber = '5534984426408';
                    const whatsappUrl = `https://wa.me/${whatsappNumber}`;
                    window.open(whatsappUrl, '_blank');
                };
                
                // Forçar estilos do botão para garantir que fique fixo e sempre visível
                whatsappBtn.style.position = 'fixed';
                whatsappBtn.style.bottom = '90px';
                whatsappBtn.style.right = '20px';
                whatsappBtn.style.zIndex = '9999';
                whatsappBtn.style.display = 'flex';
                whatsappBtn.style.visibility = 'visible';
                whatsappBtn.style.opacity = '1';
                console.log('[WhatsApp] Botão sempre visível configurado');
                
                // ✅ VERIFICAR SE HÁ CHECK-IN DISPONÍVEL (para modal obrigatório)
                if (data.available_checkin) {
                    // Garantir que o modal existe
                    let checkinModal = document.getElementById('checkinModal');
                    if (!checkinModal) {
                        // Criar o modal se não existir
                        checkinModal = document.createElement('div');
                        checkinModal.id = 'checkinModal';
                        checkinModal.className = 'checkin-modal';
                        checkinModal.innerHTML = `
                            <div class="checkin-chat-container">
                                <div class="checkin-chat-header">
                                    <h3 id="checkin-title">Check-in</h3>
                                    <button class="checkin-close-btn" id="checkin-close-btn" style="display: none !important;">&times;</button>
                                </div>
                                <div class="checkin-messages" id="checkinMessages"></div>
                                <div class="checkin-input-container" id="checkinInputContainer">
                                    <input type="text" class="checkin-text-input" id="checkinTextInput" placeholder="Digite sua resposta..." onkeypress="if(event.key === 'Enter') sendCheckinResponse()" disabled>
                                    <button class="checkin-send-btn" onclick="sendCheckinResponse()" id="checkinSendBtn" disabled>
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                        // Inserir no body, DEPOIS do app-container
                        const appContainer = document.getElementById('app-container');
                        if (appContainer && appContainer.nextSibling) {
                            document.body.insertBefore(checkinModal, appContainer.nextSibling);
                        } else {
                            document.body.appendChild(checkinModal);
                        }
                        console.log('[Check-in] Modal criado dinamicamente');
                    }
                    
                    console.log('[Check-in] Check-in disponível encontrado:', data.available_checkin);
                    
                    // ✅ RESETAR FLAG DE COMPLETADO quando novo checkin é carregado
                    isCheckinCompleted = false;
                    
                    window.checkinData = data.available_checkin;
                    checkinData = data.available_checkin;
                    
                    const checkinTitle = document.getElementById('checkin-title');
                    if (checkinTitle && data.available_checkin.name) {
                        checkinTitle.textContent = data.available_checkin.name;
                    }
                    
                    // ✅ VERIFICAR SE CHECK-IN JÁ FOI COMPLETADO
                    const currentWeek = getCurrentWeekStart();
                    const storageKey = `checkin_progress_${data.available_checkin.id}_${currentWeek}`;
                    const savedProgress = localStorage.getItem(storageKey);
                    
                    // Verificar se há progresso salvo e se está completo
                    let isCheckinComplete = false;
                    if (savedProgress) {
                        try {
                            const progress = JSON.parse(savedProgress);
                            // Verificar se todas as perguntas foram respondidas
                            const totalQuestions = data.available_checkin.questions ? data.available_checkin.questions.length : 0;
                            const answeredCount = progress.responses ? Object.keys(progress.responses).length : 0;
                            
                            // Se todas as perguntas foram respondidas, considerar completo
                            if (answeredCount >= totalQuestions && totalQuestions > 0) {
                                isCheckinComplete = true;
                            }
                        } catch (e) {
                            console.error('[Check-in] Erro ao verificar progresso:', e);
                        }
                    }
                    
                    // ✅ CONFIGURAR EVENTOS DO MODAL ANTES DE ABRIR
                    setupCheckinModalEvents();
                    
                    // ✅ ABRIR MODAL AUTOMATICAMENTE E BLOQUEAR APP SE NÃO ESTIVER COMPLETO
                    if (!isCheckinComplete) {
                        // Esconder botão X (checkin obrigatório)
                        const closeBtn = checkinModal.querySelector('.checkin-close-btn');
                        if (closeBtn) {
                            closeBtn.style.display = 'none !important';
                            closeBtn.style.visibility = 'hidden';
                            closeBtn.style.opacity = '0';
                            closeBtn.style.pointerEvents = 'none';
                        }
                        
                        // Bloquear navegação do app (impedir cliques em outros elementos)
                        const appContainer = document.getElementById('app-container');
                        if (appContainer) {
                            appContainer.style.pointerEvents = 'none';
                            appContainer.style.opacity = '0.3';
                        }
                        
                        // ✅ ABRIR IMEDIATAMENTE - checkin obrigatório
                        // Forçar abertura do modal imediatamente
                        console.log('[Check-in] Abrindo modal automaticamente (obrigatório) - FORÇADO');
                        
                        // Tentar abrir imediatamente
                        openCheckinModal();
                        
                        // Backup: tentar novamente após um pequeno delay para garantir
                        setTimeout(() => {
                            const modal = document.getElementById('checkinModal');
                            if (modal && (modal.style.display === 'none' || !modal.classList.contains('active'))) {
                                console.log('[Check-in] Modal não abriu, forçando abertura novamente');
                                openCheckinModal();
                            }
                        }, 300);
                    } else {
                        // Se já está completo, esconder modal e liberar app
                        checkinModal.style.display = 'none';
                        const appContainer = document.getElementById('app-container');
                        if (appContainer) {
                            appContainer.style.pointerEvents = 'auto';
                            appContainer.style.opacity = '1';
                        }
                    }
                } else {
                    console.log('[Check-in] Nenhum check-in disponível');
                    // Esconder modal se existir
                    const existingModal = document.getElementById('checkinModal');
                    if (existingModal) {
                        existingModal.style.display = 'none';
                    }
                    // Liberar app (sem checkin pendente)
                    const appContainer = document.getElementById('app-container');
                    if (appContainer) {
                        appContainer.style.pointerEvents = 'auto';
                        appContainer.style.opacity = '1';
                    }
                    // Limpar dados do check-in
                    window.checkinData = null;
                    checkinData = null;
                    console.log('[Check-in] Dados limpos');
                }
                
                // Inicializar carrossel após tudo renderizado
                setTimeout(() => {
                    if (window.initializeMissionsCarousel) {
                        window.initializeMissionsCarousel();
                    }
                }, 100);
                
                // ✅ GARANTIR QUE CHECKIN ABRE AUTOMATICAMENTE APÓS RENDERIZAÇÃO
                // Aguardar um pouco para garantir que tudo foi renderizado
                setTimeout(() => {
                    if (data.available_checkin && window.checkinData) {
                        console.log('[Check-in] Verificando check-in após renderização completa');
                        checkAndOpenPendingCheckin();
                        
                        // ✅ VERIFICAÇÃO EXTRA: Forçar abertura se ainda não abriu
                        setTimeout(() => {
                            const modal = document.getElementById('checkinModal');
                            if (modal && window.checkinData) {
                                const isVisible = modal.style.display === 'flex' || 
                                                 modal.classList.contains('active') ||
                                                 window.getComputedStyle(modal).display === 'flex';
                                
                                if (!isVisible) {
                                    console.log('[Check-in] Modal ainda não está visível após verificação, FORÇANDO abertura');
                                    const currentWeek = getCurrentWeekStart();
                                    const storageKey = `checkin_progress_${window.checkinData.id}_${currentWeek}`;
                                    const savedProgress = localStorage.getItem(storageKey);
                                    
                                    let isComplete = false;
                                    if (savedProgress) {
                                        try {
                                            const progress = JSON.parse(savedProgress);
                                            const totalQuestions = window.checkinData.questions ? window.checkinData.questions.length : 0;
                                            const answeredCount = progress.responses ? Object.keys(progress.responses).length : 0;
                                            isComplete = answeredCount >= totalQuestions && totalQuestions > 0;
                                        } catch (e) {}
                                    }
                                    
                                    if (!isComplete) {
                                        openCheckinModal();
                                    }
                                }
                            }
                        }, 500);
                    }
                }, 1500);
                
                resolve();
            }
        ];
        
        // ✅ EXECUTAR PASSOS INCREMENTALMENTE COM DELAY ENTRE PASSOS
        function executeNextStep() {
            if (step < steps.length) {
                steps[step]();
                step++;
                // ✅ Delay entre passos para não sobrecarregar (5ms = 200fps)
                setTimeout(() => {
                    requestAnimationFrame(executeNextStep);
                }, 5);
            }
        }
        
        // ✅ Iniciar no próximo frame
        requestAnimationFrame(executeNextStep);
    });
}

// ✅ MANTER FUNÇÃO ORIGINAL PARA COMPATIBILIDADE
function renderDashboard(data) {
    renderDashboardOptimized(data);
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
    // Expor meta real (ml) para o controlador antigo do card (main_app_inline_2.js)
    window.currentWaterGoalMl = waterGoal;
    
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

    const formatNumberPt = (num, decimals = 0) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(num) || 0);
    const formatGrams = (num) => {
        const n = Number(num) || 0;
        const rounded = Math.round(n * 10) / 10;
        const decimals = Math.abs(rounded % 1) < 1e-9 ? 0 : 1;
        return formatNumberPt(rounded, decimals);
    };
    
    if (valueEl) {
        valueEl.textContent = formatGrams(value);
    }
    
    if (goalEl) {
        goalEl.textContent = formatGrams(goal);
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
    
    // ✅ OTIMIZADO: Um único loop em vez de dois
    routines.forEach((routine, index) => {
        const isCompleted = routine.completion_status == 1;
        if (!isCompleted && firstPendingIndex === -1) {
            firstPendingIndex = index;
        }
        
        // ✅ Processar no mesmo loop
        const missionId = routine.id || `routine_${index}`;
        const title = routine.title || 'Tarefa';
        const icon = routine.icon_class || 'fa-check-circle';
        const isExercise = routine.is_exercise == 1;
        const exerciseType = routine.exercise_type || '';
        
        // Determinar se precisa de duração ou sono
        let isDuration = false;
        let isSleep = false;
        
        if (String(missionId).indexOf('onboarding_') === 0) {
            isDuration = true;
        } else if (isExercise) {
            if (exerciseType === 'sleep') {
                isSleep = true;
            } else if (exerciseType === 'duration') {
                isDuration = true;
            }
        } else if (title.toLowerCase().indexOf('sono') !== -1) {
            isSleep = true;
        }
        
        const displayMissionId = isExercise && exerciseType === 'duration' ? `onboarding_${title}` : missionId;
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
    
    // ✅ OTIMIZADO: Usar DocumentFragment para não causar reflow
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }
    
    // Limpar e adicionar de uma vez (menos reflow)
    missionsCarousel.innerHTML = '';
    missionsCarousel.appendChild(fragment);
    
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
            // showCurrentMission não está disponível ainda
        }
        
        // Reinicializar o carrossel de missões para configurar event listeners
        if (window.initializeMissionsCarousel) {
            window.initializeMissionsCarousel();
        } else {
            // initializeMissionsCarousel não está disponível ainda
        }
    }, 100);
}

function renderRanking(data) {
    const rankingCard = document.getElementById('ranking-card');
    if (!rankingCard) return;
    
    const ranking = data.ranking || {};
    // ✅ Logs removidos para performance
    
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
    // ✅ Log removido para performance
    
    // Verificar se há oponente (igual ao PHP: <?php if (isset($opponent_data)): ?>)
    // A API retorna opponent_data que pode ser null ou um objeto com id, name, points, profile_image_filename, etc.
    if (ranking.opponent && ranking.opponent !== null && typeof ranking.opponent === 'object' && ranking.opponent.name) {
        // ✅ Log removido para performance
        
        // Mostrar oponente
        if (opponentInfo) {
            const opponentAvatar = opponentInfo.querySelector('.player-avatar');
            if (opponentAvatar) {
                const opponentImage = ranking.opponent.profile_image_filename;
                // ✅ Log removido para performance
                
                if (opponentImage) {
                    // Tentar imagem original primeiro, depois thumbnail, depois ícone (igual ao PHP)
                    const opponentImageUrl = `${IMAGES_URL}/assets/images/users/${opponentImage}`;
                    const opponentThumbUrl = `${IMAGES_URL}/assets/images/users/thumb_${opponentImage}`;
                    opponentAvatar.innerHTML = `
                        <img src="${opponentImageUrl}" alt="Foto do oponente" onerror="this.onerror=null; this.src='${opponentThumbUrl}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}">
                        <i class="fas fa-user" style="display:none;"></i>
                    `;
                } else {
                    // ✅ Log removido para performance
                    opponentAvatar.innerHTML = '<i class="fas fa-user"></i>';
                }
            }
        }
        
        // Nome do oponente (apenas primeiro nome) - igual ao PHP: explode(' ', $opponent_data['name'])[0]
        if (opponentName && ranking.opponent.name) {
            const firstName = ranking.opponent.name.split(' ')[0];
            // ✅ Log removido para performance
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
            
            // Atualizar link "Ver mais" - NAVEGAR PARA EXPLORAR RECEITAS
            const viewAllLink = document.getElementById('suggestions-view-all');
            if (viewAllLink && mealSuggestion.category_id) {
                const categoryId = mealSuggestion.category_id;
                
                // ✅ NAVEGAR USANDO O ROUTER SPA CORRETAMENTE
                const targetPath = `/fragments/explore_recipes.html?categories=${categoryId}`;
                viewAllLink.href = `/explorar?categories=${categoryId}`;
                
                // ✅ REMOVER data-router-ignore PARA DEIXAR O ROUTER TRATAR
                viewAllLink.removeAttribute('data-router-ignore');
                
                // ✅ GARANTIR QUE O CLIQUE FUNCIONE CORRETAMENTE (deixar router tratar)
                viewAllLink.onclick = null; // Remover onclick anterior se existir
            } else if (viewAllLink) {
                // Se não tem category_id, navegar para explore_recipes sem filtro
                viewAllLink.href = `/explorar`;
                
                // ✅ REMOVER data-router-ignore PARA DEIXAR O ROUTER TRATAR
                viewAllLink.removeAttribute('data-router-ignore');
                
                // ✅ GARANTIR QUE O CLIQUE FUNCIONE CORRETAMENTE (deixar router tratar)
                viewAllLink.onclick = null; // Remover onclick anterior se existir
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
                <a href="javascript:void(0)" onclick="window.SPARouter.navigate('/fragments/challenges.html?id=${challenge.id}')" class="challenge-item">
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
            
            // Validando peso
            
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
            
            // Peso validado
            
            // Desabilitar botão durante requisição
            newSaveBtn.disabled = true;
            newSaveBtn.textContent = 'Salvando...';
            
            try {
                // Usar /api/ para que o proxy do serve.js intercepte em desenvolvimento
                const apiUrl = '/api/update_weight.php';
                
                // O PHP espera $_POST['weight'] com form data, não JSON
                const formData = new FormData();
                formData.append('weight', weight.toString());
                
                // Atualizando peso
                
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
                // Resposta da API recebida
                
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
                    
                    // Peso atualizado com sucesso
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
    
    // ✅ FUNÇÃO AUXILIAR PARA GARANTIR MODAL CORRETO
    function ensureModalPosition(modal) {
        if (!modal) return;
        // ✅ GARANTIR QUE MODAL ESTÁ NO BODY (fora do container)
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        // ✅ GARANTIR POSICIONAMENTO CORRETO
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.right = '0';
        modal.style.bottom = '0';
        modal.style.zIndex = '99999';
    }

    document._weightModalHandler = function(e) {
        if (e.target.closest('[data-action="open-weight-modal"]')) {
            const modal = document.getElementById('edit-weight-modal');
            if (modal) {
                // ✅ GARANTIR POSICIONAMENTO CORRETO
                ensureModalPosition(modal);
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

// Expor funções de check-in globalmente para uso em onclick
window.openCheckinModal = openCheckinModal;
window.closeCheckinModal = closeCheckinModal;
window.sendCheckinResponse = sendCheckinResponse;

// Listener global para mostrar/esconder o botão WhatsApp baseado na página
(function() {
    function updateWhatsAppButtonVisibility() {
        const whatsappBtn = document.getElementById('checkin-floating-btn');
        if (!whatsappBtn) return;
        
        const isMainAppPage = document.getElementById('dashboard-container') || 
                             document.querySelector('.main-app-container') ||
                             window.location.pathname.includes('main_app') ||
                             window.location.pathname === '/' ||
                             window.location.pathname === '/index.html';
        
        if (isMainAppPage) {
            // ✅ SEMPRE VISÍVEL na página main_app (independente de checkin)
            whatsappBtn.style.display = 'flex';
            whatsappBtn.style.visibility = 'visible';
            whatsappBtn.style.opacity = '1';
            whatsappBtn.style.position = 'fixed';
            whatsappBtn.style.bottom = '90px';
            whatsappBtn.style.right = '20px';
            whatsappBtn.style.zIndex = '9999';
        } else {
            // Esconder quando não está na main_app
            whatsappBtn.style.display = 'none';
            whatsappBtn.style.visibility = 'hidden';
            whatsappBtn.style.opacity = '0';
        }
    }
    
    // Atualizar visibilidade quando a página carregar
    window.addEventListener('pageLoaded', updateWhatsAppButtonVisibility);
    window.addEventListener('fragmentReady', updateWhatsAppButtonVisibility);
    
    // Verificar imediatamente também
    setTimeout(updateWhatsAppButtonVisibility, 100);
})();

})();
