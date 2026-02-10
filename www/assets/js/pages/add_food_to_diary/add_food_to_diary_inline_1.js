
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

let selectedRecipe = null;
let pendingItems = [];
let userSelectedMealType = false;

function selectRecipe(recipe) {
    selectedRecipe = {
        ...recipe,
        is_food: recipe.is_food === true,
        is_custom_meal: recipe.is_custom_meal === true
    };
    document.getElementById('modal-recipe-name').textContent = selectedRecipe.name;
    document.getElementById('selected-recipe-id').value = selectedRecipe.id || '';
    
    // Preencher nome da refeição automaticamente
    document.getElementById('custom_meal_name').value = selectedRecipe.custom_meal_name || selectedRecipe.name;
    
    // RESETAR ESTADO ANTERIOR - CORRIGIR BUG DA COR VERMELHA E LEGENDA
    const quantityLabel = document.getElementById('quantity-label');
    const quantityInfo = document.getElementById('quantity-info');
    
    quantityLabel.style.color = ''; // Resetar cor
    quantityLabel.innerHTML = 'Quantidade'; // Resetar texto
    quantityInfo.innerHTML = '<small class="text-muted"><span id="conversion-info"></span></small>'; // Resetar HTML
    quantityInfo.style.display = 'none'; // Ocultar inicialmente
    
    // Mostrar/ocultar seletor de unidade baseado no tipo
    const unitSelect = document.getElementById('unit-select');
    
    if (selectedRecipe.is_food) {
        // Para alimentos, mostrar seletor de unidade
        unitSelect.style.display = 'block';
        quantityLabel.textContent = 'Quantidade';
        document.getElementById('quantity').classList.remove('quantity-input-full-width');
        loadUnitsForFood(selectedRecipe.id, '0');
    } else {
        // Para receitas ou refeições customizadas, ocultar seletor de unidade e usar "porções"
        unitSelect.style.display = 'none';
        quantityLabel.textContent = 'Porções';
        document.getElementById('quantity').classList.add('quantity-input-full-width');
        updateMacros(); // Usar cálculo direto para receitas/refeições customizadas
    }
    
    // Se for refeição customizada favorita, preencher tipo de refeição
    if (selectedRecipe.is_custom_meal && selectedRecipe.meal_type) {
        const mealTypeSelect = document.getElementById('meal-type');
        if (mealTypeSelect) {
            mealTypeSelect.value = selectedRecipe.meal_type;
            userSelectedMealType = true; // Marcar que foi selecionado manualmente
        }
    }
    
    // Mostrar modal
    const modal = document.getElementById('recipe-modal');
    modal.classList.add('visible');
    // ✅ Bloquear scroll do body quando modal está aberto
    document.body.classList.add('recipe-modal-open');
    document.body.style.overflow = 'hidden';
}

function updateMacros() {
    if (!selectedRecipe) return;
    
    const quantity = parseFloat(document.getElementById('quantity').value) || 1;
    const unitSelect = document.getElementById('unit-select');
    
    // Se for receita ou não houver seletor de unidade visível
    if (!selectedRecipe.is_food || unitSelect.style.display === 'none') {
        // Cálculo direto para receitas (sistema antigo)
        const totalKcal = Math.round(selectedRecipe.kcal_per_serving * quantity);
        const totalProtein = Math.round(selectedRecipe.protein_g_per_serving * quantity * 10) / 10;
        const totalCarbs = Math.round(selectedRecipe.carbs_g_per_serving * quantity * 10) / 10;
        const totalFat = Math.round(selectedRecipe.fat_g_per_serving * quantity * 10) / 10;
        
        document.getElementById('total-kcal').innerHTML = totalKcal + ' <span class="nutrition-item-unit">kcal</span>';
        document.getElementById('total-protein').innerHTML = totalProtein + ' <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-carbs').innerHTML = totalCarbs + ' <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-fat').innerHTML = totalFat + ' <span class="nutrition-item-unit">g</span>';
        
        // Ocultar informação de conversão para receitas
        document.getElementById('quantity-info').style.display = 'none';
        return;
    }
    
    // Para alimentos, usar API de cálculo com unidades
    const unitId = unitSelect.value;
    if (unitId) {
        calculateNutritionWithUnits(quantity, unitId);
    }
}

// Função auxiliar para extrair ID numérico de um ID que pode ter prefixo
function extractNumericId(id) {
    if (typeof id === 'string' && id.includes('_')) {
        const parts = id.split('_');
        const numeric = parseInt(parts[parts.length - 1]);
        return isNaN(numeric) || numeric <= 0 ? null : numeric;
    }
    const numeric = parseInt(id);
    return isNaN(numeric) || numeric <= 0 ? null : numeric;
}

function calculateNutritionWithUnits(quantity, unitId) {
    // Extrair ID numérico do alimento
    let numericFoodId = selectedRecipe ? extractNumericId(selectedRecipe.id) : null;
    if (!numericFoodId) {
        const hiddenId = document.getElementById('selected-recipe-id')?.value;
        numericFoodId = extractNumericId(hiddenId);
    }
    
    const unitSelect = document.getElementById('unit-select');
    const resolvedUnitId = unitId || unitSelect?.value;
    
    if (!numericFoodId || !resolvedUnitId) {
        console.warn('⏭️ Ignorando cálculo: parâmetros inválidos', { numericFoodId, resolvedUnitId, quantity, hiddenId: document.getElementById('selected-recipe-id')?.value });
        // Tentar fallback para unidades padrão
        loadDefaultUnits(() => updateMacros());
        return;
    }
    if (!quantity || quantity <= 0) {
        
        document.getElementById('total-kcal').innerHTML = '0 <span class="nutrition-item-unit">kcal</span>';
        document.getElementById('total-protein').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-carbs').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-fat').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
        document.getElementById('conversion-info').textContent = '';
        document.getElementById('quantity-info').style.display = 'none';
        return;
    }
    const payload = new URLSearchParams();
    payload.append('food_id', numericFoodId);
    payload.append('quantity', quantity);
    payload.append('unit_id', resolvedUnitId);
    payload.append('is_recipe', selectedRecipe.is_food ? '0' : '1');
    
    const debugPayload = {
        food_id: numericFoodId,
        quantity: quantity,
        unit_id: resolvedUnitId,
        is_recipe: selectedRecipe.is_food ? '0' : '1'
    };
    authenticatedFetch(`${window.API_BASE_URL}/calculate_nutrition.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: payload.toString()
    })
    .then(response => {
        if (!response) throw new Error('Não autenticado');
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const nutrition = data.data.nutrition;
            const unitInfo = data.data.unit_info;
            
            document.getElementById('total-kcal').innerHTML = nutrition.kcal + ' <span class="nutrition-item-unit">kcal</span>';
            document.getElementById('total-protein').innerHTML = nutrition.protein + ' <span class="nutrition-item-unit">g</span>';
            document.getElementById('total-carbs').innerHTML = nutrition.carbs + ' <span class="nutrition-item-unit">g</span>';
            document.getElementById('total-fat').innerHTML = nutrition.fat + ' <span class="nutrition-item-unit">g</span>';
            
            // Mostrar informação de conversão
            const conversionInfo = document.getElementById('conversion-info');
            const quantityInfo = document.getElementById('quantity-info');
            conversionInfo.textContent = `${quantity} ${unitInfo.name} = ${data.data.quantity_in_base_unit}${data.data.quantity_in_base_unit >= 1000 ? 'g' : 'g'}`;
            quantityInfo.style.display = 'block';
        } else {
            console.error('Erro ao calcular nutrição:', data.error);
        }
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
    });
}

function closeModal() {
    const modal = document.getElementById('recipe-modal');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('visible');
    
    // ✅ Restaurar scroll do body quando modal fecha
    document.body.classList.remove('recipe-modal-open');
    document.body.style.overflow = '';

    // Adicione esta linha para resetar a posição do modal
    modalContent.style.transform = ''; 

    resetModalState();
    selectedRecipe = null;
}

function loadUnitsForFood(foodId, isRecipe) {
    // Extrair o número do ID se vier com prefixo (ex: "taco_66" -> "66")
    const numericId = extractNumericId(foodId);
    if (!numericId) {
        console.error('❌ ID inválido após extração:', foodId);
        loadDefaultUnits(() => updateMacros());
        return;
    }
    const unitSelect = document.getElementById('unit-select');
    unitSelect.innerHTML = '<option value="">Carregando...</option>';
    
    const url = `${window.API_BASE_URL}/get_units.php?action=for_food&food_id=${numericId}`;
    authenticatedFetch(url)
    .then(response => {
        if (!response) throw new Error('Não autenticado');
        if (!response.ok) {
            throw new Error(`Erro na rede: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // VERIFICAÇÃO DE SEGURANÇA: Garante que 'data' e 'data.data' existam e que a lista não esteja vazia
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
            unitSelect.innerHTML = ''; // Limpar "Carregando..."
            data.data.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = `${unit.name} (${unit.abbreviation})`;
                if (unit.is_default) {
                    option.selected = true;
                }
                unitSelect.appendChild(option);
            });
            
            // Caso nenhuma unidade tenha vindo marcada como padrão
            if (!unitSelect.value && unitSelect.options.length > 0) {
                unitSelect.selectedIndex = 0;
            }
            
            // Exibir o seletor e atualizar os macros
            unitSelect.style.display = 'block';
            document.getElementById('quantity').classList.remove('quantity-input-full-width');
            updateMacros();
        } else {
            loadDefaultUnits(() => updateMacros());
            return;
        }
    })
    .catch(error => {
        console.error('❌ Erro crítico ao carregar unidades:', error);
        loadDefaultUnits(() => updateMacros()); // Tentar novamente com unidades padrão
    });
}

