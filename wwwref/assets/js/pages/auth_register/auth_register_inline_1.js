
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // Definir BASE_APP_URL antes de carregar auth.js
        window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -2).join('/');
        if (window.BASE_APP_URL.endsWith('/')) {
            window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
        }
        console.log('BASE_APP_URL definido como:', window.BASE_APP_URL);
    
})();
