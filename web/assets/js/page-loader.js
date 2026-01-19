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

        // Scanner de código de barras
        scanner: `
            <div class="page-skeleton" data-type="scanner">
                <div class="skel-page-header" style="display: flex; align-items: center; gap: 12px; padding: 16px 0; margin-bottom: 16px;">
                    <div class="skel-back skeleton" style="width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;"></div>
                    <div class="skel-title skeleton" style="height: 24px; flex: 1; border-radius: 8px;"></div>
                </div>
                <div class="skel-scanner-camera skeleton" style="width: 100%; height: 55vh; min-height: 450px; max-height: 550px; border-radius: 16px; margin-bottom: 16px; flex-shrink: 0;"></div>
                <div class="skel-scanner-controls" style="display: flex; flex-direction: column; gap: 12px;">
                    <div class="skel-input-group skeleton" style="height: 60px; border-radius: 16px; width: 100%;"></div>
                </div>
            </div>`,

        // Auth (login/register) - sem skeleton, transição direta
        auth: `<div class="page-skeleton" data-type="auth"></div>`,
        
        // Onboarding - skeleton limpo e simples, similar ao dashboard
        onboarding: `
            <div class="page-skeleton" data-type="onboarding" style="width: 100%; max-width: 480px; height: 100%; display: flex; flex-direction: column; margin: 0 auto;">
                <div style="padding: calc(env(safe-area-inset-top, 0px) + 10px) 20px 10px; flex-shrink: 0;">
                    <div class="skeleton" style="width: 100%; height: 4px; border-radius: 2px; margin-bottom: 10px;"></div>
                </div>
                <div style="flex-grow: 1; padding: 20px; display: flex; flex-direction: column; gap: 18px;">
                    <div class="skeleton" style="height: 32px; width: 70%; border-radius: 8px;"></div>
                    <div class="skeleton" style="height: 20px; width: 90%; border-radius: 8px;"></div>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                        <div class="skeleton" style="height: 54px; border-radius: 14px;"></div>
                        <div class="skeleton" style="height: 54px; border-radius: 14px;"></div>
                        <div class="skeleton" style="height: 54px; border-radius: 14px;"></div>
                    </div>
                </div>
                <div style="padding: 20px; flex-shrink: 0;">
                    <div class="skeleton" style="width: 100%; height: 50px; border-radius: 16px;"></div>
                </div>
            </div>`
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
        'onboarding_onboarding': 'onboarding',
        'scan_barcode': 'scanner'
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

        // ✅ Para onboarding, REMOVER REGISTER E PREPARAR LAYOUT (background já está no CSS)
        const isOnboardingPage = pageName === 'onboarding_onboarding';
        
        if (isOnboardingPage) {
            // ✅ REMOVER TODOS os elementos do register (se ainda existirem)
            const registerPage = document.querySelector('.register-page');
            const registerContainer = document.querySelector('.register-container');
            const registerForm = document.getElementById('registerForm');
            if (registerPage) registerPage.remove();
            if (registerContainer) registerContainer.remove();
            if (registerForm) registerForm.remove();
            
            // ✅ GARANTIR BACKGROUND (se não foi aplicado ainda)
            if (!container.style.background || !container.style.background.includes('radial-gradient')) {
                container.style.background = 'radial-gradient(circle at top, #1b1b1b 0, #050505 55%)';
                container.style.backgroundColor = '#050505';
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                container.style.alignItems = 'center';
            }
            if (!document.body.style.background || !document.body.style.background.includes('radial-gradient')) {
                document.body.style.background = 'radial-gradient(circle at top, #1b1b1b 0, #050505 55%)';
                document.body.style.backgroundColor = '#050505';
                document.body.style.display = 'flex';
                document.body.style.justifyContent = 'center';
                document.body.style.alignItems = 'center';
            }
        } else {
            // ✅ Para outras páginas, apenas garantir visibilidade
            // NÃO aplicar background aqui se já foi aplicado (evita piscada)
            if (!container.style.background || container.style.background.includes('radial-gradient')) {
                // Background já foi aplicado, não sobrescrever
            } else {
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
            }
        }

        // Determinar tipo de skeleton
        const skeletonType = PAGE_TYPE_MAP[pageName] || 'dashboard';
        const skeleton = SKELETONS[skeletonType] || SKELETONS.dashboard;

        // ✅ CRIAR ELEMENTO DE SKELETON SEPARADO (não substituir conteúdo)
        let skeletonEl = container.querySelector('.page-skeleton');
        if (!skeletonEl) {
            skeletonEl = document.createElement('div');
            skeletonEl.className = 'page-skeleton';
            skeletonEl.setAttribute('data-type', skeletonType);
            container.appendChild(skeletonEl);
        } else {
            skeletonEl.setAttribute('data-type', skeletonType);
        }
        skeletonEl.innerHTML = skeleton;
        skeletonEl.classList.remove('skeleton-fade-out');
        
        // ✅ GARANTIR SKELETON 100% VISÍVEL IMEDIATAMENTE (SEM DELAY)
        skeletonEl.style.cssText = `
            z-index: 9999 !important;
            opacity: 1 !important;
            visibility: visible !important;
            display: flex !important;
        `;
        
        // ✅ GARANTIR SKELETON SEMPRE VISÍVEL
        if (isOnboardingPage) {
            // ✅ Container - layout
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            
            // ✅ Skeleton - 100% VISÍVEL E CENTRALIZADO
            skeletonEl.setAttribute('style', `
                position: relative !important;
                width: 100% !important;
                max-width: 480px !important;
                height: 100% !important;
                max-height: 100vh !important;
                display: flex !important;
                flex-direction: column !important;
                opacity: 1 !important;
                visibility: visible !important;
                padding: 0 !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                background: transparent !important;
                z-index: 9999 !important;
            `);
            
            // ✅ Body - layout com centralização (background já aplicado acima)
            document.body.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: calc(var(--vh, 1vh) * 100) !important;
                overflow: hidden !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                justify-content: center !important;
                align-items: stretch !important;
            `;
            
            // ✅ GARANTIR SCROLL NO TOPO imediatamente
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        } else {
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
        }
        
        // ✅ FORÇAR RE-FLOW para garantir que padding está aplicado
        skeletonEl.offsetHeight;
        
        // ✅ GARANTIR SKELETON VISÍVEL COM Z-INDEX ALTO
        skeletonEl.style.zIndex = '9999';
        skeletonEl.style.position = 'relative';
        
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
        
        // ✅ FORÇAR RE-FLOW FINAL para garantir que skeleton está visível
        skeletonEl.offsetHeight;
        document.body.offsetHeight;
        
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
        const pageContent = container.querySelector('.page-root, .app-container, .page-content-hidden');
        if (pageContent) {
            // Remover classe de escondido
            pageContent.classList.remove('page-content-hidden');
            
            // ✅ Para onboarding, garantir EXATAMENTE o mesmo layout do skeleton
            const isOnboarding = state.currentPage === 'onboarding_onboarding';
            if (isOnboarding) {
                // ✅ GARANTIR layout COM BACKGROUND PRETO E ILUMINAÇÃO (o lindo!)
                container.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: calc(var(--vh, 1vh) * 100) !important;
                    overflow: hidden !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: stretch !important;
                    background: radial-gradient(circle at top, #1b1b1b 0, #050505 55%) !important;
                    background-color: #050505 !important;
                `;
                
                // ✅ GARANTIR layout do body COM BACKGROUND PRETO E ILUMINAÇÃO
                document.body.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: calc(var(--vh, 1vh) * 100) !important;
                    overflow: hidden !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: stretch !important;
                    background: radial-gradient(circle at top, #1b1b1b 0, #050505 55%) !important;
                    background-color: #050505 !important;
                `;
                
                // ✅ GARANTIR background no html também
                document.documentElement.style.cssText = `
                    background: radial-gradient(circle at top, #1b1b1b 0, #050505 55%) !important;
                    background-color: #050505 !important;
                `;
                
                // Resetar scroll ANTES de mostrar o conteúdo
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                if (container) container.scrollTop = 0;
                
                // ✅ Garantir que o conteúdo do onboarding tenha EXATAMENTE o mesmo posicionamento do skeleton
                const appContainer = pageContent.querySelector('.app-container');
                const onboardingForm = pageContent.querySelector('#onboarding-form');
                const footerNav = pageContent.querySelector('.footer-nav');
                
                if (appContainer) {
                    appContainer.scrollTop = 0;
                    // ✅ Forçar o mesmo posicionamento do skeleton (centralizado via container justify-content)
                    appContainer.style.width = '100%';
                    appContainer.style.maxWidth = '480px';
                    appContainer.style.height = '100%';
                    appContainer.style.margin = '0';
                    appContainer.style.display = 'flex';
                    appContainer.style.flexDirection = 'column';
                }
                
                // ✅ GARANTIR que o form tenha display flex
                if (onboardingForm) {
                    onboardingForm.style.display = 'flex';
                    onboardingForm.style.flexDirection = 'column';
                    onboardingForm.style.minHeight = '0';
                    onboardingForm.style.overflow = 'hidden';
                }
                
                // ✅ GARANTIR que o footer fique EM CIMA (sem margin-top: auto)
                if (footerNav) {
                    footerNav.style.cssText = `
                        padding: 18px 20px calc(env(safe-area-inset-bottom, 0px) + 22px) !important;
                        flex: 0 0 auto !important;
                        flex-shrink: 0 !important;
                        flex-grow: 0 !important;
                        margin-top: 0 !important;
                        margin-bottom: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 12px !important;
                        align-self: flex-start !important;
                        width: 100% !important;
                        position: relative !important;
                        order: 2 !important;
                    `;
                }
                
                // ✅ Garantir que o page-root também tenha o layout correto
                if (pageContent.classList.contains('page-root')) {
                    pageContent.style.cssText = `
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        pointer-events: auto !important;
                        transform: translateZ(0) !important;
                        -webkit-transform: translateZ(0) !important;
                        width: 100% !important;
                        max-width: 480px !important;
                        height: 100% !important;
                    `;
                } else {
                    pageContent.style.cssText = `
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        pointer-events: auto !important;
                        transform: translateZ(0) !important;
                        -webkit-transform: translateZ(0) !important;
                    `;
                }
            } else {
                pageContent.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                    transform: translateZ(0) !important;
                    -webkit-transform: translateZ(0) !important;
                `;
            }
            
            // ✅ Resetar scroll novamente após mostrar (para garantir) - múltiplos resets
            if (isOnboarding) {
                // ✅ GARANTIR que o body mantenha EXATAMENTE o mesmo estilo (justify-content: center)
                document.body.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: calc(var(--vh, 1vh) * 100) !important;
                    overflow: hidden !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: stretch !important;
                `;
                
                requestAnimationFrame(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    if (container) container.scrollTop = 0;
                    const appContainer = pageContent.querySelector('.app-container');
                    if (appContainer) {
                        appContainer.scrollTop = 0;
                    }
                });
                
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    if (container) container.scrollTop = 0;
                    const appContainer = pageContent.querySelector('.app-container');
                    if (appContainer) {
                        appContainer.scrollTop = 0;
                    }
                }, 50);
                
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    if (container) container.scrollTop = 0;
                    const appContainer = pageContent.querySelector('.app-container');
                    if (appContainer) {
                        appContainer.scrollTop = 0;
                    }
                }, 150);
            }
            
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

