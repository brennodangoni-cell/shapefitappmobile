
/**
 * Script Inline Protegido - inline_0
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        function setRealViewportHeight() { 
            const vh = window.innerHeight * 0.01; 
            document.documentElement.style.setProperty('--vh', `${vh}px`); 
        }
        setRealViewportHeight();
        window.addEventListener('resize', setRealViewportHeight);
        window.addEventListener('orientationchange', function() {
            setTimeout(setRealViewportHeight, 100);
        });
        
        if (window.visualViewport) {
            const updateKeyboardOffset = () => {
                const viewportHeight = window.visualViewport.height;
                const offset = Math.max(0, window.innerHeight - viewportHeight);
                document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
            };
            
            window.visualViewport.addEventListener('resize', updateKeyboardOffset);
            window.visualViewport.addEventListener('scroll', updateKeyboardOffset);
            window.addEventListener('orientationchange', updateKeyboardOffset);
            updateKeyboardOffset();
        }
        
        document.addEventListener('touchmove', function(event) {
            // Só processar se estiver na página main_app
            const isMainAppPage = document.querySelector('.main-app-container') || document.querySelector('.dashboard-container');
            if (!isMainAppPage) return;
            
            const checkinModal = document.getElementById('checkinModal');
            const isModalOpen = checkinModal && checkinModal.classList.contains('active');
            
            if (isModalOpen) {
                const insideMessages = event.target.closest('#checkinMessages');
                if (insideMessages) {
                    // Permitir scroll dentro do chat
                    return;
                }
                
                const insideModal = event.target.closest('#checkinModal');
                if (insideModal) {
                    // Dentro do modal mas fora das mensagens -> bloquear
                    event.preventDefault();
                    return;
                }
            }
            
            const scrollable = event.target.closest('.app-container, .container');
            if (!scrollable) {
                event.preventDefault();
            }
        }, { passive: false });
    
})();
