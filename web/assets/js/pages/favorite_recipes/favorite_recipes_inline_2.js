
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
            
            const BASE_URL = window.BASE_APP_URL;
            let pageData = null;
            let allCategories = [];
            
            // Função para mostrar skeleton durante carregamento de filtros
            function showFilterSkeleton() {
                const appContainer = document.querySelector('.app-container');
                if (!appContainer) return;
                
                // Esconder conteúdo atual
                const recipesList = document.getElementById('recipes-list');
                const loadingState = document.getElementById('loading-state');
                const emptyState = document.getElementById('empty-state');
                
                if (recipesList) recipesList.style.display = 'none';
                if (loadingState) loadingState.style.display = 'none';
                if (emptyState) emptyState.style.display = 'none';
                
                // Criar ou atualizar skeleton
                let skeleton = appContainer.querySelector('.filter-skeleton');
                if (!skeleton) {
                    skeleton = document.createElement('div');
                    skeleton.className = 'filter-skeleton';
                    appContainer.appendChild(skeleton);
                }
                
                // Skeleton para lista de receitas favoritas
                skeleton.innerHTML = `
                    <div style="padding: 0 1rem; display: flex; flex-direction: column; gap: 8px;">
                        ${Array.from({ length: 6 }, () => `
                            <div style="display: flex; gap: 1rem; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;">
                                <div class="skeleton" style="width: 64px; height: 64px; border-radius: 12px; flex-shrink: 0;"></div>
                                <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
                                    <div class="skeleton" style="height: 16px; width: 70%; border-radius: 8px;"></div>
                                    <div class="skeleton" style="height: 14px; width: 50%; border-radius: 8px;"></div>
                                </div>
                                <div class="skeleton" style="width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;"></div>
                            </div>
                        `).join('')}
                    </div>
                `;
                
                skeleton.style.display = 'block';
            }
            
            // Função para esconder skeleton
            function hideFilterSkeleton() {
                const skeleton = document.querySelector('.filter-skeleton');
                if (skeleton) {
                    skeleton.style.display = 'none';
                }
            }
            
            // Carregar dados da página
            async function loadPageData(customParams = null) {
                try {
                    let query, sort, categories;
                    
                    if (customParams) {
                        query = customParams.query || '';
                        sort = customParams.sort || '';
                        categories = customParams.categories || '';
                    } else {
                        const urlParams = new URLSearchParams(window.location.search);
                        query = urlParams.get('q') || '';
                        sort = urlParams.get('sort') || '';
                        categories = urlParams.get('categories') || '';
                    }
                    
                    // Mostrar skeleton durante carregamento (só se for atualização dinâmica)
                    if (customParams) {
                        showFilterSkeleton();
                    }
                    
                    const recipesList = document.getElementById('recipes-list');
                    
                    const apiUrl = `/api/get_favorite_recipes_data.php?q=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&categories=${encodeURIComponent(categories)}`;
                    const response = await authenticatedFetch(apiUrl);
                    
                    if (!response) {
                        hideFilterSkeleton();
                        return; // Token inválido, já redirecionou
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
                    
                    // Renderizar receitas
                    renderRecipes();
                    
                    // Esconder skeleton após renderizar
                    if (customParams) {
                        hideFilterSkeleton();
                    }
                    
                    // Restaurar estado dos filtros (só na primeira vez)
                    if (!customParams) {
                        restoreFiltersState();
                    }
                    
                    // Atualizar URL sem recarregar
                    if (customParams) {
                        const url = new URL(window.location.origin + window.location.pathname);
                        if (query) url.searchParams.set('q', query);
                        if (sort) url.searchParams.set('sort', sort);
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
                            <p>Erro ao carregar receitas favoritas. Tente novamente.</p>
                        `;
                        loadingState.style.display = 'block';
                    }
                }
            }
            
            function renderCategories() {
                const container = document.getElementById('category-options');
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
            
            function renderRecipes() {
                document.getElementById('loading-state').style.display = 'none';
                
                if (pageData.recipes && pageData.recipes.length > 0) {
                    document.getElementById('recipes-list').style.display = 'flex';
                    document.getElementById('empty-state').style.display = 'none';
                    
                    const recipesHtml = pageData.recipes.map(recipe => {
                        const imageUrl = recipe.image_url 
                            || (recipe.image_filename ? `${BASE_URL}/assets/images/recipes/${recipe.image_filename}` : null)
                            || `${BASE_URL}/assets/images/recipes/placeholder_food.jpg`;
                        
                        return `
                            <a href="view_recipe.html?id=${recipe.id}" class="recipe-list-item glass-card">
                                <img src="${imageUrl}" alt="${escapeHtml(recipe.name)}" class="recipe-list-image" loading="eager" decoding="async" onerror="this.src='${BASE_URL}/assets/images/recipes/placeholder_food.jpg'">
                                <div class="recipe-list-info">
                                    <h3>${escapeHtml(recipe.name)}</h3>
                                    <span class="kcal"><i class="fas fa-fire-alt"></i> ${Math.round(recipe.kcal_per_serving || 0)} kcal</span>
                                </div>
                                <div class="favorite-icon"><i class="fas fa-heart"></i></div>
                            </a>
                        `;
                    }).join('');
                    
                    document.getElementById('recipes-list').innerHTML = recipesHtml;
                } else {
                    document.getElementById('recipes-list').style.display = 'none';
                    document.getElementById('empty-state').style.display = 'block';
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    const isFiltered = urlParams.has('q') || urlParams.has('sort') || urlParams.has('categories');
                    document.getElementById('empty-message').innerHTML = isFiltered
                        ? 'Nenhuma receita favorita encontrada com estes filtros.'
                        : 'Você ainda não favoritou nenhuma receita.<br><span style="color: var(--accent-orange);">Toque no coração para guardá-las aqui.</span>';
                }
            }
            
            function restoreFiltersState() {
                const urlParams = new URLSearchParams(window.location.search);
                
                // Restaurar ordenação
                const initialSort = urlParams.get('sort') || '';
                setTimeout(() => {
                    const sortRadio = document.querySelector(`input[name="sort"][value="${initialSort}"]`);
                    if (sortRadio) sortRadio.checked = true;
                    
                    // Restaurar categorias
                    const initialCategories = (urlParams.get('categories') || '').split(',').filter(c => c);
                    initialCategories.forEach(catId => {
                        const checkbox = document.getElementById(`cat_${catId}`);
                        if (checkbox) checkbox.checked = true;
                    });
                    
                    // Marcar botão de filtro como ativo
                    const filterButton = document.getElementById('filter-button');
                    if (filterButton && (urlParams.has('sort') || urlParams.has('categories') || urlParams.has('q'))) {
                        filterButton.classList.add('active');
                    }
                }, 100);
            }
            
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // Carregar dados ao iniciar
            loadPageData();
            
            // Script de filtro - executar após DOM estar pronto
            function setupFilterModal() {
                const filterButton = document.getElementById('filter-button');
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
                        // Mostrar bottom nav
                        const bottomNav = document.getElementById('bottom-nav-container');
                        if (bottomNav) {
                            bottomNav.style.transform = '';
                        }
                        if (window.BottomNavAPI) {
                            window.BottomNavAPI.show();
                        }
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
                
                const searchInput = document.getElementById('search-input');
                const applyFiltersBtn = document.getElementById('apply-filters-btn');
                const clearFiltersBtn = document.getElementById('clear-filters-btn');
                
                // Função para voltar ao estado original
                const resetToOriginal = async () => {
                    // Fechar modal
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
                    document.querySelectorAll('#category-options input').forEach(c => c.checked = false);
                    
                    // Atualizar URL ANTES de carregar dados (importante!)
                    window.history.replaceState({}, '', '/favoritos');
                    
                    // Carregar dados sem filtros - passar parâmetros vazios explicitamente
                    await loadPageData({
                        query: '',
                        sort: '',
                        categories: ''
                    });
                };
                
                const applyAndRedirect = async () => {
                    const query = searchInput ? searchInput.value.trim() : '';
                    const sortValueInput = document.querySelector('input[name="sort"]:checked');
                    const sortValue = sortValueInput ? sortValueInput.value : '';
                    const selectedCategories = Array.from(document.querySelectorAll('#category-options input:checked')).map(input => input.value);
                    
                    // Verificar se há filtros ativos
                    const hasActiveFilters = query || sortValue || selectedCategories.length > 0;
                    
                    // Se não há filtros, voltar ao estado original com transição fluida
                    if (!hasActiveFilters) {
                        await resetToOriginal();
                        return;
                    }
                    
                    // Fechar modal primeiro
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
                
                if (applyFiltersBtn) {
                    applyFiltersBtn.addEventListener('click', applyAndRedirect);
                }
                
                if (clearFiltersBtn) {
                    clearFiltersBtn.addEventListener('click', () => {
                        resetToOriginal();
                    });
                }
                
                if (searchInput) {
                    let debounceTimer;
                    searchInput.addEventListener('input', () => {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(async () => {
                            const urlParams = new URLSearchParams(window.location.search);
                            const currentQuery = urlParams.get('q') || '';
                            const newQuery = searchInput.value.trim();
                            if (currentQuery !== newQuery) {
                                const sortValueInput = document.querySelector('input[name="sort"]:checked');
                                const sortValue = sortValueInput ? sortValueInput.value : '';
                                const selectedCategories = Array.from(document.querySelectorAll('#category-options input:checked')).map(input => input.value);
                                
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
            
            // Executar quando DOM estiver pronto
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setupFilterModal);
            } else {
                setupFilterModal();
            }
        })();
    
})();