function showNoUnitsMessage() {
    const unitSelect = document.getElementById('unit-select');
    const quantityLabel = document.getElementById('quantity-label');
    const quantityInfo = document.getElementById('quantity-info');
    
    // Ocultar o seletor de unidades
    unitSelect.style.display = 'none';
    
    // Mostrar mensagem de não classificado
    quantityLabel.innerHTML = '⚠️ Alimento não classificado';
    quantityLabel.style.color = '#ff6b6b';
    
    // Mostrar informação sobre classificação
    quantityInfo.innerHTML = `
        <div class="no-units-message">
            <p>⚠️ Este alimento ainda não foi classificado pelas estagiárias.</p>
            <p>Unidades de medida não disponíveis.</p>
            <p>Peça para uma estagiária classificar este alimento no painel administrativo.</p>
        </div>
    `;
    quantityInfo.style.display = 'block';
    
    // Fazer o campo de quantidade ocupar toda a largura
    document.getElementById('quantity').classList.add('quantity-input-full-width');
    
    // Atualizar macros (vai usar valores padrão)
    updateMacros();
}

function loadDefaultUnits(onComplete) {
    const unitSelect = document.getElementById('unit-select');
    const url = `${window.API_BASE_URL}/get_units.php?action=all`;
    console.log('URL da API (todas as unidades):', url);
    
    authenticatedFetch(url)
    .then(response => {
        if (!response) throw new Error('Não autenticado');
        console.log('📡 Resposta da API (todas as unidades):', response.status);
        return response.json();
    })
    .then(data => {
        console.log('📊 Dados da API (todas as unidades):', data);
        
        if (data.success) {
            unitSelect.innerHTML = '';
            
            // Adicionar unidades padrão com IDs reais do banco
            const defaultUnits = [
                { id: '26', name: 'Grama', abbreviation: 'g' }, // ID real do banco
                { id: '28', name: 'Mililitro', abbreviation: 'ml' }, // ID real do banco  
                { id: '31', name: 'Unidade', abbreviation: 'un' } // ID real do banco
            ];
            defaultUnits.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = `${unit.name} (${unit.abbreviation})`;
                if (unit.id === '31') { // Unidade como padrão
                    option.selected = true;
                }
                unitSelect.appendChild(option);
            });
            
            // Adicionar outras unidades
            data.data.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = `${unit.name} (${unit.abbreviation})`;
                unitSelect.appendChild(option);
            });
            
            if (!unitSelect.value && unitSelect.options.length > 0) {
                unitSelect.selectedIndex = 0;
            }
            updateMacros();
            if (typeof onComplete === 'function') {
                onComplete();
            }
        } else {
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    })
    .catch(error => {
        console.error('❌ Erro ao carregar unidades padrão:', error);
        if (typeof onComplete === 'function') {
            onComplete();
        }
    });
}

function confirmMeal() {
    if (!selectedRecipe) return;

    const customMealName = document.getElementById('custom_meal_name').value.trim();
    const quantityField = document.getElementById('quantity');
    const quantity = parseFloat(quantityField.value);
    const unitSelect = document.getElementById('unit-select');
    const unitId = unitSelect.value;
    const mealTypeSelect = document.getElementById('meal-type');
    const mealTime = document.getElementById('meal_time').value;
    const mealType = mealTypeSelect.value;
    const mealTypeLabel = mealTypeSelect.options[mealTypeSelect.selectedIndex]?.textContent || mealType;
    const dateConsumed = document.getElementById('meal-date').value;

    if (!customMealName) {
        showPendingFeedback('Por favor, insira o nome da refeição.', false);
        return;
    }

    if (!quantity || quantity <= 0) {
        showPendingFeedback('Por favor, informe uma quantidade válida.', false);
        return;
    }

    if (selectedRecipe.is_food && unitSelect.style.display === 'block' && (!unitId || unitId === '')) {
        showPendingFeedback('Selecione uma unidade de medida para o alimento.', false);
        return;
    }

    const totalKcal = parseMacroValue(document.getElementById('total-kcal').textContent);
    const totalProtein = parseMacroValue(document.getElementById('total-protein').textContent);
    const totalCarbs = parseMacroValue(document.getElementById('total-carbs').textContent);
    const totalFat = parseMacroValue(document.getElementById('total-fat').textContent);

    const unitLabel = selectedRecipe.is_food
        ? (unitSelect.options[unitSelect.selectedIndex]?.textContent || '')
        : 'Porção';

    // Para refeições customizadas favoritas, tratar como alimento customizado (is_food = 1)
    const isCustomMeal = selectedRecipe.is_custom_meal === true;
    
    const pendingItem = {
        id: Date.now() + Math.random(),
        display_name: customMealName,
        custom_meal_name: customMealName,
        is_food: selectedRecipe.is_food ? 1 : (isCustomMeal ? 1 : 0), // Ref customizada = is_food = 1
        food_name: selectedRecipe.is_food ? selectedRecipe.name : (isCustomMeal ? customMealName : ''),
        recipe_id: selectedRecipe.is_food || isCustomMeal ? '' : (selectedRecipe.id || ''),
        meal_type: mealType,
        meal_type_label: mealTypeLabel,
        meal_time: mealTime,
        meal_time_label: mealTime || 'Sem horário',
        date_consumed: dateConsumed,
        servings_consumed: quantity,
        quantity: quantity,
        unit_id: selectedRecipe.is_food ? unitId : '',
        unit_name: unitLabel,
        kcal_per_serving: selectedRecipe.is_food ? totalKcal : (isCustomMeal ? selectedRecipe.kcal_per_serving : selectedRecipe.kcal_per_serving),
        protein_per_serving: selectedRecipe.is_food ? totalProtein : (isCustomMeal ? selectedRecipe.protein_per_serving : selectedRecipe.protein_g_per_serving),
        carbs_per_serving: selectedRecipe.is_food ? totalCarbs : (isCustomMeal ? selectedRecipe.carbs_per_serving : selectedRecipe.carbs_g_per_serving),
        fat_per_serving: selectedRecipe.is_food ? totalFat : (isCustomMeal ? selectedRecipe.fat_per_serving : selectedRecipe.fat_g_per_serving),
        total_kcal: totalKcal,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fat: totalFat
    };

    pendingItems.push(pendingItem);
    renderPendingItems();
    showPendingFeedback('Refeição adicionada à lista. Clique em "Salvar no Diário" para registrar tudo de uma vez.', true);
    
    // Verificar se está favoritada após adicionar item
    setTimeout(() => checkIfCurrentMealIsFavorited(), 100);

    closeModal();
}

function parseMacroValue(text) {
    if (!text) return 0;
    const normalized = text.toString().replace(',', '.').replace(/[^0-9.\-]/g, '');
    const value = parseFloat(normalized);
    return isNaN(value) ? 0 : value;
}

function getMealTypeSlugByTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [hoursStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    if (Number.isNaN(hours)) return null;

    if (hours >= 5 && hours < 10) return 'breakfast';
    if (hours >= 10 && hours < 12) return 'morning_snack';
    if (hours >= 12 && hours < 15) return 'lunch';
    if (hours >= 15 && hours < 18) return 'afternoon_snack';
    if (hours >= 18 && hours < 21) return 'dinner';
    return 'supper';
}

function autoSetMealType(force = false) {
    if (!force && userSelectedMealType) return;
    const mealTimeInput = document.getElementById('meal_time');
    const mealTypeSelect = document.getElementById('meal-type');
    if (!mealTimeInput || !mealTypeSelect) return;

    const slug = getMealTypeSlugByTime(mealTimeInput.value);
    if (!slug) return;

    const optionExists = Array.from(mealTypeSelect.options).some(opt => opt.value === slug);
    if (optionExists) {
        mealTypeSelect.value = slug;
    }
}

function formatNumber(value, decimals = 1) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? number.toString() : number.toFixed(decimals);
}

