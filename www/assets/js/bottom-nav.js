/**
 * bottom-nav.js - Controle de Ativação do Menu SPA
 * + Efeito Auto-Hide (estilo Twitter)
 */

(function() {
    // CORREÇÃO CRÍTICA: Impede re-execução se o script for carregado 2x
    if (window.BottomNavInitialized) return;
    window.BottomNavInitialized = true;

    // ============================================
    // AUTO-HIDE DO MENU (Acompanha o dedo suavemente)
    // ============================================
    let lastScrollY = 0;
    let navOffset = 0;
    let navHeight = 0;
    let ticking = false;
    let isScrolling = null;
    
    function handleNavScroll() {
        const navContainer = document.getElementById('bottom-nav-container');
        const scrollContainer = document.getElementById('app-container');
        
        if (!navContainer || !scrollContainer) return;
        if (navContainer.style.display === 'none') return;
        
        const currentScrollY = scrollContainer.scrollTop;
        const scrollDiff = currentScrollY - lastScrollY;
        
        // No topo da página - sempre mostrar completamente
        if (currentScrollY < 20) {
            navOffset = 0;
        } else {
            // Acompanhar o movimento do dedo
            // scrollDiff positivo = scrollando pra baixo = esconder
            // scrollDiff negativo = scrollando pra cima = mostrar
            navOffset += scrollDiff * 0.8; // 0.8 = fator de suavização
            
            // Limitar entre 0 (visível) e navHeight (escondido)
            navOffset = Math.max(0, Math.min(navOffset, navHeight));
        }
        
        // Aplicar transform SEM transição (movimento direto)
        navContainer.style.transform = `translateY(${navOffset}px)`;
        
        lastScrollY = currentScrollY;
        
        // Detectar quando parou de scrollar pra "encaixar" na posição final
        clearTimeout(isScrolling);
        isScrolling = setTimeout(function() {
            // Snap: se passou de metade, esconde; senão, mostra
            const targetOffset = navOffset > navHeight / 2 ? navHeight : 0;
            if (targetOffset !== navOffset) {
                navContainer.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                navContainer.style.transform = `translateY(${targetOffset}px)`;
                navOffset = targetOffset;
                // Remover transição após o snap
                setTimeout(() => {
                    navContainer.style.transition = 'none';
                }, 260);
            }
        }, 100);
    }
    
    function initAutoHide() {
        const scrollContainer = document.getElementById('app-container');
        const navContainer = document.getElementById('bottom-nav-container');
        
        if (!scrollContainer || !navContainer) {
            setTimeout(initAutoHide, 100);
            return;
        }
        
        // Calcular altura do nav após renderização
        requestAnimationFrame(() => {
            navHeight = navContainer.offsetHeight || 80;
            console.log('[BottomNav] Altura:', navHeight);
        });
        
        // SEM transição inicial - movimento direto
        navContainer.style.transition = 'none';
        
        console.log('[BottomNav] Auto-hide fluido ativado!');
        
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