
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
                    
                    const recipesList = document.getElementById('recipes-list');
                    
                    const apiUrl = `/api/get_favorite_recipes_data.php?q=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&categories=${encodeURIComponent(categories)}`;
                    const response = await authenticatedFetch(apiUrl);
                    
                    if (!response) return; // Token inválido, já redirecionou
                    
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
                    document.getElementById('loading-state').innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--accent-orange);"></i>
                        <p>Erro ao carregar receitas favoritas. Tente novamente.</p>
                    `;
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
                
                if (filterButton && filterModal) {
                    const modalContent = filterModal.querySelector('.modal-content');
                    const closeModal = () => {
                        filterModal.classList.remove('visible');
                        // Resetar transform quando fechar
                        setTimeout(() => {
                            modalContent.style.transform = '';
                            modalContent.style.transition = '';
                        }, 350);
                        // Usar API do bottom nav
                        if (window.BottomNavAPI) {
                            window.BottomNavAPI.show();
                        }
                    };
                    
                    const toggleModal = () => {
                        const isOpening = !filterModal.classList.contains('visible');
                        filterModal.classList.toggle('visible');
                        
                        // Resetar transform quando abrir
                        if (isOpening) {
                            modalContent.style.transform = '';
                            modalContent.style.transition = '';
                        } else {
                            // Resetar transform quando fechar
                            setTimeout(() => {
                                modalContent.style.transform = '';
                                modalContent.style.transition = '';
                            }, 350);
                        }
                        
                        // Usar API do bottom nav
                        if (window.BottomNavAPI) {
                            if (filterModal.classList.contains('visible')) {
                                window.BottomNavAPI.hide();
                            } else {
                                window.BottomNavAPI.show();
                            }
                        }
                    };
                    
                    filterButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleModal();
                    });
                    
                    filterModal.addEventListener('click', (e) => {
                        if (e.target === filterModal) {
                            closeModal();
                        }
                    });
                    
                    // Funcionalidade de arrastar para fechar
                    const modalHeader = modalContent.querySelector('.modal-header');
                    if (modalHeader) {
                        let startY = 0;
                        let isDragging = false;
                        
                        modalHeader.addEventListener('touchstart', (e) => {
                            startY = e.touches[0].clientY;
                            isDragging = true;
                            modalContent.style.transition = 'none';
                        }, { passive: true });
                        
                        modalHeader.addEventListener('touchmove', (e) => {
                            if (!isDragging) return;
                            const currentY = e.touches[0].clientY;
                            const deltaY = currentY - startY;
                            if (deltaY > 0) {
                                modalContent.style.transform = `translateY(${deltaY}px)`;
                            }
                        }, { passive: true });
                        
                        modalHeader.addEventListener('touchend', (e) => {
                            if (!isDragging) return;
                            isDragging = false;
                            modalContent.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
                            const currentY = e.changedTouches[0].clientY;
                            const deltaY = currentY - startY;
                            const threshold = modalContent.offsetHeight * 0.3;
                            
                            if (deltaY > threshold) {
                                closeModal();
                            } else {
                                modalContent.style.transform = 'translateY(0)';
                                // Resetar transform após animação
                                setTimeout(() => {
                                    modalContent.style.transform = '';
                                    modalContent.style.transition = '';
                                }, 400);
                            }
                        }, { passive: true });
                    }
                }
                
                const searchInput = document.getElementById('search-input');
                const applyFiltersBtn = document.getElementById('apply-filters-btn');
                const clearFiltersBtn = document.getElementById('clear-filters-btn');
                
                // Função para voltar ao estado original com transição fluida
                const resetToOriginal = async () => {
                    // Fechar modal suavemente
                    filterModal.classList.remove('visible');
                    document.body.style.overflow = '';
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
                    document.body.style.overflow = '';
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
