/**
 * bottom-nav.js - Bottom Navigation Controller
 * Animação que ACOMPANHA O DEDO durante o arrasto
 */

(function() {
    'use strict';
    
    // Prevenir re-execução
    if (window.BottomNavInitialized) return;
    window.BottomNavInitialized = true;

    // ============================================
    // CONFIGURAÇÃO
    // ============================================
    const CONFIG = {
        followFactor: 1.0,
        velocityThreshold: 0.25,
        hiddenPages: ['auth_login', 'auth_register', 'login', 'register', 'onboarding', 'bem-vindo']
    };

    // ============================================
    // MAPA DE PÁGINAS -> TAB ATIVA
    // ============================================
    const pageMap = {
        'main_app': 'home',
        'dashboard': 'home',
        'ranking': 'home',
        'progress': 'stats',
        'measurements_progress': 'stats',
        'points_history': 'stats',
        'diary': 'diary',
        'add_food_to_diary': 'diary',
        'edit_meal': 'diary',
        'create_custom_food': 'diary',
        'explore_recipes': 'explore',
        'favorite_recipes': 'explore',
        'view_recipe': 'explore',
        'more_options': 'settings',
        'profile_overview': 'settings',
        'edit_profile': 'settings',
        'routine': 'settings',
        'content': 'settings',
        'view_content': 'settings'
    };

    // ============================================
    // ESTADO
    // ============================================
    let state = {
        offset: 0,
        navHeight: 0,
        touchStartY: 0,
        touchStartOffset: 0,
        lastTouchY: 0,
        lastTouchTime: 0,
        velocity: 0,
        isTouching: false,
        scrollContainer: null,
        navContainer: null,
        lastScrollY: 0
    };

    // ============================================
    // FUNÇÕES DE CONTROLE DO NAV
    // ============================================
    
    function setNavOffset(offset, animate = false) {
        if (!state.navContainer) return;
        
        const clampedOffset = Math.max(0, Math.min(offset, state.navHeight));
        state.offset = clampedOffset;
        
        if (animate) {
            state.navContainer.classList.add('smooth-transition');
        } else {
            state.navContainer.classList.remove('smooth-transition');
        }
        
        state.navContainer.style.transform = `translateY(${clampedOffset}px) translateZ(0)`;
    }

    function showNav(animate = true) {
        setNavOffset(0, animate);
    }

    function hideNav(animate = true) {
        setNavOffset(state.navHeight, animate);
    }

    function snapToPosition() {
        const shouldHide = state.velocity > CONFIG.velocityThreshold || 
                          (state.offset > state.navHeight * 0.4 && state.velocity >= 0);
        
        if (shouldHide) {
            hideNav(true);
        } else {
            showNav(true);
        }
    }

    // ============================================
    // HANDLERS DE TOUCH
    // ============================================
    
    function handleTouchStart(e) {
        if (!state.navContainer) return;
        
        state.isTouching = true;
        state.touchStartY = e.touches[0].clientY;
        state.touchStartOffset = state.offset;
        state.lastTouchY = state.touchStartY;
        state.lastTouchTime = performance.now();
        state.velocity = 0;
        
        state.navContainer.classList.remove('smooth-transition');
    }

    function handleTouchMove(e) {
        if (!state.isTouching || !state.navContainer) return;
        
        const currentY = e.touches[0].clientY;
        const currentTime = performance.now();
        const deltaFromStart = state.touchStartY - currentY;
        const deltaTime = currentTime - state.lastTouchTime;
        const deltaY = state.lastTouchY - currentY;
        
        if (deltaTime > 0) {
            state.velocity = deltaY / deltaTime;
        }
        
        let newOffset = state.touchStartOffset + (deltaFromStart * CONFIG.followFactor);
        newOffset = Math.max(0, Math.min(newOffset, state.navHeight));
        
        setNavOffset(newOffset, false);
        
        state.lastTouchY = currentY;
        state.lastTouchTime = currentTime;
    }

    function handleTouchEnd() {
        if (!state.isTouching) return;
        state.isTouching = false;
        snapToPosition();
    }

    // ============================================
    // HANDLER DE SCROLL
    // ============================================
    
    function handleScroll() {
        if (!state.scrollContainer || !state.navContainer) return;
        if (state.navContainer.classList.contains('hidden')) return;
        if (state.isTouching) return;
        
        const currentScrollY = state.scrollContainer.scrollTop;
        const deltaY = currentScrollY - state.lastScrollY;
        
        if (currentScrollY < 30) {
            showNav(true);
        } else if (deltaY > 10) {
            hideNav(true);
        } else if (deltaY < -10) {
            showNav(true);
        }
        
        state.lastScrollY = currentScrollY;
    }

    // ============================================
    // EXTRAIR NOME DA PÁGINA
    // ============================================
    
    function getPageNameFromPath(path) {
        if (!path) path = window.location.pathname;
        
        // Remover query string
        path = path.split('?')[0];
        
        // Extrair nome do arquivo
        let pageName = path.split('/').pop().replace('.html', '');
        
        // Se for vazio ou index, é main_app
        if (!pageName || pageName === '' || pageName === 'index') {
            pageName = 'main_app';
        }
        
        // Se vier de fragments, pegar só o nome
        if (path.includes('/fragments/')) {
            pageName = path.split('/fragments/').pop().replace('.html', '');
        }
        
        return pageName;
    }

    // ============================================
    // ATUALIZAR ITEM ATIVO
    // ============================================
    
    function updateActiveMenuItem(path) {
        const pageName = getPageNameFromPath(path);
        const activeTab = pageMap[pageName] || 'home';
        
        console.log('[BottomNav] Página:', pageName, '-> Tab:', activeTab);
        
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === activeTab) {
                item.classList.add('active');
            }
        });
    }

    function shouldHideNav(pageName) {
        return CONFIG.hiddenPages.some(p => pageName && pageName.includes(p));
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    function init() {
        state.scrollContainer = document.getElementById('app-container');
        state.navContainer = document.getElementById('bottom-nav-container');
        
        if (!state.scrollContainer || !state.navContainer) {
            setTimeout(init, 100);
            return;
        }

        requestAnimationFrame(() => {
            state.navHeight = state.navContainer.offsetHeight || 70;
        });

        // Touch events
        state.scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        state.scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
        state.scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
        state.scrollContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        // Scroll event
        let scrollTicking = false;
        state.scrollContainer.addEventListener('scroll', () => {
            if (!scrollTicking && !state.isTouching) {
                requestAnimationFrame(() => {
                    handleScroll();
                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        }, { passive: true });

        // Atualizar item ativo inicial
        updateActiveMenuItem();
        
        console.log('[BottomNav] ✅ Inicializado');
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    // Quando página carrega via router
    window.addEventListener('pageLoaded', (e) => {
        const path = e.detail?.path || window.location.pathname;
        const pageName = getPageNameFromPath(path);
        
        if (shouldHideNav(pageName)) {
            if (state.navContainer) {
                state.navContainer.classList.add('hidden');
            }
        } else {
            if (state.navContainer) {
                state.navContainer.classList.remove('hidden');
                showNav(false);
            }
            updateActiveMenuItem(path);
        }
        
        state.lastScrollY = 0;
        state.offset = 0;
    });

    // Quando fragmento está pronto
    window.addEventListener('fragmentReady', (e) => {
        const path = e.detail?.path || window.location.pathname;
        updateActiveMenuItem(path);
    });

    // Navegação browser
    window.addEventListener('popstate', () => {
        updateActiveMenuItem();
    });

    // Iniciar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
