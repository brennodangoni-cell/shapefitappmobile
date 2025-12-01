
/**
 * Script Inline Protegido - account_deleted_inline_0
 * Página de confirmação de exclusão de conta
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
    'use strict';
    
    // Evitar execução duplicada
    if (window._accountDeletedLoaded) {
        return;
    }
    window._accountDeletedLoaded = true;
    
    // Resetar flag quando sair da página
    window.addEventListener('beforeunload', () => {
        window._accountDeletedLoaded = false;
    });
    
    function initAccountDeletedPage() {
        console.log('[AccountDeleted] Inicializando página de conta excluída...');
        
        // Garantir que o body tenha o estilo correto
        document.body.style.background = '#050505';
        document.body.style.overflow = 'hidden';
        document.body.classList.add('account-deleted-page');
        
        // Esconder bottom nav se existir
        const bottomNav = document.getElementById('bottom-nav-container');
        if (bottomNav) {
            bottomNav.style.display = 'none';
            bottomNav.style.opacity = '0';
            bottomNav.style.visibility = 'hidden';
        }
        
        // Garantir que a página está no topo
        window.scrollTo(0, 0);
        if (window.SPARouter && window.SPARouter.container) {
            window.SPARouter.container.scrollTop = 0;
        }
        
        // Limpar dados locais (caso não tenham sido limpos antes)
        localStorage.removeItem('shapefit_auth_token');
        localStorage.removeItem('shapefitUserToken');
        localStorage.removeItem('shapefitUserData');
        
        if (window.clearAuthToken) {
            window.clearAuthToken();
        }
        window._authResult = undefined;
        window._authChecking = false;
        
        // Redirecionar após 3 segundos
        setTimeout(function() {
            console.log('[AccountDeleted] Redirecionando para login...');
            
            // Redirecionar para login usando router SPA
            if (window.SPARouter && typeof window.SPARouter.navigate === 'function') {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                // Fallback
                window.location.href = '/auth/login.html';
            }
        }, 3000); // 3 segundos
        
        // Notificar que a página está pronta
        if (window.PageLoader) {
            window.PageLoader.ready();
        }
    }
    
    // Executar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccountDeletedPage);
    } else {
        initAccountDeletedPage();
    }
})();

