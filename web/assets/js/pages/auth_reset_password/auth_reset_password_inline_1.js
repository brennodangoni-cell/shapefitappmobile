
/**
 * Script Inline Protegido - auth_reset_password_inline_1
 */
(function() {
    'use strict';
    
    function initResetPassword() {
        const form = document.getElementById('resetForm');
        if (!form) return;
        
        // Obter token da URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) {
            const formError = document.getElementById('formError');
            formError.textContent = 'Token inválido ou expirado. Solicite um novo link de recuperação.';
            formError.style.display = 'block';
            form.style.display = 'none';
            return;
        }
        
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            const submitBtn = document.getElementById('submitBtn');
            const formError = document.getElementById('formError');
            const passwordError = document.getElementById('passwordError');
            const confirmPasswordError = document.getElementById('confirmPasswordError');
            
            // Limpar erros anteriores
            formError.style.display = 'none';
            passwordError.style.display = 'none';
            confirmPasswordError.style.display = 'none';
            
            // Validar
            let hasErrors = false;
            if (!password || password.length < 6) {
                passwordError.textContent = 'A senha deve ter no mínimo 6 caracteres.';
                passwordError.style.display = 'block';
                hasErrors = true;
            }
            if (password !== confirmPassword) {
                confirmPasswordError.textContent = 'As senhas não coincidem.';
                confirmPasswordError.style.display = 'block';
                hasErrors = true;
            }
            
            if (hasErrors) return;
            
            // Desabilitar botão
            submitBtn.disabled = true;
            submitBtn.textContent = 'Redefinindo...';
            
            try {
                const apiUrl = window.API_BASE_URL || 'https://appshapefit.com/api';
                const response = await fetch(`${apiUrl}/reset_password.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token, password })
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
                    formError.style.display = 'none';
                    // Mostrar sucesso
                    const successMsg = document.createElement('div');
                    successMsg.className = 'form-success';
                    successMsg.textContent = result.message || 'Senha redefinida com sucesso! Redirecionando...';
                    form.insertBefore(successMsg, form.firstChild);
                    
                    // Redirecionar para login após 2 segundos
                    setTimeout(() => {
                        if (window.SPARouter && typeof window.SPARouter.navigate === 'function') {
                            window.SPARouter.navigate('/fragments/auth_login.html', true);
                        } else {
                            window.location.href = '/auth/login.html';
                        }
                    }, 2000);
                } else {
                    formError.textContent = result.message || 'Erro ao redefinir senha. Token pode estar expirado.';
                    formError.style.display = 'block';
                }
            } catch (error) {
                console.error('Erro ao redefinir senha:', error);
                formError.textContent = 'Erro ao conectar com o servidor. Tente novamente.';
                formError.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Redefinir Senha';
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initResetPassword);
    } else {
        initResetPassword();
    }
})();

