
/**
 * Script Inline Protegido - auth_forgot_password_inline_1
 */
(function() {
    'use strict';
    
    function initForgotPassword() {
        const form = document.getElementById('forgotForm');
        if (!form) return;
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const submitBtn = document.getElementById('submitBtn');
            const formError = document.getElementById('formError');
            const formSuccess = document.getElementById('formSuccess');
            const emailError = document.getElementById('emailError');
            
            // Limpar erros anteriores
            formError.style.display = 'none';
            formSuccess.style.display = 'none';
            emailError.style.display = 'none';
            
            // Validar email
            if (!email || !email.includes('@')) {
                emailError.textContent = 'Por favor, insira um email válido.';
                emailError.style.display = 'block';
                return;
            }
            
            // Desabilitar botão
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
            
            try {
                const apiUrl = window.API_BASE_URL || 'https://appshapefit.com/api';
                const response = await fetch(`${apiUrl}/forgot_password.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erro HTTP:', response.status, errorText);
                    throw new Error('Erro ao conectar com o servidor');
                }
                
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Resposta inválida do servidor');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    formSuccess.textContent = result.message || 'Email enviado com sucesso! Verifique sua caixa de entrada.';
                    formSuccess.style.display = 'block';
                    form.reset();
                } else {
                    formError.textContent = result.message || 'Erro ao enviar email. Verifique se o email está correto.';
                    formError.style.display = 'block';
                }
            } catch (error) {
                console.error('Erro ao solicitar recuperação:', error);
                formError.textContent = 'Erro ao conectar com o servidor. Tente novamente.';
                formError.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Link';
            }
        });
        
        // ✅ Interceptar link "Fazer login" para transição suave
        const backToLoginLink = document.querySelector('a[href*="auth_login"]');
        if (backToLoginLink) {
            backToLoginLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Usar router SPA se disponível
                if (window.SPARouter && window.SPARouter.navigate) {
                    window.SPARouter.navigate('/fragments/auth_login.html', false);
                } else {
                    window.location.href = '/auth/login.html';
                }
            });
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initForgotPassword);
    } else {
        initForgotPassword();
    }
})();

