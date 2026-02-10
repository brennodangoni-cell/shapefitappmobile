
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

// Carregar dados da página
const BASE_URL = window.BASE_APP_URL;
let pageData = null;
let allCategories = [];

// Função para mostrar skeleton durante carregamento de filtros
function showFilterSkeleton() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    // Esconder conteúdo atual
    const recipesList = document.getElementById('recipes-list');
    const categoriesGrid = document.getElementById('categories-grid');
    const loadingState = document.getElementById('loading-state');
    
    if (recipesList) recipesList.style.display = 'none';
    if (categoriesGrid) categoriesGrid.style.display = 'none';
    if (loadingState) loadingState.style.display = 'none';
    
    // Criar ou atualizar skeleton
    let skeleton = mainContent.querySelector('.filter-skeleton');
    if (!skeleton) {
        skeleton = document.createElement('div');
        skeleton.className = 'filter-skeleton';
        mainContent.appendChild(skeleton);
    }
    
    // Determinar qual tipo de skeleton mostrar baseado no que está visível
    const hasActiveFilters = document.getElementById('active-filters-container')?.style.display !== 'none';
    
    if (hasActiveFilters || recipesList?.style.display === 'block') {
        // Skeleton para lista de receitas filtradas
        skeleton.innerHTML = `
            <div style="padding: 20px 24px; display: flex; flex-direction: column; gap: 20px;">
                ${Array.from({ length: 5 }, () => `
                    <div style="display: flex; gap: 16px; padding: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px;">
                        <div class="skeleton" style="width: 80px; height: 80px; border-radius: 12px; flex-shrink: 0;"></div>
                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px;">
                            <div class="skeleton" style="height: 18px; width: 70%; border-radius: 8px;"></div>
                            <div class="skeleton" style="height: 14px; width: 40%; border-radius: 8px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // Skeleton para carrossel de categorias
        skeleton.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 2rem;">
                ${Array.from({ length: 3 }, () => `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 24px; margin-bottom: 1rem;">
                            <div class="skeleton" style="height: 20px; width: 150px; border-radius: 8px;"></div>
                            <div class="skeleton" style="height: 14px; width: 80px; border-radius: 8px;"></div>
                        </div>
                        <div style="display: flex; gap: 16px; overflow-x: auto; padding: 0 24px 8px 24px;">
                            ${Array.from({ length: 4 }, () => `
                                <div style="flex-shrink: 0; width: 160px;">
                                    <div class="skeleton" style="width: 100%; height: 120px; border-radius: 16px 16px 0 0;"></div>
                                    <div style="padding: 12px;">
                                        <div class="skeleton" style="height: 16px; width: 80%; border-radius: 8px; margin-bottom: 8px;"></div>
                                        <div class="skeleton" style="height: 12px; width: 60%; border-radius: 8px;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    skeleton.style.display = 'block';
}

// Função para esconder skeleton
function hideFilterSkeleton() {
    const skeleton = document.querySelector('.filter-skeleton');
    if (skeleton) {
        skeleton.style.display = 'none';
    }
}

// Função para verificar se estamos na página explore_recipes
function isExploreRecipesPage() {
    const path = window.location.pathname;
    const pageName = path.split('/').pop().replace('.html', '').split('?')[0];
    
    // Verificar se é explore_recipes
    if (pageName === 'explore_recipes' || path.includes('/explorar') || path.includes('explore_recipes')) {
        return true;
    }
    
    // Verificar elementos do DOM
    const loadingState = document.getElementById('loading-state');
    const recipesList = document.getElementById('recipes-list');
    const categoriesGrid = document.getElementById('categories-grid');
    
    return !!(loadingState && recipesList && categoriesGrid);
}

async function loadPageData(customParams = null) {
    // Verificar se estamos na página correta antes de continuar
    if (!isExploreRecipesPage()) {
        // Não estamos na página explore_recipes, não fazer nada (silenciosamente)
        return;
    }
    
    const loadingState = document.getElementById('loading-state');
    const recipesList = document.getElementById('recipes-list');
    const categoriesGrid = document.getElementById('categories-grid');
    
    try {
        let query, sort, categories;
        
        if (customParams) {
            // Usar parâmetros personalizados (filtro dinâmico)
            query = customParams.query || '';
            sort = customParams.sort || '';
            categories = customParams.categories || '';
        } else {
            // Usar parâmetros da URL
            const urlParams = new URLSearchParams(window.location.search);
            query = urlParams.get('q') || '';
            sort = urlParams.get('sort') || '';
            categories = urlParams.get('categories') || '';
        }
        
        // Determinar se está limpando filtros (voltando ao estado inicial)
        const isClearingFilters = customParams && !query && (!sort || sort === 'name_asc') && !categories;
        
        // Mostrar skeleton durante carregamento
        if (customParams) {
            if (isClearingFilters) {
                // Esconder conteúdo atual antes de mostrar skeleton
        const recipesList = document.getElementById('recipes-list');
        const categoriesGrid = document.getElementById('categories-grid');
        const loadingState = document.getElementById('loading-state');
                if (recipesList) recipesList.style.display = 'none';
                if (categoriesGrid) categoriesGrid.style.display = 'none';
                if (loadingState) loadingState.style.display = 'none';
                
                // Garantir que modal não seja afetado pelo PageLoader
                const filterModal = document.getElementById('filter-modal');
                if (filterModal) {
                    // Mover modal para fora do page-root temporariamente para não ser escondido
                    const pageRoot = filterModal.closest('.page-root');
                    if (pageRoot) {
                        // Salvar referência do modal
                        filterModal.dataset.tempParent = 'true';
                        // Mover para body temporariamente
                        document.body.appendChild(filterModal);
                    }
                }
                
                // Usar PageLoader (mesmo skeleton da primeira carga)
                if (window.PageLoader) {
                    window.PageLoader.start('explore_recipes');
                }
            } else {
                // Usar skeleton customizado para filtros
                showFilterSkeleton();
            }
        }
        
        const recipesList = document.getElementById('recipes-list');
        const categoriesGrid = document.getElementById('categories-grid');
        const loadingState = document.getElementById('loading-state');
        
        const apiUrl = `${window.API_BASE_URL}/get_explore_recipes_data.php?q=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&categories=${encodeURIComponent(categories)}`;
        const response = await authenticatedFetch(apiUrl);
        if (!response) {
            hideFilterSkeleton();
            return;
        }
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Erro ao carregar dados');
        }
        
        pageData = result.data;
        allCategories = result.data.all_categories || [];
        
        // Preencher input de busca
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = query;
        
        // Renderizar categorias no modal (só na primeira vez)
        if (!customParams) {
            renderCategories();
        }
        
        // Determinar se deve mostrar view filtrada ou carrossel
        // Se customParams foi passado com valores vazios, forçar carrossel
        const hasActiveFilters = query || (sort && sort !== 'name_asc') || categories;
        
        // ✅ AGUARDAR RENDERIZAÇÃO E CARREGAMENTO DE IMAGENS
        if (hasActiveFilters) {
            await renderFilteredView();
        } else {
            await renderCarouselView();
        }
        
        // Esconder skeleton após renderizar
        if (customParams) {
            if (isClearingFilters) {
                // Para limpar filtros, aguardar todas as imagens carregarem antes de remover skeleton
                // Como está limpando, sempre vai mostrar o carrossel (categories-grid)
                const categoriesGrid = document.getElementById('categories-grid');
                if (categoriesGrid && categoriesGrid.style.display === 'block') {
                    await waitForAllImages(categoriesGrid);
                }
                // Agora sim remover skeleton do PageLoader (após todas as imagens carregarem)
                if (window.PageLoader) {
                    window.PageLoader.ready();
                }
                
                // Restaurar modal para sua posição original após PageLoader
                const filterModal = document.getElementById('filter-modal');
                if (filterModal && filterModal.dataset.tempParent === 'true') {
                    const pageRoot = document.querySelector('.page-root');
                    if (pageRoot) {
                        // Mover modal de volta para o page-root
                        pageRoot.appendChild(filterModal);
                        delete filterModal.dataset.tempParent;
                    }
                }
                
                // Re-inicializar UI após PageLoader (garantir que modal e event listeners funcionem)
                setTimeout(() => {
                    if (typeof initExploreRecipesUI === 'function') {
                        initExploreRecipesUI();
                    }
                }, 500);
            } else {
                // Para filtros normais, usar skeleton customizado
                hideFilterSkeleton();
            }
        }
        
        // ✅ PÁGINA PRONTA - Remover skeleton APÓS imagens carregarem (só na primeira carga)
        if (!customParams && window.PageLoader) {
            window.PageLoader.ready();
        }
        
        // Restaurar estado dos filtros (só na primeira vez)
        if (!customParams) {
            restoreFiltersState();
        }
        
        // Atualizar URL sem recarregar (history)
        if (customParams) {
            const url = new URL(window.location.origin + window.location.pathname);
            if (query) url.searchParams.set('q', query);
            if (sort && sort !== 'name_asc') url.searchParams.set('sort', sort);
            if (categories) url.searchParams.set('categories', categories);
            window.history.replaceState({}, '', url.toString());
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        hideFilterSkeleton();
        const loadingState = document.getElementById('loading-state');
        if (loadingState) {
            loadingState.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--accent-orange);"></i>
                <p>Erro ao carregar receitas. Tente novamente.</p>
            `;
            loadingState.style.display = 'block';
        }
        // ✅ Mesmo com erro, remover skeleton
        if (window.PageLoader) window.PageLoader.ready();
    }
}

function renderCategories() {
    const container = document.getElementById('category-options-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    allCategories.forEach(category => {
        const option = document.createElement('label');
        option.className = 'chip-option';
        option.innerHTML = `
            <input type="checkbox" id="cat_${category.id}" name="categories" value="${category.id}">
            <span>${escapeHtml(category.name)}</span>
        `;
        container.appendChild(option);
    });
}

async function renderFilteredView() {
    // Verificar se estamos na página correta
    if (!isExploreRecipesPage()) {
        return;
    }
    
    const loadingState = document.getElementById('loading-state');
    const categoriesGrid = document.getElementById('categories-grid');
    const recipesList = document.getElementById('recipes-list');
    
    // Verificar se os elementos existem antes de acessar
    if (!loadingState || !categoriesGrid || !recipesList) {
        console.warn('[Explore Recipes] Elementos não encontrados em renderFilteredView');
        return;
    }
    
    loadingState.style.display = 'none';
    categoriesGrid.style.display = 'none';
    recipesList.style.display = 'block';
    
    if (pageData.recipes && pageData.recipes.length > 0) {
        recipesList.innerHTML = pageData.recipes.map(recipe => `
            <a href="view_recipe.html?id=${recipe.id}" class="recipe-item">
                <img src="${recipe.image_url || (recipe.image_filename ? `${BASE_URL}/assets/images/recipes/${recipe.image_filename}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmEzYzRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvb2Q8L3RleHQ+PC9zdmc+')}" 
                     alt="${escapeHtml(recipe.name)}" 
                     class="recipe-image"
                     loading="eager"
                     decoding="async"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmEzYzRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvb2Q8L3RleHQ+PC9zdmc+'">
                <div class="recipe-info">
                    <h3 class="recipe-name">${escapeHtml(recipe.name)}</h3>
                    <span class="recipe-kcal">
                        <i class="fas fa-fire-alt"></i>
                        ${Math.round(recipe.kcal_per_serving || 0)} kcal
                    </span>
                </div>
            </a>
        `).join('');
        
        // ✅ AGUARDAR TODAS AS IMAGENS CARREGAREM
        await waitForAllImages(recipesList);
    } else {
        recipesList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Nenhuma receita encontrada com estes filtros.</p>
            </div>
        `;
    }
    
    // Mostrar filtros ativos
    const activeFiltersText = document.getElementById('active-filters-text');
    const activeFiltersContainer = document.getElementById('active-filters-container');
    if (activeFiltersText && activeFiltersContainer) {
        if (pageData.active_filter_names && pageData.active_filter_names.length > 0) {
            activeFiltersText.textContent = pageData.active_filter_names.join(', ');
            activeFiltersContainer.style.display = 'block';
        } else {
            activeFiltersContainer.style.display = 'none';
        }
    }
}

async function renderCarouselView() {
    // Verificar se estamos na página correta
    if (!isExploreRecipesPage()) {
        return;
    }
    
    const loadingState = document.getElementById('loading-state');
    const recipesList = document.getElementById('recipes-list');
    const categoriesGrid = document.getElementById('categories-grid');
    const activeFiltersContainer = document.getElementById('active-filters-container');
    
    // Verificar se os elementos existem antes de acessar
    if (!loadingState || !recipesList || !categoriesGrid) {
        console.warn('[Explore Recipes] Elementos não encontrados em renderCarouselView');
        return;
    }
    
    loadingState.style.display = 'none';
    recipesList.style.display = 'none';
    categoriesGrid.style.display = 'block';
    if (activeFiltersContainer) {
        activeFiltersContainer.style.display = 'none';
    }
    
    if (pageData.sections && pageData.sections.length > 0) {
        categoriesGrid.innerHTML = pageData.sections.map(section => `
            <section class="category-section">
                <div class="category-header">
                    <h2 class="category-title">${escapeHtml(section.title)}</h2>
                    <a href="explore_recipes.html?${section.link_params}" class="view-all-link">
                        Ver mais
                    </a>
                </div>
                <div class="recipes-carousel">
                    ${section.recipes.map(recipe => `
                        <a href="view_recipe.html?id=${recipe.id}" class="recipe-card">
                            <img src="${recipe.image_url || (recipe.image_filename ? `${BASE_URL}/assets/images/recipes/${recipe.image_filename}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmEzYzRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvb2Q8L3RleHQ+PC9zdmc+')}"
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmEzYzRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvb2Q8L3RleHQ+PC9zdmc+'" 
                                 alt="${escapeHtml(recipe.name)}" 
                                 class="card-image">
                            <div class="card-info">
                                <h4 class="card-name">${escapeHtml(recipe.name)}</h4>
                                <span class="card-kcal">
                                    <i class="fas fa-fire-alt"></i>
                                    ${Math.round(recipe.kcal_per_serving || 0)} kcal
                                </span>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </section>
        `).join('');
        
        // ✅ AGUARDAR TODAS AS IMAGENS CARREGAREM
        await waitForAllImages(categoriesGrid);
    } else {
        categoriesGrid.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-utensils" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Nenhuma receita disponível no momento.</p>
            </div>
        `;
    }
}

function restoreFiltersState() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Restaurar ordenação
    const initialSort = urlParams.get('sort') || 'name_asc';
    setTimeout(() => {
        const sortRadio = document.querySelector(`input[name="sort"][value="${initialSort}"]`);
        if (sortRadio) sortRadio.checked = true;
        else {
            const defaultSort = document.getElementById('sort_name_asc');
            if (defaultSort) defaultSort.checked = true;
        }
        
        // Restaurar categorias
        const initialCategories = (urlParams.get('categories') || '').split(',').filter(c => c);
        initialCategories.forEach(catId => {
            const checkbox = document.getElementById(`cat_${catId}`);
            if (checkbox) checkbox.checked = true;
        });
        
        // Marcar botão de filtro como ativo
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn && (urlParams.has('sort') || urlParams.has('categories') || urlParams.has('q'))) {
            filterBtn.classList.add('active');
        }
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * ✅ Aguarda todas as imagens dentro de um container carregarem
 * @param {HTMLElement} container - Container que contém as imagens
 * @returns {Promise} - Resolve quando todas as imagens carregaram
 */
function waitForAllImages(container) {
    return new Promise((resolve) => {
        const images = container.querySelectorAll('img');
        
        if (images.length === 0) {
            resolve();
            return;
        }
        
        let loadedCount = 0;
        const totalImages = images.length;
        
        // Função para verificar se todas carregaram
        const checkComplete = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                resolve();
            }
        };
        
        // Para cada imagem, aguardar load ou error
        images.forEach(img => {
            // Se já está carregada (cached), contar imediatamente
            if (img.complete && img.naturalHeight !== 0) {
                checkComplete();
            } else {
                // Aguardar load ou error
                img.addEventListener('load', checkComplete, { once: true });
                img.addEventListener('error', checkComplete, { once: true });
            }
        });
        
        // ✅ Timeout de segurança (5 segundos)
        setTimeout(() => {
            if (loadedCount < totalImages) {
                
                resolve(); // Resolver mesmo assim para não travar
            }
        }, 5000);
    });
}

// Carregar dados ao iniciar (aguardar autenticação)
(async () => {
    // Verificar se estamos na página correta antes de fazer qualquer coisa
    if (!isExploreRecipesPage()) {
        return;
    }
    
    const authenticated = await requireAuth();
    if (!authenticated) return;
    await loadPageData();
})();

function initExploreRecipesUI() {
    // Script de filtro - EXATAMENTE IGUAL AO FAVORITES
    function setupFilterModal() {
        const filterButton = document.getElementById('filter-btn');
        const filterModal = document.getElementById('filter-modal');
        const closeFilterBtn = document.getElementById('close-filter-modal-btn');
        
        if (filterButton && filterModal) {
            const modalContent = filterModal.querySelector('.modal-content');
            let savedScrollPosition = 0;
            
            const closeModal = () => {
                filterModal.classList.remove('visible');
                // Restaurar posição do scroll
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.position = '';
                document.body.style.width = '';
                document.body.style.height = '';
                document.body.style.maxWidth = '';
                document.body.style.maxHeight = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.body.style.overscrollBehavior = '';
                document.documentElement.style.overflow = '';
                document.documentElement.style.touchAction = '';
                document.documentElement.style.overscrollBehavior = '';
                document.body.classList.remove('modal-open');
                // Restaurar container
                const appContainer = document.querySelector('.app-container');
                if (appContainer) {
                    appContainer.style.overflow = '';
                    appContainer.style.overflowY = '';
                    appContainer.style.overflowX = '';
                    appContainer.style.touchAction = '';
                    appContainer.style.overscrollBehavior = '';
                    appContainer.style.pointerEvents = '';
                }
                window.scrollTo(0, savedScrollPosition);
                // Resetar transform quando fechar
                    modalContent.style.transform = '';
                    modalContent.style.transition = '';
                // Mostrar bottom nav sincronizado com o fechamento do modal
                const bottomNav = document.getElementById('bottom-nav-container');
                const modalTransition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
                setTimeout(() => {
                    if (bottomNav) {
                        bottomNav.style.transition = modalTransition;
                        bottomNav.style.transform = '';
                    }
                    if (window.BottomNavAPI) {
                        window.BottomNavAPI.show();
                    }
                }, 50);
            };
            
            const toggleModal = () => {
                const isOpening = !filterModal.classList.contains('visible');
                filterModal.classList.toggle('visible');
                
                // Resetar transform quando abrir
                if (isOpening) {
                    // Salvar posição do scroll atual
                    savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                    // Fixar body na posição atual
                    document.body.style.top = `-${savedScrollPosition}px`;
                    document.body.style.left = '0';
                    document.body.style.right = '0';
                    document.body.style.position = 'fixed';
                    document.body.style.width = '100%';
                    document.body.style.height = '100%';
                    document.body.style.maxWidth = '100vw';
                    document.body.style.maxHeight = '100vh';
                    document.body.style.overflow = 'hidden';
                    document.body.style.touchAction = 'none';
                    document.body.style.overscrollBehavior = 'none';
                    document.documentElement.style.overflow = 'hidden';
                    document.documentElement.style.touchAction = 'none';
                    document.documentElement.style.overscrollBehavior = 'none';
                    modalContent.style.transform = '';
                    modalContent.style.transition = '';
                    document.body.classList.add('modal-open');
                    // Prevenir scroll no container também
                    const appContainer = document.querySelector('.app-container');
                    if (appContainer) {
                        appContainer.style.overflow = 'hidden';
                        appContainer.style.overflowY = 'hidden';
                        appContainer.style.overflowX = 'hidden';
                        appContainer.style.touchAction = 'none';
                        appContainer.style.overscrollBehavior = 'none';
                        appContainer.style.pointerEvents = 'none';
                    }
                } else {
                    // Restaurar posição do scroll
                    document.body.style.top = '';
                    document.body.style.left = '';
                    document.body.style.right = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                    document.body.style.height = '';
                    document.body.style.maxWidth = '';
                    document.body.style.maxHeight = '';
                    document.body.style.overflow = '';
                    document.body.style.touchAction = '';
                    document.body.style.overscrollBehavior = '';
                    document.documentElement.style.overflow = '';
                    document.documentElement.style.touchAction = '';
                    document.documentElement.style.overscrollBehavior = '';
                    document.body.classList.remove('modal-open');
                    // Restaurar container
                    const appContainer = document.querySelector('.app-container');
                    if (appContainer) {
                        appContainer.style.overflow = '';
                        appContainer.style.overflowY = '';
                        appContainer.style.overflowX = '';
                        appContainer.style.touchAction = '';
                        appContainer.style.overscrollBehavior = '';
                        appContainer.style.pointerEvents = '';
                    }
                    window.scrollTo(0, savedScrollPosition);
                    // Resetar transform quando fechar
                        modalContent.style.transform = '';
                        modalContent.style.transition = '';
                }
                
                // Controlar bottom nav
                const bottomNav = document.getElementById('bottom-nav-container');
                
                if (isOpening) {
                    // Esconder bottom nav
                    if (bottomNav) {
                        bottomNav.style.transform = 'translateY(100%)';
                    }
                    if (window.BottomNavAPI) {
                        window.BottomNavAPI.hide();
                    }
                } else {
                    // Mostrar bottom nav
                        if (bottomNav) {
                            bottomNav.style.transform = '';
                        }
                        if (window.BottomNavAPI) {
                            window.BottomNavAPI.show();
                        }
                }
            };
            
            filterButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleModal();
            });
            
            // Fechar ao clicar no botão X
            if (closeFilterBtn) {
                closeFilterBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                });
            }
            
            // Fechar ao clicar no overlay (fora do modal)
            filterModal.addEventListener('click', (e) => {
                if (e.target === filterModal) {
                    closeModal();
                }
            });
            
            // Bloquear todos os toques no overlay que não sejam no modal-content
            filterModal.addEventListener('touchstart', (e) => {
                if (e.target === filterModal || !modalContent.contains(e.target)) {
                    // Se tocou no overlay (fora do modal), bloquear
                    if (e.target === filterModal) {
                        e.stopPropagation();
                    }
                }
            }, { passive: false });
            
            filterModal.addEventListener('touchmove', (e) => {
                if (e.target === filterModal || !modalContent.contains(e.target)) {
                    // Se moveu no overlay (fora do modal), bloquear
                    if (e.target === filterModal) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }, { passive: false });
            
            // Prevenir TODOS os toques na página quando modal está aberto
            // Apenas permitir toques dentro do modal
            const preventPageTouch = (e) => {
                if (!filterModal.classList.contains('visible')) return;
                
                // Verificar se o toque está dentro do modal
                const isInsideModal = filterModal.contains(e.target);
                
                if (!isInsideModal) {
                    // Bloquear TUDO fora do modal
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            };
            
            // Bloquear touchmove na página quando modal está aberto
            document.addEventListener('touchmove', (e) => {
                if (!filterModal.classList.contains('visible')) return;
                
                // Permitir apenas dentro do modal
                const isInsideModal = filterModal.contains(e.target);
                const modalScrollable = filterModal.querySelector('.modal-scrollable-content');
                
                // Se está dentro do modal, deixar os listeners do modalContent lidarem
                if (isInsideModal) {
                    return; // Deixar o modalContent gerenciar
                }
                
                // Bloquear TUDO fora do modal
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
            
            // Bloquear touchstart na página quando modal está aberto
            document.addEventListener('touchstart', (e) => {
                if (!filterModal.classList.contains('visible')) return;
                
                const isInsideModal = filterModal.contains(e.target);
                if (!isInsideModal) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });
            
            // Bloquear wheel na página quando modal está aberto
            document.addEventListener('wheel', (e) => {
                if (!filterModal.classList.contains('visible')) return;
                
                const isInsideModal = filterModal.contains(e.target);
                const modalScrollable = filterModal.querySelector('.modal-scrollable-content');
                
                // Permitir scroll apenas dentro do conteúdo do modal
                if (isInsideModal && modalScrollable && modalScrollable.contains(e.target)) {
                    return;
                }
                
                // Bloquear TUDO fora do modal
                e.preventDefault();
            }, { passive: false });
            
        }
    }
    
    setupFilterModal();
    
    // Resto do código (aplicar filtros, etc)
    const searchInput = document.getElementById('search-input');
    const applyBtn = document.getElementById('apply-filters');
    const clearBtn = document.getElementById('clear-filters');
    
    // Função para voltar ao estado original (carrossel)
    const resetToOriginal = async () => {
        // Fechar modal
        const filterModal = document.getElementById('filter-modal');
        if (filterModal) {
            filterModal.classList.remove('visible');
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.maxWidth = '';
            document.body.style.maxHeight = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.body.style.overscrollBehavior = '';
            document.documentElement.style.overflow = '';
            document.documentElement.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            document.body.classList.remove('modal-open');
        }
        // Restaurar container
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.overflow = '';
            appContainer.style.overflowY = '';
            appContainer.style.overflowX = '';
            appContainer.style.touchAction = '';
            appContainer.style.overscrollBehavior = '';
            appContainer.style.pointerEvents = '';
        }
        // Mostrar bottom nav
        const bottomNav = document.getElementById('bottom-nav-container');
            if (bottomNav) {
                bottomNav.style.transform = '';
            }
            if (window.BottomNavAPI) {
                window.BottomNavAPI.show();
            }
        
        // Resetar inputs do modal
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('input[name="sort"]').forEach(r => r.checked = false);
        const defaultSort = document.getElementById('sort_name_asc');
        if (defaultSort) defaultSort.checked = true;
        document.querySelectorAll('input[name="categories"]').forEach(c => c.checked = false);
        
        // Atualizar URL ANTES de carregar dados (importante!)
        window.history.replaceState({}, '', '/explorar');
        
        // Carregar dados sem filtros - passar parâmetros vazios explicitamente
        await loadPageData({
            query: '',
            sort: '',
            categories: ''
        });
    };
    
    // Aplicar filtros
    const applyFilters = async () => {
        const query = searchInput ? searchInput.value.trim() : '';
        const sortValue = document.querySelector('input[name="sort"]:checked')?.value || 'name_asc';
        const selectedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(input => input.value);
        
        // Verificar se há filtros ativos
        const hasActiveFilters = query || (sortValue && sortValue !== 'name_asc') || selectedCategories.length > 0;
        
        // Se não há filtros, voltar ao estado original com transição fluida
        if (!hasActiveFilters) {
            await resetToOriginal();
            return;
        }
        
        // Fechar modal primeiro
        const filterModal = document.getElementById('filter-modal');
        if (filterModal) {
            filterModal.classList.remove('visible');
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.maxWidth = '';
            document.body.style.maxHeight = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.body.style.overscrollBehavior = '';
            document.documentElement.style.overflow = '';
            document.documentElement.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            document.body.classList.remove('modal-open');
        }
        // Restaurar container
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.overflow = '';
            appContainer.style.overflowY = '';
            appContainer.style.overflowX = '';
            appContainer.style.touchAction = '';
            appContainer.style.overscrollBehavior = '';
            appContainer.style.pointerEvents = '';
        }
        // Mostrar bottom nav
        const bottomNav = document.getElementById('bottom-nav-container');
            if (bottomNav) {
                bottomNav.style.transform = '';
            }
            if (window.BottomNavAPI) {
                window.BottomNavAPI.show();
            }
        
        // Carregar dados com novos filtros (sem reload!)
        await loadPageData({
            query: query,
            sort: sortValue,
            categories: selectedCategories.join(',')
        });
    };
    
    // Event listeners
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    
    // Limpar filtros - transição fluida
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            resetToOriginal();
        });
    }
    
    // Busca com "debounce" (dinâmico, sem reload)
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const urlParams = new URLSearchParams(window.location.search);
                const currentQuery = urlParams.get('q') || '';
                const newQuery = searchInput.value.trim();
                
                if (currentQuery !== newQuery) {
                    const sortValue = document.querySelector('input[name="sort"]:checked')?.value || 'name_asc';
                    const selectedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(input => input.value);
                    
                    await loadPageData({
                        query: newQuery,
                        sort: sortValue,
                        categories: selectedCategories.join(',')
                    });
                }
            }, 500);
        });
    }
}

// Executar no DOMContentLoaded (para páginas completas)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (isExploreRecipesPage()) {
            initExploreRecipesUI();
        }
    });
} else {
    // DOM já carregado, executar imediatamente (se estiver na página correta)
    if (isExploreRecipesPage()) {
        initExploreRecipesUI();
    }
}

// Também escutar eventos do SPA router
window.addEventListener('fragmentReady', function() {
    if (isExploreRecipesPage()) {
        initExploreRecipesUI();
    }
});
window.addEventListener('pageLoaded', function() {
    if (isExploreRecipesPage()) {
        initExploreRecipesUI();
    }
});

})();
