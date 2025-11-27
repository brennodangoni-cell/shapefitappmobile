
/**
 * Script Inline Protegido - inline_3
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // Verificar autenticação
        (async function() {
            const authenticated = await requireAuth();
            if (!authenticated) {
                return; // Já redirecionou para login
            }
            
            const BASE_URL = window.BASE_APP_URL;
            const urlParams = new URLSearchParams(window.location.search);
            const recipeId = parseInt(urlParams.get('id')) || 0;
            
            if (!recipeId) {
                alert('ID da receita inválido.');
                if (window.SPARouter) {
                    window.SPARouter.navigate('/fragments/explore_recipes.html');
                } else {
                    window.location.href = '/explore_recipes.html';
                }
                return;
            }
            
            let recipeData = null;
            let isFavorited = false;
            
            // Carregar dados da receita
            async function loadRecipeData() {
                try {
                    const response = await authenticatedFetch(`/api/get_recipe_data.php?id=${recipeId}`);
                    
                    if (!response) return; // Token inválido, já redirecionou
                    
                    const result = await response.json();
                    
                    if (!result.success) {
                        throw new Error(result.message || 'Erro ao carregar receita');
                    }
                    
                    recipeData = result.data.recipe;
                    isFavorited = result.data.is_favorited;
                    
                    // Atualizar título (se existir)
                    const pageTitle = document.getElementById('page-title');
                    if (pageTitle) pageTitle.textContent = recipeData.name + ' - ShapeFIT';
                    document.title = recipeData.name + ' - ShapeFIT';
                    
                    // Renderizar receita
                    renderRecipe(result.data);
                    
                    // Configurar favorito
                    setupFavoriteButton();
                    
                    // Configurar formulário
                    setupLogMealForm(result.data);
                    
                    // Mostrar conteúdo
                    document.getElementById('loading-state').style.display = 'none';
                    document.getElementById('recipe-container').style.display = 'block';
                    
                } catch (error) {
                    console.error('Erro ao carregar receita:', error);
                    document.getElementById('loading-state').innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--accent-orange);"></i>
                        <p>Erro ao carregar receita. Redirecionando...</p>
                    `;
                    setTimeout(() => {
                        if (window.SPARouter) {
                            window.SPARouter.navigate('/fragments/explore_recipes.html');
                        } else {
                            window.location.href = '/explore_recipes.html';
                        }
                    }, 2000);
                }
            }
            
            function renderRecipe(data) {
                const recipe = data.recipe;
                const BASE_URL = window.BASE_APP_URL;
                
                // Imagem
                const imageUrl = recipe.image_url 
                    || (recipe.image_filename 
                        ? `${BASE_URL}/assets/images/recipes/${recipe.image_filename}`
                        : `${BASE_URL}/assets/images/recipes/placeholder_food.jpg`);
                document.getElementById('recipe-image').src = imageUrl;
                document.getElementById('recipe-image').onerror = function() {
                    this.src = `${BASE_URL}/assets/images/recipes/placeholder_food.jpg`;
                };
                document.getElementById('recipe-image').alt = recipe.name;
                
                // Nome
                document.getElementById('recipe-name').textContent = recipe.name;
                
                // Descrição
                if (recipe.description) {
                    document.getElementById('recipe-description').textContent = recipe.description;
                    document.getElementById('recipe-description').style.display = 'block';
                }
                
                // Categorias
                if (data.categories && data.categories.length > 0) {
                    const categoriesHtml = data.categories.map(cat => 
                        `<span class="category-tag">${escapeHtml(cat.name)}</span>`
                    ).join('');
                    document.getElementById('category-tags').innerHTML = categoriesHtml;
                    document.getElementById('category-tags').style.display = 'flex';
                }
                
                // Macros
                document.getElementById('macro-kcal').textContent = Math.round(recipe.kcal_per_serving || 0);
                document.getElementById('macro-carbs').textContent = (recipe.carbs_g_per_serving || 0).toFixed(1).replace('.', ',') + 'g';
                document.getElementById('macro-fat').textContent = (recipe.fat_g_per_serving || 0).toFixed(1).replace('.', ',') + 'g';
                document.getElementById('macro-protein').textContent = (recipe.protein_g_per_serving || 0).toFixed(1).replace('.', ',') + 'g';
                
                // Info de porção
                let servingInfo = 'Valores por porção';
                if (recipe.serving_size_g && recipe.serving_size_g > 0) {
                    servingInfo += ' de ' + Math.round(recipe.serving_size_g) + 'g';
                }
                document.getElementById('serving-info').textContent = servingInfo;
                
                // Tempo e porções
                const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
                if (totalTime > 0 || recipe.servings) {
                    let timingHtml = '';
                    if (totalTime > 0) {
                        timingHtml += `<div class="timing-item"><i class="far fa-clock"></i> ${totalTime} min</div>`;
                    }
                    if (recipe.servings) {
                        let servingsText = "Rende " + recipe.servings;
                        servingsText += (parseInt(recipe.servings) === 1) ? ' porção' : ' porções';
                        if (recipe.serving_size_g && recipe.serving_size_g > 0) {
                            servingsText += ' de ' + Math.round(recipe.serving_size_g) + 'g';
                        }
                        timingHtml += `<div class="servings-item"><i class="fas fa-utensils"></i> ${servingsText}</div>`;
                    }
                    document.getElementById('timing-servings').innerHTML = timingHtml;
                    document.getElementById('timing-servings').style.display = 'flex';
                }
                
                // Ingredientes
                if (data.ingredients && data.ingredients.length > 0) {
                    const ingredientsHtml = data.ingredients.map(ing => 
                        `<li>- ${escapeHtml(ing)}</li>`
                    ).join('');
                    document.getElementById('ingredients-list').innerHTML = ingredientsHtml;
                    document.getElementById('ingredients-section').style.display = 'block';
                }
                
                // Instruções
                if (recipe.instructions) {
                    const steps = recipe.instructions.split('\n').filter(s => s.trim());
                    let stepNumber = 1;
                    const instructionsHtml = steps.map(step => {
                        const cleaned = step.trim().replace(/^\d+[\.\)]\s*/, '');
                        return `<div class="instruction-step"><span class="step-number">${stepNumber++}</span><p>${escapeHtml(cleaned).replace(/\n/g, '<br>')}</p></div>`;
                    }).join('');
                    document.getElementById('instructions-content').innerHTML = instructionsHtml;
                    document.getElementById('instructions-section').style.display = 'block';
                }
                
                // Notas
                if (recipe.notes) {
                    document.getElementById('notes-content').innerHTML = escapeHtml(recipe.notes).replace(/\n/g, '<br>');
                    document.getElementById('notes-section').style.display = 'block';
                }
            }
            
            function setupFavoriteButton() {
                const favoriteBtn = document.getElementById('favorite-btn');
                const favoriteIcon = favoriteBtn.querySelector('i');
                
                if (isFavorited) {
                    favoriteBtn.classList.add('is-favorited');
                    favoriteIcon.className = 'fas fa-heart';
                    favoriteBtn.setAttribute('aria-label', 'Desfavoritar receita');
                } else {
                    favoriteBtn.classList.remove('is-favorited');
                    favoriteIcon.className = 'far fa-heart';
                    favoriteBtn.setAttribute('aria-label', 'Favoritar receita');
                }
                
                favoriteBtn.onclick = async function(e) {
                    e.preventDefault();
                    
                    try {
                        const response = await authenticatedFetch(`/api/toggle_favorite.php`, {
                            method: 'POST',
                            body: JSON.stringify({ recipe_id: recipeId })
                        });
                        
                        if (!response) return; // Token inválido, já redirecionou
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            isFavorited = result.is_favorited;
                            if (isFavorited) {
                                favoriteBtn.classList.add('is-favorited');
                                favoriteIcon.className = 'fas fa-heart';
                                favoriteBtn.setAttribute('aria-label', 'Desfavoritar receita');
                            } else {
                                favoriteBtn.classList.remove('is-favorited');
                                favoriteIcon.className = 'far fa-heart';
                                favoriteBtn.setAttribute('aria-label', 'Favoritar receita');
                            }
                        }
                    } catch (error) {
                        console.error('Erro ao favoritar:', error);
                    }
                };
            }
            
            function setupLogMealForm(data) {
                document.getElementById('recipe_id').value = recipeId;
                
                // Preencher meal type
                const mealTypeSelect = document.getElementById('meal_type');
                mealTypeSelect.innerHTML = '';
                for (const [slug, name] of Object.entries(data.meal_type_options)) {
                    const option = document.createElement('option');
                    option.value = slug;
                    option.textContent = name;
                    if (slug === data.default_meal_type) {
                        option.selected = true;
                    }
                    mealTypeSelect.appendChild(option);
                }
                
                // Preencher data
                const dateSelect = document.getElementById('date_consumed');
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                dateSelect.innerHTML = `
                    <option value="${typeof getLocalDateString === 'function' ? getLocalDateString() : today.toISOString().split('T')[0]}">Hoje, ${today.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</option>
                    <option value="${typeof addDaysLocal === 'function' ? addDaysLocal(getLocalDateString(), -1) : yesterday.toISOString().split('T')[0]}">Ontem, ${yesterday.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</option>
                `;
                
                // Submit do formulário
                document.getElementById('log-meal-form').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const formData = {
                        recipe_id: recipeId,
                        meal_type: document.getElementById('meal_type').value,
                        date_consumed: document.getElementById('date_consumed').value,
                        servings_consumed: parseFloat(document.getElementById('servings_consumed').value)
                    };
                    
                    try {
                        const response = await authenticatedFetch(`/api/log_meal.php`, {
                            method: 'POST',
                            body: JSON.stringify(formData)
                        });
                        
                        if (!response) return; // Token inválido, já redirecionou
                        
                        let resultText = '';
                        let result = {};
                        try {
                            resultText = await response.text();
                            result = resultText ? JSON.parse(resultText) : {};
                        } catch (parseError) {
                            console.error('Resposta não é um JSON válido:', resultText);
                            throw new Error(resultText || 'Resposta inválida do servidor');
                        }
                        
                        if (result.success) {
                            alert(result.message || 'Refeição registrada com sucesso!');
                            // Usar SPA router para ir ao diário
                            if (window.SPARouter) {
                                window.SPARouter.navigate('/diario');
                            } else {
                                window.location.href = '/diary.html';
                            }
                        } else {
                            alert(result.message || 'Erro ao registrar refeição.');
                        }
                    } catch (error) {
                        console.error('Erro ao registrar refeição:', error);
                        alert('Erro ao registrar refeição. Tente novamente.');
                    }
                });
            }
            
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // Carregar dados
            loadRecipeData();
        })();
    
})();
