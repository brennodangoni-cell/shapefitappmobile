
/**
 * Script Inline Protegido - inline_0
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // BASE_APP_URL já foi definido pelo www-config.js
        // Se não foi definido (fallback), usar URL local
        if (!window.BASE_APP_URL) {
            window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
            if (window.BASE_APP_URL.endsWith('/')) {
                window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
            }
        }
        console.log('[dashboard] BASE_APP_URL:', window.BASE_APP_URL);
    
})();
