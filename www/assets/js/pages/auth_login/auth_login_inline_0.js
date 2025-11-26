
/**
 * Script Inline Protegido - inline_0
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
    // NÃO definir BASE_APP_URL aqui - deixar common.js e config.js fazerem isso
    // Isso evita sobrescrever valores corretos já definidos
    
    // Esconder bottom nav em páginas de auth
    function hideBottomNav() {
        const bottomNav = document.getElementById('bottom-nav-container');
        if (bottomNav) {
            bottomNav.classList.add('hidden');
            bottomNav.style.display = 'none';
        }
        if (window.BottomNavAPI) {
            window.BottomNavAPI.hide();
        }
    }
    
    // Ativar animações na primeira carga
    function activateAnimations() {
        const container = document.querySelector('.login-container');
        const logo = document.querySelector('.login-logo');
        
        // Verificar se já veio de outra página auth (View Transition)
        const isViewTransition = document.startViewTransition !== undefined && 
                                 sessionStorage.getItem('auth-transition') === 'true';
        
        if (!isViewTransition) {
            if (container) {
                container.classList.add('animate-in');
            }
            if (logo) {
                logo.classList.add('animate-in');
            }
        } else {
            // Limpar flag
            sessionStorage.removeItem('auth-transition');
        }
    }
    
    // Executar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            hideBottomNav();
            activateAnimations();
        });
    } else {
        hideBottomNav();
        activateAnimations();
    }
    
    // Também esconder quando a página for carregada via SPA
    window.addEventListener('pageLoaded', function() {
        hideBottomNav();
    });
})();
