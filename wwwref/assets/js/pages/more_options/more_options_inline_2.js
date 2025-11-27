
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
        // Evitar execução duplicada na mesma navegação
        if (window._moreOptionsLoaded) {
            console.log('more_options: já carregado');
            return;
        }
        window._moreOptionsLoaded = true;
        
        // Resetar flag quando sair da página
        window.addEventListener('beforeunload', () => {
            window._moreOptionsLoaded = false;
        });

        async function loadMoreOptionsData() {
            try {
                // Usar URL relativa para passar pelo proxy
                const response = await authenticatedFetch('/api/get_more_options_data.php');
                
                if (!response) return; // Token inválido, já redirecionou
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error('Erro HTTP:', response.status, text);
                    throw new Error(`Erro ao carregar dados: ${response.status}`);
                }
                
                const text = await response.text();
                if (!text || text.trim() === '') {
                    throw new Error('Resposta vazia do servidor');
                }
                
                let result;
                try {
                    result = JSON.parse(text);
                } catch (parseError) {
                    console.error('Erro ao parsear JSON:', parseError);
                    console.error('Texto recebido:', text);
                    throw new Error('Resposta inválida do servidor');
                }
                
                if (!result.success) {
                    throw new Error(result.message || 'Erro ao carregar dados');
                }
                
                const data = result.data;
                
                // Atualizar nome
                const profileName = document.getElementById('profile-name');
                if (profileName) {
                    profileName.textContent = data.first_name || 'Usuário';
                }
                
                // Atualizar foto de perfil
                const profileImageContainer = document.getElementById('profile-image-container');
                const profileCard = document.getElementById('profile-card');
                
                if (profileImageContainer) {
                    if (data.profile_image_url) {
                        // Criar imagem
                        const img = document.createElement('img');
                        img.src = data.profile_image_url;
                        img.alt = 'Foto de Perfil';
                        img.className = 'profile-picture';
                        img.onerror = function() {
                            // Se a imagem falhar, remover e mostrar placeholder
                            this.remove();
                            const placeholder = document.createElement('div');
                            placeholder.className = 'profile-icon-placeholder';
                            placeholder.innerHTML = '<i class="fas fa-user"></i>';
                            profileImageContainer.appendChild(placeholder);
                        };
                        
                        // Limpar container e adicionar imagem
                        profileImageContainer.innerHTML = '';
                        profileImageContainer.appendChild(img);
                    } else {
                        // Se não tem foto, garantir que o placeholder está visível
                        profileImageContainer.innerHTML = '<div class="profile-icon-placeholder"><i class="fas fa-user"></i></div>';
                    }
                }
                
                // Atualizar link do perfil para usar SPA
                if (profileCard) {
                    profileCard.href = './edit_profile.html';
                }
                
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
            }
        }
        
        async function handleLogout(e) {
            e.preventDefault();
            
            // Pegar token antes de limpar
            const token = localStorage.getItem('shapefitUserToken');
            
            // 1. Limpar localStorage LOCAL (importante: antes de redirecionar!)
            localStorage.removeItem('shapefit_auth_token');  // Chave correta do auth.js
            localStorage.removeItem('shapefitUserToken');     // Chave antiga (backup)
            localStorage.removeItem('shapefitUserData');
            
            // 2. Invalidar token no servidor (em background)
            if (token) {
                try {
                    await fetch('https://appshapefit.com/api/invalidate_token.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        }
                    });
                } catch (err) {
                    // Ignora erro - o importante é limpar local
                }
            }
            
            // 3. Redirecionar para login
            window.location.href = '/login';
        }
        
        async function initPage() {
            // Aguardar auth.js estar carregado
            if (typeof requireAuth !== 'function' || typeof authenticatedFetch !== 'function') {
                console.log('more_options: Aguardando auth.js...');
                setTimeout(initPage, 100);
                return;
            }
            
            const authenticated = await requireAuth();
            if (!authenticated) return;
            
            await loadMoreOptionsData();
            
            // Setup logout button
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }
        }
        
        // Executar imediatamente (script já está no final do DOM)
        initPage();
    
})();
