
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
        // Reset flag para SPA (cada vez que navega para a página)
        window._dashboardLoaded = false;
        
        // Evitar execução duplicada dentro da mesma navegação
        if (window._dashboardLoading) return;
        window._dashboardLoading = true;

        function formatNumber(num) {
            if (!num) return '0';
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        
        async function loadDashboardData() {
            // Aguardar auth.js
            if (typeof requireAuth !== 'function' || typeof authenticatedFetch !== 'function') {
                setTimeout(loadDashboardData, 100);
                return;
            }
            
            try {
                const authenticated = await requireAuth();
                if (!authenticated) return;
                
                // Usar proxy local
                const response = await authenticatedFetch('/api/get_dashboard_goals_data.php');
                
                if (!response || !response.ok) return;
                
                const text = await response.text();
                if (!text || text.trim() === '') return;
                
                let result;
                try {
                    result = JSON.parse(text);
                } catch (parseError) {
                    console.error('[Dashboard] Erro ao parsear JSON:', parseError);
                    return;
                }
                
                if (!result.success) return;
                
                const data = result.data;
                const goals = data.goals;
                
                // Atualizar valores na página
                if (goals?.calories) {
                    const el = document.getElementById('calories-value');
                    if (el) el.textContent = formatNumber(goals.calories.goal || 0);
                }
                if (goals?.carbs) {
                    const consumed = document.getElementById('carbs-consumed');
                    const goal = document.getElementById('carbs-goal');
                    if (consumed) consumed.textContent = goals.carbs.consumed || 0;
                    if (goal) goal.textContent = goals.carbs.goal || 0;
                }
                if (goals?.protein) {
                    const consumed = document.getElementById('protein-consumed');
                    const goal = document.getElementById('protein-goal');
                    if (consumed) consumed.textContent = goals.protein.consumed || 0;
                    if (goal) goal.textContent = goals.protein.goal || 0;
                }
                if (goals?.fat) {
                    const consumed = document.getElementById('fat-consumed');
                    const goal = document.getElementById('fat-goal');
                    if (consumed) consumed.textContent = goals.fat.consumed || 0;
                    if (goal) goal.textContent = goals.fat.goal || 0;
                }
                if (goals?.water) {
                    const consumed = document.getElementById('water-consumed');
                    const goal = document.getElementById('water-goal');
                    if (consumed) consumed.textContent = goals.water.consumed || 0;
                    if (goal) goal.textContent = goals.water.goal || 0;
                }
                
                console.log('[Dashboard] Dados carregados!');
                window._dashboardLoaded = true;
                
            } catch (error) {
                console.error('[Dashboard] Erro:', error);
            } finally {
                window._dashboardLoading = false;
            }
        }
        
        // Executar imediatamente (SPA)
        loadDashboardData();
    
})();
