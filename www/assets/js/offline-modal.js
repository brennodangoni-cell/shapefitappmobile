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

    /**
     * Verifica se está realmente offline (não apenas navigator.onLine)
     */
    async function checkConnection() {
        // Se navigator.onLine diz que está online, tenta fazer um fetch pequeno
        if (navigator.onLine) {
            try {
                // Tenta buscar um arquivo pequeno do servidor
                const response = await fetch(`${window.BASE_APP_URL || ''}/favicon.ico?t=${Date.now()}`, {
                    method: 'HEAD',
                    cache: 'no-cache',
                    signal: AbortSignal.timeout(3000) // Timeout de 3 segundos
                });
                return response.ok;
            } catch (error) {
                return false;
            }
        }
        return false;
    }

    /**
     * Mostra o modal offline
     */
    function showOfflineModal() {
        if (isOffline) return; // Já está mostrando
        
        isOffline = true;
        offlineModal.classList.add('visible');
        console.log('[OfflineModal] Modal offline exibido');
        
        // Iniciar verificação periódica de reconexão
        if (!reconnectCheckInterval) {
            reconnectCheckInterval = setInterval(async () => {
                const isOnline = await checkConnection();
                if (isOnline) {
                    hideOfflineModal();
                }
            }, 2000); // Verifica a cada 2 segundos
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
        // Aguardar um pouco antes de verificar (pode ser um falso positivo)
        setTimeout(async () => {
            const isOnline = await checkConnection();
            if (isOnline) {
                hideOfflineModal();
            }
        }, 1000);
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

