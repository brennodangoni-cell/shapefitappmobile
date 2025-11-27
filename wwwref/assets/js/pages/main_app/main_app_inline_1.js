
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // NÃO sobrescrever BASE_APP_URL se já foi definido pelo www-config.js
        // O www-config.js já define corretamente para mobile (https://appshapefit.com)
        // Apenas usar fallback se não foi definido (não deve acontecer)
        if (!window.BASE_APP_URL) {
            window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
            if (window.BASE_APP_URL.endsWith('/')) {
                window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
            }
        }
        console.log('[main_app head] BASE_APP_URL:', window.BASE_APP_URL);
    
})();
