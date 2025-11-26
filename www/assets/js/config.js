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
        let url = input;

        // Se a URL já é completa (https://), usar diretamente
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            // ✅ Log removido para performance
            try {
                return await originalFetch(url, init);
            } catch (error) {
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
                console.log(`🔀 [API] Remoto: ${url}`);
            }
        }

        try {
            return await originalFetch(url, init);
        } catch (error) {
            console.error(`❌ [Fetch] Erro: ${url}`, error);
            throw error;
        }
    };
})();