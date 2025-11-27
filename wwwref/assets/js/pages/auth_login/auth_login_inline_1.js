
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
                console.log('[Login] Fazendo requisição para:', loginUrl);
                console.log('[Login] API_BASE_URL:', window.API_BASE_URL);
                console.log('[Login] Hostname:', window.location.hostname);
                
                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                // Verificar se a resposta é OK
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erro HTTP:', response.status, errorText);
                    formError.textContent = 'Erro ao conectar com o servidor. Tente novamente.';
                    formError.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                    return;
                }
                
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
                
                if (result.success && result.token) {
                    // Save token
                    console.log('Token recebido, salvando no localStorage...');
                    setAuthToken(result.token);
                    console.log('Token salvo:', getAuthToken() ? 'SIM' : 'NÃO');
                    
                    // Limpar cache de autenticação para forçar nova verificação
                    window._authResult = undefined;
                    window._authLastCheck = undefined;
                    
                    // Redirect usando SPA router se disponível
                    if (window.SPARouter) {
                        if (result.user && result.user.onboarding_complete) {
                            console.log('Redirecionando para main_app via SPA');
                            window.SPARouter.navigate('/fragments/main_app.html', true);
                        } else {
                            console.log('Redirecionando para onboarding via SPA');
                            window.SPARouter.navigate('/fragments/onboarding_onboarding.html', true);
                        }
                    } else {
                        // Fallback para navegação tradicional
                        if (result.user && result.user.onboarding_complete) {
                            console.log('Redirecionando para main_app.html');
                            window.location.href = `${window.BASE_APP_URL || window.location.origin}/main_app.html`;
                        } else {
                            console.log('Redirecionando para onboarding');
                            window.location.href = `${window.BASE_APP_URL || window.location.origin}/onboarding/onboarding.html`;
                        }
                    }
                } else {
                    // Show error
                    formError.textContent = result.message || 'Email ou senha incorretos.';
                    formError.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
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
    
})();
