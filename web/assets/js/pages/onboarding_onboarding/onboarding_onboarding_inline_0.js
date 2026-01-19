
/**
 * Script Inline Protegido - inline_0
 * Compatível com SPA
 */
(function() {
        // Definir BASE_APP_URL se não existir
        if (!window.BASE_APP_URL) {
            window.BASE_APP_URL = window.location.origin;
        }

        function setRealViewportHeight() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }
        window.addEventListener('resize', setRealViewportHeight);
        setRealViewportHeight();

        // Verificar autenticação (usar router SPA se disponível)
        if (typeof getAuthToken === 'function' && !getAuthToken()) {
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/login');
            } else {
                window.location.href = '/login';
            }
        }
    
})();
