
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        let progressData = null;
        let weightChart = null;
        
        // Carregar dados do progresso
        (async function() {
            const authenticated = await requireAuth();
            if (!authenticated) return;
            
            const BASE_URL = window.BASE_APP_URL;
            
            try {
                const response = await authenticatedFetch(`${BASE_URL}/api/get_progress_data.php`);
                if (!response) return;
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.message || 'Erro ao carregar dados');
                }
                
                const data = result.data;
                
                // Preparar dados para renderização
                prepareProgressData(data);
                
                // Renderizar página
                renderProgressPage();
                
                // Mostrar conteúdo
                document.getElementById('progress-container').style.display = 'block';
                
            } catch (error) {
                console.error('Erro ao carregar progresso:', error);
                document.getElementById('progress-content').innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: red;">Erro ao carregar dados. Tente novamente.</p>
                    </div>
                `;
            }
        })();
        
        function prepareProgressData(data) {
            const goals = data.goals || {};
            const today = data.today || {};
            const week = data.week || {};
            const month = data.month || {};
            
            // Calcular meta de água com base no valor real enviado pelo backend (ml)
            const waterGoalMl = (typeof data.water_goal_ml === 'number' && data.water_goal_ml > 0)
                ? data.water_goal_ml
                : ((goals.target_water_cups || 0) * 250);
            const sleepGoalHours = 8; // Meta fixa de sono
            
            progressData = {
                today: {
                    kcal: today.kcal_consumed || 0,
                    protein: today.protein_consumed_g || 0,
                    carbs: today.carbs_consumed_g || 0,
                    fat: today.fat_consumed_g || 0,
                    water: today.water_consumed_ml != null 
                        ? today.water_consumed_ml 
                        : ((today.water_consumed_cups || 0) * 250),
                    steps: today.steps_daily || 0,
                    sleep: parseFloat(today.sleep_hours) || 0,
                    workout: today.workout_hours || 0,
                    cardio: today.cardio_hours || 0
                },
                week: {
                    kcal: week.total_kcal || 0,
                    protein: week.total_protein || 0,
                    carbs: week.total_carbs || 0,
                    fat: week.total_fat || 0,
                    water: (week.total_water || 0) * 250,
                    steps: week.total_steps || 0,
                    sleep: parseFloat(week.avg_sleep) || 0,
                    workout: week.total_workout_hours || 0,
                    cardio: week.total_cardio_hours || 0
                },
                month: {
                    kcal: month.total_kcal || 0,
                    protein: month.total_protein || 0,
                    carbs: month.total_carbs || 0,
                    fat: month.total_fat || 0,
                    water: (month.total_water || 0) * 250,
                    steps: month.total_steps || 0,
                    sleep: parseFloat(month.avg_sleep) || 0,
                    workout: month.total_workout_hours || 0,
                    cardio: month.total_cardio_hours || 0
                },
                goals: {
                    kcal: goals.target_kcal || 2000,
                    protein: goals.target_protein_g || 150,
                    carbs: goals.target_carbs_g || 200,
                    fat: goals.target_fat_g || 65,
                    water: waterGoalMl,
                    steps_daily: goals.target_steps_daily || 10000,
                    steps_weekly: goals.target_steps_weekly || 70000,
                    sleep: sleepGoalHours,
                    workout_weekly: goals.target_workout_hours_weekly || 0,
                    cardio_weekly: goals.target_cardio_hours_weekly || 0
                },
                user_has_exercises: data.user_has_exercises || false
            };
        }
        
        function formatNumber(number, decimals = 0) {
            return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(number);
        }
        
        function formatHours(hours) {
            if (!hours || hours < 0) hours = 0;
            if (hours < 1) return Math.round(hours * 60) + 'min';
            const wholeHours = Math.floor(hours);
            const remainingMinutes = Math.round((hours - wholeHours) * 60);
            return remainingMinutes === 0 ? wholeHours + 'h' : wholeHours + 'h' + remainingMinutes;
        }
        
        function getProgressColor(percentage) {
            if (percentage >= 100) return '#22c55e';
            if (percentage >= 80) return '#f59e0b';
            if (percentage >= 60) return '#f97316';
            return '#ef4444';
        }
        
        function calculateProgress(current, target) {
            if (target <= 0) return 0;
            return Math.min(100, Math.round((current / target) * 100));
        }
        
        function renderProgressCards(period) {
            const content = document.getElementById('progress-content');
            if (!content || !progressData) return;
            
            let currentData, goalsData;
            
            switch(period) {
                case 'week':
                    currentData = progressData.week;
                    goalsData = {
                        kcal: progressData.goals.kcal * 7,
                        protein: progressData.goals.protein * 7,
                        carbs: progressData.goals.carbs * 7,
                        fat: progressData.goals.fat * 7,
                        water: progressData.goals.water * 7,
                        steps: progressData.goals.steps_weekly,
                        sleep: progressData.goals.sleep,
                        workout: progressData.goals.workout_weekly,
                        cardio: progressData.goals.cardio_weekly
                    };
                    break;
                case 'month':
                    currentData = progressData.month;
                    goalsData = {
                        kcal: progressData.goals.kcal * 30,
                        protein: progressData.goals.protein * 30,
                        carbs: progressData.goals.carbs * 30,
                        fat: progressData.goals.fat * 30,
                        water: progressData.goals.water * 30,
                        steps: progressData.goals.steps_daily * 30,
                        sleep: progressData.goals.sleep,
                        workout: progressData.goals.workout_weekly * 4,
                        cardio: progressData.goals.cardio_weekly * 4
                    };
                    break;
                case 'today':
                default:
                    currentData = progressData.today;
                    goalsData = {
                        kcal: progressData.goals.kcal,
                        protein: progressData.goals.protein,
                        carbs: progressData.goals.carbs,
                        fat: progressData.goals.fat,
                        water: progressData.goals.water,
                        steps: progressData.goals.steps_daily,
                        sleep: progressData.goals.sleep,
                        workout: progressData.goals.workout_weekly / 7,
                        cardio: progressData.goals.cardio_weekly / 7
                    };
                    break;
            }

            const cards = [
                { icon: '🔥', label: 'Calorias', value: currentData.kcal, target: goalsData.kcal, unit: 'kcal' },
                { icon: '🥩', label: 'Proteínas', value: currentData.protein, target: goalsData.protein, unit: 'g' },
                { icon: '🍞', label: 'Carboidratos', value: currentData.carbs, target: goalsData.carbs, unit: 'g' },
                { icon: '🥑', label: 'Gorduras', value: currentData.fat, target: goalsData.fat, unit: 'g' },
                { icon: '💧', label: 'Água', value: currentData.water, target: goalsData.water, unit: 'ml' },
                { icon: '😴', label: 'Sono', value: currentData.sleep, target: goalsData.sleep, unit: '', isHour: true }
            ];

            if (progressData.user_has_exercises && goalsData.workout > 0) {
                cards.push(
                    { icon: '🏋️', label: 'Treino', value: currentData.workout, target: goalsData.workout, unit: '', isHour: true },
                    { icon: '🏃', label: 'Cardio', value: currentData.cardio, target: goalsData.cardio, unit: '', isHour: true }
                );
            }

            let cardsHTML = cards.map(card => {
                const progress = calculateProgress(card.value, card.target);
                const displayValue = card.isHour ? formatHours(card.value) : formatNumber(card.value, card.unit === 'g' ? 1 : 0);
                const displayTarget = card.isHour ? formatHours(card.target) : formatNumber(card.target, card.unit === 'g' ? 1 : 0);

                return `
                    <div class="unified-progress-card">
                        <span class="progress-icon">${card.icon}</span>
                        <h4 class="progress-label">${card.label}</h4>
                        <p class="progress-value">${displayValue} ${card.unit}</p>
                        <p class="progress-target">Meta: ${displayTarget} ${card.unit}</p>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${progress}%; background: ${getProgressColor(progress)};"></div>
                        </div>
                        <p class="progress-percentage">${progress}% • ${displayValue} de ${displayTarget}</p>
                    </div>
                `;
            }).join('');
            
            content.innerHTML = cardsHTML;
        }
        
        function changePeriod(period) {
            document.querySelectorAll('.period-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.period === period);
            });
            
            const subtitles = {
                'today': 'Consumo vs Meta - Hoje',
                'week': 'Total vs Meta - Esta Semana',
                'month': 'Total vs Meta - Este Mês'
            };
            document.getElementById('period-subtitle').textContent = subtitles[period];
            
            renderProgressCards(period);
        }
        
        function renderProgressPage() {
            // Event listeners para período
            document.querySelectorAll('.period-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    changePeriod(tab.dataset.period);
                });
            });
            
            // Renderizar período inicial
            changePeriod('today');
        }
    
})();
