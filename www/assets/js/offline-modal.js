/**
 * Modal Offline - Detecta quando o usuário está sem internet
 * Mostra modal automaticamente quando offline e esconde quando online
 * Não desloga o usuário
 */

(function() {
    'use strict';

    const offlineModal = document.getElementById('offline-modal');
    if (!offlineModal) {
        console.warn('[OfflineModal] Modal não encontrado no DOM');
        return;
    }

    let isOffline = false;
    let reconnectCheckInterval = null;
    let isChecking = false;

    const retryButton = document.getElementById('offline-retry-button');
    const modalIcon = document.getElementById('offline-modal-icon');
    const modalMessage = document.getElementById('offline-modal-message');
    const modalSpinner = document.getElementById('offline-modal-spinner');

    /**
     * Verifica se está realmente offline (não apenas navigator.onLine)
     * Tenta múltiplas estratégias para garantir detecção precisa
     */
    async function checkConnection() {
        // Primeira verificação: navigator.onLine
        if (!navigator.onLine) {
            return false;
        }

        // Segunda verificação: tentar fazer fetch para o servidor
        const baseUrl = window.BASE_APP_URL || window.location.origin;
        const testUrls = [
            `${baseUrl}/favicon.ico?t=${Date.now()}`,
            `${baseUrl}/manifest.json?t=${Date.now()}`,
            'https://www.google.com/favicon.ico?t=' + Date.now() // Fallback para Google
        ];

        for (const url of testUrls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout mais curto
                
                const response = await fetch(url, {
                    method: 'HEAD',
                    cache: 'no-cache',
                    signal: controller.signal,
                    mode: 'no-cors' // Para o fallback do Google
                });
                
                clearTimeout(timeoutId);
                
                // Se chegou aqui, tem conexão
                return true;
            } catch (error) {
                // Continua tentando outras URLs
                continue;
            }
        }

        // Se nenhuma URL funcionou, está offline
        return false;
    }

    /**
     * Atualiza o estado visual do modal
     */
    function updateModalState(checking) {
        if (checking) {
            isChecking = true;
            retryButton.disabled = true;
            retryButton.classList.add('checking');
            modalIcon.classList.add('checking');
            modalSpinner.style.display = 'block';
            modalMessage.textContent = 'Verificando conexão...';
        } else {
            isChecking = false;
            retryButton.disabled = false;
            retryButton.classList.remove('checking');
            modalIcon.classList.remove('checking');
            modalSpinner.style.display = 'none';
            modalMessage.textContent = 'Você está offline. Verifique sua conexão com a internet.';
        }
    }

    /**
     * Mostra o modal offline
     */
    function showOfflineModal() {
        if (isOffline) return; // Já está mostrando
        
        isOffline = true;
        updateModalState(false);
        offlineModal.classList.add('visible');
        console.log('[OfflineModal] Modal offline exibido');
        
        // Iniciar verificação periódica de reconexão (mais frequente)
        if (!reconnectCheckInterval) {
            reconnectCheckInterval = setInterval(async () => {
                if (!isChecking) {
                    const isOnline = await checkConnection();
                    if (isOnline) {
                        hideOfflineModal();
                    }
                }
            }, 1500); // Verifica a cada 1.5 segundos
        }
    }

    /**
     * Esconde o modal offline
     */
    function hideOfflineModal() {
        if (!isOffline) return; // Já está escondido
        
        isOffline = false;
        offlineModal.classList.remove('visible');
        console.log('[OfflineModal] Modal offline escondido - conexão restaurada');
        
        // Parar verificação periódica
        if (reconnectCheckInterval) {
            clearInterval(reconnectCheckInterval);
            reconnectCheckInterval = null;
        }
    }

    /**
     * Handler para evento online
     */
    async function handleOnline() {
        console.log('[OfflineModal] Evento online detectado, verificando conexão...');
        updateModalState(true);
        
        // Aguardar um pouco antes de verificar (pode ser um falso positivo)
        setTimeout(async () => {
            const isOnline = await checkConnection();
            if (isOnline) {
                hideOfflineModal();
            } else {
                updateModalState(false);
            }
        }, 500);
    }

    /**
     * Função para tentar reconectar manualmente
     */
    async function retryConnection() {
        if (isChecking) return;
        
        console.log('[OfflineModal] Tentativa manual de reconexão');
        updateModalState(true);
        
        // Verificar múltiplas vezes para garantir
        let attempts = 0;
        const maxAttempts = 3;
        
        const checkInterval = setInterval(async () => {
            attempts++;
            const isOnline = await checkConnection();
            
            if (isOnline) {
                clearInterval(checkInterval);
                hideOfflineModal();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                updateModalState(false);
                console.log('[OfflineModal] Ainda offline após', maxAttempts, 'tentativas');
            }
        }, 800);
    }

    /**
     * Handler para evento offline
     */
    function handleOffline() {
        console.log('[OfflineModal] Evento offline detectado');
        showOfflineModal();
    }

    /**
     * Verificação inicial ao carregar a página
     */
    async function initOfflineCheck() {
        // Aguardar um pouco para garantir que a página carregou
        setTimeout(async () => {
            const isOnline = await checkConnection();
            if (!isOnline && navigator.onLine === false) {
                showOfflineModal();
            }
        }, 2000);
    }

    // Event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Botão de tentar novamente
    if (retryButton) {
        retryButton.addEventListener('click', retryConnection);
    }

    // Verificação inicial
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOfflineCheck);
    } else {
        initOfflineCheck();
    }

    // Também verificar quando a página ganha foco (usuário volta para a aba)
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            const isOnline = await checkConnection();
            if (!isOnline) {
                showOfflineModal();
            } else {
                hideOfflineModal();
            }
        }
    });

    // Expor função globalmente para debug (opcional)
    window.offlineModal = {
        show: showOfflineModal,
        hide: hideOfflineModal,
        check: checkConnection
    };
})();

