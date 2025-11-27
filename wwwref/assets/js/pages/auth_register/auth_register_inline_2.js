
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
                const response = await fetch(`${window.BASE_APP_URL}/api/register.php`, {
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
                    
                    // Redirect to onboarding
                    window.location.href = `${window.BASE_APP_URL}/onboarding/onboarding.html`;
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
    
})();
