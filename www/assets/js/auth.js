// auth.js - Sistema de autenticação SPA

// Evitar redeclaração se o script já foi carregado
if (typeof window.AUTH_TOKEN_KEY === 'undefined') {
    window.AUTH_TOKEN_KEY = 'shapefit_auth_token';
}

// Função helper para obter a chave do token
function getAuthTokenKey() {
    return window.AUTH_TOKEN_KEY || 'shapefit_auth_token';
}

function getAuthToken() {
    return localStorage.getItem(getAuthTokenKey());
}

function setAuthToken(token) {
    localStorage.setItem(getAuthTokenKey(), token);
}

function clearAuthToken() {
    localStorage.removeItem(getAuthTokenKey());
}

async function isAuthenticated() {
    const token = getAuthToken();
    if (!token) {
        return false;
    }
    
    try {
        // Usar window.API_BASE_URL - sempre aponta para appshapefit.com/api
        const apiBase = window.API_BASE_URL || 'https://appshapefit.com/api';
        const verifyUrl = `${apiBase}/verify_token.php`;
        // ✅ Log removido para performance (verificação de token é normal)
        
        // Criar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            // Se for 401, realmente não está autenticado
            if (response.status === 401) {
                return false;
            }
            // Para outros erros, assumir que ainda está autenticado (pode ser erro temporário)
            return true;
        }
        
        // Verificar Content-Type antes de fazer parse
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[Auth] Resposta não é JSON:', contentType, text.substring(0, 200));
            // Se não for JSON mas tiver token, assumir que ainda está autenticado
            return true;
        }
        
        const result = await response.json();
        const isAuth = result.success === true;
        return isAuth;
    } catch (error) {
        console.error('[Auth] Erro verificação:', error);
        
        // ✅ NÃO DESLOGAR EM CASO DE ERRO DE REDE/CONEXÃO
        // Se for erro de rede (abort, timeout, network error), manter autenticação
        if (error.name === 'AbortError' || 
            error.name === 'TimeoutError' || 
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('network')) {
            return true; // Manter autenticado se for erro de rede
        }
        
        // Se for erro de JSON parsing, logar mais detalhes
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            console.error('[Auth] Erro de parsing JSON - possível resposta HTML ou texto');
            // Manter autenticado se tiver token (pode ser problema temporário do servidor)
            return true;
        }
        
        // Para outros erros desconhecidos, também manter autenticado (melhor que deslogar)
        return true;
    }
}

async function requireAuth() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('auth_login') || currentPath.includes('auth_register')) return false;
    
    // ✅ Verificar se está offline ANTES de verificar token
    // Se estiver offline e não tiver token, redirecionar para login IMEDIATAMENTE
    const token = getAuthToken();
    if (!token) {
        // Sem token, verificar se está offline
        if (!navigator.onLine) {
            // Se estiver offline e sem token, mostrar login (usuário não está logado)
            // ✅ Redirecionar IMEDIATAMENTE sem tentar fazer requisições
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return false;
        }
        // Se estiver online e sem token, redirecionar para login
        if (window.SPARouter && window.SPARouter.navigate) {
            window.SPARouter.navigate('/fragments/auth_login.html', true);
        } else {
            window.location.href = '/auth/login.html';
        }
        return false;
    }
    
    // ✅ Se tem token mas está offline, assumir autenticado (usuário já estava logado)
    // O modal offline será mostrado pelo offline-modal.js
    if (!navigator.onLine) {
        return true; // Retornar true para não redirecionar, modal offline cuida do resto
    }
    
    // Limpar cache de autenticação após 5 segundos (evitar cache permanente)
    if (window._authLastCheck && Date.now() - window._authLastCheck > 5000) {
        window._authResult = undefined;
        window._authChecking = false;
    }
    
    if (window._authChecking) {
        // Aguardar verificação em andamento
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!window._authChecking) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
        // Se ainda está verificando e tem token, assumir autenticado
        return window._authResult !== undefined ? window._authResult : true;
    }
    
    window._authChecking = true;
    window._authLastCheck = Date.now();
    
    try {
        const authenticated = await isAuthenticated();
        window._authResult = authenticated;
        
        // ✅ Só redirecionar se realmente não estiver autenticado E não tiver token
        // Se tiver token mas a verificação falhou por erro de rede, manter autenticado
        if (!authenticated && !token) {
            if (window.SPARouter) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return false;
        }
        
        // Se tem token, mesmo que verificação falhe, manter autenticado (pode ser erro temporário)
        return authenticated || !!token;
    } finally {
        window._authChecking = false;
    }
}

async function authenticatedFetch(url, options = {}) {
    // Se a URL já é completa (https://), usar diretamente
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // URL já está completa, usar como está
    } else if (url.startsWith('/api')) {
        // URLs que começam com /api serão interceptadas pelo config.js
        // Não fazer nada aqui
    } else {
        // Se for relativa, adicionar API_BASE_URL
        const apiBase = window.API_BASE_URL || 'https://appshapefit.com/api';
        url = apiBase + (url.startsWith('/') ? url : '/' + url);
    }

    const token = getAuthToken();
    const isFormData = options.body instanceof FormData;
    const method = options.method || 'GET';
    const headers = options.headers || {};
    
    // ✅ Para requisições GET simples, não adicionar Content-Type para evitar preflight
    // Apenas adicionar Content-Type se for POST/PUT/PATCH e não for FormData
    if (method !== 'GET' && !isFormData) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const fetchOptions = {
        method: method,
        headers: headers,
        body: options.body
    };
    
    // ✅ No Capacitor, usar mode 'no-cors' pode ajudar, mas não permite ler resposta
    // Em vez disso, vamos garantir que a requisição seja feita corretamente
    // Se estiver no Capacitor e for GET, tentar sem headers customizados primeiro
    if (typeof window.Capacitor !== 'undefined' && method === 'GET' && Object.keys(headers).length === 0) {
        // GET simples sem headers - não deve fazer preflight
        try {
            const response = await fetch(url, { method: 'GET' });
            if (response.status === 401) {
                clearAuthToken();
                if (window.SPARouter) window.SPARouter.navigate('/fragments/auth_login.html');
                else window.location.href = '/auth/login.html';
                return null;
            }
            return response;
        } catch (error) {
            console.error('[Auth] Erro requisição (fallback):', error);
            // Continuar com a requisição normal
        }
    }
    
    try {
        const response = await fetch(url, fetchOptions);
        
        if (response.status === 401) {
            clearAuthToken();
            if (window.SPARouter) window.SPARouter.navigate('/fragments/auth_login.html');
            else window.location.href = '/auth/login.html';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('[Auth] Erro requisição:', error);
        throw error;
    }
}

window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuthToken = clearAuthToken;
window.isAuthenticated = isAuthenticated;
window.requireAuth = requireAuth;
window.authenticatedFetch = authenticatedFetch;