/**
 * Modal Offline - Detecta quando o usuário está sem internet
 * Mostra modal automaticamente quando offline e esconde quando online
 * Não desloga o usuário
 */

(function() {
    'use strict';

    const offlineModal = document.getElementById('offline-modal');
    if (!offlineModal) {
        return;
    }

    let isOffline = false;
    let reconnectCheckInterval = null;
    let isChecking = false;

    const retryButton = document.getElementById('offline-retry-button');
    const retryIcon = document.getElementById('offline-retry-icon');
    const retryText = document.getElementById('offline-retry-text');
    const modalIcon = document.getElementById('offline-modal-icon');
    const modalMessage = document.getElementById('offline-modal-message');

    /**
     * Verifica se está realmente offline (não apenas navigator.onLine)
     * Tenta múltiplas estratégias para garantir detecção precisa
     */
    async function checkConnection() {
        // Primeira verificação: navigator.onLine
        if (!navigator.onLine) {
            return false;
        }

        // ✅ Segunda verificação: tentar fazer fetch para o servidor
        // ✅ SEMPRE usar origem local para verificação (não usar BASE_APP_URL que aponta para appshapefit.com)
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseUrl = isDev ? window.location.origin : (window.BASE_APP_URL || window.location.origin);
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
            if (retryIcon) {
                retryIcon.className = 'fas fa-spinner fa-spin';
            }
            if (retryText) {
                retryText.textContent = 'Verificando...';
            }
            modalMessage.textContent = 'Verificando conexão...';
        } else {
            isChecking = false;
            retryButton.disabled = false;
            retryButton.classList.remove('checking');
            if (retryIcon) {
                retryIcon.className = 'fas fa-sync-alt';
            }
            if (retryText) {
                retryText.textContent = 'Tentar novamente';
            }
            modalMessage.textContent = 'Você está offline. Verifique sua conexão com a internet.';
        }
    }

    /**
     * Esconde mensagens de erro quando está offline
     */
    function hideErrorMessages() {
        // Esconder mensagens de erro comuns
        const errorSelectors = [
            '.error-message',
            '.alert-danger',
            '[class*="error"]',
            '[id*="error"]',
            'p:contains("Erro ao carregar")',
            'div:contains("Failed to fetch")'
        ];
        
        errorSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    const text = el.textContent || '';
                    if (text.includes('Erro') || text.includes('Failed to fetch') || text.includes('Error')) {
                        el.style.display = 'none';
                        el.classList.add('hidden-by-offline');
                    }
                });
            } catch (e) {
                // Ignorar erros de seletor inválido
            }
        });
    }

    /**
     * Mostra o modal offline
     */
    function showOfflineModal() {
        if (isOffline) return; // Já está mostrando
        
        // ✅ VERIFICAR SE TEM TOKEN ANTES DE MOSTRAR MODAL
        // Se não tiver token, NÃO mostrar modal - redirecionar para login
        const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                     (localStorage.getItem('shapefit_auth_token') || null);
        
        if (!token) {
            // Redirecionar para login imediatamente
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return; // Não mostrar modal
        }
        
        isOffline = true;
        updateModalState(false);
        offlineModal.classList.add('visible');
        // ✅ Esconder mensagens de erro quando modal aparece
        hideErrorMessages();
        
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
     * Esconde o modal offline e recarrega a página atual
     */
    function hideOfflineModal() {
        if (!isOffline) return; // Já está escondido
        
        isOffline = false;
        offlineModal.classList.remove('visible');
        // Parar verificação periódica
        if (reconnectCheckInterval) {
            clearInterval(reconnectCheckInterval);
            reconnectCheckInterval = null;
        }
        
        // ✅ VERIFICAR SE TEM TOKEN quando internet volta
        // Se não tiver token, redirecionar para login (não deveria estar aqui)
        const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                     (localStorage.getItem('shapefit_auth_token') || null);
        
        if (!token) {
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return;
        }
        
        // ✅ LIMPAR MENSAGENS DE ERRO VISÍVEIS
        // Remover mensagens de erro que possam estar na tela
        if (typeof window.hideErrorMessages === 'function') {
            window.hideErrorMessages();
        }
        
        // Remover mensagens de erro manualmente também
        const errorSelectors = [
            '.error-message',
            '.alert-danger',
            '[class*="error"]',
            'div[style*="text-align: center"]'
        ];
        
        errorSelectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    const text = el.textContent || '';
                    if (text.includes('Erro ao carregar dados') || 
                        text.includes('Network request failed') ||
                        text.includes('Failed to fetch')) {
                        el.style.display = 'none';
                        el.classList.add('hidden-by-offline');
                    }
                });
            } catch (e) {
                // Ignorar erros de seletor
            }
        });
        
        // ✅ DISPARAR EVENTO DE RECONEXÃO
        // Isso permite que as páginas recarreguem seus dados automaticamente
        window.dispatchEvent(new CustomEvent('reloadPageData', {
            detail: { reason: 'connection-restored' }
        }));
        
        // ✅ RECARREGAR PÁGINA ATUAL AUTOMATICAMENTE quando internet volta
        // Isso garante que os dados sejam carregados novamente
        setTimeout(() => {
            const currentPath = window.location.pathname;
            const currentSearch = window.location.search;
            
            // Verificar novamente se tem token (pode ter mudado)
            const tokenCheck = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                              (localStorage.getItem('shapefit_auth_token') || null);
            
            if (!tokenCheck) {
                if (window.SPARouter && window.SPARouter.navigate) {
                    window.SPARouter.navigate('/fragments/auth_login.html', true);
                } else {
                    window.location.href = '/auth/login.html';
                }
                return;
            }
            
            // Se estiver usando SPA router, recarregar via router
            if (window.SPARouter && window.SPARouter.currentPath) {
                const currentRoute = window.SPARouter.currentPath;
                // ✅ RECARREGAR PÁGINA COMPLETA para garantir que tudo seja atualizado
                // Navegar para a mesma página para forçar recarregamento completo
                window.SPARouter.navigate(currentRoute + currentSearch, { forceReload: true });
            } else {
                // Fallback: recarregar página completa
                window.location.reload();
            }
        }, 500); // Pequeno delay para garantir que conexão está estável
    }

    /**
     * Handler para evento online
     */
    async function handleOnline() {
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
            }
        }, 800);
    }

    /**
     * Handler para evento offline
     */
    function handleOffline() {
        // ✅ Só mostrar modal se usuário estiver logado (tem token)
        const hasToken = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                        (localStorage.getItem('shapefit_auth_token') || null);
        
        if (hasToken) {
            showOfflineModal();
        }
    }

    /**
     * Verificação inicial ao carregar a página - IMEDIATA
     */
    async function initOfflineCheck() {
        // ✅ Verificar se usuário está logado antes de mostrar modal offline
        // Se não tiver token, não mostrar modal (auth.js vai redirecionar para login)
        const hasToken = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                        (localStorage.getItem('shapefit_auth_token') || null);
        
        // ✅ Verificar IMEDIATAMENTE se está offline (antes de qualquer requisição)
        if (!navigator.onLine) {
            // Só mostrar modal se tiver token (usuário está logado)
            if (hasToken) {
                showOfflineModal();
            }
            return;
        }
        
        // Se navigator.onLine diz que está online, verificar conexão real rapidamente
        try {
            const isOnline = await checkConnection();
            if (!isOnline) {
                // Só mostrar modal se tiver token (usuário está logado)
                if (hasToken) {
                    showOfflineModal();
                }
            }
        } catch (error) {
            // Se falhar a verificação, assumir offline
            // Só mostrar modal se tiver token (usuário está logado)
            if (hasToken) {
                showOfflineModal();
            }
        }
    }

    // Event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Botão de tentar novamente
    if (retryButton) {
        retryButton.addEventListener('click', retryConnection);
    }

    // ✅ Verificação IMEDIATA (antes de qualquer requisição)
    // Executar o mais cedo possível, antes mesmo do DOMContentLoaded
    (function() {
        // Verificar navigator.onLine imediatamente (síncrono)
        if (!navigator.onLine) {
            // Verificar se tem token antes de mostrar modal
            const hasToken = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                            (localStorage.getItem('shapefit_auth_token') || null);
            
            // Só mostrar modal se tiver token (usuário está logado)
            if (hasToken) {
                setTimeout(() => {
                    if (offlineModal) {
                        showOfflineModal();
                    }
                }, 0);
            }
        }
    })();
    
    // Verificação mais completa quando DOM estiver pronto
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

    // ✅ Listener global para recarregar dados quando internet volta
    window.addEventListener('pageReload', function(e) {
        if (e.detail && e.detail.reason === 'connection-restored') {
            // Disparar evento customizado para cada página recarregar seus dados
            // As páginas podem escutar este evento e recarregar seus dados
            window.dispatchEvent(new CustomEvent('reloadPageData', {
                detail: { reason: 'connection-restored' }
            }));
        }
    });

    // Expor função globalmente para debug (opcional)
    window.offlineModal = {
        show: showOfflineModal,
        hide: hideOfflineModal,
        check: checkConnection
    };
})();