function escapeHtml(str) {
    if (str == null) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function renderPendingItems() {
    const listEl = document.getElementById('pending-list');
    const totalsEl = document.getElementById('pending-totals');
    const saveBtn = document.getElementById('save-all-btn');

    if (!listEl || !totalsEl || !saveBtn) return;

    if (!pendingItems.length) {
        listEl.className = 'pending-empty';
        listEl.innerHTML = 'Nenhum item selecionado. Busque um alimento ou receita para começar.';
        totalsEl.style.display = 'none';
        totalsEl.innerHTML = '';
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar no Diário';
        return;
    }

    const itemsHtml = pendingItems.map((item, index) => {
        const quantityInfo = item.is_food
            ? `${escapeHtml(item.unit_name || 'Unidade')} • ${formatNumber(item.quantity, 2)}`
            : `${formatNumber(item.servings_consumed, 2)} porção(ões)`;

        return `
            <div class="pending-item">
                <div class="pending-item-info">
                    <div class="pending-item-title">${escapeHtml(item.display_name)}</div>
                    <div class="pending-item-meta">
                        <span>${escapeHtml(item.meal_type_label)}</span>
                        <span>${escapeHtml(item.meal_time || 'Sem horário')}</span>
                        <span>${formatDateLabel(item.date_consumed)}</span>
                        <span>${quantityInfo}</span>
                    </div>
                    <div class="pending-item-macros">
                        <span>${formatNumber(item.total_kcal, 0)} kcal</span>
                        <span>P: ${formatNumber(item.total_protein)}g</span>
                        <span>C: ${formatNumber(item.total_carbs)}g</span>
                        <span>G: ${formatNumber(item.total_fat)}g</span>
                    </div>
                </div>
                <button class="pending-remove-btn" onclick="removePendingItem(${index})" title="Remover item">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');

    listEl.className = 'pending-list';
    listEl.innerHTML = itemsHtml;

    const totals = pendingItems.reduce((acc, item) => {
        acc.kcal += item.total_kcal || 0;
        acc.protein += item.total_protein || 0;
        acc.carbs += item.total_carbs || 0;
        acc.fat += item.total_fat || 0;
        return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    totalsEl.style.display = 'flex';
    totalsEl.innerHTML = `
        <span><strong>Total:</strong> ${formatNumber(totals.kcal, 0)} kcal</span>
        <span>P: ${formatNumber(totals.protein)}g</span>
        <span>C: ${formatNumber(totals.carbs)}g</span>
        <span>G: ${formatNumber(totals.fat)}g</span>
    `;

    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fas fa-save"></i> Salvar no Diário (${pendingItems.length})`;
    
    // Habilitar/desabilitar botão de favoritar baseado nos itens
    const favoriteBtn = document.getElementById('favorite-meal-btn');
    if (favoriteBtn) {
        if (pendingItems.length === 0) {
            favoriteBtn.disabled = true;
            favoriteBtn.classList.remove('favorited');
            favoriteBtn.innerHTML = '<i class="far fa-heart"></i> Favoritar Refeição';
        } else {
            favoriteBtn.disabled = false;
            // Verificar se já está favoritada
            checkIfCurrentMealIsFavorited();
        }
    }
}

function removePendingItem(index) {
    pendingItems.splice(index, 1);
    renderPendingItems();
    showPendingFeedback('Item removido da lista.', true);
    
    // Verificar se ainda está favoritada após remover item
    setTimeout(() => checkIfCurrentMealIsFavorited(), 100);
}

function showPendingFeedback(message, isSuccess = true) {
    const feedbackEl = document.getElementById('pending-feedback');
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.classList.remove('success', 'error');
    feedbackEl.classList.add(isSuccess ? 'success' : 'error');
}

async function submitAllMeals() {
    if (!pendingItems.length) return;

    const saveBtn = document.getElementById('save-all-btn');
    const originalText = saveBtn.innerHTML;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const formData = new FormData();
    // CSRF token não necessário para requisições com token Bearer
    formData.append('batch', '1');
    formData.append('items', JSON.stringify(pendingItems));

    try {
        // Enviar como JSON em vez de FormData para melhor compatibilidade
        const payload = {
            batch: '1',
            items: pendingItems
        };
        
        const response = await authenticatedFetch(`${window.API_BASE_URL}/log_meal_batch.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response) {
            throw new Error('Resposta vazia do servidor');
        }
        
        if (!response.ok) {
            const text = await response.text();
            console.error('Erro HTTP:', response.status, text);
            throw new Error(`Erro ao salvar refeições: ${response.status}`);
        }
        
        const text = await response.text();
        if (!text || text.trim() === '') {
            throw new Error('Resposta vazia do servidor');
        }
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('Erro ao parsear JSON:', parseError);
            console.error('Texto recebido:', text);
            throw new Error('Resposta inválida do servidor');
        }

        if (data.success) {
            // Fechar qualquer modal aberto antes de redirecionar
            closeFavoriteMealModal();
            const favoriteModal = document.getElementById('favorite-meal-modal');
            if (favoriteModal) {
                favoriteModal.classList.remove('visible');
                document.body.classList.remove('recipe-modal-open');
                document.body.style.overflow = '';
            }
            
            showPendingFeedback('Refeições registradas com sucesso! Redirecionando...', true);
            const dateConsumed = pendingItems[0]?.date_consumed || new Date().toISOString().split('T')[0];
            
            // Fechar todos os modais ANTES de navegar (sem delay e sem transição)
            const allModals = document.querySelectorAll('.recipe-modal');
            allModals.forEach(modal => {
                modal.classList.remove('visible');
                modal.style.transition = 'none';
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
                modal.style.pointerEvents = 'none';
            });
            document.body.classList.remove('recipe-modal-open', 'modal-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            
            // Usar SPA router para navegar de volta ao diário
            setTimeout(() => {
                if (window.SPARouter) {
                    window.SPARouter.navigate(`/fragments/diary.html?date=${encodeURIComponent(dateConsumed)}`);
                } else {
                    window.location.href = `/diario?date=${encodeURIComponent(dateConsumed)}`;
                }
            }, 500);
            return;
        }

        throw new Error(data.message || 'Não foi possível salvar as refeições.');
    } catch (error) {
        console.error('Erro ao salvar refeições em lote:', error);
        showPendingFeedback(error.message || 'Erro ao salvar refeições. Tente novamente.', false);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

function resetModalState() {
    document.getElementById('custom_meal_name').value = '';
    document.getElementById('quantity').value = '1';
    document.getElementById('total-kcal').innerHTML = '0 <span class="nutrition-item-unit">kcal</span>';
    document.getElementById('total-protein').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
    document.getElementById('total-carbs').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
    document.getElementById('total-fat').innerHTML = '0 <span class="nutrition-item-unit">g</span>';

    const unitSelect = document.getElementById('unit-select');
    unitSelect.innerHTML = '';
    unitSelect.style.display = 'none';
    document.getElementById('quantity').classList.add('quantity-input-full-width');

    const quantityLabel = document.getElementById('quantity-label');
    quantityLabel.style.color = '';
    quantityLabel.textContent = 'Quantidade';

    const quantityInfo = document.getElementById('quantity-info');
    quantityInfo.innerHTML = '<small class="text-muted"><span id="conversion-info"></span></small>';
    quantityInfo.style.display = 'none';
}

let currentTab = 'foods';
let searchTimeout = null;

// Função para alternar entre abas
function switchTab(tab) {
    currentTab = tab;
    
    // Atualizar botões das abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    // Atualizar placeholder
    const searchInput = document.getElementById('search-input');
    if (tab === 'recipes') {
        searchInput.placeholder = 'Buscar receitas...';
    } else {
        searchInput.placeholder = 'Buscar alimentos...';
    }
    
    // Limpar resultados se houver
    clearSearchResults();
}

// Função para limpar resultados de busca
function clearSearchResults() {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.style.display = 'none';
    resultsDiv.innerHTML = '';
}

// Função para realizar busca
function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    
    if (query.length < 2) {
        clearSearchResults();
        return;
    }
    
    if (currentTab === 'recipes') {
        searchRecipes(query);
    } else {
        searchFoods(query);
    }
}

// Função para buscar receitas
async function searchRecipes(query) {
    try {
        // ✅ Usar URL completa diretamente para evitar problemas de CORS no Capacitor
        const apiBase = window.API_BASE_URL || 'https://appshapefit.com/api';
        const url = `${apiBase}/ajax_search_foods_recipes.php?term=${encodeURIComponent(query)}&type=recipes`;
        const response = await authenticatedFetch(url);
        
        if (!response) {
            clearSearchResults();
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displaySearchResults(data.data, 'recipe');
        } else {
            clearSearchResults();
        }
    } catch (error) {
        console.error('Erro ao buscar receitas:', error);
        clearSearchResults();
    }
}

// Função para buscar alimentos
async function searchFoods(query) {
    try {
        const apiBase = window.API_BASE_URL || 'https://appshapefit.com/api';
        
        // ✅ TENTAR PRIMEIRO O ENDPOINT ESPECÍFICO DE ALIMENTOS (ajax_search_food.php)
        // Se der erro de CORS, tentar o endpoint de receitas com type=food
        let url = `${apiBase}/ajax_search_food.php?term=${encodeURIComponent(query)}`;
        let response = null;
        let data = null;
        
        try {
            response = await authenticatedFetch(url);
            if (response && response.ok) {
                data = await response.json();
                if (data.success && data.data && data.data.length > 0) {
                    displaySearchResults(data.data, 'food');
                    return;
                }
            }
        } catch (error) {
            
        }
        
        // ✅ FALLBACK: Tentar usar o endpoint de receitas com type=food
        url = `${apiBase}/ajax_search_foods_recipes.php?term=${encodeURIComponent(query)}&type=food`;
        try {
            response = await authenticatedFetch(url);
            if (response && response.ok) {
                data = await response.json();
                console.log('[SearchFoods] Resposta do ajax_search_foods_recipes.php (type=food):', data);
                
                if (data.success && data.data && data.data.length > 0) {
                    displaySearchResults(data.data, 'food');
                    return;
                }
            }
        } catch (error) {
            console.error('[SearchFoods] Erro ao usar ajax_search_foods_recipes.php:', error);
        }
        
        // Se chegou aqui, não encontrou resultados ou deu erro
        clearSearchResults();
        
    } catch (error) {
        console.error('[SearchFoods] Erro geral ao buscar alimentos:', error);
        clearSearchResults();
    }
}

// Função para exibir resultados de busca
function displaySearchResults(results, type) {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';
    
    results.forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.onclick = () => selectSearchResult(item, type);
        
        let macros = '';
        const protein = Math.round(item.protein_g_per_serving || item.protein_100g || 0);
        const carbs = Math.round(item.carbs_g_per_serving || item.carbohydrate_g_100g || item.carbs_100g || 0);
        const fat = Math.round(item.fat_g_per_serving || item.fat_g_100g || 0);
        macros = `P: ${protein}g | C: ${carbs}g | G: ${fat}g`;
        
        resultItem.innerHTML = `
            <div class="search-result-type ${type}">${type === 'recipe' ? 'RECEITA' : 'ALIMENTO'}</div>
            <div class="search-result-info">
                <div class="search-result-name">${item.name}</div>
                <div class="search-result-macros">${macros}</div>
            </div>
        `;
        
        resultsDiv.appendChild(resultItem);
    });
    
    resultsDiv.style.display = 'block';
}

// Função para selecionar resultado da busca
function selectSearchResult(item, type) {
    if (type === 'recipe') {
        // Converter para formato de receita
        const recipe = {
            id: item.id,
            name: item.name,
            kcal_per_serving: item.kcal_per_serving || 0,
            protein_g_per_serving: item.protein_g_per_serving || 0,
            carbs_g_per_serving: item.carbs_g_per_serving || 0,
            fat_g_per_serving: item.fat_g_per_serving || 0,
            is_food: false
        };
        selectRecipe(recipe);
    } else {
        // Converter para formato de alimento
        const food = {
            id: item.id,
            name: item.name,
            kcal_per_serving: item.kcal_per_serving || 0,
            protein_g_per_serving: item.protein_g_per_serving || 0,
            carbs_g_per_serving: item.carbs_g_per_serving || 0,
            fat_g_per_serving: item.fat_g_per_serving || 0,
            is_food: true,
            source_table: item.source_table
        };
        selectRecipe(food); // Usar a mesma função, mas marcando como alimento
    }
    
    clearSearchResults();
    document.getElementById('search-input').value = '';
}

// Event listeners (serão adicionados em initAddFoodPage para garantir que funcionem no SPA)


// Fechar modal clicando fora
document.getElementById('recipe-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Modal centralizado - sem funcionalidade de arrastar

// Carregar dados iniciais da página
const BASE_URL = window.BASE_APP_URL || '';
// URL fixa para imagens (sempre do servidor, nunca localhost)
const IMAGES_BASE_URL = 'https://appshapefit.com';
const urlParams = new URLSearchParams(window.location.search);
let pageData = {
    date: urlParams.get('date') || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]),
    meal_type: urlParams.get('meal_type') || 'breakfast',
    meal_type_options: {},
    favorite_recipes: [],
    recent_recipes: []
};

async function loadPageData() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const date = urlParams.get('date') || pageData.date;
        const mealType = urlParams.get('meal_type') || pageData.meal_type;
        const response = await authenticatedFetch(`${window.API_BASE_URL}/get_add_food_data.php?date=${date}&meal_type=${mealType}`);
        if (!response) return;
        
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
        
        pageData = result.data;
        // Atualizar campos do formulário
        document.getElementById('meal-date').value = pageData.date;
        
        // Preencher select de meal type
        const mealTypeSelect = document.getElementById('meal-type');
        mealTypeSelect.innerHTML = '';
        for (const [slug, name] of Object.entries(pageData.meal_type_options)) {
            const option = document.createElement('option');
            option.value = slug;
            option.textContent = name;
            if (slug === pageData.meal_type) {
                option.selected = true;
            }
            mealTypeSelect.appendChild(option);
        }
        
        // Atualizar botão de voltar - usar rota do SPA
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            // Usar SPA router se disponível, senão usar href direto
            backBtn.onclick = (e) => {
                e.preventDefault();
                const dateParam = pageData.date ? `?date=${encodeURIComponent(pageData.date)}` : '';
                if (window.SPARouter) {
                    window.SPARouter.navigate(`/diario${dateParam}`, { isBack: true });
                } else {
                    window.location.href = `/diario${dateParam}`;
                }
            };
            // Manter href como fallback
            backBtn.href = `/diario${pageData.date ? `?date=${encodeURIComponent(pageData.date)}` : ''}`;
        }
        
        // Carregar e renderizar refeições customizadas favoritas
        loadFavoriteCustomMeals();
        
        // Renderizar receitas favoritas
        if (pageData.favorite_recipes.length > 0) {
            renderRecipes(pageData.favorite_recipes, 'favorite-recipes');
            document.getElementById('favorite-recipes-section').style.display = 'block';
        }
        
        // Renderizar receitas recentes
        if (pageData.recent_recipes.length > 0) {
            renderRecipes(pageData.recent_recipes, 'recent-recipes');
            document.getElementById('recent-recipes-section').style.display = 'block';
        }
        
        // Mostrar estado vazio se não há receitas
        if (pageData.favorite_recipes.length === 0 && pageData.recent_recipes.length === 0) {
            document.getElementById('empty-recipes-state').style.display = 'block';
        }
        
    } catch (error) {
        // ✅ Não mostrar erro se for erro de rede/offline
        if (error && (
            error.message && (
                error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError') ||
                error.message.includes('Network request failed') ||
                error.silent === true
            ) ||
            error.name === 'NetworkError'
        )) {
            // Erro de rede - não fazer nada, modal offline cuida
            return;
        }
        console.error('Erro ao carregar dados da página:', error);
    }
}

async function loadFavoriteCustomMeals() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/get_favorite_custom_meals.php`);
        if (!response) return;
        
        const result = await response.json();
        
        if (result.success && result.favorite_meals && result.favorite_meals.length > 0) {
            renderFavoriteCustomMeals(result.favorite_meals);
            document.getElementById('favorite-custom-meals-section').style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao carregar refeições favoritas:', error);
    }
}

function renderFavoriteCustomMeals(meals) {
    const container = document.getElementById('favorite-custom-meals');
    if (!container) return;
    
    container.innerHTML = '';
    
    meals.forEach(meal => {
        const mealCard = document.createElement('div');
        mealCard.className = 'recipe-card';
        mealCard.onclick = () => {
            // Criar objeto compatível com selectRecipe para refeição customizada
            selectRecipe({
                id: null, // Não tem ID de receita
                name: meal.meal_name,
                is_food: false,
                is_custom_meal: true,
                kcal_per_serving: meal.kcal_per_serving,
                protein_g_per_serving: meal.protein_per_serving,
                carbs_g_per_serving: meal.carbs_per_serving,
                fat_g_per_serving: meal.fat_per_serving,
                meal_type: meal.meal_type,
                custom_meal_name: meal.meal_name
            });
        };
        
        // Usar imagem placeholder para refeições customizadas (SVG inline para evitar 404)
        const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmEzYzRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvb2Q8L3RleHQ+PC9zdmc+';
        const imageUrl = placeholderSvg;
        
        mealCard.innerHTML = `
            <div class="recipe-image-wrapper" style="position: relative;">
                <img src="${imageUrl}" alt="${escapeHtml(meal.meal_name)}" class="recipe-image">
                <div class="custom-meal-badge" style="position: absolute; top: 8px; right: 8px; background: rgba(255, 107, 0, 0.9); color: white; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: 600;">
                    <i class="fas fa-heart"></i>
                </div>
            </div>
            <h3 class="recipe-name">${escapeHtml(meal.meal_name)}</h3>
            <p class="recipe-macros">
                P: ${Math.round(meal.protein_per_serving || 0)}g | 
                C: ${Math.round(meal.carbs_per_serving || 0)}g | 
                G: ${Math.round(meal.fat_per_serving || 0)}g
            </p>
            <div class="recipe-kcal">${Math.round(meal.kcal_per_serving || 0)} kcal</div>
        `;
        
        container.appendChild(mealCard);
    });
}

function renderRecipes(recipes, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    recipes.forEach(recipe => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        recipeCard.onclick = () => {
            selectRecipe({...recipe, is_food: false});
        };
        
        const placeholderSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmEzYzRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvb2Q8L3RleHQ+PC9zdmc+';
        const imageUrl = recipe.image_filename 
            ? `${IMAGES_BASE_URL}/assets/images/recipes/${recipe.image_filename}`
            : placeholderSvg;
        
        recipeCard.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHtml(recipe.name)}" class="recipe-image">
            <h3 class="recipe-name">${escapeHtml(recipe.name)}</h3>
            <p class="recipe-macros">
                P: ${Math.round(recipe.protein_g_per_serving || 0)}g | 
                C: ${Math.round(recipe.carbs_g_per_serving || 0)}g | 
                G: ${Math.round(recipe.fat_per_serving || 0)}g
            </p>
            <div class="recipe-kcal">${Math.round(recipe.kcal_per_serving || 0)} kcal</div>
        `;
        
        container.appendChild(recipeCard);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function initAddFoodPage() {
    // Verificar se estamos na página correta
    const mealTypeEl = document.getElementById('meal-type');
    if (!mealTypeEl) {
        return;
    }
    
    // Evitar inicialização duplicada
    if (mealTypeEl.dataset.initialized === 'true') {
        return;
    }
    mealTypeEl.dataset.initialized = 'true';
    
    // Verificar autenticação antes de carregar dados
    const authenticated = await requireAuth();
    if (!authenticated) return;
    
    // Inicializar data no input
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date') || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]);
    const mealDateInput = document.getElementById('meal-date');
    if (mealDateInput) {
        mealDateInput.value = dateParam;
    }
    
    // Carregar dados da página
    await loadPageData();
    
    renderPendingItems();
    const saveAllBtn = document.getElementById('save-all-btn');
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', submitAllMeals);
    }
    
    // Botão de favoritar refeição
    const favoriteBtn = document.getElementById('favorite-meal-btn');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', openFavoriteMealModal);
    }
    
    // Event listener para fechar modal de favoritar clicando fora
    const favoriteModal = document.getElementById('favorite-meal-modal');
    if (favoriteModal) {
        favoriteModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeFavoriteMealModal();
            }
        });
    }
    
    // Event listener para Enter no input de nome
    const favoriteMealNameInput = document.getElementById('favorite-meal-name');
    if (favoriteMealNameInput) {
        favoriteMealNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmFavoriteMeal();
            }
        });
    }
    
    // Carregar refeições completas favoritas
    loadFavoriteCompleteMeals();

    const mealTimeInput = document.getElementById('meal_time');
    if (mealTimeInput) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        mealTimeInput.value = `${hours}:${minutes}`;
        mealTimeInput.addEventListener('change', () => autoSetMealType());
        mealTimeInput.addEventListener('input', () => autoSetMealType());
    }

    const mealTypeSelect = document.getElementById('meal-type');
    if (mealTypeSelect) {
        mealTypeSelect.addEventListener('change', () => {
            userSelectedMealType = true;
        });
    }

    // ✅ Só auto-definir meal_type se não veio na URL (respeitar o que o usuário clicou no main_app)
    const mealTypeFromUrl = urlParams.get('meal_type');
    if (!mealTypeFromUrl) {
        // Se não veio meal_type na URL, auto-definir baseado no horário
        autoSetMealType(true);
    } else {
        // Se veio meal_type na URL, marcar como selecionado pelo usuário para não sobrescrever
        userSelectedMealType = true;
    }
    
    // Atualizar links de criar alimento com data e meal_type atuais
    function updateCustomFoodLinks() {
        const currentDate = document.getElementById('meal-date')?.value || pageData.date;
        const currentMealType = document.getElementById('meal-type')?.value || pageData.meal_type;
        
        const params = new URLSearchParams();
        if (currentDate) params.set('date', currentDate);
        if (currentMealType) params.set('meal_type', currentMealType);
        const queryString = params.toString() ? '?' + params.toString() : '';
        
        const createFoodBtn = document.getElementById('create-custom-food-btn');
        if (createFoodBtn) {
            createFoodBtn.href = '/criar-alimento' + queryString;
        }
        
        const scanBarcodeBtn = document.getElementById('scan-barcode-btn');
        if (scanBarcodeBtn) {
            scanBarcodeBtn.href = '/scan_barcode' + queryString;
        }
    }
    
    // Atualizar links inicialmente e quando data/meal_type mudar
    updateCustomFoodLinks();
    
    // Usar variável já existente mealDateInput (declarada acima)
    if (document.getElementById('meal-date')) {
        document.getElementById('meal-date').addEventListener('change', updateCustomFoodLinks);
    }
    if (document.getElementById('meal-type')) {
        document.getElementById('meal-type').addEventListener('change', updateCustomFoodLinks);
    }
    
    // ✅ Event listeners para as abas (movidos para dentro de initAddFoodPage)
    // Remover listeners antigos se existirem para evitar duplicação
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        // Clonar o botão para remover todos os listeners antigos
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // Adicionar listeners novamente
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // ✅ Event listeners para busca (movidos para dentro de initAddFoodPage)
    let searchInput = document.getElementById('search-input');
    if (searchInput) {
        // Remover listener antigo se existir
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        // Adicionar listener novamente
        searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch();
            }, 300);
        });
        
        // ✅ Garantir que o placeholder inicial está correto (Alimentos é a aba padrão)
        if (currentTab === 'foods') {
            searchInput.placeholder = 'Buscar alimentos...';
        }
    }
    
    // ✅ Event listeners para modal (movidos para dentro de initAddFoodPage)
    const quantityInput = document.getElementById('quantity');
    const unitSelect = document.getElementById('unit-select');
    if (quantityInput) {
        quantityInput.addEventListener('input', updateMacros);
    }
    if (unitSelect) {
        unitSelect.addEventListener('change', updateMacros);
    }
    
    // ✅ Event listener para fechar modal clicando fora
    const recipeModal = document.getElementById('recipe-modal');
    if (recipeModal) {
        recipeModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
}

// ✅ Mover modais para fora do page-root para funcionar corretamente com position: fixed
function moveModalToBody() {
    const recipeModal = document.getElementById('recipe-modal');
    if (recipeModal && recipeModal.parentElement && recipeModal.parentElement.classList.contains('page-root')) {
        document.body.appendChild(recipeModal);
    }
    
    const favoriteModal = document.getElementById('favorite-meal-modal');
    if (favoriteModal && favoriteModal.parentElement && favoriteModal.parentElement.classList.contains('page-root')) {
        document.body.appendChild(favoriteModal);
    }
}

// Executar no DOMContentLoaded (para páginas completas)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        moveModalToBody();
        initAddFoodPage();
    });
} else {
    // DOM já carregado, executar imediatamente
    moveModalToBody();
    initAddFoodPage();
}

// Também escutar eventos do SPA router
window.addEventListener('fragmentReady', function(e) {
    // Fechar e remover modal de detalhes imediatamente ao mudar de página
    const modal = document.getElementById('favorite-meal-details-modal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.classList.remove('recipe-modal-open');
        document.body.style.overflow = '';
        // Remover imediatamente do DOM
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        // Remover listeners
        if (modal._closeOnNavigation) {
            window.removeEventListener('beforeunload', modal._closeOnNavigation);
            window.removeEventListener('popstate', modal._closeOnNavigation);
            window.removeEventListener('pageChange', modal._closeOnNavigation);
            window.removeEventListener('fragmentReady', modal._closeOnNavigation);
        }
    }
    initAddFoodPage();
});
window.addEventListener('pageLoaded', function(e) {
    // Fechar e remover modal de detalhes imediatamente ao mudar de página
    const modal = document.getElementById('favorite-meal-details-modal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.classList.remove('recipe-modal-open');
        document.body.style.overflow = '';
        // Remover imediatamente do DOM
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        // Remover listeners
        if (modal._closeOnNavigation) {
            window.removeEventListener('beforeunload', modal._closeOnNavigation);
            window.removeEventListener('popstate', modal._closeOnNavigation);
            window.removeEventListener('pageChange', modal._closeOnNavigation);
            window.removeEventListener('fragmentReady', modal._closeOnNavigation);
        }
    }
    initAddFoodPage();
});

// ✅ Recarregar dados quando internet volta
window.addEventListener('reloadPageData', function(e) {
    if (e.detail && e.detail.reason === 'connection-restored') {
        // Recarregar dados da página
        if (typeof loadPageData === 'function') {
            loadPageData().catch(err => {
                console.error('[AddFood] Erro ao recarregar dados:', err);
            });
        } else {
            // Se não tiver função específica, reinicializar página
            initAddFoodPage();
        }
    }
});

// ✅ Recarregar dados quando internet volta
window.addEventListener('pageReload', function(e) {
    if (e.detail && e.detail.reason === 'connection-restored') {
        // Recarregar dados da página
        if (typeof loadPageData === 'function') {
            loadPageData();
        } else {
            // Se não tiver função específica, reinicializar página
            initAddFoodPage();
        }
    }
});

// ========== FUNCIONALIDADE DE REFEIÇÕES COMPLETAS FAVORITAS ==========

// Variável para armazenar se a refeição atual está favoritada
let currentMealFavoriteId = null;

async function checkIfCurrentMealIsFavorited() {
    if (!pendingItems || pendingItems.length === 0) {
        currentMealFavoriteId = null;
        updateFavoriteButtonState();
        return;
    }
    
    // Gerar hash único baseado nos itens para identificar a refeição
    const mealSignature = JSON.stringify(pendingItems.map(item => ({
        name: item.display_name || item.custom_meal_name,
        quantity: item.quantity || item.servings_consumed,
        unit: item.unit_name || '',
        meal_type: item.meal_type
    })).sort((a, b) => a.name.localeCompare(b.name)));
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/get_favorite_complete_meals.php`);
        if (!response) return;
        
        const result = await response.json();
        if (result.success && result.meals) {
            // Verificar se existe uma refeição favorita com os mesmos itens
            const matchingMeal = result.meals.find(meal => {
                const mealItems = meal.items || [];
                const mealSignature2 = JSON.stringify(mealItems.map(item => ({
                    name: item.display_name || item.custom_meal_name,
                    quantity: item.quantity || item.servings_consumed,
                    unit: item.unit_name || '',
                    meal_type: item.meal_type
                })).sort((a, b) => a.name.localeCompare(b.name)));
                return mealSignature === mealSignature2;
            });
            
            if (matchingMeal) {
                currentMealFavoriteId = matchingMeal.id;
            } else {
                currentMealFavoriteId = null;
            }
        }
    } catch (error) {
        console.error('Erro ao verificar se está favoritada:', error);
        currentMealFavoriteId = null;
    }
    
    updateFavoriteButtonState();
}

function updateFavoriteButtonState() {
    const favoriteBtn = document.getElementById('favorite-meal-btn');
    if (!favoriteBtn) return;
    
    if (currentMealFavoriteId) {
        favoriteBtn.classList.add('favorited');
        favoriteBtn.innerHTML = '<i class="fas fa-heart"></i> Favoritada';
    } else {
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.innerHTML = '<i class="far fa-heart"></i> Favoritar Refeição';
    }
}

function openFavoriteMealModal() {
    if (!pendingItems || pendingItems.length === 0) {
        showPendingFeedback('Adicione pelo menos um item antes de favoritar a refeição.', false);
        return;
    }
    
    // Se já está favoritada, mostrar modal de confirmação para desfavoritar
    if (currentMealFavoriteId) {
        showUnfavoriteConfirmModal();
        return;
    }
    
    // Gerar sugestão de nome baseado nos itens
    const suggestedName = pendingItems.map(item => item.display_name).join(' + ').substring(0, 50);
    const nameInput = document.getElementById('favorite-meal-name');
    if (nameInput) {
        nameInput.value = suggestedName;
    }
    
    // Abrir modal
    const modal = document.getElementById('favorite-meal-modal');
    if (modal) {
        modal.classList.add('visible');
        document.body.classList.add('recipe-modal-open');
        document.body.style.overflow = 'hidden';
        
        // Focar no input
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }, 100);
    }
}

