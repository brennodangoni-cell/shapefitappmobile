
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        const BASE_URL = window.BASE_APP_URL || '';
        let customActivities = [];
        let currentExerciseType = '';
        let currentFrequency = 'sedentary';

        const noneCheckbox = document.getElementById('ex-none');
        const exerciseOptionsWrapper = document.getElementById('exercise-options-wrapper');
        const frequencyWrapper = document.getElementById('frequency-wrapper');
        const allExerciseCheckboxes = exerciseOptionsWrapper.querySelectorAll('input[type="checkbox"]');
        const otherActivityBtn = document.getElementById('other-activity-btn');
        const modal = document.getElementById('modal');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const closeModalIcon = document.getElementById('close-modal-icon');
        const addActivityBtn = document.getElementById('add-activity-btn');
        const activityInput = document.getElementById('custom-activity-input');
        const activityList = document.getElementById('custom-activities-list');
        const closeModalFooterBtn = document.getElementById('close-modal-footer-btn');
        const saveBtn = document.getElementById('save-btn');
        const errorMessage = document.getElementById('error-message');
        const backBtn = document.getElementById('back-btn');

        function renderTags() {
            activityList.innerHTML = '';
            customActivities.forEach(activity => {
                const tag = document.createElement('div');
                tag.className = 'activity-tag';
                const tagText = document.createTextNode(activity);
                tag.appendChild(tagText);
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-tag';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = () => {
                    customActivities = customActivities.filter(item => item !== activity);
                    renderTags();
                };
                tag.appendChild(removeBtn);
                activityList.appendChild(tag);
            });
            otherActivityBtn.classList.toggle('active', customActivities.length > 0);
        }

        function addActivity() {
            const newActivity = activityInput.value.trim();
            if (newActivity && !customActivities.includes(newActivity)) {
                customActivities.push(newActivity);
                activityInput.value = '';
                renderTags();
                updateFrequencyVisibility();
            }
            activityInput.focus();
        }

        function updateFrequencyVisibility() {
            const hasExercises = Array.from(allExerciseCheckboxes).some(cb => cb.checked && cb.id !== 'ex-none') || customActivities.length > 0;
            if (hasExercises && !noneCheckbox.checked) {
                frequencyWrapper.style.display = 'block';
                frequencyWrapper.classList.add('visible');
            } else {
                frequencyWrapper.style.display = 'none';
                frequencyWrapper.classList.remove('visible');
            }
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 5000);
        }

        // ========== MODAL DE ATIVIDADES CUSTOMIZADAS ==========
        
        let modalInitialized = false;
        
        // Função para abrir modal
        function openModal() {
            if (!modal) {
                console.error('[EditExercises] Modal não encontrado!');
                return;
            }
            
            // Garantir que modal está no body
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            
            // Inicializar listeners apenas uma vez
            if (!modalInitialized) {
                initModalListeners();
                modalInitialized = true;
            }
            
            // Remover estilo inline que pode estar bloqueando
            modal.removeAttribute('style');
            
            // Mostrar modal - FORÇAR COM !important via inline
            modal.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: rgba(0, 0, 0, 0.6) !important;
                backdrop-filter: blur(8px) !important;
                -webkit-backdrop-filter: blur(8px) !important;
                z-index: 999999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 20px !important;
                box-sizing: border-box !important;
                pointer-events: auto !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
            modal.classList.add('active');
            document.body.classList.add('modal-open');
            
            // Focar no input
            setTimeout(() => {
                if (activityInput) activityInput.focus();
            }, 100);
        }

        // Função para fechar modal
        function closeModal() {
            if (modal) {
                modal.classList.remove('active');
                modal.style.cssText = 'display: none !important;';
                document.body.classList.remove('modal-open');
            }
        }
        
        // EXPOR FUNÇÃO GLOBALMENTE
        window.closeEditExercisesModal = closeModal;

        // Função para configurar event listeners do modal
        function initModalListeners() {
            const closeBtn = document.getElementById('close-modal-btn');
            const closeIcon = document.getElementById('close-modal-icon');
            const footerBtn = document.getElementById('close-modal-footer-btn');
            const addBtn = document.getElementById('add-activity-btn');
            const input = document.getElementById('custom-activity-input');
            
            // Remover listeners antigos para evitar duplicação
            if (closeBtn) {
                const newCloseBtn = closeBtn.cloneNode(true);
                closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                newCloseBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                    return false;
                };
            }
            
            if (closeIcon) {
                const newCloseIcon = closeIcon.cloneNode(true);
                closeIcon.parentNode.replaceChild(newCloseIcon, closeIcon);
                newCloseIcon.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                    return false;
                };
            }
            
            if (footerBtn) {
                const newFooterBtn = footerBtn.cloneNode(true);
                footerBtn.parentNode.replaceChild(newFooterBtn, footerBtn);
                newFooterBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                    return false;
                };
            }
            
            // Clicar no overlay (fora do conteúdo) fecha o modal
            if (modal) {
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeModal();
                    }
                };
            }
            
            // Botão adicionar atividade
            const currentAddBtn = document.getElementById('add-activity-btn');
            if (currentAddBtn && !currentAddBtn.dataset.listenerAdded) {
                currentAddBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    addActivity();
                    return false;
                };
                currentAddBtn.dataset.listenerAdded = 'true';
            }
            
            // Enter no input adiciona atividade
            const currentInput = document.getElementById('custom-activity-input');
            if (currentInput && !currentInput.dataset.listenerAdded) {
                currentInput.onkeypress = function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addActivity();
                        return false;
                    }
                };
                currentInput.dataset.listenerAdded = 'true';
            }
        }

        // Carregar dados atuais
        async function loadCurrentData() {
            try {
                const response = await authenticatedFetch(`${window.API_BASE_URL}/get_edit_profile_data.php`);
                if (!response || !response.ok) {
                    throw new Error('Erro ao carregar dados');
                }
                const result = await response.json();
                if (result.success && result.data) {
                    const profile = result.data.profile;
                    currentExerciseType = profile.exercise_type || '';
                    currentFrequency = profile.exercise_frequency || 'sedentary';

                    // Preencher exercícios
                    if (currentExerciseType && currentExerciseType !== '0' && currentExerciseType.trim() !== '') {
                        const exercises = currentExerciseType.split(',').map(e => e.trim()).filter(e => e);
                        const standardExercises = ['Musculação', 'Corrida', 'Crossfit', 'Natação', 'Yoga', 'Futebol'];
                        
                        exercises.forEach(exercise => {
                            if (standardExercises.includes(exercise)) {
                                const checkbox = document.querySelector(`input[value="${exercise}"]`);
                                if (checkbox) checkbox.checked = true;
                            } else {
                                customActivities.push(exercise);
                            }
                        });

                        if (exercises.length === 0) {
                            noneCheckbox.checked = true;
                        }
                    } else {
                        noneCheckbox.checked = true;
                    }

                    // Preencher frequência
                    if (currentFrequency && currentFrequency !== 'sedentary') {
                        const freqRadio = document.querySelector(`input[name="exercise_frequency"][value="${currentFrequency}"]`);
                        if (freqRadio) freqRadio.checked = true;
                    }

                    renderTags();
                    updateFrequencyVisibility();
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
                showError('Erro ao carregar dados. Tente novamente.');
            }
        }

        // Event listeners
        backBtn.addEventListener('click', () => {
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/editar-perfil');
            } else {
                window.location.href = '/fragments/edit_profile.html';
            }
        });

        // Botão "Outro" - abrir modal
        if (otherActivityBtn) {
            otherActivityBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                openModal();
                return false;
            };
        }
        
        // Inicializar listeners do modal imediatamente
        initModalListeners();
        activityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addActivity();
            }
        });

        allExerciseCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                if (this.id === 'ex-none') {
                    if (this.checked) {
                        allExerciseCheckboxes.forEach(cb => {
                            if (cb.id !== 'ex-none') cb.checked = false;
                        });
                        customActivities = [];
                        renderTags();
                    }
                } else {
                    if (this.checked && noneCheckbox) {
                        noneCheckbox.checked = false;
                    }
                }
                updateFrequencyVisibility();
            });
        });

        // Auto-selecionar frequência mínima se necessário
        document.querySelectorAll('input[name="exercise_frequency"]').forEach(radio => {
            radio.addEventListener('change', function() {
                // Frequência selecionada
            });
        });

        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            try {
                // Coletar exercícios selecionados
                const selectedExercises = [];
                allExerciseCheckboxes.forEach(cb => {
                    if (cb.checked && cb.id !== 'ex-none') {
                        selectedExercises.push(cb.value);
                    }
                });

                // Combinar exercícios padrão e customizados
                const allExercises = [...selectedExercises, ...customActivities];
                const exerciseType = noneCheckbox.checked ? null : (allExercises.length > 0 ? allExercises.join(', ') : null);

                // Coletar frequência
                const freqRadio = document.querySelector('input[name="exercise_frequency"]:checked');
                let exerciseFrequency = 'sedentary';
                if (!noneCheckbox.checked && freqRadio) {
                    exerciseFrequency = freqRadio.value;
                } else if (noneCheckbox.checked) {
                    exerciseFrequency = 'sedentary';
                } else if (allExercises.length > 0 && !freqRadio) {
                    showError('Por favor, selecione a frequência de treino.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar';
                    return;
                }

                // Validar se há exercícios mas não há frequência
                if (allExercises.length > 0 && !freqRadio && !noneCheckbox.checked) {
                    showError('Por favor, selecione a frequência de treino.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Salvar';
                    return;
                }

                // Enviar para API
                const response = await authenticatedFetch(`${window.API_BASE_URL}/update_exercises.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        exercise_type: exerciseType,
                        exercise_frequency: exerciseFrequency
                    })
                });

                if (!response || !response.ok) {
                    throw new Error('Erro ao salvar');
                }

                const result = await response.json();
                if (result.success) {
                    if (window.SPARouter && window.SPARouter.navigate) {
                        window.SPARouter.navigate('/editar-perfil');
                    } else {
                        window.location.href = '/fragments/edit_profile.html';
                    }
                } else {
                    throw new Error(result.message || 'Erro ao salvar');
                }
            } catch (error) {
                console.error('Erro ao salvar:', error);
                showError(error.message || 'Erro ao salvar. Tente novamente.');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar';
            }
        });

        // Carregar dados ao iniciar
        async function init() {
            const authenticated = await requireAuth();
            if (!authenticated) return;
            await loadCurrentData();
        }
        
        // Executar imediatamente (SPA) ou aguardar DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    
})();
