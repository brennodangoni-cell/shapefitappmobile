
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
        if (window.BASE_APP_URL.endsWith('/')) {
            window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
        }
    
})();