function closeFavoriteMealModal() {
    const modal = document.getElementById('favorite-meal-modal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.classList.remove('recipe-modal-open');
        document.body.style.overflow = '';
    }
    
    // Limpar input
    const nameInput = document.getElementById('favorite-meal-name');
    if (nameInput) {
        nameInput.value = '';
    }
    
    // Restaurar conteúdo original do modal
    restoreFavoriteModalContent();
}

function showUnfavoriteConfirmModal() {
    const modal = document.getElementById('favorite-meal-modal');
    const modalTitle = document.getElementById('favorite-modal-title');
    const modalBody = document.getElementById('favorite-modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    // Salvar conteúdo original
    if (!modalBody.dataset.originalContent) {
        modalBody.dataset.originalContent = modalBody.innerHTML;
    }
    
    // Alterar conteúdo para confirmação de desfavoritar
    modalTitle.textContent = 'Remover dos Favoritos';
    modalTitle.style.textAlign = 'center';
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <i class="fas fa-heart-broken" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 16px;"></i>
            <p style="color: var(--text-primary); font-size: 16px; margin-bottom: 8px; font-weight: 600;">
                Deseja remover esta refeição dos favoritos?
            </p>
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">
                Você poderá favoritá-la novamente depois.
            </p>
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button class="btn-cancel-favorite" onclick="closeFavoriteMealModal()" style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; color: var(--text-primary); font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                    Cancelar
                </button>
                <button class="btn-confirm-unfavorite" onclick="confirmUnfavoriteMeal()" style="flex: 1; padding: 12px; background: rgba(255, 0, 0, 0.2); border: 1px solid rgba(255, 0, 0, 0.4); border-radius: 12px; color: #ff4444; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
    `;
    
    // Adicionar hover ao botão de remover
    const removeBtn = modalBody.querySelector('.btn-confirm-unfavorite');
    if (removeBtn) {
        removeBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 0, 0, 0.3)';
            this.style.borderColor = 'rgba(255, 0, 0, 0.5)';
        });
        removeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 0, 0, 0.2)';
            this.style.borderColor = 'rgba(255, 0, 0, 0.4)';
        });
    }
    
    // Abrir modal
    modal.classList.add('visible');
    document.body.classList.add('recipe-modal-open');
    document.body.style.overflow = 'hidden';
}

function restoreFavoriteModalContent() {
    const modalBody = document.getElementById('favorite-modal-body');
    const modalTitle = document.getElementById('favorite-modal-title');
    
    if (modalBody && modalBody.dataset.originalContent) {
        modalBody.innerHTML = modalBody.dataset.originalContent;
    }
    
    if (modalTitle) {
        modalTitle.textContent = 'Favoritar Refeição';
        modalTitle.style.textAlign = 'center';
    }
}

async function confirmUnfavoriteMeal() {
    if (!currentMealFavoriteId) {
        closeFavoriteMealModal();
        return;
    }
    
    closeFavoriteMealModal();
    
    const favoriteBtn = document.getElementById('favorite-meal-btn');
    if (favoriteBtn) {
        favoriteBtn.disabled = true;
        favoriteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removendo...';
    }
    
    try {
        await deleteFavoriteCompleteMeal(currentMealFavoriteId);
        currentMealFavoriteId = null;
        updateFavoriteButtonState();
        // Recarregar lista de favoritas (vai esconder a seção se não houver mais refeições)
        await loadFavoriteCompleteMeals();
        showPendingFeedback('Refeição removida dos favoritos.', true);
    } catch (error) {
        console.error('Erro ao remover favorito:', error);
        showPendingFeedback(error.message || 'Erro ao remover dos favoritos. Tente novamente.', false);
    } finally {
        if (favoriteBtn) {
            favoriteBtn.disabled = false;
            updateFavoriteButtonState();
        }
    }
}

function showDeleteFavoriteMealModal(mealId) {
    const modal = document.getElementById('favorite-meal-modal');
    const modalTitle = document.getElementById('favorite-modal-title');
    const modalBody = document.getElementById('favorite-modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    // Salvar conteúdo original se ainda não foi salvo
    if (!modalBody.dataset.originalContent) {
        modalBody.dataset.originalContent = modalBody.innerHTML;
    }
    
    // Alterar conteúdo para confirmação de deleção
    modalTitle.textContent = 'Remover dos Favoritos';
    modalTitle.style.textAlign = 'center';
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <i class="fas fa-trash-alt" style="font-size: 48px; color: #ff4444; margin-bottom: 16px;"></i>
            <p style="color: var(--text-primary); font-size: 16px; margin-bottom: 8px; font-weight: 600;">
                Tem certeza que deseja remover esta refeição dos favoritos?
            </p>
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">
                Esta ação não pode ser desfeita.
            </p>
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button class="btn-cancel-favorite" onclick="closeFavoriteMealModal()" style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; color: var(--text-primary); font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                    Cancelar
                </button>
                <button class="btn-confirm-delete" onclick="confirmDeleteFavoriteMeal(${mealId})" style="flex: 1; padding: 12px; background: rgba(255, 0, 0, 0.2); border: 1px solid rgba(255, 0, 0, 0.4); border-radius: 12px; color: #ff4444; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
    `;
    
    // Adicionar hover ao botão de remover
    const removeBtn = modalBody.querySelector('.btn-confirm-delete');
    if (removeBtn) {
        removeBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 0, 0, 0.3)';
            this.style.borderColor = 'rgba(255, 0, 0, 0.5)';
        });
        removeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 0, 0, 0.2)';
            this.style.borderColor = 'rgba(255, 0, 0, 0.4)';
        });
    }
    
    // Abrir modal
    modal.classList.add('visible');
    document.body.classList.add('recipe-modal-open');
    document.body.style.overflow = 'hidden';
}

