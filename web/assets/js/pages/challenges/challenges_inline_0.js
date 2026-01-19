// challenges_inline_0.js - Setup inicial da página de desafios

(function() {
    'use strict';
    
    console.log('[Challenges] Página carregada');
    
    // Verificar autenticação
    if (typeof verifyAuthentication === 'function') {
        verifyAuthentication().then(isAuthenticated => {
            if (!isAuthenticated) {
                console.log('[Challenges] Usuário não autenticado, redirecionando...');
                if (window.SPARouter) {
                    window.SPARouter.navigate('/fragments/auth_login.html');
                } else {
                    window.location.href = '/auth/login.html';
                }
            }
        });
    }
})();
