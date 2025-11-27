
/**
 * Script Inline Protegido - inline_1
 * Compatível com SPA - executa imediatamente
 */
(function() {
        // Evitar execução dupla
        if (window._onboardingLoaded) return;
        window._onboardingLoaded = true;

        // Carregar estados (UF) da API do IBGE
        async function loadStates() {
            try {
                const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
                const estados = await response.json();
                const ufSelect = document.getElementById('uf-select');
                if (!ufSelect) return;
                estados.forEach(uf => {
                    const option = document.createElement('option');
                    option.value = uf.sigla;
                    option.textContent = uf.sigla;
                    ufSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Erro ao carregar estados:', error);
            }
        }

        // Placeholder pra futuro: carregar nome
        async function loadUserName() {
            // Pode ser ajustado depois com base no token/localStorage
        }

        function initOnboarding() {
            console.log('[Onboarding] Iniciando...');
            
            loadStates();
            loadUserName();

            // Valores padrão para inputs de horário
            const sleepBedInput = document.querySelector('input[name="sleep_time_bed"]');
            const sleepWakeInput = document.querySelector('input[name="sleep_time_wake"]');
            const dobInput = document.querySelector('input[name="dob"]');
            
            if (sleepBedInput) sleepBedInput.value = "00:00";
            if (sleepWakeInput) sleepWakeInput.value = "00:00";

            // Data de nascimento = hoje por padrão
            const today = new Date().toISOString().split("T")[0];
            if (dobInput) dobInput.value = today;

            const form = document.getElementById('onboarding-form');
            if (!form) {
                console.error('[Onboarding] Formulário não encontrado!');
                return;
            }
            
            const steps = Array.from(form.querySelectorAll('.form-step'));
            const actionBtn = document.getElementById('action-btn');
            const backBtn = document.getElementById('back-btn');
            const exitBtn = document.getElementById('exit-btn');
            const headerNav = document.querySelector('.header-nav');
            const progressBarFill = document.getElementById('progress-bar-fill');
            const stepIndicatorText = document.getElementById('step-indicator-text');

            console.log('[Onboarding] Elementos encontrados:', { form: !!form, steps: steps.length, actionBtn: !!actionBtn, exitBtn: !!exitBtn });

            // Verificar se usuário já completou onboarding antes (para mostrar botão de sair)
            async function checkIfUserCompletedOnboarding() {
                try {
                    const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
                    if (!token) {
                        console.log('[Onboarding] Sem token, assumindo primeira vez');
                        return false;
                    }

                    const response = await fetch(`/api/get_user_info.php`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log('[Onboarding] Verificação de onboarding completo:', result);
                        if (result.success && result.user && result.user.onboarding_complete) {
                            return true;
                        }
                    }
                } catch (error) {
                    console.error('[Onboarding] Erro ao verificar onboarding:', error);
                }
                return false;
            }

            // Verificar se é refazer (via URL ou se já completou antes)
            const urlParams = new URLSearchParams(window.location.search);
            const isRefazerUrl = urlParams.get('refazer') === 'true';
            let isRefazer = isRefazerUrl; // Já começar como true se veio da URL
            
            console.log('[Onboarding] isRefazerUrl:', isRefazerUrl);
            
            // Se veio com ?refazer=true, mostrar botão de sair imediatamente
            if (isRefazerUrl && exitBtn) {
                exitBtn.classList.add('show');
                console.log('[Onboarding] Botão de sair mostrado (via URL)');
            }
            
            // Verificar se já completou onboarding e esconder steps desnecessários
            checkIfUserCompletedOnboarding().then(hasCompleted => {
                isRefazer = isRefazerUrl || hasCompleted;
                console.log('[Onboarding] isRefazer final:', isRefazer, '| hasCompleted:', hasCompleted);
                
                if (isRefazer && exitBtn) {
                    exitBtn.classList.add('show');
                    console.log('Botão de sair mostrado - usuário já completou onboarding');
                }
                
                // Esconder steps que não são necessários ao refazer
                if (isRefazer) {
                    const stepsToHide = ['location', 'phone', 'dob_gender'];
                    stepsToHide.forEach(stepId => {
                        const step = form.querySelector(`[data-step-id="${stepId}"]`);
                        if (step) {
                            step.style.display = 'none';
                            console.log(`Step ${stepId} escondido (refazer onboarding)`);
                        }
                    });
                    
                    // Buscar e aplicar restrição de peso
                    getWeightEditInfo().then(weightInfo => {
                        if (weightInfo) {
                            const weightInput = document.getElementById('weight-input');
                            const weightMessage = document.getElementById('weight-restriction-message');
                            const daysRemaining = document.getElementById('days-remaining');
                            const daysText = document.getElementById('days-text');
                            
                            if (weightInput && weightMessage && daysRemaining && daysText) {
                                if (!weightInfo.can_edit) {
                                    // Buscar peso atual do usuário
                                    fetch(`/api/get_dashboard_data.php`, {
                                        method: 'GET',
                                        headers: {
                                            'Authorization': `Bearer ${getAuthToken()}`
                                        }
                                    })
                                    .then(res => res.json())
                                    .then(result => {
                                        if (result.success && result.data && result.data.weight_banner) {
                                            // Extrair o peso do formato "XX.Xkg"
                                            const currentWeight = result.data.weight_banner.current_weight;
                                            if (currentWeight) {
                                                const weightValue = currentWeight.replace('kg', '').trim();
                                                weightInput.value = weightValue.replace(',', '.');
                                            }
                                        }
                                    })
                                    .catch(err => console.error('Erro ao buscar peso atual:', err));
                                    
                                    weightInput.readOnly = true;
                                    weightInput.style.opacity = '0.6';
                                    weightInput.required = false;
                                    weightMessage.style.display = 'block';
                                    daysRemaining.textContent = weightInfo.days_remaining;
                                    daysText.textContent = weightInfo.days_remaining === 1 ? 'dia' : 'dias';
                                }
                            }
                        }
                    });
                }
            });

            // Buscar informações de peso (verificação de 7 dias)
            async function getWeightEditInfo() {
                try {
                    const token = getAuthToken();
                    if (!token) return null;

                    const response = await fetch(`/api/get_dashboard_data.php`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            // Verificar se tem weight_banner
                            if (result.data.weight_banner) {
                                return {
                                    can_edit: result.data.weight_banner.show_edit_button !== false,
                                    days_remaining: result.data.weight_banner.days_until_update || 0
                                };
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao buscar info de peso:', error);
                }
                return null;
            }

            const otherActivityBtn = document.getElementById('other-activity-btn');
            const modal = document.getElementById('custom-activity-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const closeModalIcon = document.getElementById('close-modal-icon');
            const addActivityBtn = document.getElementById('add-activity-btn');
            const activityInput = document.getElementById('custom-activity-input');
            const activityList = document.getElementById('custom-activities-list');
            const hiddenInput = document.getElementById('custom-activities-hidden-input');

            const noneCheckbox = document.getElementById('ex-none');
            const exerciseOptionsWrapper = document.getElementById('exercise-options-wrapper');
            const frequencyWrapper = document.getElementById('frequency-wrapper');
            const allExerciseCheckboxes = exerciseOptionsWrapper.querySelectorAll('input[type="checkbox"]');

            let stepHistory = [0];
            let customActivities = [];

            // Filtrar steps visíveis (não escondidos)
            function getVisibleSteps() {
                return steps.filter(step => step.style.display !== 'none');
            }

            function getVisibleStepIndex(originalIndex) {
                const visibleSteps = getVisibleSteps();
                let visibleIndex = 0;
                for (let i = 0; i <= originalIndex; i++) {
                    if (steps[i].style.display !== 'none') {
                        visibleIndex++;
                    }
                }
                return visibleIndex;
            }

            const visibleSteps = getVisibleSteps();
            const totalSteps = visibleSteps.length;

            function updateProgress(stepIndex) {
                // Contar apenas steps visíveis até o atual
                const visibleCount = getVisibleStepIndex(stepIndex);
                const percent = (visibleCount / totalSteps) * 100;
                progressBarFill.style.width = percent + '%';
                stepIndicatorText.textContent = `Passo ${visibleCount} de ${totalSteps}`;
            }

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
                        updateButtonState();
                    };
                    tag.appendChild(removeBtn);
                    activityList.appendChild(tag);
                });
                hiddenInput.value = customActivities.join(',');
                otherActivityBtn.classList.toggle('active', customActivities.length > 0);

                // Se tiver atividade customizada e não estiver marcado "Nenhuma", selecionar frequência mínima por padrão
                if (customActivities.length > 0 && frequencyWrapper && !noneCheckbox.checked) {
                    const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                    const hasFrequencySelected = Array.from(freqRadios).some(radio => radio.checked);
                    if (!hasFrequencySelected) {
                        const minFreqRadio = document.getElementById('freq1');
                        if (minFreqRadio) {
                            minFreqRadio.checked = true;
                        }
                    }
                }

                updateButtonState();
            }

            function addActivity() {
                const newActivity = activityInput.value.trim();
                if (newActivity && !customActivities.includes(newActivity)) {
                    customActivities.push(newActivity);
                    activityInput.value = '';
                    renderTags();
                }
                activityInput.focus();
            }

            // Modal de atividade
            otherActivityBtn.addEventListener('click', () => {
                modal.classList.add('active');
                setTimeout(() => {
                    activityInput.focus();
                }, 80);
            });

            function closeModal() {
                modal.classList.remove('active');
            }

            closeModalBtn.addEventListener('click', closeModal);
            closeModalIcon.addEventListener('click', closeModal);

            addActivityBtn.addEventListener('click', addActivity);
            activityInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addActivity();
                }
            });

            // Lógica "Nenhum"
            noneCheckbox.addEventListener('change', function() {
                const isChecked = this.checked;

                if (isChecked) {
                    // Desmarcar todos os outros exercícios
                    allExerciseCheckboxes.forEach(cb => {
                        if (cb.id !== 'ex-none') {
                            cb.checked = false;
                            cb.disabled = true;
                        }
                    });

                    // Limpar atividades customizadas
                    customActivities = [];
                    renderTags();

                    // Desabilitar frequência
                    if (frequencyWrapper) {
                        const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                        freqRadios.forEach(radio => {
                            radio.checked = false;
                            radio.disabled = true;
                        });
                    }

                    // Desabilitar botão "Outro"
                    if (otherActivityBtn) {
                        otherActivityBtn.disabled = true;
                        otherActivityBtn.style.opacity = '0.5';
                        otherActivityBtn.style.pointerEvents = 'none';
                    }

                    // Adicionar classe disabled (apenas para desabilitar inputs, não visual)
                    if (exerciseOptionsWrapper) {
                        exerciseOptionsWrapper.classList.add('disabled');
                    }
                    if (frequencyWrapper) {
                        frequencyWrapper.classList.add('disabled');
                    }
                } else {
                    // Reabilitar todos os exercícios
                    allExerciseCheckboxes.forEach(cb => {
                        if (cb.id !== 'ex-none') {
                            cb.disabled = false;
                            cb.checked = false;
                        }
                    });

                    // Reabilitar frequência
                    if (frequencyWrapper) {
                        const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                        freqRadios.forEach(radio => {
                            radio.disabled = false;
                            radio.checked = false;
                        });
                    }

                    // Reabilitar botão "Outro"
                    if (otherActivityBtn) {
                        otherActivityBtn.disabled = false;
                        otherActivityBtn.style.opacity = '1';
                        otherActivityBtn.style.pointerEvents = 'auto';
                    }

                    // Remover classe disabled
                    if (exerciseOptionsWrapper) {
                        exerciseOptionsWrapper.classList.remove('disabled');
                    }
                    if (frequencyWrapper) {
                        frequencyWrapper.classList.remove('disabled');
                    }
                }

                updateButtonState();
            });

            // Reagir a cliques no wrapper para "cancelar" o Nenhum automaticamente
            exerciseOptionsWrapper.addEventListener('click', function(e) {
                if (noneCheckbox && noneCheckbox.checked) {
                    const clickedElement = e.target.closest('label, .option-button, button');
                    const noneLabel = noneCheckbox.closest('label');

                    // Se clicou em qualquer exercício (exceto o próprio "Nenhum"), desmarcar "Nenhum"
                    if (clickedElement && clickedElement !== noneLabel) {
                        // Verificar se é um label de exercício ou o botão "Outro"
                        const isExerciseLabel = clickedElement.tagName === 'LABEL' && clickedElement.getAttribute('for') && clickedElement.getAttribute('for') !== 'ex-none';
                        const isOtherButton = clickedElement.id === 'other-activity-btn' || clickedElement.classList.contains('option-button');
                        
                        if (isExerciseLabel || isOtherButton) {
                            e.preventDefault();
                            e.stopPropagation();

                            // Desmarcar "Nenhum"
                            noneCheckbox.checked = false;
                            
                            // Reabilitar todos os exercícios
                            allExerciseCheckboxes.forEach(cb => {
                                if (cb.id !== 'ex-none') {
                                    cb.disabled = false;
                                    cb.checked = false;
                                }
                            });

                            // Limpar atividades custom
                            customActivities = [];
                            renderTags();

                            // Reabilitar frequência
                            if (frequencyWrapper) {
                                const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                                freqRadios.forEach(radio => {
                                    radio.disabled = false;
                                    radio.checked = false;
                                });
                            }

                            // Reabilitar botão "Outro"
                            if (otherActivityBtn) {
                                otherActivityBtn.disabled = false;
                                otherActivityBtn.style.opacity = '1';
                                otherActivityBtn.style.pointerEvents = 'auto';
                            }

                            // Remover classe disabled
                            if (exerciseOptionsWrapper) {
                                exerciseOptionsWrapper.classList.remove('disabled');
                            }
                            if (frequencyWrapper) {
                                frequencyWrapper.classList.remove('disabled');
                            }

                            updateButtonState();
                        }
                    }
                }
            });

            allExerciseCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    if (this.id !== 'ex-none') {
                        if (this.checked && frequencyWrapper) {
                            const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                            const hasFrequencySelected = Array.from(freqRadios).some(radio => radio.checked);

                            if (!hasFrequencySelected) {
                                const minFreqRadio = document.getElementById('freq1');
                                if (minFreqRadio) {
                                    minFreqRadio.checked = true;
                                }
                            }
                        }

                        if (!this.checked && frequencyWrapper) {
                            const anyExerciseSelected = Array.from(allExerciseCheckboxes).some(cb => cb.checked && cb.id !== 'ex-none') || customActivities.length > 0;
                            if (!anyExerciseSelected) {
                                const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                                freqRadios.forEach(radio => radio.checked = false);
                            }
                        }

                        if (this.checked && noneCheckbox) {
                            noneCheckbox.checked = false;
                            allExerciseCheckboxes.forEach(cb => cb.disabled = false);
                            if (frequencyWrapper) {
                                const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                                freqRadios.forEach(radio => radio.disabled = false);
                            }
                            if (otherActivityBtn) {
                                otherActivityBtn.disabled = false;
                                otherActivityBtn.style.opacity = '1';
                                otherActivityBtn.style.pointerEvents = 'auto';
                            }
                            if (exerciseOptionsWrapper) {
                                exerciseOptionsWrapper.classList.remove('disabled');
                            }
                            if (frequencyWrapper) {
                                frequencyWrapper.classList.remove('disabled');
                            }
                        }

                        updateButtonState();
                    }
                });
            });

            const updateButtonState = () => {
                const currentStepIndex = stepHistory[stepHistory.length - 1];
                const currentStepDiv = steps[currentStepIndex];
                if (!currentStepDiv) {
                    console.log('[Onboarding] updateButtonState: currentStepDiv é null, index:', currentStepIndex);
                    return;
                }

                const stepId = currentStepDiv.dataset.stepId;
                let isStepValid = false;
                
                console.log('[Onboarding] updateButtonState: stepId =', stepId, '| index =', currentStepIndex);

                if (stepId === 'exercise_types') {
                    if (noneCheckbox && noneCheckbox.checked) {
                        isStepValid = true;
                    } else {
                        const anyExerciseSelected = currentStepDiv.querySelector('input[name="exercise_types[]"]:checked') || customActivities.length > 0;
                        isStepValid = !!anyExerciseSelected;
                    }
                } else if (stepId === 'exercise_frequency') {
                    // Se "Nenhuma / Não pratico", esse step será pulado
                    if (noneCheckbox && noneCheckbox.checked) {
                        isStepValid = true;
                    } else {
                        const freqSelected = currentStepDiv.querySelector('input[name="exercise_frequency"]:checked');
                        isStepValid = !!freqSelected;
                    }
                } else if (stepId === 'meat') {
                    const selected = form.querySelector('input[name="meat_consumption"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'gluten') {
                    const selected = form.querySelector('input[name="gluten_intolerance"]:checked');
                    console.log('[Onboarding] Gluten - selected:', selected, '| isValid:', !!selected);
                    isStepValid = !!selected;
                } else if (stepId === 'lactose') {
                    const selected = form.querySelector('input[name="lactose_intolerance"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'vegetarian') {
                    const selected = form.querySelector('input[name="vegetarian_type"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'weight') {
                    // Se o input de peso estiver readonly (restrição de 7 dias), sempre válido
                    const weightInput = document.getElementById('weight-input');
                    if (weightInput && weightInput.readOnly) {
                        isStepValid = true;
                    } else {
                        const weightValue = weightInput ? weightInput.value.trim() : '';
                        isStepValid = weightValue !== '' && weightInput.checkValidity();
                    }
                } else {
                    const inputs = currentStepDiv.querySelectorAll('input[required], select[required]');
                    isStepValid = Array.from(inputs).every(input => {
                        if (input.type === 'radio' || input.type === 'checkbox') {
                            const checked = form.querySelector(`input[name="${input.name}"]:checked`);
                            return checked !== null;
                        }
                        if (input.tagName === 'SELECT') {
                            return input.value !== '';
                        }
                        return input.value.trim() !== '' && input.checkValidity();
                    });
                }

                console.log('[Onboarding] updateButtonState FINAL: stepId =', stepId, '| isStepValid =', isStepValid, '| button disabled =', !isStepValid);
                actionBtn.disabled = !isStepValid;
            };

            const showStep = (stepIndex) => {
                steps.forEach((step, index) => {
                    step.classList.toggle('active', index === stepIndex);
                });

                headerNav.style.visibility = (stepIndex > 0) ? 'visible' : 'hidden';
                
                // Verificar se este é o último step visível
                let isLastVisibleStep = (stepIndex === steps.length - 1);
                if (!isLastVisibleStep) {
                    // Verificar se todos os próximos steps estão escondidos
                    let hasVisibleNextStep = false;
                    for (let i = stepIndex + 1; i < steps.length; i++) {
                        if (steps[i].style.display !== 'none') {
                            hasVisibleNextStep = true;
                            break;
                        }
                    }
                    isLastVisibleStep = !hasVisibleNextStep;
                }
                
                actionBtn.textContent = isLastVisibleStep ? 'Finalizar e criar plano' : 'Continuar';
                updateProgress(stepIndex);
                updateButtonState();
            };

            actionBtn.addEventListener('click', async () => {
                console.log('[Onboarding] Botão clicado! disabled =', actionBtn.disabled);
                if (actionBtn.disabled) {
                    console.log('[Onboarding] Botão está disabled, ignorando clique');
                    return;
                }

                let currentStepIndex = stepHistory[stepHistory.length - 1];
                const currentStepDiv = steps[currentStepIndex];
                const currentStepId = currentStepDiv.dataset.stepId;
                console.log('[Onboarding] Navegando do step:', currentStepId, '| index:', currentStepIndex);

                // Último passo -> enviar
                if (currentStepIndex === steps.length - 1) {
                    actionBtn.disabled = true;
                    actionBtn.textContent = 'Processando...';

                    const formData = new FormData(form);
                    const data = {};

                    for (let [key, value] of formData.entries()) {
                        if (key === 'exercise_types[]') {
                            if (!data['exercise_types']) data['exercise_types'] = [];
                            data['exercise_types'].push(value);
                        } else {
                            data[key] = value;
                        }
                    }

                    // Atividades customizadas
                    data.custom_activities = customActivities.join(',');
                    // Checkbox "não pratico"
                    data.exercise_type_none = noneCheckbox.checked ? '1' : '';

                    try {
                        const token = getAuthToken();
                        const response = await fetch(`/api/process_onboarding.php`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.success) {
                            // Se um novo token foi retornado (usuário foi criado), atualizar o token armazenado
                            if (result.token) {
                                setAuthToken(result.token);
                            }
                            // Usar router SPA se disponível, senão redirecionar normalmente
                            if (window.SPARouter && window.SPARouter.navigate) {
                                window.SPARouter.navigate('/metas');
                            } else {
                                window.location.href = result.redirect_url || `${window.BASE_APP_URL}/fragments/dashboard.html`;
                            }
                        } else {
                            alert(result.message || 'Erro ao processar onboarding. Tente novamente.');
                            actionBtn.disabled = false;
                            actionBtn.textContent = 'Finalizar e criar plano';
                        }
                    } catch (error) {
                        console.error('Erro ao processar onboarding:', error);
                        alert('Erro ao conectar com o servidor. Tente novamente.');
                        actionBtn.disabled = false;
                        actionBtn.textContent = 'Finalizar e criar plano';
                    }
                    return;
                }

                // Navegação normal + pulos de step
                let nextStepIndex = currentStepIndex + 1;

                // Se estiver saindo do step de exercícios e marcou "Nenhuma", pula frequência
                if (currentStepId === 'exercise_types' && noneCheckbox.checked) {
                    const freqIndex = steps.findIndex(step => step.dataset.stepId === 'exercise_frequency');
                    if (freqIndex > currentStepIndex) {
                        nextStepIndex = freqIndex + 1;
                    }
                }

                // Se estiver saindo do step de carne e marcou "Sim", pula vegetariano
                if (currentStepId === 'meat') {
                    const meatSelected = form.querySelector('input[name="meat_consumption"]:checked');
                    if (meatSelected && meatSelected.value === '1') {
                        const vegIndex = steps.findIndex(step => step.dataset.stepId === 'vegetarian');
                        if (vegIndex > currentStepIndex) {
                            nextStepIndex = vegIndex + 1;
                        }
                    }
                }

                // Pular steps escondidos (quando refazer)
                while (nextStepIndex < steps.length && steps[nextStepIndex].style.display === 'none') {
                    nextStepIndex++;
                }

                // Se todos os próximos steps estão escondidos, este é o último step visível
                // Nesse caso, devemos enviar o formulário
                if (nextStepIndex >= steps.length || nextStepIndex <= currentStepIndex) {
                    console.log('[Onboarding] Último step visível detectado, enviando formulário...');
                    
                    // Mudar texto do botão e enviar
                    actionBtn.disabled = true;
                    actionBtn.textContent = 'Processando...';

                    const formData = new FormData(form);
                    const data = {};

                    for (let [key, value] of formData.entries()) {
                        if (key === 'exercise_types[]') {
                            if (!data['exercise_types']) data['exercise_types'] = [];
                            data['exercise_types'].push(value);
                        } else {
                            data[key] = value;
                        }
                    }

                    // Atividades customizadas
                    data.custom_activities = customActivities.join(',');
                    // Checkbox "não pratico"
                    data.exercise_type_none = (noneCheckbox && noneCheckbox.checked) ? '1' : '';
                    // Indicar que é refazer (não precisa dos campos de localização/telefone)
                    data.is_refazer = true;

                    try {
                        const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
                        const response = await fetch(`/api/process_onboarding.php`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.success) {
                            if (result.token) {
                                setAuthToken(result.token);
                            }
                            if (window.SPARouter && window.SPARouter.navigate) {
                                window.SPARouter.navigate('/metas');
                            } else {
                                window.location.href = result.redirect_url || `${window.BASE_APP_URL}/fragments/dashboard.html`;
                            }
                        } else {
                            alert(result.message || 'Erro ao processar. Tente novamente.');
                            actionBtn.disabled = false;
                            actionBtn.textContent = 'Finalizar';
                        }
                    } catch (error) {
                        console.error('Erro ao processar:', error);
                        alert('Erro ao conectar com o servidor. Tente novamente.');
                        actionBtn.disabled = false;
                        actionBtn.textContent = 'Finalizar';
                    }
                    return;
                }

                stepHistory.push(nextStepIndex);
                showStep(nextStepIndex);
            });

            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    if (backBtn.disabled) return;
                    backBtn.disabled = true;

                    if (stepHistory.length > 1) {
                        stepHistory.pop();
                        showStep(stepHistory[stepHistory.length - 1]);
                    }

                    setTimeout(() => {
                        backBtn.disabled = false;
                    }, 250);
                });
            }

            // Botão de sair (só aparece quando é refazer)
            if (exitBtn) {
                exitBtn.addEventListener('click', () => {
                    // Usar router SPA se disponível
                    if (window.SPARouter && window.SPARouter.navigate) {
                        window.SPARouter.navigate('/metas');
                    } else {
                        window.location.href = window.BASE_APP_URL + '/fragments/dashboard.html';
                    }
                });
            }

            form.addEventListener('input', updateButtonState);
            form.addEventListener('change', updateButtonState);
            
            // Garantir que radio buttons e checkboxes disparem updateButtonState
            form.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                input.addEventListener('change', () => {
                    console.log('[Onboarding] Input changed:', input.name, '| checked:', input.checked);
                    updateButtonState();
                });
            });
            
            // Também adicionar listener nos labels (para garantir)
            form.querySelectorAll('.option-card, .exercise-option label').forEach(label => {
                label.addEventListener('click', () => {
                    console.log('[Onboarding] Label clicado:', label.getAttribute('for'));
                    setTimeout(updateButtonState, 50);
                });
            });

            showStep(stepHistory[0]);
        }
        
        // Executar imediatamente (SPA) ou aguardar DOM se necessário
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initOnboarding);
        } else {
            initOnboarding();
        }
    
})();