async function confirmDeleteFavoriteMeal(mealId) {
    closeFavoriteMealModal();
    
    try {
        await deleteFavoriteCompleteMeal(mealId);
        
        // Se era a refeição atual, atualizar estado
        if (currentMealFavoriteId === mealId) {
            currentMealFavoriteId = null;
            updateFavoriteButtonState();
        }
        
        // Recarregar lista de favoritas (vai esconder a seção se não houver mais refeições)
        await loadFavoriteCompleteMeals();
        
        showPendingFeedback('Refeição removida dos favoritos.', true);
    } catch (error) {
        console.error('Erro ao remover refeição favorita:', error);
        showPendingFeedback(error.message || 'Erro ao remover refeição. Tente novamente.', false);
    }
}

async function confirmFavoriteMeal() {
    const nameInput = document.getElementById('favorite-meal-name');
    if (!nameInput) return;
    
    const mealName = nameInput.value.trim();
    
    if (!mealName || mealName === '') {
        showPendingFeedback('Por favor, digite um nome para a refeição.', false);
        nameInput.focus();
        return;
    }
    
    if (!pendingItems || pendingItems.length === 0) {
        showPendingFeedback('Adicione pelo menos um item antes de favoritar a refeição.', false);
        closeFavoriteMealModal();
        return;
    }
    
    // Verificar se todos os itens têm o mesmo tipo de refeição
    const firstItem = pendingItems[0];
    const mealType = firstItem.meal_type;
    
    // Fechar modal
    closeFavoriteMealModal();
    
    const favoriteBtn = document.getElementById('favorite-meal-btn');
    if (favoriteBtn) {
        favoriteBtn.disabled = true;
        favoriteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    }
    
    try {
        const payload = {
            meal_name: mealName.trim(),
            meal_type: mealType,
            items: pendingItems.map(item => ({
                display_name: item.display_name,
                custom_meal_name: item.custom_meal_name,
                is_food: item.is_food,
                food_name: item.food_name,
                recipe_id: item.recipe_id || '',
                meal_type: item.meal_type,
                meal_time: item.meal_time,
                servings_consumed: item.servings_consumed,
                quantity: item.quantity,
                unit_id: item.unit_id || '',
                unit_name: item.unit_name || '',
                kcal_per_serving: item.kcal_per_serving,
                protein_per_serving: item.protein_per_serving,
                carbs_per_serving: item.carbs_per_serving,
                fat_per_serving: item.fat_per_serving,
                total_kcal: item.total_kcal,
                total_protein: item.total_protein,
                total_carbs: item.total_carbs,
                total_fat: item.total_fat
            }))
        };
        
        const response = await authenticatedFetch(`${window.API_BASE_URL}/save_favorite_complete_meal.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response) {
            throw new Error('Não autenticado');
        }
        
        const data = await response.json();
        
        if (data.success) {
            showPendingFeedback('Refeição favoritada com sucesso! Você pode carregá-la depois.', true);
            // Atualizar estado de favoritada
            currentMealFavoriteId = data.meal_id;
            updateFavoriteButtonState();
            // Recarregar lista de favoritas
            loadFavoriteCompleteMeals();
        } else {
            throw new Error(data.message || 'Erro ao favoritar refeição');
        }
    } catch (error) {
        console.error('Erro ao favoritar refeição:', error);
        showPendingFeedback(error.message || 'Erro ao favoritar refeição. Tente novamente.', false);
    } finally {
        if (favoriteBtn) {
            favoriteBtn.disabled = false;
            updateFavoriteButtonState();
        }
    }
}

async function loadFavoriteCompleteMeals() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/get_favorite_complete_meals.php`);
        
        if (!response) {
            return;
        }
        
        const result = await response.json();
        
        const sectionEl = document.getElementById('favorite-complete-meals-section');
        
        if (result.success && result.meals && result.meals.length > 0) {
            cachedFavoriteMeals = result.meals; // Armazenar para uso no modal
            renderFavoriteCompleteMeals(result.meals);
            if (sectionEl) {
                sectionEl.style.display = 'block';
            }
        } else {
            cachedFavoriteMeals = [];
            // Esconder seção se não houver refeições
            if (sectionEl) {
                sectionEl.style.display = 'none';
            }
            // Limpar container
            const container = document.getElementById('favorite-complete-meals');
            if (container) {
                container.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar refeições favoritas completas:', error);
        cachedFavoriteMeals = [];
        // Esconder seção em caso de erro
        const sectionEl = document.getElementById('favorite-complete-meals-section');
        if (sectionEl) {
            sectionEl.style.display = 'none';
        }
    }
}

// Melhorar: armazenar meals globalmente para acesso
let cachedFavoriteMeals = [];

function renderFavoriteCompleteMeals(meals) {
    const container = document.getElementById('favorite-complete-meals');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!meals || meals.length === 0) {
        return;
    }
    
    meals.forEach((meal, index) => {
        const mealCard = document.createElement('div');
        mealCard.className = 'recipe-card';
        mealCard.style.cssText = 'width: 160px; min-width: 160px; min-height: 240px; flex-shrink: 0; scroll-snap-align: start; cursor: pointer; position: relative; display: flex; flex-direction: column;';
        
        const itemCount = meal.items ? meal.items.length : 0;
        
        // Card para carrossel - nome completo visível, botões sempre alinhados, altura fixa
        mealCard.innerHTML = `
            <div style="background: linear-gradient(135deg, rgba(255, 107, 0, 0.1), rgba(255, 140, 0, 0.05)); border-radius: 10px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; min-height: 60px; flex-shrink: 0;">
                <div style="text-align: center;">
                    <i class="fas fa-heart" style="font-size: 24px; color: var(--accent-orange); margin-bottom: 6px; display: block;"></i>
                    <div style="background: rgba(255, 107, 0, 0.9); color: white; padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 600; display: inline-block;">
                        ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}
                    </div>
                </div>
            </div>
            <div style="flex-grow: 1; display: flex; flex-direction: column; min-height: 0;">
                <h3 class="recipe-name" style="font-size: 14px; margin-bottom: 6px; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word; flex-grow: 0; min-height: 36px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(meal.meal_name)}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; flex-grow: 0;">
                    <p class="recipe-macros" style="font-size: 11px; margin: 0;">
                        P: ${Math.round(meal.total_protein || 0)}g | C: ${Math.round(meal.total_carbs || 0)}g | G: ${Math.round(meal.total_fat || 0)}g
                    </p>
                    <div class="recipe-kcal" style="font-size: 12px; font-weight: 600; color: var(--accent-orange);">${Math.round(meal.total_kcal || 0)} kcal</div>
                </div>
                <div style="display: flex; gap: 6px; margin-top: auto; padding-top: 8px; flex-shrink: 0;">
                    <button class="btn-load-favorite-meal" data-meal-id="${meal.id}" style="flex: 1; padding: 6px; background: var(--accent-orange); color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; z-index: 10; position: relative;">
                        <i class="fas fa-plus"></i> Carregar
                    </button>
                    <button class="btn-delete-favorite-meal" data-meal-id="${meal.id}" style="padding: 6px 10px; background: rgba(255, 0, 0, 0.1); color: #ff4444; border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s ease; z-index: 10; position: relative;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Clique no card (exceto nos botões) abre modal de detalhes
        mealCard.addEventListener('click', (e) => {
            // Se clicou em um botão, não abrir modal
            if (e.target.closest('.btn-load-favorite-meal') || e.target.closest('.btn-delete-favorite-meal')) {
                return;
            }
            showFavoriteMealDetailsModal(meal);
        });
        
        // Event listener para carregar refeição
        const loadBtn = mealCard.querySelector('.btn-load-favorite-meal');
        if (loadBtn) {
            loadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadFavoriteCompleteMeal(meal);
            });
        }
        
        // Event listener para deletar refeição
        const deleteBtn = mealCard.querySelector('.btn-delete-favorite-meal');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Usar modal customizado para confirmar deleção
                showDeleteFavoriteMealModal(meal.id);
            });
        }
        
        container.appendChild(mealCard);
    });
}

function showFavoriteMealDetailsModal(meal) {
    // Verificar se estamos na página correta
    const mealTypeEl = document.getElementById('meal-type');
    if (!mealTypeEl) {
        // Não estamos na página de adicionar refeição, não mostrar modal
        return;
    }
    
    let modal = document.getElementById('favorite-meal-details-modal');
    if (!modal) {
        // Criar modal se não existir
        createFavoriteMealDetailsModal();
        modal = document.getElementById('favorite-meal-details-modal');
    }
    
    if (!modal) return;
    
    const modalTitle = document.getElementById('favorite-meal-details-title');
    const modalBody = document.getElementById('favorite-meal-details-body');
    
    if (!modalTitle || !modalBody) return;
    
    modalTitle.textContent = meal.meal_name;
    
    const itemCount = meal.items ? meal.items.length : 0;
    let itemsHtml = '';
    
    if (meal.items && meal.items.length > 0) {
        itemsHtml = meal.items.map(item => {
            const itemName = item.display_name || item.custom_meal_name || 'Item sem nome';
            const quantity = item.quantity || item.servings_consumed || 1;
            const unit = item.unit_name || '';
            const quantityText = unit ? `${quantity} ${unit}` : `${quantity} porção(ões)`;
            
            return `
                <div style="padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${escapeHtml(itemName)}</span>
                        <span style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(quantityText)}</span>
                    </div>
                    <div style="display: flex; gap: 12px; font-size: 11px; color: var(--text-secondary);">
                        <span>${Math.round(item.total_kcal || 0)} kcal</span>
                        <span>P: ${Math.round(item.total_protein || 0)}g</span>
                        <span>C: ${Math.round(item.total_carbs || 0)}g</span>
                        <span>G: ${Math.round(item.total_fat || 0)}g</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        itemsHtml = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Nenhum item encontrado nesta refeição.</p>';
    }
    
    const modalFooter = document.getElementById('favorite-meal-details-footer');
    
    modalBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px; background: rgba(255, 107, 0, 0.1); border-radius: 8px;">
                <div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total da Refeição</div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--accent-orange);">${Math.round(meal.total_kcal || 0)} kcal</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Macros</div>
                    <div style="font-size: 13px; color: var(--text-primary);">
                        P: ${Math.round(meal.total_protein || 0)}g | 
                        C: ${Math.round(meal.total_carbs || 0)}g | 
                        G: ${Math.round(meal.total_fat || 0)}g
                    </div>
                </div>
            </div>
            <div style="margin-bottom: 12px;">
                <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
                    <i class="fas fa-list" style="margin-right: 8px; color: var(--accent-orange);"></i>
                    Itens (${itemCount})
                </h4>
                ${itemsHtml}
            </div>
        </div>
    `;
    
    // Botões sempre visíveis no footer
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button onclick="closeFavoriteMealDetailsModal()" style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; color: var(--text-primary); font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                Fechar
            </button>
            <button onclick="loadFavoriteMealFromDetails(${meal.id})" style="flex: 1; padding: 12px; background: var(--accent-orange); border: none; border-radius: 12px; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                <i class="fas fa-plus"></i> Carregar Refeição
            </button>
        `;
    }
    
    modal.classList.add('visible');
    document.body.classList.add('recipe-modal-open');
    document.body.style.overflow = 'hidden';
}

