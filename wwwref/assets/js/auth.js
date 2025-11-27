// auth.js - Sistema de autenticação SPA

const AUTH_TOKEN_KEY = 'shapefit_auth_token';

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function isAuthenticated() {
    const token = getAuthToken();
    if (!token) {
        console.log('[Auth] Nenhum token encontrado');
        return false;
    }
    
    try {
        // Usar window.API_BASE_URL - sempre aponta para appshapefit.com/api
        const apiBase = window.API_BASE_URL || 'https://appshapefit.com/api';
        const verifyUrl = `${apiBase}/verify_token.php`;
        console.log('[Auth] Verificando token em:', verifyUrl);
        
        const response = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        if (!response.ok) {
            console.log('[Auth] Resposta não OK:', response.status);
            return false;
        }
        
        // Verificar Content-Type antes de fazer parse
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[Auth] Resposta não é JSON:', contentType, text.substring(0, 200));
            return false;
        }
        
        const result = await response.json();
        const isAuth = result.success === true;
        console.log('[Auth] Token válido:', isAuth);
        return isAuth;
    } catch (error) {
        console.error('[Auth] Erro verificação:', error);
        // Se for erro de JSON parsing, logar mais detalhes
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            console.error('[Auth] Erro de parsing JSON - possível resposta HTML ou texto');
        }
        return false;
    }
}

async function requireAuth() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('auth_login')) return false;
    
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
        return window._authResult || false;
    }
    
    window._authChecking = true;
    window._authLastCheck = Date.now();
    
    try {
        const authenticated = await isAuthenticated();
        window._authResult = authenticated;
        
        if (!authenticated) {
            if (window.SPARouter) {
                window.SPARouter.navigate('/fragments/auth_login.html', true);
            } else {
                window.location.href = '/auth/login.html';
            }
            return false;
        }
        return authenticated;
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
    const headers = options.headers || {};
    
    if (!isFormData) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const fetchOptions = {
        method: options.method || 'GET',
        headers: headers,
        body: options.body
    };
    
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