/**
 * bottom-nav.js - Bottom Navigation Controller
 * Animação fluida que acompanha o dedo durante o arrasto
 * OTIMIZADO para iOS com requestAnimationFrame
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
        followFactor: 0.8,          // Suavidade do acompanhamento (0-1)
        velocityThreshold: 0.15,    // Threshold menor = mais responsivo
        scrollThreshold: 5,         // Pixels mínimos para detectar scroll
        hiddenPages: ['auth_login', 'auth_register', 'login', 'register', 'onboarding', 'bem-vindo', 'account_deleted']
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
        targetOffset: 0,
        currentOffset: 0,
        navHeight: 0,
        touchStartY: 0,
        touchStartOffset: 0,
        lastTouchY: 0,
        lastTouchTime: 0,
        velocity: 0,
        isTouching: false,
        scrollContainer: null,
        navContainer: null,
        lastScrollY: 0,
        rafId: null,
        isAnimating: false
    };

    // ============================================
    // LOOP DE ANIMAÇÃO (RAF)
    // ============================================
    
    function animationLoop() {
        if (!state.navContainer) {
            state.isAnimating = false;
            return;
        }
        
        // ✅ DESABILITAR COMPLETAMENTE DURANTE TRANSIÇÕES
        if (document.body.classList.contains('page-transitioning') || 
            document.documentElement.classList.contains('page-transitioning') ||
            document.body.classList.contains('page-loading') ||
            document.body.classList.contains('page-ready')) {
            state.isAnimating = false;
            if (state.rafId) {
                cancelAnimationFrame(state.rafId);
                state.rafId = null;
            }
            // ✅ FORÇAR FIXO - SEM QUALQUER TRANSFORM
            state.navContainer.style.cssText = `
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                transform: none !important;
                -webkit-transform: none !important;
                transition: none !important;
                animation: none !important;
                will-change: auto !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
            `;
            return;
        }
        
        // Interpolação suave (apenas quando NÃO está em transição)
        const diff = state.targetOffset - state.currentOffset;
        
        if (Math.abs(diff) < 0.5) {
            state.currentOffset = state.targetOffset;
            state.isAnimating = false;
            // ✅ Se offset é 0, usar none em vez de transform
            if (state.currentOffset === 0) {
                state.navContainer.style.transform = 'none';
                state.navContainer.style.webkitTransform = 'none';
            } else {
                state.navContainer.style.transform = `translateY(${state.currentOffset}px) translateZ(0)`;
                state.navContainer.style.webkitTransform = `translateY(${state.currentOffset}px) translateZ(0)`;
            }
        } else {
            // Lerp com fator mais alto durante touch
            const lerpFactor = state.isTouching ? 0.5 : 0.25;
            state.currentOffset += diff * lerpFactor;
            state.rafId = requestAnimationFrame(animationLoop);
            
            // ✅ Se offset é 0, usar none em vez de transform
            if (Math.abs(state.currentOffset) < 0.5) {
                state.navContainer.style.transform = 'none';
                state.navContainer.style.webkitTransform = 'none';
            } else {
                state.navContainer.style.transform = `translateY(${state.currentOffset}px) translateZ(0)`;
                state.navContainer.style.webkitTransform = `translateY(${state.currentOffset}px) translateZ(0)`;
            }
        }
    }
    
    function startAnimation() {
        if (!state.isAnimating) {
            state.isAnimating = true;
            state.rafId = requestAnimationFrame(animationLoop);
        }
    }

    // ============================================
    // FUNÇÕES DE CONTROLE DO NAV
    // ============================================
    
    function setNavOffset(offset, immediate = false) {
        if (!state.navContainer) return;
        
        state.targetOffset = Math.max(0, Math.min(offset, state.navHeight));
        
        if (immediate) {
            state.currentOffset = state.targetOffset;
            state.navContainer.style.transform = `translateY(${state.currentOffset}px) translateZ(0)`;
        } else {
            startAnimation();
        }
    }

    function showNav(immediate = false) {
        setNavOffset(0, immediate);
    }

    function hideNav(immediate = false) {
        setNavOffset(state.navHeight, immediate);
    }

    function snapToPosition() {
        const shouldHide = state.velocity > CONFIG.velocityThreshold || 
                          (state.currentOffset > state.navHeight * 0.35 && state.velocity >= 0);
        
        if (shouldHide) {
            hideNav(false);
        } else {
            showNav(false);
        }
    }

    // ============================================
    // HANDLERS DE TOUCH
    // ============================================
    
    function handleTouchStart(e) {
        if (!state.navContainer) return;
        
        state.isTouching = true;
        state.touchStartY = e.touches[0].clientY;
        state.touchStartOffset = state.currentOffset;
        state.lastTouchY = state.touchStartY;
        state.lastTouchTime = performance.now();
        state.velocity = 0;
    }

    function handleTouchMove(e) {
        if (!state.isTouching || !state.navContainer) return;
        
        const currentY = e.touches[0].clientY;
        const currentTime = performance.now();
        const deltaFromStart = state.touchStartY - currentY;
        const deltaTime = currentTime - state.lastTouchTime;
        const deltaY = state.lastTouchY - currentY;
        
        // Calcular velocidade com smoothing
        if (deltaTime > 0) {
            const instantVelocity = deltaY / deltaTime;
            state.velocity = state.velocity * 0.6 + instantVelocity * 0.4;
        }
        
        // Aplicar offset diretamente durante touch (seguir o dedo)
        let newOffset = state.touchStartOffset + (deltaFromStart * CONFIG.followFactor);
        state.targetOffset = Math.max(0, Math.min(newOffset, state.navHeight));
        startAnimation();
        
        state.lastTouchY = currentY;
        state.lastTouchTime = currentTime;
    }

    function handleTouchEnd() {
        if (!state.isTouching) return;
        state.isTouching = false;
        snapToPosition();
    }

    // ============================================
    // HANDLER DE SCROLL (quando não está tocando)
    // ============================================
    
    function handleScroll() {
        if (!state.scrollContainer || !state.navContainer) return;
        if (state.navContainer.classList.contains('hidden')) return;
        if (state.isTouching) return;
        
        // ✅ DESABILITAR COMPLETAMENTE DURANTE TRANSIÇÕES
        if (document.body.classList.contains('page-transitioning') ||
            document.body.classList.contains('page-loading') ||
            document.body.classList.contains('page-ready')) {
            // ✅ FORÇAR FIXO DURANTE TRANSIÇÕES
            state.navContainer.style.cssText = `
                position: fixed !important;
                bottom: 0 !important;
                transform: none !important;
                -webkit-transform: none !important;
            `;
            return;
        }
        
        const currentScrollY = state.scrollContainer.scrollTop;
        const deltaY = currentScrollY - state.lastScrollY;
        
        // No topo: sempre mostrar
        if (currentScrollY < 50) {
            showNav(false);
        } 
        // Scrollando para baixo: esconder
        else if (deltaY > CONFIG.scrollThreshold) {
            hideNav(false);
        } 
        // Scrollando para cima: mostrar
        else if (deltaY < -CONFIG.scrollThreshold) {
            showNav(false);
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
        
        // ✅ Log removido para performance
        
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

        // ✅ VERIFICAR SE É PÁGINA AUTH ANTES DE MOSTRAR
        const currentPath = window.location.pathname;
        const pageName = getPageNameFromPath(currentPath);
        const isAuth = shouldHideNav(pageName) || 
                      document.documentElement.classList.contains('auth-initial') ||
                      document.body.classList.contains('auth-mode');
        
        if (isAuth) {
            // Esconder imediatamente em páginas auth
            state.navContainer.style.cssText = `
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
            `;
            state.navContainer.classList.add('hidden');
            state.navContainer.classList.remove('nav-visible');
            return; // Não inicializar o sistema de scroll em páginas auth
        }

        // Medir altura do nav
        state.navHeight = state.navContainer.offsetHeight || 70;
        
        // ✅ Garantir que começa visível e 100% fixo
        state.currentOffset = 0;
        state.targetOffset = 0;
        // ✅ FORÇAR FIXO COM CSS INLINE E ADICIONAR CLASSE PARA MOSTRAR
        state.navContainer.classList.add('nav-visible');
        state.navContainer.style.cssText = `
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            transform: none !important;
            -webkit-transform: none !important;
            transition: none !important;
            animation: none !important;
            will-change: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
            display: block !important;
        `;

        // Touch events no container de scroll
        state.scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
        state.scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
        state.scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
        state.scrollContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        // Scroll event com throttle
        let lastScrollTime = 0;
        state.scrollContainer.addEventListener('scroll', () => {
            // ✅ DESABILITAR COMPLETAMENTE DURANTE TRANSIÇÕES
            if (document.body.classList.contains('page-transitioning') ||
                document.body.classList.contains('page-loading') ||
                document.body.classList.contains('page-ready')) {
                // ✅ FORÇAR FIXO
                if (state.navContainer) {
                    state.navContainer.style.cssText = `
                        position: fixed !important;
                        bottom: 0 !important;
                        transform: none !important;
                        -webkit-transform: none !important;
                    `;
                }
                return;
            }
            
            const now = performance.now();
            if (now - lastScrollTime > 16 && !state.isTouching) { // ~60fps
                lastScrollTime = now;
                handleScroll();
            }
        }, { passive: true });

        // Atualizar item ativo inicial
        updateActiveMenuItem();
        
        // ✅ Log removido para performance
    }

    // ============================================
    // API PÚBLICA (para modais/overlays)
    // ============================================
    
    window.BottomNavAPI = {
        hide: () => hideNav(false),
        show: () => showNav(false),
        hideImmediate: () => hideNav(true),
        showImmediate: () => showNav(true),
        isVisible: () => state.currentOffset < state.navHeight * 0.5
    };

    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    // Quando página carrega via router
    window.addEventListener('pageLoaded', (e) => {
        const path = e.detail?.path || window.location.pathname;
        const pageName = getPageNameFromPath(path);
        
        // Remover classe auth-initial quando sair de página de auth
        document.documentElement.classList.remove('auth-initial');
        
        // ✅ PARAR COMPLETAMENTE QUALQUER ANIMAÇÃO
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
        state.isAnimating = false;
        
        // ✅ DESABILITAR COMPLETAMENTE O SISTEMA DE SCROLL HIDE/SHOW
        state.isTouching = false;
        state.lastScrollY = 0;
        state.velocity = 0;
        state.currentOffset = 0;
        state.targetOffset = 0;
        
        if (shouldHideNav(pageName)) {
            // ✅ Apenas para auth pages - esconder
            if (state.navContainer) {
                state.navContainer.classList.add('hidden');
                state.navContainer.classList.remove('nav-visible');
            }
        } else {
            // ✅ SEMPRE MOSTRAR E MANTER FIXO
            if (state.navContainer) {
                state.navContainer.classList.remove('hidden');
                state.navContainer.classList.add('nav-visible');
                // Recalcular altura
                state.navHeight = state.navContainer.offsetHeight || 70;
                // ✅ FORÇAR POSIÇÃO FIXA - SEMPRE VISÍVEL
                state.navContainer.style.cssText = `
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    transform: translateZ(0) !important;
                    -webkit-transform: translateZ(0) !important;
                    transition: none !important;
                    animation: none !important;
                    will-change: transform !important;
                    z-index: 1000 !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    display: block !important;
                `;
            }
            updateActiveMenuItem(path);
        }
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

    // ✅ VERIFICAR SE É PÁGINA AUTH ANTES DE INICIALIZAR
    function shouldInit() {
        const path = window.location.pathname;
        const pageName = getPageNameFromPath(path);
        const isAuth = shouldHideNav(pageName) || 
                      document.documentElement.classList.contains('auth-initial') ||
                      document.body.classList.contains('auth-mode');
        
        if (isAuth) {
            // ✅ GARANTIR QUE ESTÁ ESCONDIDO E NÃO INICIALIZAR
            const navContainer = document.getElementById('bottom-nav-container');
            if (navContainer) {
                navContainer.style.cssText = 'display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; position: fixed !important; bottom: -1000px !important; height: 0 !important; width: 0 !important; overflow: hidden !important;';
                navContainer.classList.add('hidden');
                navContainer.classList.remove('nav-visible');
            }
            return false; // Não inicializar
        }
        return true; // Pode inicializar
    }
    
    // Iniciar apenas se não for página auth
    if (shouldInit()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                // Verificar novamente antes de inicializar
                if (shouldInit()) {
                    init();
                }
            });
        } else {
            init();
        }
    } else {
        // ✅ Se for auth, garantir que fica escondido e monitorar mudanças
        const navContainer = document.getElementById('bottom-nav-container');
        if (navContainer) {
            // Esconder imediatamente
            navContainer.style.cssText = 'display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; position: fixed !important; bottom: -1000px !important; height: 0 !important; width: 0 !important; overflow: hidden !important;';
            navContainer.classList.add('hidden');
            navContainer.classList.remove('nav-visible');
            
            // ✅ MONITORAR MUDANÇAS E FORÇAR ESCONDER
            var authObserver = new MutationObserver(function() {
                const path = window.location.pathname;
                const pageName = getPageNameFromPath(path);
                const isAuth = shouldHideNav(pageName) || 
                              document.documentElement.classList.contains('auth-initial') ||
                              document.body.classList.contains('auth-mode');
                
                if (isAuth && navContainer) {
                    navContainer.style.cssText = 'display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; position: fixed !important; bottom: -1000px !important; height: 0 !important; width: 0 !important; overflow: hidden !important;';
                    navContainer.classList.add('hidden');
                    navContainer.classList.remove('nav-visible');
                }
            });
            
            authObserver.observe(navContainer, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            
            // Observar mudanças no body/html também
            authObserver.observe(document.body || document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }
})();
