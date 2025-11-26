
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

// Carregar dados da página
const BASE_URL = window.BASE_APP_URL;
let pageData = null;
let allCategories = [];

async function loadPageData(customParams = null) {
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
        
        // Mostrar loading suave (só se for atualização dinâmica)
        const recipesList = document.getElementById('recipes-list');
        const categoriesGrid = document.getElementById('categories-grid');
        const loadingState = document.getElementById('loading-state');
        
        // Não fazer fade durante loading - deixar transição mais suave
        
        const apiUrl = `/api/get_explore_recipes_data.php?q=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&categories=${encodeURIComponent(categories)}`;
        const response = await authenticatedFetch(apiUrl);
        if (!response) return;
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
        
        if (hasActiveFilters) {
            renderFilteredView();
        } else {
            renderCarouselView();
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
        document.getElementById('loading-state').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--accent-orange);"></i>
            <p>Erro ao carregar receitas. Tente novamente.</p>
        `;
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

function renderFilteredView() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('categories-grid').style.display = 'none';
    document.getElementById('recipes-list').style.display = 'block';
    
    const recipesList = document.getElementById('recipes-list');
    
    if (pageData.recipes && pageData.recipes.length > 0) {
        recipesList.innerHTML = pageData.recipes.map(recipe => `
            <a href="view_recipe.html?id=${recipe.id}" class="recipe-item">
                <img src="${recipe.image_url || `${BASE_URL}/assets/images/recipes/${recipe.image_filename || 'placeholder_food.jpg'}`}" 
                     alt="${escapeHtml(recipe.name)}" 
                     class="recipe-image"
                     loading="eager"
                     decoding="async"
                     onerror="this.src='${BASE_URL}/assets/images/recipes/placeholder_food.jpg'">
                <div class="recipe-info">
                    <h3 class="recipe-name">${escapeHtml(recipe.name)}</h3>
                    <span class="recipe-kcal">
                        <i class="fas fa-fire-alt"></i>
                        ${Math.round(recipe.kcal_per_serving || 0)} kcal
                    </span>
                </div>
            </a>
        `).join('');
    } else {
        recipesList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Nenhuma receita encontrada com estes filtros.</p>
            </div>
        `;
    }
    
    // Mostrar filtros ativos
    if (pageData.active_filter_names && pageData.active_filter_names.length > 0) {
        document.getElementById('active-filters-text').textContent = pageData.active_filter_names.join(', ');
        document.getElementById('active-filters-container').style.display = 'block';
    } else {
        document.getElementById('active-filters-container').style.display = 'none';
    }
}

function renderCarouselView() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('recipes-list').style.display = 'none';
    document.getElementById('categories-grid').style.display = 'block';
    document.getElementById('active-filters-container').style.display = 'none';
    
    const categoriesGrid = document.getElementById('categories-grid');
    
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
                            <img src="${recipe.image_url || `${BASE_URL}/assets/images/recipes/${recipe.image_filename || 'placeholder_food.jpg'}`}"
                                 onerror="this.src='${BASE_URL}/assets/images/recipes/placeholder_food.jpg'" 
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

// Carregar dados ao iniciar (aguardar autenticação)
(async () => {
    const authenticated = await requireAuth();
    if (!authenticated) return;
    await loadPageData();
})();

function initExploreRecipesUI() {
    console.log('[ExploreRecipes] initExploreRecipesUI chamado');
    
    // Elementos
    const filterBtn = document.getElementById('filter-btn');
    const filterModal = document.getElementById('filter-modal');
    if (!filterBtn || !filterModal) {
        console.log('[ExploreRecipes] Elementos de filtro não encontrados');
        return;
    }
    const modalContent = filterModal.querySelector('.modal-content');
    const searchInput = document.getElementById('search-input');
    const applyBtn = document.getElementById('apply-filters');
    const clearBtn = document.getElementById('clear-filters');
    
    // Funções do Modal
    if (filterBtn && filterModal) {
        const openModal = () => {
            modalContent.style.transform = ''; 
            filterModal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            // Usar API do bottom nav se disponível
            if (window.BottomNavAPI) {
                window.BottomNavAPI.hide();
            }
        };
        
        const closeModal = () => {
            filterModal.classList.remove('visible');
            document.body.style.overflow = '';
            // Usar API do bottom nav se disponível
            if (window.BottomNavAPI) {
                window.BottomNavAPI.show();
            }
        };
        
        filterBtn.addEventListener('click', openModal);
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
                }
            }, { passive: true });
        }
    }
    
    // Função para voltar ao estado original (carrossel) com transição fluida
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
    document.addEventListener('DOMContentLoaded', initExploreRecipesUI);
} else {
    // DOM já carregado, executar imediatamente
    initExploreRecipesUI();
}

// Também escutar eventos do SPA router
window.addEventListener('fragmentReady', initExploreRecipesUI);
window.addEventListener('pageLoaded', initExploreRecipesUI);

})();
