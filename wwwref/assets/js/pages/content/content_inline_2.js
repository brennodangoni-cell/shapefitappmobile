
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // Verificar autenticação
        if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
            if (window.SPARouter) {
                window.SPARouter.navigate('/auth/login');
            } else {
                window.location.href = './auth/login.html';
            }
            return;
        }
        
        const contentContainer = document.getElementById('content-container');
        
        // Ícones e labels por tipo
        const contentIcons = {
            'chef': 'fas fa-utensils',
            'supplements': 'fas fa-pills',
            'videos': 'fas fa-play',
            'articles': 'fas fa-file-alt',
            'pdf': 'fas fa-file-pdf'
        };
        
        const contentLabels = {
            'chef': 'Receitas',
            'supplements': 'Suplementos',
            'videos': 'Vídeos',
            'articles': 'Artigos',
            'pdf': 'PDFs'
        };
        
        // Carregar conteúdos
        async function loadContents() {
            try {
                const response = await authenticatedFetch(`/api/get_content_data.php`);
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error('Erro HTTP:', response.status, text.substring(0, 500));
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                
                // Verificar se a resposta é JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Resposta não é JSON:', text.substring(0, 500));
                    throw new Error('Resposta do servidor não é JSON');
                }
                
                const result = await response.json();
                
                if (!result.success) {
                    if (result.message && result.message.includes('Onboarding')) {
                        if (window.SPARouter) {
                            window.SPARouter.navigate('/onboarding');
                        } else {
                            window.location.href = './onboarding/onboarding.php';
                        }
                        return;
                    }
                    throw new Error(result.message || 'Erro ao carregar conteúdos');
                }
                
                renderContents(result.data.contents);
                
            } catch (error) {
                console.error('Erro ao carregar conteúdos:', error);
                // Se o erro for de parsing JSON, tentar ler como texto
                if (error.message && error.message.includes('JSON')) {
                    try {
                        const response = await authenticatedFetch(`/api/get_content_data.php`);
                        const text = await response.text();
                        console.error('Resposta do servidor (texto):', text.substring(0, 1000));
                    } catch (e) {
                        console.error('Erro ao ler resposta:', e);
                    }
                }
                renderEmptyState();
            }
        }
        
        function renderContents(contents) {
            if (!contents || contents.length === 0) {
                renderEmptyState();
                return;
            }
            
            const grid = document.createElement('div');
            grid.className = 'content-grid';
            
            contents.forEach(content => {
                const card = createContentCard(content);
                grid.appendChild(card);
            });
            
            contentContainer.innerHTML = '';
            contentContainer.appendChild(grid);
        }
        
        // Helper para construir URL completa
        function buildFullUrl(path) {
            if (!path) return '';
            // Se já é URL completa, retornar
            if (path.match(/^https?:\/\//)) return path;
            // Construir URL completa com o domínio da API
            const baseUrl = 'https://appshapefit.com';
            if (path.startsWith('/')) {
                return baseUrl + path;
            }
            return baseUrl + '/' + path;
        }
        
        function createContentCard(content) {
            const card = document.createElement('a');
            card.href = `./view_content.html?id=${content.id}`;
            card.className = 'content-card';
            
            let thumbnailHTML = '';
            
            // Thumbnail para vídeos
            if (content.thumbnail_url && content.content_type === 'videos') {
                const thumbnailUrl = buildFullUrl(content.thumbnail_url);
                
                thumbnailHTML = `
                    <div class="content-thumbnail" style="width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background: rgba(0, 0, 0, 0.2); position: relative; pointer-events: none;">
                        <img src="${escapeHtml(thumbnailUrl)}" 
                             alt="${escapeHtml(content.title)}" 
                             style="width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;\\' ><i class=\\'fas fa-video\\' style=\\'font-size:3rem;color:var(--accent-orange);opacity:0.5;\\'></i></div>';">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.6); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; pointer-events: none;">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                `;
            } else if (content.content_type === 'pdf') {
                // Preview de PDF - verificar se tem thumbnail personalizada
                if (content.thumbnail_url) {
                    const thumbnailUrl = buildFullUrl(content.thumbnail_url);
                    thumbnailHTML = `
                        <div class="content-thumbnail" style="width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background: rgba(255, 107, 0, 0.1); position: relative;">
                            <img src="${escapeHtml(thumbnailUrl)}" 
                                 alt="${escapeHtml(content.title)}" 
                                 style="width: 100%; height: 100%; object-fit: cover; display: block;"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; align-items: center; justify-content: center;">
                                <i class="fas fa-file-pdf" style="font-size: 4rem; color: var(--accent-orange);"></i>
                            </div>
                        </div>
                    `;
                } else {
                    thumbnailHTML = `
                        <div class="content-thumbnail" style="width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background: rgba(255, 107, 0, 0.1); display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-file-pdf" style="font-size: 4rem; color: var(--accent-orange);"></i>
                        </div>
                    `;
                }
            }
            
            // Autor
            let authorHTML = '';
            if (content.author_name) {
                let authorPhotoHTML = '';
                if (content.author_image_url) {
                    const authorImageUrl = buildFullUrl(content.author_image_url);
                    authorPhotoHTML = `<img src="${escapeHtml(authorImageUrl)}" alt="${escapeHtml(content.author_name)}" class="author-avatar" onerror="this.parentElement.innerHTML='<div class=\\'author-avatar-placeholder\\'>${getInitials(content.author_name)}</div>';">`;
                } else {
                    authorPhotoHTML = `<div class="author-avatar-placeholder">${getInitials(content.author_name)}</div>`;
                }
                
                authorHTML = `
                    <div class="content-author">
                        ${authorPhotoHTML}
                        <span class="author-name">${escapeHtml(content.author_name)}</span>
                    </div>
                `;
            }
            
            // Data
            const date = content.created_at ? new Date(content.created_at) : null;
            const dateStr = date ? date.toLocaleDateString('pt-BR') : '';
            
            card.innerHTML = `
                ${thumbnailHTML}
                <div class="content-card-header">
                    <div class="content-info">
                        <h3>${escapeHtml(content.title)}</h3>
                        ${content.description ? `<p class="content-description">${escapeHtml(content.description)}</p>` : ''}
                    </div>
                </div>
                <div class="content-meta">
                    ${authorHTML}
                    ${dateStr ? `
                        <div class="content-date">
                            <i class="fas fa-calendar"></i>
                            <span>${dateStr}</span>
                        </div>
                    ` : ''}
                </div>
            `;
            
            return card;
        }
        
        function getInitials(name) {
            if (!name) return '??';
            const parts = name.trim().split(' ');
            if (parts.length > 1) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return parts[0].substring(0, 2).toUpperCase();
        }
        
        function renderEmptyState() {
            contentContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <h3>Nenhum conteúdo disponível</h3>
                    <p>Nenhum conteúdo disponível no momento. Volte mais tarde!</p>
                </div>
            `;
        }
        
        // Carregar dados ao iniciar
        function init() {
            loadContents();
        }
        
        // SPA: usar eventos do router
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(init, 0);
        } else {
            document.addEventListener('DOMContentLoaded', init);
        }
        
        // Também ouvir eventos do SPA
        window.addEventListener('fragmentReady', init);
        window.addEventListener('pageLoaded', init);
    
})();
