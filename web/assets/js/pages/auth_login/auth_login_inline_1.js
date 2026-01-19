
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        function setRealViewportHeight() { 
            const vh = window.innerHeight * 0.01; 
            document.documentElement.style.setProperty('--vh', `${vh}px`); 
        }
        window.addEventListener('resize', setRealViewportHeight);
        setRealViewportHeight();
        
        // Bloquear scroll apenas na página de login (não no body global!)
        const loginPage = document.querySelector('.login-page');
        if (loginPage) {
            loginPage.addEventListener('touchmove', function(event) { 
                event.preventDefault(); 
            }, { passive: false });
        }
        
        (function preventIOSScroll() {
            const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
            inputs.forEach(input => {
                input.addEventListener('focusin', () => { setTimeout(() => { window.scrollTo(0, 0); }, 0); });
                input.addEventListener('blur', () => { window.scrollTo(0, 0); });
            });
        })();
        
        // Handle login form
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const submitBtn = document.getElementById('submitBtn');
            const formError = document.getElementById('formError');
            const emailError = document.getElementById('emailError');
            const passwordError = document.getElementById('passwordError');
            
            // Clear previous errors
            formError.style.display = 'none';
            emailError.style.display = 'none';
            passwordError.style.display = 'none';
            
            // Validate
            let hasErrors = false;
            if (!email || !email.includes('@')) {
                emailError.textContent = 'Por favor, insira um email válido.';
                emailError.style.display = 'block';
                hasErrors = true;
            }
            if (!password) {
                passwordError.textContent = 'Por favor, insira sua senha.';
                passwordError.style.display = 'block';
                hasErrors = true;
            }
            
            if (hasErrors) return;
            
            // Disable button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Entrando...';
            
            try {
                // Usar API_BASE_URL - sempre aponta para appshapefit.com/api
                const apiUrl = window.API_BASE_URL || 'https://appshapefit.com/api';
                const loginUrl = `${apiUrl}/login.php`;
                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                // Verificar Content-Type antes de fazer parse
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Resposta não é JSON:', contentType, text.substring(0, 200));
                    formError.textContent = 'Erro: resposta inválida do servidor.';
                    formError.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                    return;
                }
                
                const result = await response.json();
                
                // Verificar se houve erro (mesmo com status 401, 403, etc)
                if (!response.ok || !result.success) {
                    // Mostrar mensagem específica que vem da API
                    const errorMessage = result.message || 'Erro ao conectar com o servidor. Tente novamente.';
                    console.error('Erro de login:', response.status, result);
                    formError.textContent = errorMessage;
                    formError.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                    return;
                }
                
                // Se chegou aqui, login foi bem-sucedido
                // Save token
                setAuthToken(result.token);
                console.log('Token salvo:', getAuthToken() ? 'SIM' : 'NÃO');
                
                // Limpar cache de autenticação para forçar nova verificação
                window._authResult = undefined;
                window._authLastCheck = undefined;
                
                // Redirect usando SPA router se disponível
                if (window.SPARouter) {
                    if (result.user && result.user.onboarding_complete) {
                        window.SPARouter.navigate('/fragments/main_app.html', true);
                    } else {
                        window.SPARouter.navigate('/fragments/onboarding_onboarding.html', true);
                    }
                } else {
                    // Fallback para navegação tradicional
                    if (result.user && result.user.onboarding_complete) {
                        window.location.href = `${window.BASE_APP_URL || window.location.origin}/main_app.html`;
                    } else {
                        window.location.href = `${window.BASE_APP_URL || window.location.origin}/bem-vindo`;
                    }
                }
            } catch (error) {
                console.error('Erro ao fazer login:', error);
                // Se for erro de JSON parsing, mostrar mensagem mais específica
                if (error instanceof SyntaxError && error.message.includes('JSON')) {
                    formError.textContent = 'Erro: resposta inválida do servidor. Verifique o console para mais detalhes.';
                } else {
                    formError.textContent = 'Erro ao conectar com o servidor. Tente novamente.';
                }
                formError.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';
            }
        });
        
        // ✅ Interceptar link de cadastro para usar router SPA
        const registerLink = document.getElementById('register-link');
        if (registerLink) {
            registerLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Usar router SPA se disponível
                if (window.SPARouter && window.SPARouter.navigate) {
                    window.SPARouter.navigate('/cadastro', true);
                } else {
                    // Fallback para web
                    window.location.href = '/cadastro';
                }
            });
        }
        
        // ✅ Interceptar link "Esqueci minha senha" para usar router SPA com transição suave
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Usar router SPA se disponível (View Transition cuida da transição)
                if (window.SPARouter && window.SPARouter.navigate) {
                    // Não passar forceReload para manter transição suave
                    window.SPARouter.navigate('/fragments/auth_forgot_password.html', false);
                } else {
                    // Fallback para web
                    window.location.href = '/fragments/auth_forgot_password.html';
                }
            });
        }
        
        // ✅ FINALIZAR LOADING - Mostrar conteúdo após inicialização
        if (window.PageLoader) {
            window.PageLoader.ready();
        }
    
})();
