/**
 * Sistema de Log Condicional
 * Só loga em desenvolvimento, reduz performance em produção
 */
(function() {
    'use strict';
    
    // Detectar se está em desenvolvimento
    const isDev = !window.Capacitor && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    // Criar logger global
    window.Logger = {
        log: isDev ? console.log.bind(console) : function() {},
        warn: isDev ? console.warn.bind(console) : function() {},
        error: console.error.bind(console), // Erros sempre logam
        info: isDev ? console.info.bind(console) : function() {},
        debug: isDev ? console.log.bind(console) : function() {}
    };
    
    // Substituir console.log globalmente (opcional, mas mais agressivo)
    if (!isDev) {
        // Em produção, desabilitar console.log completamente
        const noop = function() {};
        window.console.log = noop;
        window.console.warn = noop;
        window.console.info = noop;
        window.console.debug = noop;
        // Manter apenas console.error para erros críticos
    }
})();