function createFavoriteMealDetailsModal() {
    const modal = document.createElement('div');
    modal.className = 'recipe-modal';
    modal.id = 'favorite-meal-details-modal';
    modal.innerHTML = `
        <div class="modal-content" style="display: flex; flex-direction: column; max-height: 90vh;">
            <div class="modal-header" style="position: relative; padding: 20px 50px 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;">
                <h2 class="modal-title" id="favorite-meal-details-title" style="text-align: center; margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary); padding: 0 10px; word-wrap: break-word; overflow-wrap: break-word;">Detalhes da Refeição</h2>
                <button class="modal-close-btn" onclick="closeFavoriteMealDetailsModal()" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--text-primary); font-size: 20px; cursor: pointer; padding: 8px; border-radius: 8px; transition: all 0.2s ease; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; z-index: 10;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" id="favorite-meal-details-body" style="padding: 20px; overflow-y: auto; flex: 1; min-height: 0;"></div>
            <div class="modal-footer" id="favorite-meal-details-footer" style="padding: 16px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0; display: flex; gap: 12px;"></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Fechar modal quando sair da página
    const closeOnNavigation = () => {
        closeFavoriteMealDetailsModal();
    };
    
    // Listener para mudanças de rota SPA
    window.addEventListener('beforeunload', closeOnNavigation);
    window.addEventListener('popstate', closeOnNavigation);
    
    // Listener para eventos customizados de navegação SPA
    window.addEventListener('pageChange', closeOnNavigation);
    window.addEventListener('fragmentReady', closeOnNavigation);
    
    // Armazenar função de limpeza no modal
    modal._closeOnNavigation = closeOnNavigation;
}

function closeFavoriteMealDetailsModal() {
    const modal = document.getElementById('favorite-meal-details-modal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.classList.remove('recipe-modal-open');
        document.body.style.overflow = '';
        
        // Remover listeners de navegação se existirem
        if (modal._closeOnNavigation) {
            window.removeEventListener('beforeunload', modal._closeOnNavigation);
            window.removeEventListener('popstate', modal._closeOnNavigation);
            window.removeEventListener('pageChange', modal._closeOnNavigation);
            window.removeEventListener('fragmentReady', modal._closeOnNavigation);
        }
        
        // Remover modal do DOM após animação
        setTimeout(() => {
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300); // Tempo da animação de fade
    }
}

function loadFavoriteMealFromDetails(mealId) {
    const meal = cachedFavoriteMeals.find(m => m.id === mealId);
    if (meal) {
        closeFavoriteMealDetailsModal();
        loadFavoriteCompleteMeal(meal);
    }
}

function loadFavoriteCompleteMeal(meal) {
    if (!meal.items || meal.items.length === 0) {
        showPendingFeedback('Esta refeição favorita não possui itens.', false);
        return;
    }
    
    // Limpar itens pendentes atuais ou adicionar aos existentes?
    // Vou adicionar aos existentes para permitir combinar refeições
    const currentDate = document.getElementById('meal-date')?.value || new Date().toISOString().split('T')[0];
    const currentMealType = document.getElementById('meal-type')?.value || meal.meal_type;
    
    // Adicionar cada item da refeição favorita ao pendingItems
    meal.items.forEach(item => {
        const pendingItem = {
            id: Date.now() + Math.random(),
            display_name: item.display_name || item.custom_meal_name,
            custom_meal_name: item.custom_meal_name,
            is_food: item.is_food || 0,
            food_name: item.food_name || '',
            recipe_id: item.recipe_id || '',
            meal_type: currentMealType, // Usar tipo atual
            meal_type_label: getMealTypeLabel(currentMealType),
            meal_time: item.meal_time || document.getElementById('meal_time')?.value || '',
            meal_time_label: item.meal_time || 'Sem horário',
            date_consumed: currentDate, // Usar data atual
            servings_consumed: item.servings_consumed || item.quantity || 1,
            quantity: item.quantity || item.servings_consumed || 1,
            unit_id: item.unit_id || '',
            unit_name: item.unit_name || '',
            kcal_per_serving: item.kcal_per_serving || 0,
            protein_per_serving: item.protein_per_serving || 0,
            carbs_per_serving: item.carbs_per_serving || 0,
            fat_per_serving: item.fat_per_serving || 0,
            total_kcal: item.total_kcal || 0,
            total_protein: item.total_protein || 0,
            total_carbs: item.total_carbs || 0,
            total_fat: item.total_fat || 0
        };
        
        pendingItems.push(pendingItem);
    });
    
    renderPendingItems();
    showPendingFeedback(`${meal.items.length} item(ns) adicionado(s) à lista. Você pode editar as quantidades antes de salvar.`, true);
    
    // Verificar se está favoritada após carregar
    checkIfCurrentMealIsFavorited();
    
    // Scroll para a seção de itens pendentes
    const pendingSection = document.querySelector('.pending-section');
    if (pendingSection) {
        pendingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function getMealTypeLabel(mealType) {
    const labels = {
        'breakfast': 'Café da Manhã',
        'morning_snack': 'Lanche da Manhã',
        'lunch': 'Almoço',
        'afternoon_snack': 'Lanche da Tarde',
        'dinner': 'Jantar',
        'supper': 'Ceia'
    };
    return labels[mealType] || mealType;
}

async function deleteFavoriteCompleteMeal(mealId) {
    const response = await authenticatedFetch(`${window.API_BASE_URL}/delete_favorite_complete_meal.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ meal_id: mealId })
    });
    
    if (!response) {
        throw new Error('Não autenticado');
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.message || 'Erro ao remover refeição');
    }
    
    return data;
}

// Expor funções globalmente para onclick no HTML
window.confirmMeal = confirmMeal;
window.performSearch = performSearch;
window.selectRecipe = selectRecipe;
window.removePendingItem = removePendingItem;
window.closeModal = closeModal;
window.openFavoriteMealModal = openFavoriteMealModal;
window.closeFavoriteMealModal = closeFavoriteMealModal;
window.confirmFavoriteMeal = confirmFavoriteMeal;
window.confirmUnfavoriteMeal = confirmUnfavoriteMeal;
window.confirmDeleteFavoriteMeal = confirmDeleteFavoriteMeal;
window.closeFavoriteMealDetailsModal = closeFavoriteMealDetailsModal;
window.loadFavoriteMealFromDetails = loadFavoriteMealFromDetails;

})();
