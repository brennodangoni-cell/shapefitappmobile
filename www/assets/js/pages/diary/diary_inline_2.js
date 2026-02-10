
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
        // ✅ REMOVER MODAIS IMEDIATAMENTE AO CARREGAR O SCRIPT (ANTES DE QUALQUER COISA)
        // Isso evita que modais apareçam durante a transição do SPA
        (function cleanupModals() {
            const allModals = document.querySelectorAll('.meal-group-modal-overlay, .recipe-modal, .modal-overlay');
            allModals.forEach(modal => {
                modal.classList.remove('visible');
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
                modal.style.pointerEvents = 'none';
                if (modal.parentNode) {
                    modal.remove();
                }
            });
            document.body.classList.remove('modal-open', 'recipe-modal-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        })();
        
        // Verificar autenticação antes de carregar dados
        (async function() {
            try {
                if (typeof requireAuth !== 'function') {
                    return;
                }
            const authenticated = await requireAuth();
            if (!authenticated) {
                return; // Já redirecionou para login
                }
            } catch (e) {
                console.error('ERRO na autenticação:', e);
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
    // Garantir que todos os modais estejam fechados ao carregar
    const allModals = document.querySelectorAll('.meal-group-modal-overlay, .recipe-modal, .modal-overlay');
    allModals.forEach(modal => {
        modal.classList.remove('visible');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        // Remover do DOM completamente
        if (modal.parentNode) {
            modal.remove();
        }
    });
    document.body.classList.remove('modal-open', 'recipe-modal-open');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    
    // Resetar flag de listeners para garantir que sejam reconfigurados após SPA recarregar
    mealEditListenersSetup = false;
    
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
        
        // Processar e armazenar dados ANTES de renderizar
        let processedGroups = {};
        if (Array.isArray(mealGroups)) {
            mealGroups.forEach(group => {
                if (group && group.type && Array.isArray(group.meals)) {
                    processedGroups[group.type] = group.meals;
                }
            });
        } else if (mealGroups && typeof mealGroups === 'object') {
            processedGroups = mealGroups;
        }
        // Atualizar currentMealGroupsData ANTES de renderizar para garantir que esteja disponível
        currentMealGroupsData = processedGroups;
        
        renderMeals(mealGroups, mealTypes);
        
        // Garantir que os listeners estejam configurados após renderizar (com pequeno delay para garantir DOM atualizado)
        setTimeout(() => {
            setupMealEditListeners();
        }, 50);
        
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
        
        // ✅ PÁGINA PRONTA - Remover skeleton
        if (window.PageLoader) window.PageLoader.ready();
        
    } catch (error) {
        console.error('Erro ao carregar dados do diário:', error);
        document.getElementById('meals-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar dados</h3>
                <p>${error.message}</p>
            </div>
        `;
        // ✅ Mesmo com erro, remover skeleton
        if (window.PageLoader) window.PageLoader.ready();
    }
}

// Armazenar mealGroups globalmente para acesso nos event listeners
let currentMealGroupsData = {};

// Adicionar listener no container pai uma única vez
let mealEditListenersSetup = false;

function setupMealEditListeners() {
    const mealsList = document.getElementById('meals-list');
    if (!mealsList) {
        // Se ainda não existe, tentar novamente depois
        setTimeout(setupMealEditListeners, 100);
        return;
    }
    
    // Se já configurado, remover listener antigo e adicionar novo (para garantir que funcione após SPA recarregar)
    if (mealEditListenersSetup && mealsList._mealEditHandler) {
        mealsList.removeEventListener('click', mealsList._mealEditHandler);
    }
    
    // Criar handler único para event delegation
    const mealEditHandler = function(e) {
        const editBtn = e.target.closest('.meal-group-edit-btn[data-meal-type-btn]');
        if (editBtn) {
            e.stopPropagation();
            e.preventDefault();
            const mealType = editBtn.dataset.mealTypeBtn;
            
            // Buscar meals de currentMealGroupsData
            let meals = currentMealGroupsData[mealType] || [];
            
            // Se não encontrou, aguardar um pouco e tentar novamente (pode estar sendo atualizado)
            if (meals.length === 0) {
                // Pequeno delay para garantir que currentMealGroupsData foi atualizado
                setTimeout(() => {
                    meals = currentMealGroupsData[mealType] || [];
                    if (meals.length > 0) {
                        openMealGroupModal(mealType, meals);
                    }
                }, 50);
                return;
            }
            
            openMealGroupModal(mealType, meals);
            return;
        }
        
        // Event delegation para headers (clicar no título abre modal)
        const header = e.target.closest('.meal-group-header[data-meal-type]');
        if (header && !e.target.closest('.meal-group-edit-btn')) {
            e.stopPropagation();
            e.preventDefault();
            const mealType = header.dataset.mealType;
            let meals = currentMealGroupsData[mealType] || [];
            
            // Se não encontrou, aguardar um pouco e tentar novamente
            if (meals.length === 0) {
                setTimeout(() => {
                    meals = currentMealGroupsData[mealType] || [];
                    if (meals.length > 0) {
                        openMealGroupModal(mealType, meals);
                    }
                }, 50);
                return;
            }
            
            openMealGroupModal(mealType, meals);
        }
    };
    
    // Salvar referência do handler para poder remover depois
    mealsList._mealEditHandler = mealEditHandler;
    
    // Event delegation para botões de editar
    mealsList.addEventListener('click', mealEditHandler);
    
    mealEditListenersSetup = true;
}

// Configurar listeners quando o DOM estiver pronto
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(setupMealEditListeners, 0);
} else {
    document.addEventListener('DOMContentLoaded', setupMealEditListeners);
}

// Também configurar quando o SPA carregar a página (com debounce para evitar múltiplas chamadas)
let setupListenersTimeout = null;
const debouncedSetupListeners = () => {
    if (setupListenersTimeout) clearTimeout(setupListenersTimeout);
    setupListenersTimeout = setTimeout(() => {
        setupMealEditListeners();
    }, 100);
};

window.addEventListener('fragmentReady', debouncedSetupListeners);
window.addEventListener('pageLoaded', debouncedSetupListeners);

function renderMeals(mealGroups, mealTypes) {
    const mealsList = document.getElementById('meals-list');
    
    if (!mealsList) {
        console.error('meals-list não encontrado!');
        return;
    }
    
    // Se currentMealGroupsData já foi atualizado (foi passado antes de renderizar), usar ele
    // Senão, processar mealGroups
    let processedGroups = currentMealGroupsData && Object.keys(currentMealGroupsData).length > 0 
        ? currentMealGroupsData 
        : null;
    
    // Se currentMealGroupsData está vazio, processar mealGroups
    if (!processedGroups) {
        processedGroups = {};
    
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
    
    // Armazenar globalmente para acesso nos event listeners
    currentMealGroupsData = processedGroups;
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
            
            continue;
        }
        
        const typeName = mealTypes[mealType] || mealType;
        const mealGroupKcal = meals.reduce((sum, meal) => sum + parseFloat(meal.kcal_consumed || 0), 0);
        
        const mealIds = meals.map(m => m.id).join(',');
        html += `
            <div class="meal-group">
                <div class="meal-group-header" data-meal-type="${mealType}" data-meal-ids="${mealIds}" style="cursor: pointer; user-select: none;">
                    <h3 class="meal-group-title">${escapeHtml(typeName)}</h3>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="meal-group-total">${Math.round(mealGroupKcal)} kcal</div>
                        <button class="meal-group-edit-btn" title="Editar refeição completa" data-meal-type-btn="${mealType}" aria-label="Editar refeição" style="background: rgba(255, 107, 0, 0.1); border: 1px solid rgba(255, 107, 0, 0.3); color: var(--accent-orange); padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex !important; align-items: center; justify-content: center; min-width: 36px; min-height: 36px; flex-shrink: 0; position: relative;">
                            <i class="fas fa-edit" style="font-size: 14px !important; display: inline-block !important; visibility: visible !important; opacity: 1 !important; position: relative; z-index: 2;"></i>
                            <svg style="position: absolute; width: 14px; height: 14px; fill: var(--accent-orange); display: none;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                    </div>
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
    
    // Aguardar um pouco para garantir que o DOM foi atualizado
    setTimeout(() => {
        // Verificar se FontAwesome carregou e mostrar SVG se necessário
        const buttons = document.querySelectorAll('.meal-group-edit-btn[data-meal-type-btn]');
        buttons.forEach(btn => {
            const icon = btn.querySelector('i.fas.fa-edit');
            const svg = btn.querySelector('svg');
            if (icon && svg) {
                // Verificar se o ícone FontAwesome está visível
                setTimeout(() => {
                    const iconStyles = window.getComputedStyle(icon);
                    const iconBefore = window.getComputedStyle(icon, ':before');
                    const hasContent = iconBefore.getPropertyValue('content') !== 'none' && iconBefore.getPropertyValue('content') !== '';
                    
                    if (!hasContent || icon.offsetWidth === 0) {
                        // FontAwesome não carregou, mostrar SVG
                        icon.style.display = 'none';
                        svg.style.display = 'block';
                    }
                }, 200);
            }
        });
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== MODAL DE EDIÇÃO RÁPIDA DE REFEIÇÃO ==========

let currentMealGroupData = null;
let currentMealTypes = {};

function openMealGroupModal(mealType, meals) {
    // Limpar qualquer modal anterior que possa estar escondido
    const existingModal = document.getElementById('meal-group-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    currentMealGroupData = { mealType, meals };
    
    // Criar modal
    const modal = createMealGroupModal();
        document.body.appendChild(modal);
    
    // Garantir que o modal tenha z-index alto e esteja visível
    // NÃO definir top/left/width/height para não sobrescrever o CSS de centralização
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '10000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    // Buscar meal_types do contexto atual
    const urlParams = new URLSearchParams(window.location.search);
    const date = urlParams.get('date') || currentDate;
    
    // Mostrar modal imediatamente (não esperar meal_types)
    modal.classList.add('visible');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    
    // Renderizar com meal_types vazios primeiro (para mostrar o modal)
    renderMealGroupModal(mealType, meals);
    
    // Carregar meal_types em background e atualizar
    loadMealTypesForModal(date, () => {
        // Atualizar o select com os meal_types carregados
        renderMealGroupModal(mealType, meals);
    }, () => {
        // Fallback: usar meal_types já carregados ou vazios
        renderMealGroupModal(mealType, meals);
    });
}

function createMealGroupModal() {
    const modal = document.createElement('div');
    modal.id = 'meal-group-modal';
    modal.className = 'meal-group-modal-overlay';
    modal.innerHTML = `
        <div class="meal-group-modal-content">
            <div class="meal-group-modal-header">
                <h2 id="meal-group-modal-title">Editar Refeição</h2>
                <button class="meal-group-modal-close" onclick="closeMealGroupModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="meal-group-modal-body">
                <div class="meal-group-type-selector">
                    <label for="meal-group-type-select">Tipo de Refeição:</label>
                    <select id="meal-group-type-select" class="meal-group-type-select">
                        <option value="">Carregando...</option>
                    </select>
                </div>
                <div class="meal-group-items-list" id="meal-group-items-list">
                    <!-- Itens serão renderizados aqui -->
                </div>
            </div>
            <div class="meal-group-modal-footer">
                <button class="btn-secondary" onclick="closeMealGroupModal()">Cancelar</button>
                <button class="btn-primary" onclick="saveMealGroupChanges()">Salvar Alterações</button>
            </div>
        </div>
    `;
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMealGroupModal();
        }
    });
    
    return modal;
}

async function loadMealTypesForModal(date, callback, errorCallback) {
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/get_diary_data.php?date=${date}`);
        if (!response) {
            if (errorCallback) errorCallback();
            return;
        }
        
        const result = await response.json();
        if (result.success && result.data.meal_types) {
            currentMealTypes = result.data.meal_types;
            if (callback) callback();
        } else {
            if (errorCallback) errorCallback();
        }
    } catch (error) {
        console.error('[Diary] Erro ao carregar tipos de refeição:', error);
        if (errorCallback) errorCallback();
    }
}

function renderMealGroupModal(mealType, meals) {
    const modalTitle = document.getElementById('meal-group-modal-title');
    const typeSelect = document.getElementById('meal-group-type-select');
    const itemsList = document.getElementById('meal-group-items-list');
    
    if (!modalTitle || !typeSelect || !itemsList) {
        return;
    }
    
    // Título
    modalTitle.textContent = currentMealTypes[mealType] || mealType;
    
    // Preencher select de tipos (usar meal_types se disponível, senão usar apenas o tipo atual)
    typeSelect.innerHTML = '';
    if (Object.keys(currentMealTypes).length > 0) {
    for (const [slug, name] of Object.entries(currentMealTypes)) {
        const option = document.createElement('option');
        option.value = slug;
        option.textContent = name;
        if (slug === mealType) {
            option.selected = true;
        }
            typeSelect.appendChild(option);
        }
    } else {
        // Se não tem meal_types, pelo menos mostrar o tipo atual
        const option = document.createElement('option');
        option.value = mealType;
        option.textContent = mealType;
        option.selected = true;
        typeSelect.appendChild(option);
    }
    
    // Renderizar itens
    itemsList.innerHTML = '';
    meals.forEach(meal => {
        const mealName = meal.custom_meal_name || meal.recipe_name || 'Refeição';
        const mealItem = document.createElement('div');
        mealItem.className = 'meal-group-item';
        mealItem.innerHTML = `
            <div class="meal-group-item-info">
                <div class="meal-group-item-name">${escapeHtml(mealName)}</div>
                <div class="meal-group-item-macros">
                    ${Math.round(meal.kcal_consumed || 0)} kcal | 
                    P: ${Math.round(meal.protein_consumed_g || 0)}g | 
                    C: ${Math.round(meal.carbs_consumed_g || 0)}g | 
                    G: ${Math.round(meal.fat_consumed_g || 0)}g
                </div>
            </div>
            <a href="/fragments/edit_meal.html?id=${meal.id}" class="meal-group-item-edit" title="Editar alimento" data-spa-link>
                <i class="fas fa-edit"></i>
            </a>
        `;
        itemsList.appendChild(mealItem);
    });
}

function closeMealGroupModal() {
    const modal = document.getElementById('meal-group-modal');
    if (modal) {
        modal.classList.remove('visible');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        // Remover completamente o modal do DOM para evitar problemas
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }
}

async function saveMealGroupChanges() {
    if (!currentMealGroupData) return;
    
    const typeSelect = document.getElementById('meal-group-type-select');
    const newMealType = typeSelect.value;
    
    if (!newMealType || newMealType === currentMealGroupData.mealType) {
        closeMealGroupModal();
        return;
    }
    
    const mealIds = currentMealGroupData.meals.map(meal => meal.id);
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE_URL}/update_meal_type_batch.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                meal_ids: mealIds,
                meal_type: newMealType
            })
        });
        
        if (!response) return;
        
        const result = await response.json();
        
        if (result.success) {
            // Recarregar dados do diário
            const urlParams = new URLSearchParams(window.location.search);
            const date = urlParams.get('date') || currentDate;
            await loadDiaryData(date);
            closeMealGroupModal();
        } else {
            alert('Erro ao atualizar tipo de refeição: ' + (result.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao salvar alterações:', error);
        alert('Erro ao salvar alterações. Tente novamente.');
    }
}

// Função auxiliar para abrir modal a partir do header
function openMealGroupModalFromHeader(mealType) {
    const meals = currentMealGroupsData[mealType] || [];
    if (meals.length > 0) {
        openMealGroupModal(mealType, meals);
    }
}

// Expor funções globalmente
window.openMealGroupModal = openMealGroupModal;
window.openMealGroupModalFromHeader = openMealGroupModalFromHeader;
window.closeMealGroupModal = closeMealGroupModal;
window.saveMealGroupChanges = saveMealGroupChanges;

// Carregar dados ao iniciar
loadDiaryData(currentDate).catch(err => {
    console.error('Erro ao carregar dados do diário:', err);
});
        })();

})();
