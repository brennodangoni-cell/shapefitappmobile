
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // ✅ Definir BASE_APP_URL apenas para chamadas de API (não para redirecionamentos)
        // Em app nativo, sempre usar caminhos relativos ou router SPA
        const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
        
        if (isNative) {
            // Em app nativo, BASE_APP_URL deve apontar para o servidor de API
            window.BASE_APP_URL = window.API_BASE_URL || 'https://appshapefit.com';
        } else {
            // Em web, calcular baseado na URL atual
            window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -2).join('/');
            if (window.BASE_APP_URL.endsWith('/')) {
                window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
            }
        }
        console.log('[Register] BASE_APP_URL definido como:', window.BASE_APP_URL, '(nativo:', isNative, ')');
    
})();
