
/**
 * Script Inline Protegido - inline_0
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('../sw.js?v=7')
                .then(function(registration) {
                    console.log('ServiceWorker registrado:', registration.scope);
                    
                    // Verificar atualizações periodicamente
                    setInterval(function() {
                        registration.update();
                    }, 1000);
                    
                    // Forçar atualização quando detectar nova versão
                    registration.addEventListener('updatefound', function() {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', function() {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // Nova versão disponível - recarregar página
                                window.location.reload();
                            }
                        });
                    });
                })
                .catch(function(error) {
                    console.log('Falha no registro do ServiceWorker:', error);
                });
            
            // Forçar atualização ao focar na página
            window.addEventListener('focus', function() {
                navigator.serviceWorker.getRegistration().then(function(registration) {
                    if (registration) {
                        registration.update();
                    }
                });
            });
        });
    }
    
})();
