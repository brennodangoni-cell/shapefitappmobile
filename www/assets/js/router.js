/**
 * Router SPA - Versão com View Transitions
 * Transições fluidas entre páginas e skeleton loading para evitar flash de conteúdo vazio
 */

(function() {
    'use strict';
    
    // === GESTÃO DE INTERVALOS ===
    const activeIntervals = [];
    const originalSetInterval = window.setInterval;
    window.setInterval = function(func, delay) {
        const id = originalSetInterval(func, delay);
        activeIntervals.push(id);
        return id;
    };

    const router = {
        currentPath: '/',
        container: null,
        bottomNav: null,
        history: [],
        loading: false,
        isNative: typeof window.Capacitor !== 'undefined',
        isGoingBack: false,
        prefetchedPages: new Map()
    };
    
    // === DETECTAR SUPORTE A VIEW TRANSITIONS ===
    const supportsViewTransitions = 'startViewTransition' in document;
    
    const PAGES_WITHOUT_MENU = [
        'auth_login', 'auth_register', 'onboarding_onboarding', 'scan_barcode', 'offline'
    ];

    const URL_MAP = {
        'main_app': '/dashboard',
        'auth_login': '/login',
        'auth_register': '/cadastro',
        'diary': '/diario',
        'add_food_to_diary': '/adicionar-refeicao',
        'progress': '/evolucao',
        'more_options': '/mais-opcoes',
        'explore_recipes': '/explorar',
        'view_recipe': '/receita',
        'profile_overview': '/perfil',
        'edit_profile': '/editar-perfil',
        'ranking': '/ranking',
        'onboarding_onboarding': '/bem-vindo'
    };

    async function init() {
        router.container = document.getElementById('app-container');
        router.bottomNav = document.getElementById('bottom-nav-container');
        
        // Inicializar flag de transição auth
        window._authTransition = false;
        
        if (!router.container) return;
        
        // ✅ VERIFICAR OFFLINE + SEM TOKEN ANTES DE QUALQUER COISA
        // Se estiver offline e sem token, redirecionar IMEDIATAMENTE para login
        const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                     (localStorage.getItem('shapefit_auth_token') || null);
        
        if (!navigator.onLine && !token) {
            console.log('[Router] Offline e sem token - redirecionando para login IMEDIATAMENTE');
            // Redirecionar para login sem carregar nenhuma página
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return; // Não continuar inicialização
        }
        
        document.addEventListener('click', handleLinkClick, true);
        window.addEventListener('popstate', handlePopState);
        
        let initialPath = '/fragments/main_app.html';
        const currentPath = window.location.pathname;
        
        const isPublic = PAGES_WITHOUT_MENU.some(page => currentPath.includes(page)) ||
                          ['/login', '/cadastro', '/bem-vindo'].includes(currentPath);

        // NÃO redirecionar automaticamente aqui - deixar as páginas verificarem autenticação
        // Isso evita redirecionamentos desnecessários quando o token existe mas ainda não foi verificado
        if (currentPath && currentPath !== '/' && currentPath !== '/index.html') {
            initialPath = convertUrlToFragment(currentPath);
        }
        
        // Se não há path específico e não é página pública, tentar carregar main_app
        // Se não tiver token, a página vai redirecionar via requireAuth()
        if (!initialPath && !isPublic) {
            initialPath = '/fragments/main_app.html';
        }
        
        // IMPORTANTE: Setar o currentPath ANTES de carregar para View Transitions funcionarem
        router.currentPath = initialPath;
        
        // ✅ ESCONDER BOTTOM NAV IMEDIATAMENTE SE FOR PÁGINA AUTH (ANTES DE QUALQUER COISA)
        const pageName = initialPath.split('/').pop().replace('.html', '').split('?')[0];
        const isAuthInitial = isAuthPage(pageName);
        if (router.bottomNav && isAuthInitial) {
            // Esconder IMEDIATAMENTE, antes de qualquer renderização
            router.bottomNav.style.cssText = `
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            `;
            router.bottomNav.classList.add('hidden');
            document.body.classList.add('auth-mode');
        }
        
        // ✅ MOSTRAR SKELETON APENAS SE NÃO FOR PÁGINA AUTH (auth carrega direto, mais rápido)
        if (!isAuthInitial) {
            showSkeleton(pageName);
        }
        
        // ✅ GARANTIR BACKGROUND VISÍVEL
        if (router.container) {
            router.container.style.cssText = `
                background: #121212 !important;
                background-color: #121212 !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
        }
        document.body.style.cssText = `
            background: #121212 !important;
            background-color: #121212 !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;
        
        loadPage(initialPath, false);
    }
    
    function handleLinkClick(event) {
        const link = event.target.closest('a');
        if (!link) return;
        
        if (link.hostname !== window.location.hostname || 
            link.target === '_blank' || 
            (link.href.includes('#') && !link.getAttribute('href').startsWith('/'))) return;
        
        if (link.hasAttribute('data-router-ignore')) return;
        
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        
        event.preventDefault();
        navigateTo(convertToFragmentPath(href));
    }
    
    function convertUrlToFragment(urlPath) {
        for (const [file, pretty] of Object.entries(URL_MAP)) {
            if (urlPath === pretty || urlPath === pretty + '/') return `/fragments/${file}.html`;
        }
        return convertToFragmentPath(urlPath);
    }

    function convertToFragmentPath(href) {
        // Preservar query string
        const queryIndex = href.indexOf('?');
        const queryString = queryIndex >= 0 ? href.substring(queryIndex) : '';
        
        let path = href.split('?')[0].split('#')[0];
        if (path.includes('/fragments/')) return path + queryString;
        
        // Mapa de URLs amigáveis para fragmentos
        const prettyUrlMap = {
            '/adicionar-alimento': '/fragments/add_food_to_diary.html',
            '/adicionar-refeicao': '/fragments/add_food_to_diary.html',
            '/criar-alimento': '/fragments/create_custom_food.html',
            '/scan_barcode': '/fragments/scan_barcode.html',
            '/escanear': '/fragments/scan_barcode.html',
            '/diario': '/fragments/diary.html',
            '/rotina': '/fragments/routine.html',
            '/metas': '/fragments/dashboard.html',
            '/explorar': '/fragments/explore_recipes.html',
            '/favoritos': '/fragments/favorite_recipes.html',
            '/editar-perfil': '/fragments/edit_profile.html',
            '/perfil': '/fragments/edit_profile.html',
            '/progresso': '/fragments/progress.html',
            '/medidas': '/fragments/measurements_progress.html',
            '/pontos': '/fragments/points_history.html',
            '/login': '/fragments/auth_login.html',
            '/cadastro': '/fragments/auth_register.html'
        };
        
        // Verificar se é uma URL amigável conhecida
        if (prettyUrlMap[path]) {
            return prettyUrlMap[path] + queryString;
        }
        
        try { path = new URL(path, window.location.origin).pathname; } catch (e) {}
        if (path.startsWith('/')) path = path.substring(1);
        path = path.replace(/^www\//, '').replace(/^\.\//, '');
        if (!path.endsWith('.html')) path += '.html';
        path = path.replace(/\//g, '_');
        return `/fragments/${path}${queryString}`;
    }
    
    // Páginas de autenticação para View Transitions especiais
    const AUTH_PAGES = ['auth_login', 'auth_register'];
    
    function isAuthPage(pageName) {
        return AUTH_PAGES.includes(pageName);
    }
    
    // === USAR PAGELOADER SE DISPONÍVEL ===
    function showSkeleton(pageName) {
        if (!router.container) return;
        
        // ✅ PÁGINAS AUTH: NÃO USAR SKELETON (carregar direto, mais rápido)
        if (isAuthPage(pageName)) {
            // Apenas garantir background visível
            router.container.style.cssText = `
                background: #121212 !important;
                background-color: #121212 !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
            return; // Não mostrar skeleton para auth
        }
        
        // ✅ GARANTIR BACKGROUND VISÍVEL IMEDIATAMENTE
        router.container.style.cssText = `
            background: #121212 !important;
            background-color: #121212 !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;
        
        // ✅ SEMPRE mostrar skeleton primeiro - SEM DELAY
        router.container.classList.add('page-loading');
        router.container.classList.remove('page-ready', 'page-loaded');
        
        // ✅ REMOVER CONTEÚDO ANTIGO IMEDIATAMENTE
        const oldContent = router.container.querySelector('.page-root, .app-container');
        if (oldContent) {
            oldContent.style.display = 'none';
            oldContent.remove();
        }
        
        // ✅ REMOVER SKELETON ANTIGO SE EXISTIR
        const oldSkeleton = router.container.querySelector('.page-skeleton');
        if (oldSkeleton) {
            oldSkeleton.remove();
        }
        
        // Usar o PageLoader se estiver disponível
        if (window.PageLoader) {
            window.PageLoader.start(pageName);
        } else {
            // ✅ FALLBACK: mostrar skeleton básico IMEDIATAMENTE
            const fallbackSkeleton = document.createElement('div');
            fallbackSkeleton.className = 'page-skeleton';
            fallbackSkeleton.innerHTML = '<div class="skeleton-safe-area"></div><div class="skeleton" style="height:200px;margin:16px;"></div>';
            fallbackSkeleton.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                z-index: 999 !important;
                background: #121212 !important;
                display: flex !important;
                flex-direction: column !important;
                padding-top: calc(16px + env(safe-area-inset-top, 0px)) !important;
                padding-left: 16px !important;
                padding-right: 16px !important;
                padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
            router.container.appendChild(fallbackSkeleton);
        }
    }
    
    function navigateTo(fragmentPath, options = {}) {
        if (router.loading && !options.forceReload) return;
        
        const { isBack = false, forceReload = false } = options;
        router.isGoingBack = isBack;
        
        // Separar path da query string
        const [basePath, queryString] = fragmentPath.split('?');
        const qs = queryString ? '?' + queryString : '';
        
        let prettyUrl;
        let actualFragmentPath;
        
        // Se já é uma URL "pretty" (começa com / mas não /fragments/)
        if (basePath.startsWith('/') && !basePath.startsWith('/fragments/')) {
            // Extrair nome base (remover apenas a primeira barra)
            const pathName = basePath.substring(1);
            
            // Mapear URLs amigáveis para fragmentos reais
            const reverseMap = {
                // URLs em português
                'diario': '/fragments/diary.html',
                'rotina': '/fragments/routine.html',
                'conteudo': '/fragments/content.html',
                'mais': '/fragments/more_options.html',
                'mais-opcoes': '/fragments/more_options.html',
                'metas': '/fragments/dashboard.html',
                'pontos': '/fragments/points_history.html',
                'perfil': '/fragments/edit_profile.html',
                'editar-perfil': '/fragments/edit_profile.html',
                'explorar': '/fragments/explore_recipes.html',
                'favoritos': '/fragments/favorite_recipes.html',
                'desafios': '/fragments/dashboard.html',
                'login': '/fragments/auth_login.html',
                'cadastro': '/fragments/auth_register.html',
                'bem-vindo': '/fragments/onboarding_onboarding.html',
                'adicionar-alimento': '/fragments/add_food_to_diary.html',
                'adicionar-refeicao': '/fragments/add_food_to_diary.html',
                'criar-alimento': '/fragments/create_custom_food.html',
                'progresso': '/fragments/progress.html',
                'medidas': '/fragments/measurements_progress.html',
                // URLs em inglês (nomes dos arquivos)
                'dashboard': '/fragments/dashboard.html',
                'ranking': '/fragments/ranking.html',
                'routine': '/fragments/routine.html',
                'diary': '/fragments/diary.html',
                'content': '/fragments/content.html',
                'more_options': '/fragments/more_options.html',
                'points_history': '/fragments/points_history.html',
                'edit_profile': '/fragments/edit_profile.html',
                'edit_exercises': '/fragments/edit_exercises.html',
                'explore_recipes': '/fragments/explore_recipes.html',
                'favorite_recipes': '/fragments/favorite_recipes.html',
                'add_food_to_diary': '/fragments/add_food_to_diary.html',
                'create_custom_food': '/fragments/create_custom_food.html',
                'progress': '/fragments/progress.html',
                'measurements_progress': '/fragments/measurements_progress.html',
                'view_recipe': '/fragments/view_recipe.html',
                'scan_barcode': '/fragments/scan_barcode.html'
            };
            actualFragmentPath = reverseMap[pathName] || `/fragments/${pathName}.html`;
            prettyUrl = basePath + qs; // Manter URL pretty com query string
        } else {
            // É um fragmentPath, converter para pretty URL
            let cleanName = basePath.replace('/fragments/', '').replace('.html', '');
            prettyUrl = (URL_MAP[cleanName] || '/' + cleanName) + qs;
            actualFragmentPath = basePath;
        }
        
        // Evitar navegação duplicada (apenas se não tiver query string)
        if (router.currentPath === actualFragmentPath && !qs) return;

        // Detectar se é transição entre páginas de auth (login <-> register)
        const currentPageName = router.currentPath.split('/').pop().replace('.html', '');
        const targetPageName = actualFragmentPath.split('/').pop().replace('.html', '');
        const isAuthTransition = isAuthPage(currentPageName) && isAuthPage(targetPageName);

        router.history.push(router.currentPath);
        window.history.pushState({ path: actualFragmentPath + qs, prettyUrl: prettyUrl }, '', prettyUrl);
        
        router.currentPath = actualFragmentPath;
        
        // ✅ USAR VIEW TRANSITIONS PARA TRANSIÇÕES AUTH (como na pasta REFFFF)
        // IMPORTANTE: fazer ANTES de showSkeleton e outras coisas
        if (isAuthTransition && document.startViewTransition) {
            // Marcar que estamos em transição auth (não animar a logo de novo)
            window._authTransition = true;
            document.startViewTransition(() => {
                return loadPage(actualFragmentPath + qs, false);
            });
        } else {
            window._authTransition = false;
            
            // ✅ MOSTRAR SKELETON IMEDIATAMENTE (ANTES DE QUALQUER COISA)
            // ✅ IMPORTANTE: mostrar ANTES de qualquer fetch/load
            showSkeleton(targetPageName);
            
            // ✅ ESCONDER BOTTOM NAV EM PÁGINAS AUTH
            const bottomNav = document.getElementById('bottom-nav-container');
            const isAuthTarget = isAuthPage(targetPageName);
            if (bottomNav) {
                if (isAuthTarget) {
                    // Esconder em páginas de auth
                    bottomNav.classList.add('hidden');
                    bottomNav.style.display = 'none';
                    document.body.classList.add('auth-mode');
                } else {
                    // Mostrar em outras páginas
                    bottomNav.classList.remove('hidden');
                    bottomNav.style.cssText = `
                        position: fixed !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        transform: none !important;
                        -webkit-transform: none !important;
                        transition: none !important;
                        animation: none !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        display: block !important;
                        z-index: 1000 !important;
                    `;
                    document.body.classList.remove('auth-mode');
                }
            }
            
            // ✅ GARANTIR BACKGROUND SEMPRE VISÍVEL
            document.body.style.cssText = `
                background: #121212 !important;
                background-color: #121212 !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
            document.documentElement.style.cssText = `
                background: #121212 !important;
                background-color: #121212 !important;
                opacity: 1 !important;
                visibility: visible !important;
            `;
            
            loadPage(actualFragmentPath + qs, false);
        }
    }
    
    function handlePopState(event) {
        const path = event.state?.path || '/fragments/main_app.html';
        const pageName = path.split('/').pop().replace('.html', '').split('?')[0];
        
        // ✅ SEM TRANSIÇÕES - APARECER DIRETO
        showSkeleton(pageName);
        loadPage(path, false);
    }
    
    async function loadPage(path, showLoading = true) {
        if (router.loading) return;
        
        // ✅ VERIFICAR OFFLINE + SEM TOKEN ANTES DE CARREGAR QUALQUER PÁGINA
        const pathWithoutQuery = path.split('?')[0];
        const pageName = pathWithoutQuery.split('/').pop().replace('.html', '');
        const isAuthPageCheck = PAGES_WITHOUT_MENU.includes(pageName);
        
        // Se não for página auth, verificar se está offline e sem token
        if (!isAuthPageCheck) {
            const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                         (localStorage.getItem('shapefit_auth_token') || null);
            
            if (!navigator.onLine && !token) {
                console.log('[Router] loadPage: Offline e sem token - redirecionando para login');
                router.loading = false;
                if (window.SPARouter && window.SPARouter.navigate) {
                    window.SPARouter.navigate('/fragments/auth_login.html', true);
                } else {
                    window.location.href = '/auth/login.html';
                }
                return; // Não carregar página
            }
        }
        
        router.loading = true;
        
        // Timer de segurança
        const safetyTimer = setTimeout(() => {
            if (router.loading) {
                console.warn('[Router] Timeout forçado.');
                router.container.classList.remove('page-loading');
                router.container.classList.add('page-loaded');
                router.loading = false;
            }
        }, 3000);

        // Limpeza de intervalos da página anterior
        activeIntervals.forEach(id => clearInterval(id));
        activeIntervals.length = 0;
        
        // CRÍTICO: Resetar flags de páginas anteriores que podem bloquear scroll
        window._moreOptionsLoaded = false;
        window._editProfileLoaded = false;
        window._measurementsLoaded = false;
        window._onboardingLoaded = false;
        window._dashboardLoaded = false;
        
        // Garantir que o scroll do container está habilitado
        if (router.container) {
            router.container.style.overflowY = 'scroll';
            router.container.style.touchAction = 'pan-y';
            router.container.style.webkitOverflowScrolling = 'touch';
        }

        try {
            
            if (router.bottomNav) {
                if (isAuthPageCheck) {
                    // ✅ FORÇAR ESCONDER COMPLETAMENTE EM PÁGINAS AUTH
                    router.bottomNav.classList.add('hidden');
                    router.bottomNav.classList.remove('nav-visible');
                    document.body.classList.add('auth-mode');
                    document.body.setAttribute('data-auth', 'true');
                    document.documentElement.classList.add('auth-initial');
                    document.documentElement.setAttribute('data-auth', 'true');
                    // ✅ FORÇAR COM STYLE INLINE TAMBÉM
                    router.bottomNav.style.cssText = `
                        display: none !important;
                        opacity: 0 !important;
                        visibility: hidden !important;
                        pointer-events: none !important;
                        position: fixed !important;
                        bottom: -1000px !important;
                        height: 0 !important;
                        width: 0 !important;
                        overflow: hidden !important;
                    `;
                } else {
                    // ✅ SEMPRE MOSTRAR E MANTER FIXO
                    router.bottomNav.classList.remove('hidden');
                    router.bottomNav.classList.add('nav-visible');
                    document.body.classList.remove('auth-mode');
                    document.body.removeAttribute('data-auth');
                    document.documentElement.classList.remove('auth-initial');
                    document.documentElement.removeAttribute('data-auth');
                    router.bottomNav.style.cssText = `
                        position: fixed !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        transform: translateZ(0) !important;
                        -webkit-transform: translateZ(0) !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        display: block !important;
                        z-index: 1000 !important;
                        height: auto !important;
                        width: 100% !important;
                        overflow: visible !important;
                    `;
                }
            }

            // Verificar cache de prefetch
            let html;
            if (router.prefetchedPages.has(pathWithoutQuery)) {
                html = router.prefetchedPages.get(pathWithoutQuery);
                router.prefetchedPages.delete(pathWithoutQuery);
            } else {
                // Fetch usa apenas o path sem query string (arquivo estático)
                const response = await fetch(pathWithoutQuery);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                html = await response.text();
            }
            
            // ✅ COMPORTAMENTO ESPECIAL PARA PÁGINAS AUTH (carregar direto, sem skeleton/PageLoader)
            if (window._authTransition || isAuthPageCheck) {
                // Limpar container completamente
                router.container.innerHTML = '';
                
                // ✅ Limpar modais que foram movidos para o body
                const modalsToRemove = [
                    document.getElementById('recipe-modal'),
                    document.getElementById('crop-modal'),
                    document.getElementById('restrictions-modal'),
                    document.getElementById('confirm-delete-account-modal'),
                    document.getElementById('product-not-found-modal')
                ];
                modalsToRemove.forEach(modal => {
                    if (modal && modal.parentElement === document.body) {
                        modal.remove();
                    }
                });
                
                const scripts = extractScriptsFromHTML(html);
                let htmlWithoutScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                
                // Corrigir valores PHP antes de inserir no DOM para evitar warnings
                htmlWithoutScripts = fixPHPValues(htmlWithoutScripts);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlWithoutScripts;
                let content = tempDiv.querySelector('.page-root') || tempDiv;
                
                // Inserir conteúdo diretamente (sem esconder)
                router.container.appendChild(content.cloneNode(true));
                
                // View Transition: não animar (a API cuida)
                const logo = router.container.querySelector('.login-logo');
                const loginContainer = router.container.querySelector('.login-container');
                const registerContainer = router.container.querySelector('.register-container');
                const authContainer = loginContainer || registerContainer;
                
                if (window._authTransition) {
                    // Transição entre auth: não animar (View Transitions cuida)
                    if (logo) logo.classList.remove('animate-in');
                    if (authContainer) authContainer.classList.remove('animate-in');
                } else {
                    // Primeira entrada: animar
                    if (logo) logo.classList.add('animate-in');
                    if (authContainer) authContainer.classList.add('animate-in');
                }
                
                fixTimeInputs();
                await loadScriptsSequentially(scripts);
                
                window.dispatchEvent(new CustomEvent('fragmentReady', { detail: { path, container: router.container } }));
                window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path, container: router.container } }));
                
                // ✅ RESETAR SCROLL DO CONTAINER E DA WINDOW
                if (router.container) {
                    router.container.scrollTop = 0;
                }
                window.scrollTo(0, 0);
            } else {
                // ✅ COMPORTAMENTO NORMAL (com skeleton/PageLoader)
                // Remover apenas conteúdo antigo (não o skeleton)
                const oldContent = router.container.querySelector('.page-root, .app-container');
                if (oldContent) {
                    oldContent.style.display = 'none';
                    oldContent.remove();
                }
                
                // ✅ Limpar modais que foram movidos para o body (evitar que fiquem presos na tela)
                const modalsToRemove = [
                    document.getElementById('recipe-modal'),
                    document.getElementById('crop-modal'),
                    document.getElementById('restrictions-modal'),
                    document.getElementById('confirm-delete-account-modal'),
                    document.getElementById('product-not-found-modal')
                ];
                modalsToRemove.forEach(modal => {
                    if (modal && modal.parentElement === document.body) {
                        modal.remove();
                        console.log('✅ Modal removido do body:', modal.id);
                    }
                });
                
                const scripts = extractScriptsFromHTML(html);
                let htmlWithoutScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                
                // Corrigir valores PHP antes de inserir no DOM para evitar warnings
                htmlWithoutScripts = fixPHPValues(htmlWithoutScripts);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlWithoutScripts;
                let content = tempDiv.querySelector('.page-root') || tempDiv;
                
                // ✅ Inserir conteúdo mas mantê-lo COMPLETAMENTE ESCONDIDO
                const clonedContent = content.cloneNode(true);
                clonedContent.style.cssText = `
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                `;
                router.container.appendChild(clonedContent);
                
                // Primeira entrada: animar tudo
                const logo = router.container.querySelector('.login-logo');
                const loginContainer = router.container.querySelector('.login-container');
                const registerContainer = router.container.querySelector('.register-container');
                const authContainer = loginContainer || registerContainer;
                if (logo) logo.classList.add('animate-in');
                if (authContainer) authContainer.classList.add('animate-in');
                
                fixTimeInputs();
                await loadScriptsSequentially(scripts);
                
                window.dispatchEvent(new CustomEvent('fragmentReady', { detail: { path, container: router.container } }));
                
                // ✅ NÃO disparar pageLoaded ainda - esperar PageLoader.ready()
                // window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path, container: router.container } }));
                
                // ✅ RESETAR SCROLL DO CONTAINER E DA WINDOW
                if (router.container) {
                    router.container.scrollTop = 0;
                }
                window.scrollTo(0, 0);
            }
            
        } catch (error) {
            console.error('[Router] Erro:', path, error);
            if (path.includes('main_app')) window.location.href = '/';
            // Em caso de erro, forçar ready
            if (window.PageLoader) window.PageLoader.forceReady();
        } finally {
            clearTimeout(safetyTimer);
            router.loading = false;
            
            // FALLBACK: Se a página não chamar PageLoader.ready() em 800ms,
            // assumir que está pronta (para páginas antigas sem integração)
            setTimeout(() => {
                if (window.PageLoader && window.PageLoader.isLoading()) {
                    // ✅ Log removido para performance
                    window.PageLoader.ready();
                }
            }, 800);
        }
    }
    
    function extractScriptsFromHTML(html) {
        const scripts = [];
        const externalRegex = /<script\s+src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
        let match;
        while ((match = externalRegex.exec(html)) !== null) {
            let src = match[1];
            if (src.startsWith('/http')) src = src.substring(1);
            if (src.includes('www-config.js')) continue;
            scripts.push({ type: 'external', src: src, content: null });
        }
        const inlineRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
        while ((match = inlineRegex.exec(html)) !== null) {
            // Pula se tiver src (já foi capturado pelo regex externo)
            if (match[0].includes('src=')) continue;
            
            // Pula scripts com type específico (module, importmap, JSON, template)
            if (match[0].includes('type="module"') || 
                match[0].includes("type='module'") ||
                match[0].includes('type="importmap"') ||
                match[0].includes("type='importmap'") ||
                match[0].includes('type="text/template"') ||
                match[0].includes("type='text/template'") ||
                match[0].includes('type="application/json"') ||
                match[0].includes("type='application/json'")) {
                continue;
            }
            
            const content = match[1].trim();
            
            // Ignora scripts vazios ou que só têm comentários/whitespace
            if (!content || content.length === 0 || /^[\s\n\r]*$/.test(content)) {
                continue;
            }
            
            // Ignora scripts que são JSON (import maps ou outros JSON)
            if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
                // Verifica se parece JSON (tem "imports", "scopes", etc)
                if (content.includes('"imports"') || 
                    content.includes('"scopes"') ||
                    content.includes('"exports"')) {
                    continue; // É um import map ou JSON, não JavaScript
                }
            }
            
            // Ignora scripts que são apenas comentários HTML
            if (/^[\s\n\r]*<!--[\s\S]*-->[\s\n\r]*$/.test(content)) {
                continue;
            }
            
            scripts.push({ type: 'inline', src: null, content: content });
        }
        return scripts;
    }

    async function loadScriptsSequentially(scripts) {
        for (const script of scripts) {
            if (script.type === 'external') await loadExternalScript(script.src);
            else executeInlineScript(script.content);
        }
    }

    // === A MÁGICA ACONTECE AQUI ===
    function loadExternalScript(src) {
        return new Promise((resolve) => {
            let cleanSrc = src.startsWith('/http') ? src.substring(1) : src;
            
            // 1. Identificar se é um script GLOBAL (Nunca recarregar)
            // Adicione aqui nomes de libs pesadas que não mudam
            const isGlobalLib = src.includes('jquery') || 
                                src.includes('auth.js') || 
                                src.includes('config.js') || 
                                src.includes('common.js') ||
                                src.includes('chart.js') ||
                                src.includes('lottie'); 

            // Se for global e já existir, pula
            if (isGlobalLib && document.querySelector(`script[src*="${cleanSrc}"]`)) {
                // console.log(`[Router] Mantendo global: ${cleanSrc}`);
                resolve(); 
                return;
            }
            
            // 2. Se for script de LÓGICA DA PÁGINA (Reload forçado)
            // Primeiro removemos a versão antiga do DOM para garantir que o navegador execute a nova
            const oldScript = document.querySelector(`script[src*="${cleanSrc}"]`);
            if (oldScript) {
                oldScript.remove();
                // console.log(`[Router] Recarregando lógica: ${cleanSrc}`);
            }

            // 3. Injetar novo script
            const script = document.createElement('script');
            script.src = cleanSrc;
            script.async = false;
            script.onload = resolve;
            script.onerror = () => {
                console.warn(`[Router] Falha script: ${cleanSrc}`);
                resolve();
            };
            
            document.head.appendChild(script);
        });
    }

    function executeInlineScript(content) {
        try { 
            // Remove comentários HTML que podem estar causando problemas
            const cleanContent = content.replace(/<!--[\s\S]*?-->/g, '').trim();
            if (!cleanContent) return; // Se não há conteúdo, pula
            new Function(cleanContent)(); 
        } catch(e) { 
            console.error('[Router] Erro ao executar script inline:', e);
            console.error('[Router] Conteúdo problemático:', content.substring(0, 200));
        }
    }

    function fixPHPValues(html) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        // Substituir PHP de hora
        html = html.replace(/<\?php\s+echo\s+date\(['"]H:i['"]\);\s*\?>/gi, `${hours}:${minutes}`);
        
        // Substituir PHP de data
        html = html.replace(/<\?php\s+echo\s+date\(['"]Y-m-d['"]\);\s*\?>/gi, `${year}-${month}-${day}`);
        
        // Substituir qualquer outro PHP restante por string vazia
        html = html.replace(/<\?php[^?]*\?>/gi, '');
        
        return html;
    }
    
    function fixTimeInputs() {
        const now = new Date();
        
        // Corrigir inputs de hora com PHP
        router.container.querySelectorAll('input[type="time"]').forEach(i => {
            if(!i.value || i.value.includes('<?php') || i.value.includes('?>')) {
                i.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            }
        });
        
        // Corrigir inputs de data com PHP
        router.container.querySelectorAll('input[type="date"]').forEach(i => {
            if(!i.value || i.value.includes('<?php') || i.value.includes('?>')) {
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                i.value = `${year}-${month}-${day}`;
            }
        });
    }

    // === PREFETCH PARA NAVEGAÇÃO RÁPIDA ===
    function prefetchPage(path) {
        const pathWithoutQuery = path.split('?')[0];
        if (router.prefetchedPages.has(pathWithoutQuery)) return;
        
        fetch(pathWithoutQuery)
            .then(res => res.ok ? res.text() : null)
            .then(html => {
                if (html) {
                    router.prefetchedPages.set(pathWithoutQuery, html);
                    // Limpar cache após 30 segundos
                    setTimeout(() => router.prefetchedPages.delete(pathWithoutQuery), 30000);
                }
            })
            .catch(() => {});
    }
    
    // Prefetch links do bottom nav quando hover
    function setupPrefetch() {
        if (router.bottomNav) {
            router.bottomNav.querySelectorAll('a').forEach(link => {
                link.addEventListener('mouseenter', () => {
                    const href = link.getAttribute('href');
                    if (href) prefetchPage(convertToFragmentPath(href));
                });
                // Para touch devices
                link.addEventListener('touchstart', () => {
                    const href = link.getAttribute('href');
                    if (href) prefetchPage(convertToFragmentPath(href));
                }, { passive: true });
            });
        }
    }
    
    // Chamar setup de prefetch após init
    function initWithPrefetch() {
        init();
        setTimeout(setupPrefetch, 100);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWithPrefetch);
    else initWithPrefetch();
    
    window.SPARouter = { 
        navigate: (p, opts) => navigateTo(p, opts),
        prefetch: prefetchPage,
        isNative: router.isNative,
        get currentPath() { return router.currentPath; }
    };
})();