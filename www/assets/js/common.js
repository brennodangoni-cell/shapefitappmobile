// common.js - Funções comuns para todas as páginas HTML

// Inicialização comum
(function() {
    // API Base URL - SEMPRE usar appshapefit.com/api diretamente
    // Não usar proxy local, sempre chamar a API remota
    window.API_BASE_URL = 'https://appshapefit.com/api';
    
    // BASE_APP_URL - URL base do app (appshapefit.com)
    // IMPORTANTE: Em desenvolvimento local, usar localhost para redirecionamentos
    // Mas APIs sempre vão para appshapefit.com
    if (!window.BASE_APP_URL) {
        // Se estiver em localhost, usar localhost para redirecionamentos internos
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.BASE_APP_URL = window.location.origin;
        } else {
            window.BASE_APP_URL = 'https://appshapefit.com';
        }
    }
    
    // NÃO verificar autenticação automaticamente no SPA
    // O router vai gerenciar isso quando carregar cada página
    // Isso evita redirecionamentos antes do router inicializar
})();

// Função helper para fazer requisições autenticadas
async function apiRequest(url, options = {}) {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            clearAuthToken();
            // Se estiver em modo SPA, usar router
            if (window.SPARouter) {
                window.SPARouter.navigate('/fragments/auth_login.html');
            } else {
                // Fallback: usar fragmento mesmo sem router
                window.location.href = `${window.location.origin}/fragments/auth_login.html`;
            }
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Função helper para escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Função para obter data local no formato YYYY-MM-DD (não UTC)
function getLocalDateString(date = null) {
    const d = date ? new Date(date) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Função para adicionar/subtrair dias (local)
function addDaysLocal(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return getLocalDateString(d);
}

// Função helper para formatar data
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = getLocalDateString();
    const yesterdayStr = addDaysLocal(todayStr, -1);
    
    if (dateStr === todayStr) {
        return 'Hoje';
    } else if (dateStr === yesterdayStr) {
        return 'Ontem';
    } else {
        return date.toLocaleDateString('pt-BR');
    }
}

// Exportar funções globais
window.apiRequest = apiRequest;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.getLocalDateString = getLocalDateString;
window.addDaysLocal = addDaysLocal;

