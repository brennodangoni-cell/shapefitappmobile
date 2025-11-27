
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // Verificar autenticação antes de carregar dados
        (async function() {
            const authenticated = await requireAuth();
            if (!authenticated) {
                return; // Já redirecionou para login
            }
            
// Carregar dados do diário
            const urlParams = new URLSearchParams(window.location.search);
            // Função para obter data local no formato YYYY-MM-DD (não UTC)
            function getLocalDateString() {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            
            let currentDate = urlParams.get('date') || getLocalDateString();

async function loadDiaryData(date) {
    try {
                    const token = getAuthToken();
                    const response = await authenticatedFetch(`${window.API_BASE_URL}/get_diary_data.php?date=${date}`);
                    
                    if (!response) return; // Token inválido, já redirecionou
                    
                    if (!response.ok) {
                        const text = await response.text();
                        console.error('Erro HTTP:', response.status, text);
                        throw new Error(`Erro ao carregar dados: ${response.status}`);
                    }
                    
                    const text = await response.text();
                    if (!text || text.trim() === '') {
                        throw new Error('Resposta vazia do servidor');
                    }
                    
                    let result;
                    try {
                        result = JSON.parse(text);
                    } catch (parseError) {
                        console.error('Erro ao parsear JSON:', parseError);
                        console.error('Texto recebido:', text);
                        throw new Error('Resposta inválida do servidor');
                    }
        
        if (!result.success) {
            throw new Error(result.message || 'Erro ao carregar dados');
        }
        
        const data = result.data;
        currentDate = data.date;
        
        // Atualizar data display
        document.getElementById('current-diary-date').textContent = data.date_display;
        
        // Atualizar navegação de data
        const prevLink = document.getElementById('prev-date');
        const nextLink = document.getElementById('next-date');
        // Função para formatar data como YYYY-MM-DD (local, não UTC)
        function formatDateLocal(dateStr) {
            const d = new Date(dateStr + 'T00:00:00'); // Forçar hora local
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // Função para adicionar/subtrair dias (local)
        function addDaysLocal(dateStr, days) {
            const d = new Date(dateStr + 'T00:00:00');
            d.setDate(d.getDate() + days);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        const prevDate = addDaysLocal(date, -1);
        const nextDate = addDaysLocal(date, 1);
        
        // Navegação entre dias - apenas atualiza dados e URL, sem recarregar fragmento
        if (prevLink) {
            prevLink.onclick = (e) => {
                e.preventDefault();
                // Atualizar URL sem recarregar página
                window.history.pushState({ date: prevDate }, '', `/diario?date=${prevDate}`);
                // Recarregar dados com nova data
                loadDiaryData(prevDate);
            };
        }
        
        if (nextLink) {
            nextLink.onclick = (e) => {
                e.preventDefault();
                const todayLocal = getLocalDateString();
                if (date >= todayLocal) {
                    return; // Não pode ir para o futuro
                }
                // Atualizar URL sem recarregar página
                window.history.pushState({ date: nextDate }, '', `/diario?date=${nextDate}`);
                // Recarregar dados com nova data
                loadDiaryData(nextDate);
            };
        }
        
        const todayLocal = getLocalDateString();
        // Desabilitar "next" apenas se a data for maior ou igual a hoje (não pode ir para o futuro)
        // Se estiver em uma data anterior, deve poder voltar (next habilitado)
        if (date >= todayLocal) {
            nextLink.classList.add('disabled');
        } else {
            nextLink.classList.remove('disabled');
        }
        
        // O botão "prev" sempre deve estar habilitado (pode ir para datas anteriores)
        prevLink.classList.remove('disabled');
        
        // Atualizar resumo nutricional
        document.getElementById('kcal-consumed').textContent = data.nutrition.kcal.consumed;
        document.getElementById('kcal-goal').textContent = data.nutrition.kcal.goal;
        document.getElementById('protein-consumed').textContent = data.nutrition.protein.consumed + 'g';
        document.getElementById('protein-goal').textContent = data.nutrition.protein.goal;
        document.getElementById('carbs-consumed').textContent = data.nutrition.carbs.consumed + 'g';
        document.getElementById('carbs-goal').textContent = data.nutrition.carbs.goal;
        document.getElementById('fat-consumed').textContent = data.nutrition.fat.consumed + 'g';
        document.getElementById('fat-goal').textContent = data.nutrition.fat.goal;
        
        // Renderizar refeições (garantir que meal_groups seja um objeto)
        const mealGroups = data.meal_groups || {};
        const mealTypes = data.meal_types || {};
        renderMeals(mealGroups, mealTypes);
        
        // Atualizar botão de adicionar
        const addMealBtn = document.getElementById('add-meal-btn');
        if (addMealBtn) {
            addMealBtn.onclick = () => {
                if (window.SPARouter) {
                    window.SPARouter.navigate(`/fragments/add_food_to_diary.html?date=${currentDate}`);
                } else {
                    window.location.href = `/add_food_to_diary.html?date=${currentDate}`;
                }
            };
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados do diário:', error);
        document.getElementById('meals-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar dados</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderMeals(mealGroups, mealTypes) {
    const mealsList = document.getElementById('meals-list');
    
    // Verificar se mealGroups é array (formato da API) ou objeto (formato esperado)
    let processedGroups = {};
    
    if (Array.isArray(mealGroups)) {
        // Converter array para objeto
        mealGroups.forEach(group => {
            if (group && group.type && Array.isArray(group.meals)) {
                processedGroups[group.type] = group.meals;
            }
        });
    } else if (mealGroups && typeof mealGroups === 'object') {
        // Já é objeto, usar diretamente
        processedGroups = mealGroups;
    }
    
    if (Object.keys(processedGroups).length === 0) {
        mealsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-utensils"></i>
                <h3>Nenhuma refeição registrada</h3>
                <p>Adicione sua primeira refeição do dia</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const [mealType, meals] of Object.entries(processedGroups)) {
        // Garantir que meals seja um array
        if (!Array.isArray(meals)) {
            console.warn(`mealGroups[${mealType}] não é um array:`, meals);
            continue;
        }
        
        const typeName = mealTypes[mealType] || mealType;
        const mealGroupKcal = meals.reduce((sum, meal) => sum + parseFloat(meal.kcal_consumed || 0), 0);
        
        html += `
            <div class="meal-group">
                <div class="meal-group-header">
                    <h3 class="meal-group-title">${escapeHtml(typeName)}</h3>
                    <div class="meal-group-total">${Math.round(mealGroupKcal)} kcal</div>
                </div>
                <div class="meal-items">
        `;
        
        meals.forEach(meal => {
            const mealName = meal.custom_meal_name || meal.recipe_name || 'Refeição';
            html += `
                    <div class="meal-item">
                        <div class="meal-item-info">
                            <div class="meal-item-name">${escapeHtml(mealName)}</div>
                            <div class="meal-item-details">
                                P: ${Math.round(meal.protein_consumed_g || 0)}g | 
                                C: ${Math.round(meal.carbs_consumed_g || 0)}g | 
                                G: ${Math.round(meal.fat_consumed_g || 0)}g
                            </div>
                        </div>
                        <div class="meal-item-actions">
                            <div class="meal-item-kcal">${Math.round(meal.kcal_consumed || 0)} kcal</div>
                                        <a href="/fragments/edit_meal.html?id=${meal.id}" class="meal-edit-btn" title="Editar refeição" data-spa-link>
                                <i class="fas fa-edit"></i>
                            </a>
                        </div>
                    </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    mealsList.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Carregar dados ao iniciar
loadDiaryData(currentDate);
        })();

})();
