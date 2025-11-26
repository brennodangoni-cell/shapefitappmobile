/**
 * Page Loader Controller
 * Sistema inteligente que mantém skeleton/loading até a página estar 100% pronta
 * Isso elimina o flash de conteúdo vazio enquanto API carrega
 */

(function() {
    'use strict';

    // === CONFIGURAÇÃO ===
    const CONFIG = {
        minLoadingTime: 150,      // Tempo mínimo do skeleton (evita flash)
        maxLoadingTime: 5000,     // Timeout máximo de segurança
        transitionDuration: 280,  // Duração da transição em ms
        cacheExpiry: 5 * 60 * 1000 // Cache de API expira em 5 minutos
    };

    // === ESTADO GLOBAL ===
    const state = {
        isLoading: false,
        currentPage: null,
        loadStartTime: 0,
        apiCache: new Map(),
        prefetchQueue: new Set()
    };

    // === SKELETONS POR TIPO DE PÁGINA ===
    const SKELETONS = {
        // Dashboard / Home - ✅ SUPER OTIMIZADO (mínimo de elementos)
        dashboard: `
            <div class="page-skeleton" data-type="dashboard">
                <div class="skel-header" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                    <div style="flex: 1;"></div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div class="skeleton" style="width: 60px; height: 32px; border-radius: 16px;"></div>
                        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
                    </div>
                </div>
                <div class="skeleton" style="height: 120px; border-radius: 16px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="height: 160px; border-radius: 16px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="height: 140px; border-radius: 16px; margin-bottom: 12px;"></div>
            </div>`,

        // Lista (diário, receitas, ranking, etc)
        list: `
            <div class="page-skeleton" data-type="list">
                <div class="skel-page-header">
                    <div class="skel-back skeleton"></div>
                    <div class="skel-title skeleton"></div>
                </div>
                <div class="skel-list">
                    <div class="skel-list-item">
                        <div class="skel-item-icon skeleton"></div>
                        <div class="skel-item-content">
                            <div class="skel-text skeleton" style="width: 70%;"></div>
                            <div class="skel-text skeleton" style="width: 50%;"></div>
                        </div>
                        <div class="skel-item-action skeleton"></div>
                    </div>
                    <div class="skel-list-item">
                        <div class="skel-item-icon skeleton"></div>
                        <div class="skel-item-content">
                            <div class="skel-text skeleton" style="width: 60%;"></div>
                            <div class="skel-text skeleton" style="width: 40%;"></div>
                        </div>
                        <div class="skel-item-action skeleton"></div>
                    </div>
                    <div class="skel-list-item">
                        <div class="skel-item-icon skeleton"></div>
                        <div class="skel-item-content">
                            <div class="skel-text skeleton" style="width: 80%;"></div>
                            <div class="skel-text skeleton" style="width: 55%;"></div>
                        </div>
                        <div class="skel-item-action skeleton"></div>
                    </div>
                    <div class="skel-list-item">
                        <div class="skel-item-icon skeleton"></div>
                        <div class="skel-item-content">
                            <div class="skel-text skeleton" style="width: 65%;"></div>
                            <div class="skel-text skeleton" style="width: 45%;"></div>
                        </div>
                        <div class="skel-item-action skeleton"></div>
                    </div>
                </div>
            </div>`,

        // Perfil / Configurações - ✅ EXPANDIDO
        profile: `
            <div class="page-skeleton" data-type="profile">
                <div class="skel-page-header">
                    <div class="skel-back skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
                    <div class="skel-title skeleton" style="height: 24px; width: 150px; border-radius: 8px;"></div>
                </div>
                <div class="skel-profile-header" style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px; margin-bottom: 24px;">
                    <div class="skel-profile-avatar skeleton" style="width: 100px; height: 100px; border-radius: 50%;"></div>
                    <div class="skel-profile-name skeleton" style="height: 24px; width: 150px; border-radius: 8px;"></div>
                    <div class="skel-profile-email skeleton" style="height: 16px; width: 200px; border-radius: 8px;"></div>
                </div>
                <div class="skel-menu-section" style="display: flex; flex-direction: column; gap: 12px; padding: 0 16px;">
                    <div class="skel-menu-item skeleton" style="height: 56px; border-radius: 12px;"></div>
                    <div class="skel-menu-item skeleton" style="height: 56px; border-radius: 12px;"></div>
                    <div class="skel-menu-item skeleton" style="height: 56px; border-radius: 12px;"></div>
                    <div class="skel-menu-item skeleton" style="height: 56px; border-radius: 12px;"></div>
                    <div class="skel-menu-item skeleton" style="height: 56px; border-radius: 12px;"></div>
                    <div class="skel-menu-item skeleton" style="height: 56px; border-radius: 12px;"></div>
                </div>
            </div>`,

        // Cards Grid (explorar receitas, etc) - ✅ EXPANDIDO
        grid: `
            <div class="page-skeleton" data-type="grid">
                <div class="skel-page-header">
                    <div class="skel-back skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
                    <div class="skel-title skeleton" style="height: 24px; width: 150px; border-radius: 8px;"></div>
                </div>
                <div class="skel-search skeleton" style="height: 44px; border-radius: 12px; margin-bottom: 16px;"></div>
                <div class="skel-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                    <div class="skel-grid-card skeleton" style="aspect-ratio: 1; border-radius: 12px;"></div>
                </div>
            </div>`,

        // Formulário (adicionar alimento, editar, etc)
        form: `
            <div class="page-skeleton" data-type="form">
                <div class="skel-page-header">
                    <div class="skel-back skeleton"></div>
                    <div class="skel-title skeleton"></div>
                </div>
                <div class="skel-form">
                    <div class="skel-form-group">
                        <div class="skel-label skeleton"></div>
                        <div class="skel-input skeleton"></div>
                    </div>
                    <div class="skel-form-group">
                        <div class="skel-label skeleton"></div>
                        <div class="skel-input skeleton"></div>
                    </div>
                    <div class="skel-form-group">
                        <div class="skel-label skeleton"></div>
                        <div class="skel-input skeleton"></div>
                    </div>
                    <div class="skel-button skeleton"></div>
                </div>
            </div>`,

        // Detalhe (receita, conteúdo, etc)
        detail: `
            <div class="page-skeleton" data-type="detail">
                <div class="skel-detail-image skeleton"></div>
                <div class="skel-detail-content">
                    <div class="skel-detail-title skeleton"></div>
                    <div class="skel-detail-meta">
                        <div class="skel-meta-item skeleton"></div>
                        <div class="skel-meta-item skeleton"></div>
                        <div class="skel-meta-item skeleton"></div>
                    </div>
                    <div class="skel-detail-body">
                        <div class="skel-text skeleton" style="width: 100%;"></div>
                        <div class="skel-text skeleton" style="width: 90%;"></div>
                        <div class="skel-text skeleton" style="width: 95%;"></div>
                        <div class="skel-text skeleton" style="width: 80%;"></div>
                    </div>
                </div>
            </div>`,

        // Auth (login/register) - sem skeleton, transição direta
        auth: `<div class="page-skeleton" data-type="auth"></div>`
    };

    // === MAPA DE PÁGINAS PARA TIPO DE SKELETON ===
    const PAGE_TYPE_MAP = {
        'main_app': 'dashboard',
        'dashboard': 'dashboard',
        'diary': 'list',
        'routine': 'list',
        'ranking': 'list',
        'points_history': 'list',
        'explore_recipes': 'grid',
        'favorite_recipes': 'grid',
        'view_recipe': 'detail',
        'view_content': 'detail',
        'content': 'detail',
        'edit_profile': 'profile',
        'more_options': 'profile',
        'add_food_to_diary': 'form',
        'create_custom_food': 'form',
        'edit_meal': 'form',
        'edit_exercises': 'form',
        'measurements_progress': 'list',
        'progress': 'dashboard',
        'auth_login': 'auth',
        'auth_register': 'auth',
        'onboarding_onboarding': 'auth',
        'scan_barcode': 'auth'
    };

    // === FUNÇÕES PRINCIPAIS ===

    /**
     * Inicia o loading de uma página
     * Mostra o skeleton apropriado
     */
    function startLoading(pageName) {
        state.isLoading = true;
        state.currentPage = pageName;
        state.loadStartTime = Date.now();

        const container = document.getElementById('app-container');
        if (!container) return;

        // ✅ GARANTIR BACKGROUND SEMPRE VISÍVEL
        container.style.cssText = `
            background: #121212 !important;
            background-color: #121212 !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;
        document.body.style.cssText = `
            background: #121212 !important;
            background-color: #121212 !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;

        // Determinar tipo de skeleton
        const skeletonType = PAGE_TYPE_MAP[pageName] || 'dashboard';
        const skeleton = SKELETONS[skeletonType] || SKELETONS.dashboard;

        // ✅ CRIAR ELEMENTO DE SKELETON SEPARADO (não substituir conteúdo)
        let skeletonEl = container.querySelector('.page-skeleton');
        if (!skeletonEl) {
            skeletonEl = document.createElement('div');
            skeletonEl.className = 'page-skeleton';
            container.appendChild(skeletonEl);
        }
        skeletonEl.innerHTML = skeleton;
        skeletonEl.classList.remove('skeleton-fade-out');
        
        // ✅ GARANTIR SKELETON SEMPRE VISÍVEL COM PADDING CORRETO
        // ✅ MESMO PADDING QUE O CONTEÚDO REAL (16px + safe-area)
        // ✅ IMPORTANTE: aplicar padding ANTES de inserir conteúdo para evitar "pulo"
        skeletonEl.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            opacity: 1 !important;
            visibility: visible !important;
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
            padding: 0 !important;
            padding-top: calc(16px + env(safe-area-inset-top, 0px)) !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            gap: 16px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        
        // ✅ FORÇAR RE-FLOW para garantir que padding está aplicado
        skeletonEl.offsetHeight;
        
        // Marcar container como loading
        container.classList.add('page-loading');
        container.classList.remove('page-loaded', 'page-ready');
        
        // ✅ Garantir que conteúdo real está escondido
        const pageContent = container.querySelector('.page-root, .app-container');
        if (pageContent) {
            pageContent.style.cssText = `
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            `;
        }
        
        // ✅ Log removido para performance
    }

    /**
     * Chamado pela página quando ela terminou de carregar TUDO (incluindo API)
     * Faz a transição suave do skeleton para o conteúdo real
     */
    function ready(options = {}) {
        if (!state.isLoading) return;

        const elapsed = Date.now() - state.loadStartTime;
        const remainingTime = Math.max(0, CONFIG.minLoadingTime - elapsed);

        // Garantir tempo mínimo do skeleton para evitar flash
        setTimeout(() => {
            finishLoading(options);
        }, remainingTime);
    }

    /**
     * Finaliza o loading com animação suave de entrada
     */
    function finishLoading(options = {}) {
        const container = document.getElementById('app-container');
        if (!container) return;

        // ✅ FADE OUT DO SKELETON
        const skeleton = container.querySelector('.page-skeleton');
        if (skeleton) {
            skeleton.classList.add('skeleton-fade-out');
            // Remover após fade
            setTimeout(() => {
                if (skeleton.parentNode) {
                    skeleton.remove();
                }
            }, 250);
        }

        // ✅ MOSTRAR CONTEÚDO COM ANIMAÇÃO
        const pageContent = container.querySelector('.page-root, .app-container');
        if (pageContent) {
            pageContent.style.cssText = `
                display: block !important;
                visibility: visible !important;
                transform: translateZ(0) !important;
                -webkit-transform: translateZ(0) !important;
            `;
            
            // ✅ ATIVAR ANIMAÇÕES DE AUTH (login/register) se não for transição auth
            if (!window._authTransition) {
                const logo = pageContent.querySelector('.login-logo');
                const loginContainer = pageContent.querySelector('.login-container');
                const registerContainer = pageContent.querySelector('.register-container');
                const authContainer = loginContainer || registerContainer;
                
                if (authContainer) {
                    // Primeira entrada: animar tudo
                    if (logo) logo.classList.add('animate-in');
                    if (authContainer) authContainer.classList.add('animate-in');
                }
            }
        }
        
        // ✅ GARANTIR BACKGROUND SEMPRE VISÍVEL
        container.style.cssText = `
            background: #121212 !important;
            background-color: #121212 !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;
        document.body.style.cssText = `
            background: #121212 !important;
            background-color: #121212 !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;

        // ✅ MARCAR COMO READY (ativa animação de entrada)
        container.classList.remove('page-loading');
        container.classList.add('page-ready');
        
        // ✅ APÓS ANIMAÇÃO, MARCAR COMO LOADED
        setTimeout(() => {
            container.classList.remove('page-ready');
            container.classList.add('page-loaded');
        }, 350);
        
        state.isLoading = false;

        // ✅ Disparar evento pageLoaded
        const path = (window.SPARouter && window.SPARouter.currentPath) || window.location.pathname;
        window.dispatchEvent(new CustomEvent('pageLoaded', { 
            detail: { path, container: container } 
        }));

        // ✅ ESCONDER BOTTOM NAV EM PÁGINAS AUTH
        const bottomNav = document.getElementById('bottom-nav-container');
        const currentPage = state.currentPage || '';
        const isAuthPage = ['auth_login', 'auth_register'].includes(currentPage);
        
        if (bottomNav) {
            if (isAuthPage) {
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

        // ✅ Log removido para performance
    }

    /**
     * Força finalização (timeout de segurança)
     */
    function forceReady() {
        if (state.isLoading) {
            // Força ready silenciosamente (timeout de segurança)
            finishLoading();
        }
    }

    // === CACHE DE API ===

    /**
     * Busca dados com cache
     */
    async function fetchWithCache(url, options = {}) {
        const cacheKey = url + JSON.stringify(options);
        const cached = state.apiCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CONFIG.cacheExpiry) {
            // Cache hit - silencioso
            return cached.data;
        }

        try {
            const fetcher = window.authenticatedFetch || fetch;
            const response = await fetcher(url, options);
            const data = await response.json();

            state.apiCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            // Se falhar, tentar retornar cache expirado
            if (cached) {
                // Usando cache stale - silencioso
                return cached.data;
            }
            throw error;
        }
    }

    /**
     * Invalida cache de uma URL específica
     */
    function invalidateCache(urlPattern) {
        for (const key of state.apiCache.keys()) {
            if (key.includes(urlPattern)) {
                state.apiCache.delete(key);
            }
        }
    }

    /**
     * Limpa todo o cache
     */
    function clearCache() {
        state.apiCache.clear();
    }

    // === PREFETCH ===

    /**
     * Pré-carrega uma página em background
     */
    function prefetch(fragmentPath) {
        if (state.prefetchQueue.has(fragmentPath)) return;

        state.prefetchQueue.add(fragmentPath);

        // Usar requestIdleCallback se disponível, senão setTimeout
        const scheduleLoad = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

        scheduleLoad(() => {
            fetch(fragmentPath)
                .then(res => res.text())
                .then(html => {
                    // Armazenar no cache do router se disponível
                    if (window.SPARouter && window.SPARouter.prefetchedPages) {
                        window.SPARouter.prefetchedPages.set(fragmentPath, html);
                    }
                    // Prefetched - silencioso
                })
                .catch(() => {})
                .finally(() => {
                    state.prefetchQueue.delete(fragmentPath);
                });
        });
    }

    // === TIMEOUT DE SEGURANÇA ===
    let safetyTimeout = null;

    function setSafetyTimeout() {
        clearSafetyTimeout();
        safetyTimeout = setTimeout(() => {
            if (state.isLoading) {
                // Timeout de segurança - força ready silenciosamente
                forceReady();
            }
        }, CONFIG.maxLoadingTime);
    }

    function clearSafetyTimeout() {
        if (safetyTimeout) {
            clearTimeout(safetyTimeout);
            safetyTimeout = null;
        }
    }

    // === INTEGRAÇÃO COM ROUTER ===

    // Ouvir eventos do router
    window.addEventListener('fragmentReady', (e) => {
        // O router carregou o HTML, agora esperamos a página chamar ready()
        setSafetyTimeout();
    });

    // === API PÚBLICA ===
    window.PageLoader = {
        start: startLoading,
        ready: ready,
        forceReady: forceReady,
        fetch: fetchWithCache,
        invalidateCache: invalidateCache,
        clearCache: clearCache,
        prefetch: prefetch,
        isLoading: () => state.isLoading,
        config: CONFIG
    };

    // ✅ Log removido para performance
})();

