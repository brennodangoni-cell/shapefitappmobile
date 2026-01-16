
/**
 * Script Inline Protegido - auth_forgot_password_inline_0
 */
(function() {
    // Definir BASE_APP_URL se necessário
    const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
    
    if (isNative) {
        window.BASE_APP_URL = window.API_BASE_URL || 'https://appshapefit.com';
    } else {
        window.BASE_APP_URL = window.location.origin + window.location.pathname.split('/').slice(0, -2).join('/');
        if (window.BASE_APP_URL.endsWith('/')) {
            window.BASE_APP_URL = window.BASE_APP_URL.slice(0, -1);
        }
    }
})();

