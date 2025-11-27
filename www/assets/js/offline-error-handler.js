/**
 * Offline Error Handler - Intercepta erros e não mostra mensagens quando offline
 * Garante que usuário nunca veja mensagens de erro quando está sem internet
 */

(function() {
    'use strict';

    /**
     * Verifica se está offline
     */
    function isOffline() {
        return !navigator.onLine || 
               (document.getElementById('offline-modal') && 
                document.getElementById('offline-modal').classList.contains('visible'));
    }

    /**
     * Verifica se erro é relacionado a rede
     */
    function isNetworkError(error) {
        if (!error) return false;
        
        // Se erro tem flag silent, sempre tratar como erro de rede silencioso
        if (error.silent === true) {
            return true;
        }
        
        const errorMsg = error.message || error.toString() || '';
        const errorName = error.name || '';
        
        return errorMsg.includes('Failed to fetch') ||
               errorMsg.includes('NetworkError') ||
               errorMsg.includes('Network request failed') ||
               errorMsg.includes('network') ||
               errorName === 'TypeError' ||
               errorName === 'NetworkError';
    }

    /**
     * Esconde mensagens de erro na página
     */
    function hideErrorMessages() {
        // Esconder elementos com mensagens de erro
        const errorTexts = [
            'Erro ao carregar dados',
            'Failed to fetch',
            'Erro ao carregar',
            'Error loading',
            'Verifique o console',
            'OFFLINE_SILENT',
            'Network request failed'
        ];
        
        errorTexts.forEach(text => {
            // Buscar por texto em elementos visíveis
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(text)) {
                    let parent = node.parentElement;
                    // Subir até encontrar um elemento que possa ser escondido
                    while (parent && parent !== document.body) {
                        if (parent.tagName && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
                            parent.style.display = 'none';
                            parent.classList.add('hidden-by-offline');
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
            }
        });
        
        // Esconder elementos com classes de erro
        document.querySelectorAll('.error, .error-message, .alert-danger, [class*="error"]').forEach(el => {
            el.style.display = 'none';
            el.classList.add('hidden-by-offline');
        });
    }

    /**
     * Interceptar window.onerror
     */
    const originalOnerror = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        if (isOffline() && isNetworkError(error)) {
            // Não mostrar erro quando offline
            hideErrorMessages();
            return true; // Prevenir comportamento padrão
        }
        
        if (originalOnerror) {
            return originalOnerror(message, source, lineno, colno, error);
        }
        return false;
    };

    /**
     * Interceptar Promise rejections não tratadas
     */
    window.addEventListener('unhandledrejection', function(event) {
        if (isOffline() && isNetworkError(event.reason)) {
            // Não mostrar erro quando offline
            event.preventDefault();
            hideErrorMessages();
            return;
        }
    });

    /**
     * Esconder mensagens quando modal offline aparece
     */
    const observer = new MutationObserver(function(mutations) {
        const offlineModal = document.getElementById('offline-modal');
        if (offlineModal && offlineModal.classList.contains('visible')) {
            hideErrorMessages();
        }
    });

    // Observar mudanças no modal offline
    const offlineModal = document.getElementById('offline-modal');
    if (offlineModal) {
        observer.observe(offlineModal, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // Esconder mensagens de erro imediatamente se modal já estiver visível
    if (offlineModal && offlineModal.classList.contains('visible')) {
        hideErrorMessages();
    }

    // ✅ ESCUTAR EVENTO DE RECONEXÃO
    // Quando a conexão volta, esconder mensagens de erro
    window.addEventListener('reloadPageData', function(e) {
        if (e.detail && e.detail.reason === 'connection-restored') {
            
            hideErrorMessages();
        }
    });
    
    // ✅ TAMBÉM ESCUTAR EVENTO ONLINE (backup)
    window.addEventListener('online', function() {
        setTimeout(() => {
            if (navigator.onLine) {
                
                hideErrorMessages();
            }
        }, 500);
    });

    // Expor função globalmente
    window.hideErrorMessages = hideErrorMessages;
    window.isOffline = isOffline;
})();

