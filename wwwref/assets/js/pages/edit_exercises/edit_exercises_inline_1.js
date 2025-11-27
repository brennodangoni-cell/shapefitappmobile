
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

        function closeModal() {
            modal.classList.remove('active');
        }

        // Carregar dados atuais
        async function loadCurrentData() {
            try {
                const response = await authenticatedFetch(`${BASE_URL}/api/get_edit_profile_data.php`);
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

        otherActivityBtn.addEventListener('click', () => {
            modal.classList.add('active');
            setTimeout(() => {
                activityInput.focus();
            }, 80);
        });

        closeModalBtn.addEventListener('click', closeModal);
        closeModalFooterBtn.addEventListener('click', closeModal);

        addActivityBtn.addEventListener('click', addActivity);
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
                const response = await authenticatedFetch(`${BASE_URL}/api/update_exercises.php`, {
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
