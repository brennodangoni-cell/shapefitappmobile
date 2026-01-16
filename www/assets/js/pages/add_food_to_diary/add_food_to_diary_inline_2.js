
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        const bottomNavScript = document.createElement('script');
        bottomNavScript.src = './assets/js/bottom-nav.js?v=' + Date.now();
        document.head.appendChild(bottomNavScript);
    
})();
