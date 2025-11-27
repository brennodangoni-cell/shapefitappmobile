
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

let selectedRecipe = null;
let pendingItems = [];
let userSelectedMealType = false;

function selectRecipe(recipe) {
    console.log('🎯 SELECT RECIPE - INÍCIO');
    console.log('Recipe recebido:', recipe);
    console.log('É alimento?', recipe.is_food);
    
    selectedRecipe = {
        ...recipe,
        is_food: recipe.is_food === true
    };
    document.getElementById('modal-recipe-name').textContent = selectedRecipe.name;
    document.getElementById('selected-recipe-id').value = selectedRecipe.id;
    
    // Preencher nome da refeição automaticamente
    document.getElementById('custom_meal_name').value = selectedRecipe.name;
    
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
        console.log('🍎 É ALIMENTO - Carregando unidades específicas');
        // Para alimentos, mostrar seletor de unidade
        unitSelect.style.display = 'block';
        quantityLabel.textContent = 'Quantidade';
        document.getElementById('quantity').classList.remove('quantity-input-full-width');
        loadUnitsForFood(selectedRecipe.id, '0');
    } else {
        console.log('📝 É RECEITA - Ocultando seletor de unidades');
        // Para receitas, ocultar seletor de unidade e usar "porções"
        unitSelect.style.display = 'none';
        quantityLabel.textContent = 'Porções';
        document.getElementById('quantity').classList.add('quantity-input-full-width');
        updateMacros(); // Usar cálculo direto para receitas
    }
    
    // Mostrar modal
    document.getElementById('recipe-modal').classList.add('visible');
    console.log('✅ Modal aberto');
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
        console.warn('⏭️ Quantidade inválida para cálculo', quantity);
        document.getElementById('total-kcal').innerHTML = '0 <span class="nutrition-item-unit">kcal</span>';
        document.getElementById('total-protein').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-carbs').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
        document.getElementById('total-fat').innerHTML = '0 <span class="nutrition-item-unit">g</span>';
        document.getElementById('conversion-info').textContent = '';
        document.getElementById('quantity-info').style.display = 'none';
        return;
    }
    
    console.log('📐 Calculando nutrição', { numericFoodId, unitId, quantity, isFood: selectedRecipe.is_food });
    
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
    console.log('📦 Payload enviado para cálculo:', debugPayload);
    
    authenticatedFetch(`/api/calculate_nutrition.php`, {
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

    // Adicione esta linha para resetar a posição do modal
    modalContent.style.transform = ''; 

    resetModalState();
    selectedRecipe = null;
}

function loadUnitsForFood(foodId, isRecipe) {
    console.log('🔍 LOAD UNITS FOR FOOD - INÍCIO');
    console.log('Food ID original:', foodId);
    console.log('Is Recipe:', isRecipe);
    
    // Extrair o número do ID se vier com prefixo (ex: "taco_66" -> "66")
    const numericId = extractNumericId(foodId);
    if (!numericId) {
        console.error('❌ ID inválido após extração:', foodId);
        loadDefaultUnits(() => updateMacros());
        return;
    }
    
    console.log('✅ Food ID numérico final:', numericId);
    
    const unitSelect = document.getElementById('unit-select');
    unitSelect.innerHTML = '<option value="">Carregando...</option>';
    
    const url = `/api/get_units.php?action=for_food&food_id=${numericId}`;
    console.log('URL da API:', url);
    
    authenticatedFetch(url)
    .then(response => {
        if (!response) throw new Error('Não autenticado');
        console.log('📡 Resposta da API recebida:', response.status);
        if (!response.ok) {
            throw new Error(`Erro na rede: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('📊 Dados da API:', data);
        
        // VERIFICAÇÃO DE SEGURANÇA: Garante que 'data' e 'data.data' existam e que a lista não esteja vazia
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
            console.log('✅ Unidades encontradas:', data.data.length);
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
            console.log('⚠️ Nenhuma unidade específica. Carregando unidades padrão.');
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
    console.log('🚫 Exibindo mensagem de alimento não classificado.');
    
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
    console.log('🔄 LOAD DEFAULT UNITS - INÍCIO');
    
    const unitSelect = document.getElementById('unit-select');
    const url = `/api/get_units.php?action=all`;
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
            console.log('✅ Carregando unidades padrão + todas as unidades');
            unitSelect.innerHTML = '';
            
            // Adicionar unidades padrão com IDs reais do banco
            const defaultUnits = [
                { id: '26', name: 'Grama', abbreviation: 'g' }, // ID real do banco
                { id: '28', name: 'Mililitro', abbreviation: 'ml' }, // ID real do banco  
                { id: '31', name: 'Unidade', abbreviation: 'un' } // ID real do banco
            ];
            
            console.log('➕ Adicionando unidades padrão:', defaultUnits);
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
            console.log('➕ Adicionando outras unidades:', data.data);
            data.data.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = `${unit.name} (${unit.abbreviation})`;
                unitSelect.appendChild(option);
            });
            
            if (!unitSelect.value && unitSelect.options.length > 0) {
                unitSelect.selectedIndex = 0;
            }
            
            console.log('🎯 Total de opções no select:', unitSelect.options.length);
            updateMacros();
            if (typeof onComplete === 'function') {
                onComplete();
            }
        } else {
            console.log('❌ Falha ao carregar unidades padrão');
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

    const pendingItem = {
        id: Date.now() + Math.random(),
        display_name: customMealName,
        custom_meal_name: customMealName,
        is_food: selectedRecipe.is_food ? 1 : 0,
        food_name: selectedRecipe.is_food ? selectedRecipe.name : '',
        recipe_id: selectedRecipe.is_food ? '' : selectedRecipe.id,
        meal_type: mealType,
        meal_type_label: mealTypeLabel,
        meal_time: mealTime,
        meal_time_label: mealTime || 'Sem horário',
        date_consumed: dateConsumed,
        servings_consumed: selectedRecipe.is_food ? 1 : quantity,
        quantity: quantity,
        unit_id: selectedRecipe.is_food ? unitId : '',
        unit_name: unitLabel,
        kcal_per_serving: selectedRecipe.is_food ? totalKcal : selectedRecipe.kcal_per_serving,
        protein_per_serving: selectedRecipe.is_food ? totalProtein : selectedRecipe.protein_g_per_serving,
        carbs_per_serving: selectedRecipe.is_food ? totalCarbs : selectedRecipe.carbs_g_per_serving,
        fat_per_serving: selectedRecipe.is_food ? totalFat : selectedRecipe.fat_g_per_serving,
        total_kcal: totalKcal,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fat: totalFat
    };

    pendingItems.push(pendingItem);
    renderPendingItems();
    showPendingFeedback('Refeição adicionada à lista. Clique em "Salvar no Diário" para registrar tudo de uma vez.', true);

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
}

function removePendingItem(index) {
    pendingItems.splice(index, 1);
    renderPendingItems();
    showPendingFeedback('Item removido da lista.', true);
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
        
        const response = await authenticatedFetch(`/api/log_meal_batch.php`, {
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
            showPendingFeedback('Refeições registradas com sucesso! Redirecionando...', true);
            const dateConsumed = pendingItems[0]?.date_consumed || new Date().toISOString().split('T')[0];
            
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

let currentTab = 'recipes';
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
        const response = await authenticatedFetch(`/api/ajax_search_foods_recipes.php?term=${encodeURIComponent(query)}&type=recipes`);
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
        const response = await authenticatedFetch(`/api/ajax_search_food.php?term=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displaySearchResults(data.data, 'food');
        } else {
            clearSearchResults();
        }
    } catch (error) {
        console.error('Erro ao buscar alimentos:', error);
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
    console.log('🎯 SELECT SEARCH RESULT - INÍCIO');
    console.log('Item selecionado:', item);
    console.log('Tipo:', type);
    
    if (type === 'recipe') {
        console.log('📝 Processando como RECEITA');
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
        console.log('📝 Receita formatada:', recipe);
        selectRecipe(recipe);
    } else {
        console.log('🍎 Processando como ALIMENTO');
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
        console.log('🍎 Alimento formatado:', food);
        selectRecipe(food); // Usar a mesma função, mas marcando como alimento
    }
    
    clearSearchResults();
    document.getElementById('search-input').value = '';
}

// Event listeners
document.getElementById('quantity').addEventListener('input', updateMacros);
document.getElementById('unit-select').addEventListener('change', updateMacros);

// Event listeners para as abas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

// Busca em tempo real
document.getElementById('search-input').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch();
    }, 300);
});


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
    console.log('[AddFood] loadPageData iniciado');
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const date = urlParams.get('date') || pageData.date;
        const mealType = urlParams.get('meal_type') || pageData.meal_type;
        
        console.log('[AddFood] Buscando dados:', { date, mealType });
        
        const response = await authenticatedFetch(`/api/get_add_food_data.php?date=${date}&meal_type=${mealType}`);
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
        console.log('[AddFood] Dados recebidos:', pageData);
        
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
        
        // Atualizar botão de voltar
        document.getElementById('back-btn').href = `${BASE_URL}/diary.php?date=${pageData.date}`;
        
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
        console.error('Erro ao carregar dados da página:', error);
    }
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
        
        const imageUrl = recipe.image_filename 
            ? `${IMAGES_BASE_URL}/assets/images/recipes/${recipe.image_filename}`
            : `${IMAGES_BASE_URL}/assets/images/recipes/placeholder_food.jpg`;
        
        recipeCard.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHtml(recipe.name)}" class="recipe-image">
            <h3 class="recipe-name">${escapeHtml(recipe.name)}</h3>
            <p class="recipe-macros">
                P: ${Math.round(recipe.protein_g_per_serving || 0)}g | 
                C: ${Math.round(recipe.carbs_g_per_serving || 0)}g | 
                G: ${Math.round(recipe.fat_g_per_serving || 0)}g
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
    console.log('[AddFood] initAddFoodPage chamado');
    
    // Verificar se estamos na página correta
    const mealTypeEl = document.getElementById('meal-type');
    if (!mealTypeEl) {
        console.log('[AddFood] Não é a página de adicionar refeição, ignorando');
        return;
    }
    
    // Evitar inicialização duplicada
    if (mealTypeEl.dataset.initialized === 'true') {
        console.log('[AddFood] Já inicializado, ignorando');
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

    autoSetMealType(true);
    
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
}

// Executar no DOMContentLoaded (para páginas completas)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAddFoodPage);
} else {
    // DOM já carregado, executar imediatamente
    initAddFoodPage();
}

// Também escutar eventos do SPA router
window.addEventListener('fragmentReady', initAddFoodPage);
window.addEventListener('pageLoaded', initAddFoodPage);

// Expor funções globalmente para onclick no HTML
window.confirmMeal = confirmMeal;
window.performSearch = performSearch;
window.selectRecipe = selectRecipe;

})();
