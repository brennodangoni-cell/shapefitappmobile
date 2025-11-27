
/**
 * Script Inline Protegido - inline_0
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // Definir BASE_APP_URL antes de carregar auth.js
        window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
        if (window.BASE_APP_URL.endsWith('/')) {
            window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
        }

        function setRealViewportHeight() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }
        window.addEventListener('resize', setRealViewportHeight);
        setRealViewportHeight();
    
})();
