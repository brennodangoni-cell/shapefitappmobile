/**
 * bottom-nav.js - Controle de Ativação do Menu SPA
 * + Efeito Auto-Hide (estilo Twitter)
 */

(function() {
    // CORREÇÃO CRÍTICA: Impede re-execução se o script for carregado 2x
    if (window.BottomNavInitialized) return;
    window.BottomNavInitialized = true;

    // ============================================
    // AUTO-HIDE DO MENU (Acompanha o scroll)
    // ============================================
    let lastScrollY = 0;
    let navOffset = 0; // Quanto o nav está "escondido" (0 = visível, navHeight = escondido)
    let navHeight = 70; // Altura aproximada do nav
    let safeAreaBottom = 0; // Safe area do iPhone
    let ticking = false;
    
    function handleNavScroll() {
        const navContainer = document.getElementById('bottom-nav-container');
        const scrollContainer = document.getElementById('app-container');
        
        if (!navContainer || !scrollContainer) return;
        if (navContainer.classList.contains('hidden')) return;
        
        const currentScrollY = scrollContainer.scrollTop;
        const scrollDiff = currentScrollY - lastScrollY;
        
        // Altura total a esconder = altura do nav + safe area bottom
        const totalHeight = navHeight + safeAreaBottom;
        
        // Calcular novo offset baseado na direção do scroll
        if (currentScrollY < 30) {
            // No topo - sempre mostrar
            navOffset = 0;
        } else {
            // Adiciona ou subtrai do offset baseado na direção
            navOffset += scrollDiff;
            
            // Limitar entre 0 e totalHeight (nav + safe area)
            navOffset = Math.max(0, Math.min(navOffset, totalHeight));
        }
        
        // Aplicar transform diretamente (fluido)
        navContainer.style.transform = `translateY(${navOffset}px)`;
        
        lastScrollY = currentScrollY;
    }
    
    function initAutoHide() {
        const scrollContainer = document.getElementById('app-container');
        const navContainer = document.getElementById('bottom-nav-container');
        
        if (!scrollContainer || !navContainer) {
            setTimeout(initAutoHide, 100);
            return;
        }
        
        // Aguardar um frame pra garantir que o layout foi calculado
        requestAnimationFrame(() => {
            // Pegar altura REAL do nav (JÁ INCLUI o padding da safe area)
            navHeight = navContainer.offsetHeight || 100;
            
            // Não precisa de safe area extra - offsetHeight já inclui tudo
            safeAreaBottom = 0;
            
            console.log('[BottomNav] Auto-hide ativado! Altura:', navHeight);
        });
        
        scrollContainer.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    handleNavScroll();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }
    
    // Iniciar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutoHide);
    } else {
        setTimeout(initAutoHide, 150);
    }
    
    // Páginas que NÃO devem mostrar o bottom nav
    const pagesWithoutNav = ['auth_login', 'auth_register', 'login', 'register', 'onboarding'];
    
    function shouldHideNav(pageName) {
        return pagesWithoutNav.some(p => pageName.includes(p));
    }
    
    // Reset ao mudar de página
    window.addEventListener('pageLoaded', function(e) {
        const navContainer = document.getElementById('bottom-nav-container');
        if (!navContainer) return;
        
        // Verificar se deve esconder o nav nesta página
        const pageName = e.detail?.pageName || window.location.pathname;
        if (shouldHideNav(pageName)) {
            navContainer.style.display = 'none';
        } else {
            navContainer.style.display = 'block';
            navContainer.style.transform = 'translateY(0)';
            navOffset = 0;
        }
        lastScrollY = 0;
    });

    // ============================================
    // MAPEAMENTO DE PÁGINAS
    // ============================================
    const pageMap = {
        // HOME
        'main_app': 'home',
        'dashboard': 'home',
        'ranking': 'home',

        // STATS
        'progress': 'stats',
        'measurements_progress': 'stats',
        'points_history': 'stats',

        // DIARY
        'diary': 'diary',
        'add_food_to_diary': 'diary',
        'meal_types_overview': 'diary',

        // EXPLORE
        'explore_recipes': 'explore',
        'favorite_recipes': 'explore',
        'view_recipe': 'explore',

        // SETTINGS
        'more_options': 'settings',
        'profile_overview': 'settings',
        'edit_profile': 'settings',
        'routine': 'settings'
    };

    function updateActiveMenuItem() {
        let currentPath = window.location.pathname;
        let pageName = currentPath.split('/').pop().replace('.html', '');
        
        // Se for URL bonita (ex: /diario), mapear para nome do arquivo
        const urlToFileMap = {
            '/diario': 'diary',
            '/dashboard': 'main_app',
            '/evolucao': 'progress',
            '/explorar': 'explore_recipes',
            '/mais-opcoes': 'more_options',
            '/perfil': 'profile_overview',
            '/ranking': 'ranking',
            '/': 'main_app',
            '': 'main_app'
        };
        
        // Se a URL está no mapa, usar o nome do arquivo correspondente
        if (urlToFileMap[currentPath]) {
            pageName = urlToFileMap[currentPath];
        }
        
        // Se ainda não encontrou, tentar extrair do pathname
        if (!pageName || pageName === 'index') {
            pageName = 'main_app';
        }

        const activeTab = pageMap[pageName] || 'home';
        
        console.log('[BottomNav] Página atual:', pageName, '-> Tab ativa:', activeTab);

        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === activeTab) {
                item.classList.add('active');
                console.log('[BottomNav] Item ativado:', activeTab);
            }
        });
    }

    window.addEventListener('pageLoaded', function(event) {
        // Usar pageName do evento se disponível
        if (event.detail && event.detail.pageName) {
            const pageName = event.detail.pageName;
            const activeTab = pageMap[pageName] || 'home';
            
            const navItems = document.querySelectorAll('.bottom-nav .nav-item');
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-page') === activeTab) {
                    item.classList.add('active');
                    console.log('[BottomNav] Item ativado via pageLoaded:', activeTab);
                }
            });
        } else {
            updateActiveMenuItem();
        }
    });
    window.addEventListener('popstate', updateActiveMenuItem);
    // Também atualizar quando o router dispara fragmentReady
    window.addEventListener('fragmentReady', updateActiveMenuItem);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateActiveMenuItem);
    } else {
        updateActiveMenuItem();
    }
})();