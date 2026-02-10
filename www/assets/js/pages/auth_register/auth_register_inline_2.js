
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        function setRealViewportHeight() { 
            const vh = window.innerHeight * 0.01; 
            document.documentElement.style.setProperty('--vh', `${vh}px`); 
        }
        window.addEventListener('resize', setRealViewportHeight);
        setRealViewportHeight();
        
        // NÃO bloquear touchmove no body - isso buga o scroll das outras páginas!
        // O register pode ter scroll, então não bloqueamos
        
        (function preventIOSScroll() {
            const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
            inputs.forEach(input => {
                input.addEventListener('focusin', () => { setTimeout(() => { window.scrollTo(0, 0); }, 0); });
                input.addEventListener('blur', () => { window.scrollTo(0, 0); });
            });
        })();
        
        // Toggle de visibilidade de senha
        document.querySelectorAll('.toggle-visibility').forEach(function(button) {
            button.addEventListener('click', function() {
                var inputId = button.getAttribute('data-target');
                var input = document.getElementById(inputId);
                if (!input) return;
                var isPassword = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPassword ? 'text' : 'password');
                var icon = button.querySelector('i');
                if (icon) {
                    if (isPassword) {
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                        button.setAttribute('aria-label', 'Esconder senha');
                    } else {
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                        button.setAttribute('aria-label', 'Mostrar senha');
                    }
                }
            });
        });
        
        // Handle register form
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            const submitBtn = document.getElementById('submitBtn');
            const formError = document.getElementById('formError');
            const nameError = document.getElementById('nameError');
            const emailError = document.getElementById('emailError');
            const passwordError = document.getElementById('passwordError');
            const confirmPasswordError = document.getElementById('confirmPasswordError');
            
            // Clear previous errors
            formError.style.display = 'none';
            nameError.style.display = 'none';
            emailError.style.display = 'none';
            passwordError.style.display = 'none';
            confirmPasswordError.style.display = 'none';
            
            // Disable button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Cadastrando...';
            
            try {
                const response = await fetch(`${window.API_BASE_URL}/register.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email, password, confirm_password: confirmPassword })
                });
                
                const result = await response.json();
                
                if (result.success && result.token) {
                    // Save token
                    setAuthToken(result.token);
                    
                    // Limpar cache de autenticação
                    window._authResult = undefined;
                    window._authLastCheck = undefined;
                    
                    // 1. MOSTRAR LOADING NO REGISTER
                    const loadingOverlay = document.getElementById('registerLoadingOverlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.add('active');
                    }
                    
                    // 2. APLICAR BACKGROUND DO ONBOARDING IMEDIATAMENTE
                    const container = document.getElementById('app-container');
                    const onboardingBg = 'radial-gradient(circle at top, #1b1b1b 0, #050505 55%)';
                    
                    if (container) {
                        container.style.background = onboardingBg;
                        container.style.backgroundColor = '#050505';
                        container.style.display = 'flex';
                        container.style.justifyContent = 'center';
                        container.style.alignItems = 'center';
                    }
                    document.body.style.background = onboardingBg;
                    document.body.style.backgroundColor = '#050505';
                    document.body.style.display = 'flex';
                    document.body.style.justifyContent = 'center';
                    document.body.style.alignItems = 'center';
                    
                    // 3. CARREGAR ONBOARDING MANUALMENTE E AGUARDAR 100% PRONTO
                    const onboardingPath = '/fragments/onboarding_onboarding.html';
                    
                    fetch(onboardingPath)
                        .then(response => response.text())
                        .then(html => {
                            // Parse do HTML
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            const onboardingPageRoot = doc.querySelector('.page-root');
                            
                            if (!onboardingPageRoot || !container) {
                                // Fallback: usar router
                                if (loadingOverlay) loadingOverlay.remove();
                                if (window.SPARouter && window.SPARouter.navigate) {
                                    window.SPARouter.navigate(onboardingPath, true);
                                }
                                return;
                            }
                            
                            // Remover scripts do HTML (vão ser executados depois)
                            const scripts = onboardingPageRoot.querySelectorAll('script');
                            scripts.forEach(script => script.remove());
                            
                            // 4. REMOVER REGISTER COM ANIMAÇÃO
                            const registerPage = document.querySelector('.register-page');
                            const registerContainer = document.querySelector('.register-container');
                            const registerForm = document.getElementById('registerForm');
                            const currentPageRoot = document.querySelector('.page-root');
                            
                            if (registerContainer) {
                                registerContainer.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
                                registerContainer.style.transform = 'translateY(-100%)';
                                registerContainer.style.opacity = '0';
                            }
                            
                            // 5. AGUARDAR ANIMAÇÃO E INSERIR ONBOARDING
                            setTimeout(() => {
                                // Remover register
                                if (registerPage) registerPage.remove();
                                if (registerContainer) registerContainer.remove();
                                if (registerForm) registerForm.remove();
                                if (currentPageRoot) currentPageRoot.remove();
                                
                                // Remover loading overlay
                                if (loadingOverlay) {
                                    loadingOverlay.classList.remove('active');
                                    setTimeout(() => loadingOverlay.remove(), 300);
                                }
                                
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
                                    window.history.pushState({}, '', '/bem-vindo');
                                }
                            }, 400);
                        })
                        .catch(error => {
                            console.error('Erro ao carregar onboarding:', error);
                            // Fallback: usar router
                            if (loadingOverlay) loadingOverlay.remove();
                            const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
                            if (window.SPARouter && window.SPARouter.navigate) {
                                window.SPARouter.navigate(onboardingPath, true);
                            } else if (!isNative) {
                                window.location.href = onboardingPath;
                            } else {
                                window.location.reload();
                            }
                        });
                } else {
                    // Show errors
                    if (result.errors) {
                        if (result.errors.name) {
                            nameError.textContent = result.errors.name;
                            nameError.style.display = 'block';
                        }
                        if (result.errors.email) {
                            emailError.textContent = result.errors.email;
                            emailError.style.display = 'block';
                        }
                        if (result.errors.password) {
                            passwordError.textContent = result.errors.password;
                            passwordError.style.display = 'block';
                        }
                        if (result.errors.confirm_password) {
                            confirmPasswordError.textContent = result.errors.confirm_password;
                            confirmPasswordError.style.display = 'block';
                        }
                    } else {
                        formError.textContent = result.message || 'Erro ao cadastrar. Tente novamente.';
                        formError.style.display = 'block';
                    }
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Cadastrar';
                }
            } catch (error) {
                console.error('Erro ao cadastrar:', error);
                formError.textContent = 'Erro ao conectar com o servidor. Tente novamente.';
                formError.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Cadastrar';
            }
        });
        
        // ✅ Interceptar link de login para usar router SPA
        const loginLink = document.getElementById('login-link');
        if (loginLink) {
            loginLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Usar router SPA se disponível
                if (window.SPARouter && window.SPARouter.navigate) {
                    window.SPARouter.navigate('/login', true);
                } else {
                    // Fallback para web
                    window.location.href = '/login';
                }
            });
        }
        
        // ✅ FINALIZAR LOADING - Mostrar conteúdo após inicialização
        if (window.PageLoader) {
            window.PageLoader.ready();
        }
    
})();
