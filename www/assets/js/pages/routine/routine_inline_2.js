
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        let todoList = document.getElementById('routine-list-todo');
        let completedList = document.getElementById('routine-list-completed');
        
        // Carregar dados da rotina
        async function loadRoutineData() {
            try {
                const authenticated = await requireAuth();
                if (!authenticated) {
                    return; // Já redirecionou para login
                }
                const response = await authenticatedFetch(`${window.API_BASE_URL}/get_routine_data.php`);
                
                if (!response) {
                    console.error('[Routine] Resposta vazia - token inválido');
                    return;
                }
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error('[Routine] Erro HTTP:', response.status, text);
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.message || 'Erro ao carregar dados');
                }
                
                const data = result.data;
                // Atualizar progresso
                updateProgress(data.progress);
                
                // Renderizar listas
                renderTodoList(data.todos);
                renderCompletedList(data.completed);
                
            } catch (error) {
                console.error('[Routine] Erro ao carregar dados da rotina:', error);
                alert('Erro ao carregar dados da rotina. Tente novamente.');
            }
        }
        
        function updateProgress(progress) {
            const progressText = document.getElementById('progress-text');
            const progressPercentage = document.getElementById('progress-percentage');
            const progressBar = document.getElementById('progress-bar');
            
            if (progressText) {
                progressText.textContent = `${progress.completed}/${progress.total} concluídas`;
            }
            if (progressPercentage) {
                progressPercentage.textContent = `${progress.percentage}%`;
            }
            if (progressBar) {
                progressBar.style.width = `${progress.percentage}%`;
            }
        }
        
        function renderTodoList(items) {
            if (!todoList) {
                
                return;
            }
            
            // Remover apenas os itens de rotina, preservando o placeholder
            const placeholder = document.getElementById('all-done-placeholder');
            const existingItems = todoList.querySelectorAll('.routine-list-item');
            existingItems.forEach(item => item.remove());
            
            if (items.length === 0) {
                if (placeholder) {
                    placeholder.style.display = 'block';
                }
                return;
            }
            
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            items.forEach(item => {
                const li = createRoutineItem(item, false);
                todoList.appendChild(li);
            });
        }
        
        function renderCompletedList(items) {
            if (!completedList) {
                
                return;
            }
            
            // Remover apenas os itens de rotina, preservando o placeholder
            const placeholder = document.getElementById('none-completed-placeholder');
            const existingItems = completedList.querySelectorAll('.routine-list-item');
            existingItems.forEach(item => item.remove());
            
            if (items.length === 0) {
                if (placeholder) {
                    placeholder.style.display = 'block';
                }
                return;
            }
            
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            items.forEach(item => {
                const li = createRoutineItem(item, true);
                completedList.appendChild(li);
            });
        }
        
        function createRoutineItem(item, isCompleted) {
            const li = document.createElement('li');
            li.className = 'routine-list-item';
            if (isCompleted) {
                li.classList.add('is-completed');
            }
            li.dataset.routineId = item.id;
            
            // Determinar tipo de item
            const isOnboarding = String(item.id).startsWith('onboarding_');
            const isDuration = isOnboarding || (item.is_exercise && item.exercise_type === 'duration');
            const isSleep = (item.is_exercise && item.exercise_type === 'sleep') || 
                           (item.title && (item.title.toLowerCase().includes('sono')));
            
            let actionsHTML = '';
            if (isCompleted) {
                actionsHTML = `<button class="action-btn uncomplete-btn" aria-label="Desfazer"><i class="fas fa-times"></i></button>`;
            } else {
                actionsHTML = `<button class="action-btn skip-btn" aria-label="Ignorar"><i class="fas fa-times"></i></button>`;
                
                if (isDuration) {
                    actionsHTML += `
                        <button class="action-btn duration-btn" aria-label="Definir Duração" data-routine-id="${item.id}">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="action-btn complete-btn disabled" aria-label="Concluir">
                            <i class="fas fa-check"></i>
                        </button>
                    `;
                } else if (isSleep) {
                    actionsHTML += `
                        <button class="action-btn sleep-btn" aria-label="Registrar Sono" data-routine-id="${item.id}">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="action-btn complete-btn disabled" aria-label="Concluir">
                            <i class="fas fa-check"></i>
                        </button>
                    `;
                } else {
                    actionsHTML += `<button class="action-btn complete-btn" aria-label="Concluir"><i class="fas fa-check"></i></button>`;
                }
            }
            
            let durationDisplayHTML = '';
            if (isCompleted && item.duration_minutes) {
                const duration = item.exercise_type === 'sleep' 
                    ? `${round(item.duration_minutes, 1)}h de sono`
                    : `${item.duration_minutes} min`;
                const icon = item.exercise_type === 'sleep' ? 'fa-moon' : 'fa-stopwatch';
                durationDisplayHTML = `
                    <small class="routine-duration-display" style="display: flex;">
                        <i class="fas ${icon}" style="font-size: 0.8em;"></i> ${duration}
                    </small>
                `;
            } else {
                durationDisplayHTML = `<small class="routine-duration-display" style="display: none;"></small>`;
            }
            
            li.innerHTML = `
                <div class="routine-info">
                    <p>${escapeHtml(item.title)}</p>
                    <div class="routine-actions">
                        ${actionsHTML}
                    </div>
                </div>
                ${durationDisplayHTML}
            `;
            
            return li;
        }
        
        function round(value, decimals) {
            return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
        }
        
        // Gerenciador de eventos centralizado
        document.body.addEventListener('click', function(event) {
            const target = event.target;
            const listItem = target.closest('.routine-list-item');
            
            if (listItem) {
                const skipButton = target.closest('.skip-btn');
                const durationButton = target.closest('.duration-btn');
                const sleepButton = target.closest('.sleep-btn');
                const completeButton = target.closest('.complete-btn');
                const uncompleteButton = target.closest('.uncomplete-btn');
                
                if (skipButton) {
                    handleSkip(listItem);
                    return;
                }
                if (durationButton) {
                    showExerciseDurationModal(listItem);
                    return;
                }
                if (sleepButton) {
                    showSleepModal(listItem);
                    return;
                }
                if (uncompleteButton) {
                    handleUncomplete(listItem);
                    return;
                }
                
                if (completeButton) {
                    if (completeButton.classList.contains('disabled')) {
                        const missionId = listItem.dataset.routineId;
                        if (String(missionId).startsWith('onboarding_')) {
                            alert('⚠️ Para completar, primeiro defina a duração do exercício!');
                        } else if (listItem.querySelector('.sleep-btn')) {
                            alert('⚠️ Para completar, primeiro registre seus horários de sono!');
                        }
                        return;
                    }
                    handleComplete(listItem);
                }
            }
            
            // Ações de modais
            const activeModal = target.closest('.modal-overlay');
            if (activeModal) {
                if (target.closest('[data-action="close-modal"]')) {
                    activeModal.classList.remove('modal-visible');
                    document.body.style.overflow = '';
                }
                if (target.closest('#confirm-exercise-duration')) {
                    handleConfirmExerciseDuration(activeModal);
                }
                if (target.closest('#confirm-sleep-main')) {
                    handleConfirmSleep(activeModal);
                }
            }
        });
        
        function handleSkip(listItem) {
            listItem.classList.add('fading-out');
            setTimeout(() => {
                listItem.remove();
                updateUI();
            }, 400);
        }
        
        function handleComplete(listItem) {
            const missionId = listItem.dataset.routineId;
            const button = listItem.querySelector('.complete-btn');
            
            if (String(missionId).startsWith('onboarding_')) {
                const duration = listItem.querySelector('.duration-btn')?.dataset.duration;
                if (duration) {
                    completeExerciseWithDuration(missionId, duration, listItem, button);
                } else {
                    alert('Erro: Duração não encontrada. Tente definir novamente.');
                }
            } else if (listItem.querySelector('.sleep-btn')) {
                completeSleepRoutine(listItem, button);
            } else {
                completeRoutineDirectly(listItem, button);
            }
        }
        
        function handleUncomplete(listItem) {
            const button = listItem.querySelector('.uncomplete-btn');
            button.classList.add('disabled');
            
            const routineId = listItem.dataset.routineId;
            const isOnboarding = String(routineId).startsWith('onboarding_');
            
            let endpoint, body;
            if (isOnboarding) {
                // Para onboarding, usar API específica com activity_name
                endpoint = `${window.API_BASE_URL}/uncomplete_onboarding_routine.php`;
                body = JSON.stringify({
                    activity_name: routineId.replace('onboarding_', '')
                });
            } else {
                // Para rotinas normais, usar API com routine_id numérico
                endpoint = `${window.API_BASE_URL}/uncomplete_routine_item.php`;
                body = JSON.stringify({
                    routine_id: routineId
                });
            }
            
            authenticatedFetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body
            })
            .then(async response => {
                if (!response.ok) {
                    const text = await response.text();
                    console.error('Erro HTTP:', response.status, text);
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                const data = await response.json();
                if (data.success) {
                    moveItem(listItem, completedList, todoList, false);
                } else {
                    alert(data.message || 'Erro ao desfazer tarefa.');
                }
            })
            .catch(error => {
                console.error('Erro ao desfazer:', error);
                alert('Erro ao desfazer tarefa. Tente novamente.');
            })
            .finally(() => {
                button.classList.remove('disabled');
            });
        }
        
        function showExerciseDurationModal(listItem) {
            const modal = document.getElementById('exercise-duration-modal');
            if (!modal) return;
            
            const missionId = listItem.dataset.routineId;
            const title = listItem.querySelector('p').textContent;
            const durationButton = listItem.querySelector('.duration-btn');
            const durationInput = document.getElementById('exercise-duration-input');
            
            modal.dataset.currentItemId = missionId;
            modal.querySelector('h2').textContent = `⏱️ Duração - ${title}`;
            durationInput.value = durationButton.dataset.duration || 60;
            
            modal.classList.add('modal-visible');
            document.body.style.overflow = 'hidden';
            
            // ✅ Remover listeners antigos para evitar duplicação
            const newDurationInput = document.getElementById('exercise-duration-input');
            const newInput = newDurationInput.cloneNode(true);
            newDurationInput.parentNode.replaceChild(newInput, newDurationInput);
            
            // ✅ Função para completar automaticamente quando duração for válida
            const autoCompleteExercise = () => {
                const duration = parseInt(newInput.value, 10);
                const currentMissionId = modal.dataset.currentItemId;
                
                if (!currentMissionId) return;
                const currentListItem = todoList.querySelector(`.routine-list-item[data-routine-id="${currentMissionId}"]`);
                if (!currentListItem) return;
                
                if (duration >= 15 && duration <= 300) {
                    // Fechar modal
                    modal.classList.remove('modal-visible');
                    document.body.style.overflow = '';
                    
                    // Completar automaticamente
                    const completeBtn = currentListItem.querySelector('.complete-btn');
                    if (completeBtn) {
                        completeExerciseWithDuration(currentMissionId, duration, currentListItem, completeBtn);
                    }
                }
            };
            
            // ✅ Completar ao pressionar Enter no input
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    autoCompleteExercise();
                }
            });
            
            // ✅ Completar ao mudar o valor (se for válido) - com debounce
            let blurTimeout;
            newInput.addEventListener('blur', () => {
                clearTimeout(blurTimeout);
                blurTimeout = setTimeout(() => {
                    const duration = parseInt(newInput.value, 10);
                    if (duration >= 15 && duration <= 300) {
                        autoCompleteExercise();
                    }
                }, 300);
            });
            
            // ✅ Completar ao digitar um valor válido (com debounce para não completar a cada tecla)
            let inputTimeout;
            newInput.addEventListener('input', () => {
                clearTimeout(inputTimeout);
                inputTimeout = setTimeout(() => {
                    const duration = parseInt(newInput.value, 10);
                    if (duration >= 15 && duration <= 300) {
                        // Pequeno delay adicional para garantir que o usuário terminou de digitar
                        setTimeout(() => {
                            autoCompleteExercise();
                        }, 500);
                    }
                }, 1000);
            });
        }
        
        function handleConfirmExerciseDuration(modal) {
            const durationInput = document.getElementById('exercise-duration-input');
            const duration = parseInt(durationInput.value, 10);
            const missionId = modal.dataset.currentItemId;
            
            if (!missionId) return;
            const listItem = todoList.querySelector(`.routine-list-item[data-routine-id="${missionId}"]`);
            if (!listItem) return;
            
            if (duration >= 15 && duration <= 300) {
                // Fechar modal e completar automaticamente
                modal.classList.remove('modal-visible');
                document.body.style.overflow = '';
                
                const completeBtn = listItem.querySelector('.complete-btn');
                if (completeBtn) {
                    completeExerciseWithDuration(missionId, duration, listItem, completeBtn);
                }
            } else {
                alert('Por favor, insira uma duração entre 15 e 300 minutos.');
            }
        }
        
        function showSleepModal(listItem) {
            const modal = document.getElementById('sleep-modal-main');
            if (modal) {
                modal.dataset.currentItemId = listItem.dataset.routineId;
                modal.classList.add('modal-visible');
                document.body.style.overflow = 'hidden';
                
                // ✅ Remover listeners antigos para evitar duplicação
                const sleepTimeInput = document.getElementById('sleep-time-main');
                const wakeTimeInput = document.getElementById('wake-time-main');
                
                if (sleepTimeInput && wakeTimeInput) {
                    // ✅ Flag para evitar múltiplas chamadas simultâneas
                    let isCompletingSleep = false;
                    
                    // Remover listeners antigos se existirem
                    const newSleepTimeInput = sleepTimeInput.cloneNode(true);
                    const newWakeTimeInput = wakeTimeInput.cloneNode(true);
                    sleepTimeInput.parentNode.replaceChild(newSleepTimeInput, sleepTimeInput);
                    wakeTimeInput.parentNode.replaceChild(newWakeTimeInput, wakeTimeInput);
                    
                    // ✅ Função para completar automaticamente quando horários forem válidos
                    const autoCompleteSleep = () => {
                        // Prevenir múltiplas chamadas simultâneas
                        if (isCompletingSleep) {
                            return;
                        }
                        
                        const currentSleepTime = newSleepTimeInput.value;
                        const currentWakeTime = newWakeTimeInput.value;
                        const currentMissionId = modal.dataset.currentItemId;
                        
                        if (!currentSleepTime || !currentWakeTime) {
                            return; // Não completar se não tiver ambos os horários
                        }
                        
                        if (currentSleepTime === currentWakeTime) {
                            return; // Não completar se horários forem iguais
                        }
                        
                        // Verificar se a rotina já foi completada
                        const currentItem = todoList.querySelector(`.routine-list-item[data-routine-id="${currentMissionId}"]`);
                        if (!currentItem) return;
                        
                        if (currentItem.dataset.completed === '1') {
                            // Já foi completada, apenas fechar o modal
                            modal.classList.remove('modal-visible');
                            document.body.style.overflow = '';
                            return;
                        }
                        
                        // Marcar como completando
                        isCompletingSleep = true;
                        
                        // Salvar dados no sessionStorage
                        const sleepData = {
                            sleep_time: currentSleepTime,
                            wake_time: currentWakeTime
                        };
                        sessionStorage.setItem('sleep_data', JSON.stringify(sleepData));
                        
                        // Fechar modal
                        modal.classList.remove('modal-visible');
                        document.body.style.overflow = '';
                        
                        // Completar automaticamente
                        const completeBtn = currentItem.querySelector('.complete-btn');
                        if (completeBtn) {
                            // Se o botão está desabilitado, habilitar primeiro
                            if (completeBtn.classList.contains('disabled')) {
                                completeBtn.classList.remove('disabled');
                            }
                            // Completar a rotina de sono
                            completeSleepRoutine(currentItem, completeBtn).catch(() => {
                                // Em caso de erro, liberar flag
                                isCompletingSleep = false;
                            }).finally(() => {
                                // Liberar flag após completar (sucesso ou erro)
                                setTimeout(() => {
                                    isCompletingSleep = false;
                                }, 1000);
                            });
                        } else {
                            isCompletingSleep = false;
                        }
                    };
                    
                    // ✅ Debounce para evitar múltiplas chamadas
                    let completeTimeout;
                    const checkAndComplete = () => {
                        clearTimeout(completeTimeout);
                        completeTimeout = setTimeout(() => {
                            if (newSleepTimeInput.value && newWakeTimeInput.value && 
                                newSleepTimeInput.value !== newWakeTimeInput.value) {
                                autoCompleteSleep();
                            }
                        }, 500); // Delay maior para evitar chamadas duplicadas
                    };
                    
                    // Adicionar novos listeners
                    newSleepTimeInput.addEventListener('change', checkAndComplete);
                    newWakeTimeInput.addEventListener('change', checkAndComplete);
                }
            }
        }
        
        function handleConfirmSleep(modal) {
            const sleepTime = document.getElementById('sleep-time-main').value;
            const wakeTime = document.getElementById('wake-time-main').value;
            
            if (!sleepTime || !wakeTime) {
                alert('Por favor, preencha ambos os horários.');
                return;
            }
            if (sleepTime === wakeTime) {
                alert('Os horários não podem ser iguais.');
                return;
            }
            
            // Salvar dados no sessionStorage
            const sleepData = {
                sleep_time: sleepTime,
                wake_time: wakeTime
            };
            sessionStorage.setItem('sleep_data', JSON.stringify(sleepData));
            
            // Fechar modal
            modal.classList.remove('modal-visible');
            document.body.style.overflow = '';
            
            // Completar automaticamente
            const missionId = modal.dataset.currentItemId;
            const currentItem = todoList.querySelector(`.routine-list-item[data-routine-id="${missionId}"]`);
            
            if (currentItem) {
                const completeBtn = currentItem.querySelector('.complete-btn');
                if (completeBtn) {
                    // Se o botão está desabilitado, habilitar primeiro
                    if (completeBtn.classList.contains('disabled')) {
                        completeBtn.classList.remove('disabled');
                    }
                    // Completar a rotina de sono
                    completeSleepRoutine(currentItem, completeBtn);
                }
            }
        }
        
        function completeSleepRoutine(listItem, button) {
            const sleepData = JSON.parse(sessionStorage.getItem('sleep_data'));
            if (!sleepData || !sleepData.sleep_time || !sleepData.wake_time) {
                alert('Por favor, registre os horários de sono primeiro.');
                return Promise.reject(new Error('Dados de sono não encontrados'));
            }
            
            // ✅ Verificar se já está processando ou já foi completada
            if (button.disabled && button.classList.contains('processing')) {
                return Promise.reject(new Error('Já está processando'));
            }
            
            if (listItem.dataset.completed === '1') {
                return Promise.reject(new Error('Rotina já foi completada'));
            }
            
            button.classList.add('disabled');
            button.classList.add('processing');
            
            const missionId = listItem.dataset.routineId;
            
            return authenticatedFetch(`${window.API_BASE_URL}/complete_sleep_routine.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    routine_id: missionId,
                    sleep_time: sleepData.sleep_time,
                    wake_time: sleepData.wake_time
                })
            })
            .then(async response => {
                if (!response.ok) {
                    const text = await response.text();
                    console.error('Erro ao completar sono:', text);
                    
                    // ✅ Verificar se é erro de duplicação
                    try {
                        const errorData = JSON.parse(text);
                        if (errorData.error && errorData.error.includes('Duplicate entry')) {
                            // Já foi completada, apenas marcar como completa
                            listItem.dataset.completed = '1';
                            sessionStorage.removeItem('sleep_data');
                            moveItem(listItem, todoList, completedList, true);
                            // Não mostrar erro para o usuário, apenas retornar sucesso
                            return { success: true, message: 'Rotina já foi completada anteriormente' };
                        }
                    } catch (e) {
                        // Não é JSON, continuar com o erro original
                    }
                    
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    sessionStorage.removeItem('sleep_data');
                    moveItem(listItem, todoList, completedList, true);
                } else {
                    alert(data.message || 'Erro ao completar tarefa.');
                }
            })
            .catch(error => {
                console.error('Erro ao completar sono:', error);
                // Não mostrar alerta se já foi completada (tratado acima)
                if (!error.message.includes('já foi completada')) {
                    alert('Erro ao completar tarefa. Tente novamente.');
                }
            })
            .finally(() => {
                button.classList.remove('disabled');
                button.classList.remove('processing');
            });
        }
        
        function completeRoutineDirectly(listItem, button) {
            button.classList.add('disabled');
            const routineId = listItem.dataset.routineId;
            const routineIdToSend = String(routineId).startsWith('onboarding_') 
                ? routineId.replace('onboarding_', '') 
                : routineId;
            
            authenticatedFetch(`${window.API_BASE_URL}/complete_routine_item.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    routine_id: routineIdToSend
                })
            })
            .then(async response => {
                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    moveItem(listItem, todoList, completedList, true);
                } else {
                    alert(data.message || 'Erro ao completar tarefa.');
                }
            })
            .catch(error => {
                console.error('Erro ao completar:', error);
                alert('Erro ao completar tarefa. Tente novamente.');
            })
            .finally(() => {
                button.classList.remove('disabled');
            });
        }
        
        function completeExerciseWithDuration(missionId, duration, listItem, button) {
            button.classList.add('disabled');
            const routineIdToSend = missionId.replace('onboarding_', '');
            
            authenticatedFetch(`${window.API_BASE_URL}/complete_exercise_with_duration.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    routine_id: routineIdToSend,
                    duration_minutes: parseInt(duration)
                })
            })
            .then(async response => {
                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    moveItem(listItem, todoList, completedList, true);
                } else {
                    alert(data.message || 'Erro ao completar tarefa.');
                }
            })
            .catch(error => {
                console.error('Erro ao completar exercício:', error);
                alert('Erro ao completar tarefa. Tente novamente.');
            })
            .finally(() => {
                button.classList.remove('disabled');
            });
        }
        
        function moveItem(listItem, fromList, toList, isCompleting) {
            // Re-buscar listas para garantir que temos as referências corretas
            const currentTodoList = document.getElementById('routine-list-todo');
            const currentCompletedList = document.getElementById('routine-list-completed');
            
            // Se fromList ou toList são as referências globais, usar as novas referências
            if (fromList === completedList || fromList === todoList) {
                fromList = fromList === completedList ? currentCompletedList : currentTodoList;
            }
            if (toList === completedList || toList === todoList) {
                toList = toList === completedList ? currentCompletedList : currentTodoList;
            }
            
            if (!fromList || !toList) {
                console.error('[Routine] Listas não encontradas para mover item');
                return;
            }
            
            listItem.classList.add('fading-out');
            
            setTimeout(() => {
                const clonedItem = listItem.cloneNode(true);
                listItem.remove();
                clonedItem.classList.remove('fading-out');
                const actionsContainer = clonedItem.querySelector('.routine-actions');
                
                if (isCompleting) {
                    clonedItem.classList.add('is-completed');
                    actionsContainer.innerHTML = `<button class="action-btn uncomplete-btn" aria-label="Desfazer"><i class="fas fa-times"></i></button>`;
                } else {
                    clonedItem.classList.remove('is-completed');
                    const missionId = clonedItem.dataset.routineId;
                    const isOnboardingExercise = String(missionId).startsWith('onboarding_');
                    const title = clonedItem.querySelector('p').textContent;
                    const isSleepItem = title.toLowerCase().includes('sono');
                    
                    if (isOnboardingExercise) {
                        actionsContainer.innerHTML = `
                            <button class="action-btn skip-btn" aria-label="Ignorar"><i class="fas fa-times"></i></button>
                            <button class="action-btn duration-btn" aria-label="Definir Duração" data-routine-id="${missionId}"><i class="fas fa-clock"></i></button>
                            <button class="action-btn complete-btn disabled" aria-label="Concluir"><i class="fas fa-check"></i></button>
                        `;
                        const durationDisplay = clonedItem.querySelector('.routine-duration-display');
                        if (durationDisplay) durationDisplay.style.display = 'none';
                    } else if (isSleepItem) {
                        actionsContainer.innerHTML = `
                            <button class="action-btn skip-btn" aria-label="Ignorar"><i class="fas fa-times"></i></button>
                            <button class="action-btn sleep-btn" aria-label="Registrar Sono" data-routine-id="${missionId}"><i class="fas fa-clock"></i></button>
                            <button class="action-btn complete-btn disabled" aria-label="Concluir"><i class="fas fa-check"></i></button>
                        `;
                        const durationDisplay = clonedItem.querySelector('.routine-duration-display');
                        if (durationDisplay) durationDisplay.style.display = 'none';
                    } else {
                        actionsContainer.innerHTML = `
                            <button class="action-btn skip-btn" aria-label="Ignorar"><i class="fas fa-times"></i></button>
                            <button class="action-btn complete-btn" aria-label="Concluir"><i class="fas fa-check"></i></button>
                        `;
                    }
                }
                toList.prepend(clonedItem);
                updateUI();
            }, 400);
        }
        
        function updateUI() {
            // Re-buscar listas para garantir que temos as referências corretas
            const currentTodoList = document.getElementById('routine-list-todo');
            const currentCompletedList = document.getElementById('routine-list-completed');
            
            if (!currentTodoList || !currentCompletedList) {
                
                return;
            }
            
            const todoItems = currentTodoList.querySelectorAll('.routine-list-item:not(.placeholder-card)');
            const completedItems = currentCompletedList.querySelectorAll('.routine-list-item:not(.placeholder-card)');
            const totalItems = todoItems.length + completedItems.length;
            const completedCount = completedItems.length;
            const progressPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
            
            const progressText = document.getElementById('progress-text');
            const progressPercentageEl = document.getElementById('progress-percentage');
            const progressBar = document.getElementById('progress-bar');
            const allDonePlaceholder = document.getElementById('all-done-placeholder');
            const noneCompletedPlaceholder = document.getElementById('none-completed-placeholder');
            
            if (progressText) {
                progressText.textContent = `${completedCount}/${totalItems} concluídas`;
            }
            if (progressPercentageEl) {
                progressPercentageEl.textContent = `${progressPercentage}%`;
            }
            if (progressBar) {
                progressBar.style.width = `${progressPercentage}%`;
            }
            if (allDonePlaceholder) {
                allDonePlaceholder.style.display = (todoItems.length === 0 && totalItems > 0) ? 'block' : 'none';
            }
            if (noneCompletedPlaceholder) {
                noneCompletedPlaceholder.style.display = (completedItems.length === 0) ? 'block' : 'none';
            }
        }
        
        // Contador de tentativas para evitar loop infinito
        let initAttempts = 0;
        const MAX_INIT_ATTEMPTS = 10;
        
        // Função de inicialização
        function initRoutine() {
            // Verificar se estamos na página de rotina
            const currentPath = window.location.pathname;
            const isRoutinePage = currentPath.includes('routine') || 
                                  document.getElementById('routine-list-todo') !== null;
            
            if (!isRoutinePage) {
                // Não estamos na página de rotina, parar tentativas
                initAttempts = 0;
                return;
            }
            
            // Re-buscar elementos DOM (podem ter mudado após recarregamento do fragmento)
            const currentTodoList = document.getElementById('routine-list-todo');
            const currentCompletedList = document.getElementById('routine-list-completed');
            
            // Verificar se os elementos existem
            if (!currentTodoList || !currentCompletedList) {
                initAttempts++;
                if (initAttempts < MAX_INIT_ATTEMPTS) {
                    setTimeout(initRoutine, 100);
                } else {
                    
                    initAttempts = 0;
                }
                return;
            }
            
            // Resetar contador quando encontrar elementos
            initAttempts = 0;
            
            // Atualizar referências globais
            todoList = currentTodoList;
            completedList = currentCompletedList;
            
            loadRoutineData();
        }
        
        // Executar no DOMContentLoaded (páginas HTML completas)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initRoutine);
        } else {
            // DOM já carregado, executar imediatamente
            setTimeout(initRoutine, 100);
        }
        
        // Executar no SPA quando fragmento é carregado
        window.addEventListener('fragmentReady', function() {
            setTimeout(initRoutine, 100);
        });
        
        window.addEventListener('pageLoaded', function() {
            setTimeout(initRoutine, 150);
        });
    
})();
