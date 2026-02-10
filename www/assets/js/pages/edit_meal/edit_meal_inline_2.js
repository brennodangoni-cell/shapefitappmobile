
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

// Verificar autenticação
(async function() {
    const authenticated = await requireAuth();
    if (!authenticated) {
        return; // Já redirecionou para login
    }
    
    // Carregar dados da refeição
    const BASE_URL = window.BASE_APP_URL;

    function navigateToDiary(dateStr) {
        const dateParam = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
        if (window.SPARouter && typeof window.SPARouter.navigate === 'function') {
            window.SPARouter.navigate(`/diario${dateParam}`, { isBack: true });
            return;
        }
        window.location.href = `/diario${dateParam}`;
    }
    
    // Debug: ver o que está na URL
    const urlParams = new URLSearchParams(window.location.search);
    const mealId = parseInt(urlParams.get('id')) || 0;
    if (!mealId) {
        alert('ID da refeição inválido.');
        navigateToDiary();
        return;
    }
    
    let mealData = null;
    let nutritionPerServing = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Função para atualizar valores nutricionais
    function updateNutrition() {
        const servings = parseFloat(document.getElementById('servings').value) || 1;
        
        const totalKcal = Math.round(nutritionPerServing.kcal * servings);
        const totalProtein = Math.round(nutritionPerServing.protein * servings * 10) / 10;
        const totalCarbs = Math.round(nutritionPerServing.carbs * servings * 10) / 10;
        const totalFat = Math.round(nutritionPerServing.fat * servings * 10) / 10;
        
        document.getElementById('total-kcal').innerHTML = totalKcal + ' <span class="nutrition-item-unit">kcal</span>';
        document.getElementById('total-protein').innerHTML = totalProtein + ' <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-carbs').innerHTML = totalCarbs + ' <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-fat').innerHTML = totalFat + ' <span class="nutrition-item-unit">g</span>';
    }
    
    // Função para excluir refeição
    async function deleteMeal() {
        if (!confirm('Tem certeza que deseja excluir esta refeição? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            // Usar URLSearchParams para compatibilidade com PHP $_POST
            const params = new URLSearchParams();
            params.append('meal_id', mealId);
            
            const response = await authenticatedFetch(`${window.API_BASE_URL}/delete_meal.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });
            
            if (!response) return; // Token inválido, já redirecionou
            
            const text = await response.text();
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const result = JSON.parse(text);
            
            if (result.success) {
                // Voltar ao diário via SPA
                navigateToDiary(mealData?.date_consumed);
            } else {
                alert(result.message || 'Erro ao excluir refeição.');
            }
        } catch (error) {
            console.error('Erro ao excluir refeição:', error);
            alert('Erro ao excluir refeição. Tente novamente.');
        }
    }
    
    window.deleteMeal = deleteMeal;

    async function loadMealData() {
        try {
            const response = await authenticatedFetch(`${window.API_BASE_URL}/get_edit_meal_data.php?id=${mealId}`);
            
            if (!response) return; // Token inválido, já redirecionou
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Erro ao carregar dados da refeição');
            }
            
            mealData = result.data.meal;
            const mealTypeOptions = result.data.meal_type_options;
            
            // Calcular nutrição por porção
            const servings = parseFloat(mealData.servings_consumed) || 1;
            nutritionPerServing = {
                kcal: (mealData.kcal_consumed || 0) / servings,
                protein: (mealData.protein_consumed_g || 0) / servings,
                carbs: (mealData.carbs_consumed_g || 0) / servings,
                fat: (mealData.fat_consumed_g || 0) / servings
            };
            
            // Preencher formulário
            document.getElementById('meal_id').value = mealData.id;
            document.getElementById('meal_name').value = mealData.custom_meal_name || mealData.recipe_name || '';
            document.getElementById('date_consumed').value = mealData.date_consumed;
            document.getElementById('time_consumed').value = new Date(mealData.logged_at).toTimeString().slice(0, 5);
            document.getElementById('servings').value = mealData.servings_consumed || 1;
            
            // Preencher select de meal type
            const mealTypeSelect = document.getElementById('meal_type');
            mealTypeSelect.innerHTML = '';
            for (const [slug, name] of Object.entries(mealTypeOptions)) {
                const option = document.createElement('option');
                option.value = slug;
                option.textContent = name;
                if (slug === mealData.meal_type) {
                    option.selected = true;
                }
                mealTypeSelect.appendChild(option);
            }
            
            // Atualizar valores nutricionais
            updateNutrition();
            
            // Atualizar botão de favoritar (apenas se for refeição customizada)
            const favoriteBtn = document.getElementById('favorite-meal-btn');
            if (favoriteBtn && result.data.is_custom_meal) {
                favoriteBtn.style.display = 'flex';
                if (result.data.is_favorited) {
                    favoriteBtn.classList.add('favorited');
                    favoriteBtn.querySelector('i').className = 'fas fa-heart';
                    favoriteBtn.title = 'Remover dos favoritos';
                } else {
                    favoriteBtn.classList.remove('favorited');
                    favoriteBtn.querySelector('i').className = 'far fa-heart';
                    favoriteBtn.title = 'Adicionar aos favoritos';
                }
            } else if (favoriteBtn) {
                favoriteBtn.style.display = 'none';
            }
            
            // Atualizar botão de voltar e cancelar
            const backHref = `/diario?date=${encodeURIComponent(mealData.date_consumed)}`;
            const backBtn = document.getElementById('back-button');
            const cancelBtn = document.getElementById('cancel-btn');
            if (backBtn) backBtn.href = backHref; // router intercepta o <a>
            if (cancelBtn) cancelBtn.onclick = (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                navigateToDiary(mealData.date_consumed);
            };
            
            // Mostrar formulário
            document.getElementById('edit-form').style.display = 'block';
            
        } catch (error) {
            console.error('Erro ao carregar dados da refeição:', error);
            alert('Erro ao carregar dados da refeição. Redirecionando...');
            navigateToDiary();
        }
    }
    
    // Carregar dados ao iniciar
    loadMealData();

// Event listeners
document.getElementById('servings').addEventListener('input', updateNutrition);

    // Validação e envio do formulário
    document.getElementById('edit-meal-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const mealName = document.getElementById('meal_name').value.trim();
        const servings = parseFloat(document.getElementById('servings').value);
        
        if (!mealName) {
            alert('Por favor, insira o nome da refeição.');
            return;
        }
        
        if (!servings || servings <= 0) {
            alert('Por favor, insira uma quantidade válida.');
            return;
        }
        
        try {
            // Usar URLSearchParams para compatibilidade com PHP $_POST
            const params = new URLSearchParams();
            params.append('meal_id', document.getElementById('meal_id').value);
            params.append('meal_name', mealName);
            params.append('meal_type', document.getElementById('meal_type').value);
            params.append('date_consumed', document.getElementById('date_consumed').value);
            params.append('time_consumed', document.getElementById('time_consumed').value);
            params.append('servings', servings);
            
            console.log('[EditMeal] Enviando dados:', params.toString());
            
            const response = await authenticatedFetch(`${window.API_BASE_URL}/edit_meal.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });
            
            if (!response) return; // Token inválido, já redirecionou
            console.log('[EditMeal] Response headers:', response.headers.get('content-type'));
            
            // Verificar se a resposta tem conteúdo
            const text = await response.text();
            if (!response.ok) {
                // Erro HTTP
                let errorMsg = `Erro do servidor (${response.status})`;
                if (text) {
                    try {
                        const errData = JSON.parse(text);
                        errorMsg = errData.message || errorMsg;
                    } catch (e) {
                        errorMsg = text.substring(0, 200) || errorMsg;
                    }
                }
                throw new Error(errorMsg);
            }
            
            if (!text) {
                throw new Error('Resposta vazia do servidor');
            }
            
            const result = JSON.parse(text);
            
            if (result.success) {
                // Pegar a data para voltar ao diário na data correta
                const dateConsumed = document.getElementById('date_consumed').value;
                
                // Usar SPA router para voltar ao diário
                if (window.SPARouter) {
                    window.SPARouter.navigate(`/diario?date=${encodeURIComponent(dateConsumed)}`, { isBack: true });
                } else {
                    window.location.href = `/diario?date=${encodeURIComponent(dateConsumed)}`;
                }
            } else {
                alert(result.message || 'Erro ao atualizar refeição.');
            }
        } catch (error) {
            console.error('Erro ao atualizar refeição:', error);
            alert('Erro ao atualizar refeição. Tente novamente.');
        }
    });
    
    // Event listener para favoritar refeição
    const favoriteBtn = document.getElementById('favorite-meal-btn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', async function() {
            const mealId = document.getElementById('meal_id').value;
            if (!mealId) return;
            
            try {
                const response = await authenticatedFetch(`${window.API_BASE_URL}/toggle_favorite_custom_meal.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ meal_id: mealId })
                });
                
                if (!response) return;
                
                const result = await response.json();
                
                if (result.success) {
                    // Atualizar estado do botão
                    if (result.is_favorited) {
                        favoriteBtn.classList.add('favorited');
                        favoriteBtn.querySelector('i').className = 'fas fa-heart';
                        favoriteBtn.title = 'Remover dos favoritos';
                    } else {
                        favoriteBtn.classList.remove('favorited');
                        favoriteBtn.querySelector('i').className = 'far fa-heart';
                        favoriteBtn.title = 'Adicionar aos favoritos';
                    }
                    
                    // Mostrar feedback visual (opcional)
                    const icon = favoriteBtn.querySelector('i');
                    icon.style.transform = 'scale(1.3)';
                    setTimeout(() => {
                        icon.style.transform = 'scale(1)';
                    }, 200);
                } else {
                    alert(result.message || 'Erro ao atualizar favoritos.');
                }
            } catch (error) {
                console.error('Erro ao favoritar refeição:', error);
                alert('Erro ao atualizar favoritos. Tente novamente.');
            }
        });
    }
    
    // Event listeners
    document.getElementById('servings').addEventListener('input', updateNutrition);
})();

})();
