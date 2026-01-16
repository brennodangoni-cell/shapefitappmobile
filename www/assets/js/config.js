// www/assets/js/config.js

(function() {
    // Detectar se está rodando no Capacitor (iOS/Android nativo)
    const isCapacitor = window.Capacitor !== undefined;
    
    // Detectar se está em desenvolvimento REAL (localhost COM servidor Node rodando)
    // No Capacitor, mesmo que hostname seja localhost, NÃO é desenvolvimento
    const isRealDevelopment = !isCapacitor && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        window.location.port === '8100';
    
    // ✅ Logs removidos para performance
    
    // 1. Definição da URL Base (para redirecionamentos internos)
    // SEMPRE definir, não verificar se já existe (outros scripts podem ter definido errado)
    window.BASE_APP_URL = "https://appshapefit.com";
    
    // 2. API_BASE_URL - SEMPRE usar appshapefit.com/api
    window.API_BASE_URL = 'https://appshapefit.com/api';
    
    // Congelar as URLs para evitar que outros scripts sobrescrevam
    Object.defineProperty(window, 'BASE_APP_URL', {
        value: window.BASE_APP_URL,
        writable: false,
        configurable: false
    });
    Object.defineProperty(window, 'API_BASE_URL', {
        value: window.API_BASE_URL,
        writable: false,
        configurable: false
    });
    
    // ✅ Logs removidos para performance

    // 3. INTERCEPTADOR DE FETCH (A Mágica)
    const originalFetch = window.fetch;

    window.fetch = async function(input, init) {
        // ✅ VERIFICAR OFFLINE + SEM TOKEN ANTES DE QUALQUER FETCH
        // Se estiver offline e sem token, não fazer requisição e redirecionar
        const token = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                     (localStorage.getItem('shapefit_auth_token') || null);
        
        if (!navigator.onLine && !token) {
            // Redirecionar para login
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            // Retornar erro silencioso para não propagar
            const silentError = new Error('Network request failed');
            silentError.name = 'NetworkError';
            silentError.silent = true;
            return Promise.reject(silentError);
        }
        
        let url = input;

        // Se a URL já é completa (https://), usar diretamente
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            // ✅ Log removido para performance
            try {
                const response = await originalFetch(url, init);
                // Se conseguiu fazer a requisição (mesmo com erro HTTP), não é problema de rede
                return response;
            } catch (error) {
                // ✅ Verificar se está offline antes de logar erro
                // IMPORTANTE: Só considerar offline se realmente não conseguir fazer a requisição
                const isOfflineState = !navigator.onLine || 
                    (error.message && (
                        error.message.includes('Failed to fetch') ||
                        error.message.includes('NetworkError') ||
                        error.message.includes('network') ||
                        error.message.includes('ERR_INTERNET_DISCONNECTED') ||
                        error.message.includes('ERR_NETWORK_CHANGED')
                    )) ||
                    (error.name === 'TypeError' && error.message.includes('fetch'));
                
                // ✅ NÃO mostrar modal offline se navigator.onLine diz que está online
                // Pode ser CORS, API não existe, etc - não é problema de rede
                if (isOfflineState && !navigator.onLine) {
                    // ✅ Se estiver offline e sem token, redirecionar para login IMEDIATAMENTE
                    const hasToken = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                                    (localStorage.getItem('shapefit_auth_token') || null);
                    
                    if (!hasToken) {
                        if (window.SPARouter && window.SPARouter.navigate) {
                            window.SPARouter.navigate('/fragments/auth_login.html', true);
                        } else {
                            window.location.href = '/auth/login.html';
                        }
                        const silentError = new Error('Network request failed');
                        silentError.name = 'NetworkError';
                        silentError.silent = true;
                        return Promise.reject(silentError);
                    }
                    
                    // Se tem token, mostrar modal offline
                    const offlineModal = document.getElementById('offline-modal');
                    if (offlineModal && typeof window.offlineModal !== 'undefined') {
                        window.offlineModal.show();
                    }
                    
                    // ✅ Não propagar erro quando offline - erro silencioso
                    const silentError = new Error('Network request failed');
                    silentError.name = 'NetworkError';
                    silentError.silent = true;
                    return Promise.reject(silentError);
                }
                
            // ✅ Se for AbortError (timeout esperado), não logar como erro
            // Isso acontece em verificações de conexão que são canceladas intencionalmente
            if (error.name === 'AbortError' && error.message.includes('aborted')) {
                // Erro esperado de timeout/abort - não logar
                throw error;
            }
            
            // Se está online mas deu erro, pode ser problema da API, CORS, etc
            // NÃO mostrar modal offline
            console.error(`❌ [Fetch] Erro: ${url}`, error);
            throw error;
            }
        }

        // Se a URL for relativa ./api, corrigir para /api
        if (typeof url === 'string' && url.startsWith('./api')) {
            url = url.replace('./api', '/api');
        }

        // Se a URL começar com /api, redirecionar para API remota
        // EXCETO em desenvolvimento real (localhost:8100 com proxy Node)
        if (typeof url === 'string' && url.startsWith('/api')) {
            if (isRealDevelopment) {
                // Desenvolvimento local com proxy Node.js
                // ✅ Log removido para performance
            } else {
                // Produção ou Capacitor - usar API remota diretamente
                url = window.API_BASE_URL + url.replace('/api', '');
            }
        }

        try {
            const response = await originalFetch(url, init);
            
            // ✅ Se a resposta tem status HTTP (mesmo que seja erro 404, 500, etc), 
            // significa que há conexão - NÃO mostrar modal offline
            // Apenas mostrar modal se realmente não conseguir fazer a requisição (erro de rede)
            return response;
        } catch (error) {
            // ✅ Verificar se está offline antes de logar erro
            // IMPORTANTE: Só considerar offline se realmente não conseguir fazer a requisição
            // Erros HTTP (404, 500, etc) NÃO são erros de rede - há conexão, só que a API retornou erro
            const isOfflineState = !navigator.onLine || 
                (error.message && (
                    error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError') ||
                    error.message.includes('network') ||
                    error.message.includes('ERR_INTERNET_DISCONNECTED') ||
                    error.message.includes('ERR_NETWORK_CHANGED')
                )) ||
                (error.name === 'TypeError' && error.message.includes('fetch'));
            
            // ✅ NÃO mostrar modal offline se o erro não for claramente de rede
            // Se navigator.onLine diz que está online, mas deu erro, pode ser CORS, API não existe, etc
            // Nesses casos, NÃO mostrar modal offline
            if (isOfflineState && !navigator.onLine) {
                // ✅ Só mostrar modal se usuário estiver logado (tem token)
                const hasToken = typeof window.getAuthToken === 'function' ? window.getAuthToken() : 
                                (localStorage.getItem('shapefit_auth_token') || null);
                
                if (hasToken) {
                    // Se estiver offline, mostrar modal e NÃO propagar erro
                    const offlineModal = document.getElementById('offline-modal');
                    if (offlineModal && typeof window.offlineModal !== 'undefined') {
                        window.offlineModal.show();
                    }
                }
                
                // ✅ Não propagar erro quando offline - retornar erro silencioso
                const silentError = new Error('Network request failed');
                silentError.name = 'NetworkError';
                silentError.silent = true; // Flag para não mostrar na tela
                return Promise.reject(silentError);
            }
            
            // ✅ Se for AbortError (timeout esperado), não logar como erro
            // Isso acontece em verificações de conexão que são canceladas intencionalmente
            if (error.name === 'AbortError' && error.message.includes('aborted')) {
                // Erro esperado de timeout/abort - não logar
                throw error;
            }
            
            // Se está online mas deu erro, pode ser problema da API, CORS, etc
            // NÃO mostrar modal offline, apenas logar o erro
            console.error(`❌ [Fetch] Erro: ${url}`, error);
            throw error;
        }
    };
})();