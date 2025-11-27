/**
 * Router SPA - Versão Reload (Resolve o travamento "Carregando...")
 * Diferencia scripts globais de scripts de página para forçar re-execução.
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
        loading: false
    };
    
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
    
    // Páginas de autenticação para View Transitions
    const AUTH_PAGES = ['auth_login', 'auth_register'];
    
    function isAuthPage(pageName) {
        return AUTH_PAGES.includes(pageName);
    }
    
    function navigateTo(fragmentPath) {
        if (router.loading) return;
        
        // Separar path da query string
        const [basePath, queryString] = fragmentPath.split('?');
        const qs = queryString ? '?' + queryString : '';
        
        let prettyUrl;
        let actualFragmentPath;
        
        // Se já é uma URL "pretty" (começa com / mas não /fragments/)
        if (basePath.startsWith('/') && !basePath.startsWith('/fragments/')) {
            // Extrair nome base (remover apenas a primeira barra)
            const pathName = basePath.substring(1);
            
            console.log('[Router] pathName extraído:', pathName);
            
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
            console.log('[Router] actualFragmentPath:', actualFragmentPath, '| reverseMap encontrou:', !!reverseMap[pathName]);
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
        
        // Usar View Transitions API para transições auth (se suportado)
        if (isAuthTransition && document.startViewTransition) {
            // Marcar que estamos em transição auth (não animar a logo de novo)
            window._authTransition = true;
            document.startViewTransition(() => {
                return loadPage(actualFragmentPath + qs, false);
            });
        } else {
            window._authTransition = false;
            loadPage(actualFragmentPath + qs, true);
        }
    }
    
    function handlePopState(event) {
        loadPage(event.state?.path || '/fragments/main_app.html', false);
    }
    
    async function loadPage(path, showLoading = true) {
        if (router.loading) return;
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
            if (showLoading) router.container.classList.add('page-loading');
            
            // Remover query string para extrair nome da página
            const pathWithoutQuery = path.split('?')[0];
            const pageName = pathWithoutQuery.split('/').pop().replace('.html', '');
            const isAuthPage = PAGES_WITHOUT_MENU.includes(pageName);
            
            if (router.bottomNav) {
                if (isAuthPage) {
                    router.bottomNav.style.display = 'none';
                    router.bottomNav.classList.add('hidden');
                    document.body.classList.add('auth-mode');
                } else {
                    router.bottomNav.style.display = 'block';
                    router.bottomNav.classList.remove('hidden');
                    document.body.classList.remove('auth-mode');
                }
            }

            // Fetch usa apenas o path sem query string (arquivo estático)
            const response = await fetch(pathWithoutQuery);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            
            router.container.innerHTML = '';
            
            const scripts = extractScriptsFromHTML(html);
            let htmlWithoutScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            // Corrigir valores PHP antes de inserir no DOM para evitar warnings
            htmlWithoutScripts = fixPHPValues(htmlWithoutScripts);
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlWithoutScripts;
            let content = tempDiv.querySelector('.page-root') || tempDiv;
            
            router.container.appendChild(content.cloneNode(true));
            
            // Adicionar animação apenas se NÃO for transição entre páginas auth
            const logo = router.container.querySelector('.login-logo');
            const loginContainer = router.container.querySelector('.login-container');
            const registerContainer = router.container.querySelector('.register-container');
            const authContainer = loginContainer || registerContainer;
            
            if (!window._authTransition) {
                // Primeira entrada: animar tudo
                if (logo) logo.classList.add('animate-in');
                if (authContainer) authContainer.classList.add('animate-in');
            } else {
                // View Transition: não animar (a API cuida)
                if (logo) logo.classList.remove('animate-in');
                if (authContainer) authContainer.classList.remove('animate-in');
            }
            
            fixTimeInputs();
            await loadScriptsSequentially(scripts);
            
            window.dispatchEvent(new CustomEvent('fragmentReady', { detail: { path, container: router.container } }));
            window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path, container: router.container } }));
            
            window.scrollTo(0, 0);
            
        } catch (error) {
            console.error('[Router] Erro:', path, error);
            if (path.includes('main_app')) window.location.href = '/';
        } finally {
            clearTimeout(safetyTimer);
            router.container.classList.remove('page-loading');
            router.container.classList.add('page-loaded');
            router.loading = false;
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
            const content = match[1].trim();
            if (content && !match[0].includes('src=')) {
                scripts.push({ type: 'inline', src: null, content: content });
            }
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
        try { new Function(content)(); } catch(e) { console.error(e); }
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    
    window.SPARouter = { navigate: (p) => navigateTo(p) };
})();