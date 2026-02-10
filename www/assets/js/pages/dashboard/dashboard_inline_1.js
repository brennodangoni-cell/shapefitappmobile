
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

        function formatNumberPt(num, decimals = 0) {
            const n = Number(num) || 0;
            return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
        }

        function formatGrams(num) {
            const n = Number(num) || 0;
            const rounded = Math.round(n * 10) / 10;
            const decimals = Math.abs(rounded % 1) < 1e-9 ? 0 : 1;
            return formatNumberPt(rounded, decimals);
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
                const response = await authenticatedFetch(`${window.API_BASE_URL}/get_dashboard_goals_data.php`);
                
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
                    if (consumed) consumed.textContent = formatGrams(goals.carbs.consumed);
                    if (goal) goal.textContent = formatGrams(goals.carbs.goal);
                }
                if (goals?.protein) {
                    const consumed = document.getElementById('protein-consumed');
                    const goal = document.getElementById('protein-goal');
                    if (consumed) consumed.textContent = formatGrams(goals.protein.consumed);
                    if (goal) goal.textContent = formatGrams(goals.protein.goal);
                }
                if (goals?.fat) {
                    const consumed = document.getElementById('fat-consumed');
                    const goal = document.getElementById('fat-goal');
                    if (consumed) consumed.textContent = formatGrams(goals.fat.consumed);
                    if (goal) goal.textContent = formatGrams(goals.fat.goal);
                }
                if (goals?.water) {
                    const consumed = document.getElementById('water-consumed');
                    const goal = document.getElementById('water-goal');
                    if (consumed) consumed.textContent = formatNumberPt(goals.water.consumed, 0);
                    if (goal) goal.textContent = formatNumberPt(goals.water.goal, 0);
                }
                window._dashboardLoaded = true;
                
            } catch (error) {
                console.error('[Dashboard] Erro:', error);
            } finally {
                window._dashboardLoading = false;
            }
        }
        
        // Executar imediatamente (SPA)
        loadDashboardData();
        
        // ✅ ANIMAÇÃO PARA REFAZER QUESTIONÁRIO (similar ao register -> onboarding)
        (function setupRefazerAnimation() {
            const refazerLink = document.querySelector('a[href*="onboarding_onboarding.html?refazer=true"]');
            if (!refazerLink) return;
            
            refazerLink.addEventListener('click', function(e) {
                e.preventDefault();
                
                const container = document.getElementById('app-container') || document.querySelector('.page-root')?.parentElement;
                if (!container) {
                    // Fallback: usar router normal
                    if (window.SPARouter && window.SPARouter.navigate) {
                        window.SPARouter.navigate('/fragments/onboarding_onboarding.html?refazer=true', true);
                    } else {
                        window.location.href = refazerLink.href;
                    }
                    return;
                }
                
                const onboardingPath = '/fragments/onboarding_onboarding.html?refazer=true';
                const currentPageRoot = document.querySelector('.page-root');
                
                // 1. ANIMAR PÁGINA ATUAL SAINDO (para cima)
                if (currentPageRoot) {
                    currentPageRoot.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
                    currentPageRoot.style.transform = 'translateY(-100%)';
                    currentPageRoot.style.opacity = '0';
                }
                
                // 2. CARREGAR ONBOARDING
                fetch(onboardingPath)
                    .then(response => response.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const onboardingPageRoot = doc.querySelector('.page-root');
                        
                        if (!onboardingPageRoot) {
                            // Fallback: usar router
                            if (window.SPARouter && window.SPARouter.navigate) {
                                window.SPARouter.navigate(onboardingPath, true);
                            } else {
                                window.location.href = onboardingPath;
                            }
                            return;
                        }
                        
                        // Remover scripts do HTML (vão ser executados depois)
                        const scripts = onboardingPageRoot.querySelectorAll('script');
                        scripts.forEach(script => script.remove());
                        
                        // 3. AGUARDAR ANIMAÇÃO E INSERIR ONBOARDING
                        setTimeout(() => {
                            // Remover página atual
                            if (currentPageRoot) currentPageRoot.remove();
                            
                            // Inserir onboarding com animação de baixo para cima
                            onboardingPageRoot.style.cssText = `
                                transform: translateY(100%);
                                opacity: 0;
                                transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
                            `;
                            container.appendChild(onboardingPageRoot);
                            
                            // Forçar reflow e animar
                            requestAnimationFrame(() => {
                                onboardingPageRoot.style.transform = 'translateY(0)';
                                onboardingPageRoot.style.opacity = '1';
                            });
                            
                            // Executar scripts do onboarding
                            const allScripts = doc.querySelectorAll('script');
                            allScripts.forEach(script => {
                                const newScript = document.createElement('script');
                                if (script.src) {
                                    newScript.src = script.src;
                                } else {
                                    newScript.textContent = script.textContent;
                                }
                                document.head.appendChild(newScript);
                            });
                            
                            // Atualizar URL sem recarregar
                            if (window.history && window.history.pushState) {
                                window.history.pushState({}, '', '/bem-vindo?refazer=true');
                            }
                        }, 400);
                    })
                    .catch(error => {
                        console.error('[Dashboard] Erro ao carregar onboarding:', error);
                        // Fallback: usar router
                        if (window.SPARouter && window.SPARouter.navigate) {
                            window.SPARouter.navigate(onboardingPath, true);
                        } else {
                            window.location.href = onboardingPath;
                        }
                    });
            });
        })();
    
})();
