
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(async function() {

        // Verificar autenticação usando requireAuth (assíncrono), como nas outras telas protegidas
        if (typeof requireAuth === 'function') {
            const authenticated = await requireAuth();
            if (!authenticated) {
                return; // requireAuth já redireciona se precisar
            }
        }
        
        const dietContainer = document.getElementById('diet-container');
        
        // Carregar dietas
        async function loadDiets() {
            try {
                // Usar API_BASE_URL para chamar a API remota
                const response = await authenticatedFetch(`${window.API_BASE_URL}/get_diet_data.php`);
                
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
                    throw new Error(result.message || 'Erro ao carregar dietas');
                }
                
                renderDiets(result.data.diets || []);
                
            } catch (error) {
                console.error('Erro ao carregar dietas:', error);
                renderEmptyState();
            }
        }
        
        function renderDiets(diets) {
            if (!diets || diets.length === 0) {
                renderEmptyState();
                return;
            }
            
            const grid = document.createElement('div');
            grid.className = 'diet-grid';
            
            diets.forEach(diet => {
                const card = createDietCard(diet);
                grid.appendChild(card);
            });
            
            dietContainer.innerHTML = '';
            dietContainer.appendChild(grid);
        }
        
        // Helper para construir URL completa
        function buildFullUrl(path) {
            if (!path) return '';
            // Se já é URL completa, retornar
            if (path.match(/^https?:\/\//)) return path;
            // Construir URL completa com o domínio da API
            const baseUrl = window.BASE_APP_URL || window.location.origin;
            if (path.startsWith('/')) {
                return baseUrl + path;
            }
            return baseUrl + '/' + path;
        }
        
        function createDietCard(diet) {
            const card = document.createElement('div');
            card.className = 'diet-card';
            card.style.cursor = 'pointer';
            
            // IMPORTANTE: Adicionar data-router-ignore para evitar que o SPA router intercepte
            card.setAttribute('data-router-ignore', 'true');
            
            // Construir URL do PDF
            let fileUrl = '';
            let fileId = null;
            let dietId = diet.id;
            
            // Priorizar ID do arquivo, senão usar path
            if (diet.file_path) {
                // Se tem file_path, usar serve_pdf.php com diet_id
                fileUrl = `${window.API_BASE_URL}/serve_pdf.php?diet_id=${dietId}`;
            } else {
                // Se não tem file_path, tentar usar ID do arquivo se existir
                fileUrl = `${window.API_BASE_URL}/serve_pdf.php?diet_id=${dietId}`;
            }
            
            const fileName = diet.title ? diet.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf' : 'dieta.pdf';
            
            // Adicionar data attributes para download
            card.setAttribute('data-file-url', fileUrl);
            card.setAttribute('data-file-name', fileName);
            card.setAttribute('data-diet-id', dietId);
            if (fileId) {
                card.setAttribute('data-file-id', fileId);
            }
            
            let thumbnailHTML = '';
            
            // Thumbnail para PDF de dieta
            if (diet.thumbnail_url) {
                const thumbnailUrl = buildFullUrl(diet.thumbnail_url);
                thumbnailHTML = `
                    <div class="diet-thumbnail" style="width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background: rgba(16, 185, 129, 0.1); position: relative;">
                        <img src="${escapeHtml(thumbnailUrl)}" 
                             alt="${escapeHtml(diet.title)}" 
                             style="width: 100%; height: 100%; object-fit: cover; display: block;"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; align-items: center; justify-content: center;">
                            <i class="fas fa-file-pdf" style="font-size: 4rem; color: #10b981;"></i>
                        </div>
                    </div>
                `;
            } else {
                thumbnailHTML = `
                    <div class="diet-thumbnail" style="width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-file-pdf" style="font-size: 4rem; color: #10b981;"></i>
                    </div>
                `;
            }
            
            // Autor
            let authorHTML = '';
            if (diet.author_name) {
                let authorPhotoHTML = '';
                if (diet.author_image_url) {
                    const authorImageUrl = buildFullUrl(diet.author_image_url);
                    authorPhotoHTML = `<img src="${escapeHtml(authorImageUrl)}" alt="${escapeHtml(diet.author_name)}" class="author-avatar" onerror="this.parentElement.innerHTML='<div class=\\'author-avatar-placeholder\\'>${getInitials(diet.author_name)}</div>';">`;
                } else {
                    authorPhotoHTML = `<div class="author-avatar-placeholder">${getInitials(diet.author_name)}</div>`;
                }
                
                authorHTML = `
                    <div class="diet-author">
                        ${authorPhotoHTML}
                        <span class="author-name">${escapeHtml(diet.author_name)}</span>
                    </div>
                `;
            }
            
            // Data
            const date = diet.created_at ? new Date(diet.created_at) : null;
            const dateStr = date ? date.toLocaleDateString('pt-BR') : '';
            
            card.innerHTML = `
                ${thumbnailHTML}
                <div class="diet-card-header">
                    <div class="diet-info">
                        <h3>${escapeHtml(diet.title)}</h3>
                        ${diet.description ? `<p class="diet-description">${escapeHtml(diet.description)}</p>` : ''}
                    </div>
                </div>
                <div class="diet-meta">
                    ${authorHTML}
                    ${dateStr ? `
                        <div class="diet-date">
                            <i class="fas fa-calendar"></i>
                            <span>${dateStr}</span>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Adicionar event listener para abrir PDF ao clicar
            // Usar capture: true para capturar antes do router SPA
            card.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                openDietPdf(card);
                return false;
            }, true); // true = capture phase (antes do bubbling)
            
            return card;
        }
        
        async function openDietPdf(cardElement) {
            const fileUrl = cardElement.dataset.fileUrl;
            const fileName = cardElement.dataset.fileName;
            const dietId = cardElement.dataset.dietId;
            const fileId = cardElement.dataset.fileId;
            
            // Verificar se está rodando em Capacitor (app mobile)
            const isCapacitor = window.Capacitor !== undefined || window.CapacitorWeb !== undefined;
            const isIOS = isCapacitor && (window.Capacitor?.getPlatform() === 'ios' || /iPad|iPhone|iPod/.test(navigator.userAgent));
            const isAndroid = isCapacitor && (window.Capacitor?.getPlatform() === 'android');
            
            // ✅ NO iOS E ANDROID: GERAR LINK TEMPORÁRIO E ABRIR NO NAVEGADOR EXTERNO
            if (isIOS || isAndroid) {
                try {
                    // Chamar endpoint para gerar link temporário (com generate_token=1)
                    const apiBase = window.API_BASE_URL;
                    let tempUrlEndpoint = `${apiBase}/serve_pdf.php?generate_token=1&`;
                    if (fileId) {
                        tempUrlEndpoint += `id=${fileId}`;
                    } else if (dietId) {
                        tempUrlEndpoint += `diet_id=${dietId}`;
                    } else {
                        throw new Error('Não foi possível identificar o arquivo PDF');
                    }
                    
                    const response = await authenticatedFetch(tempUrlEndpoint);
                    if (!response.ok) {
                        throw new Error('Erro ao gerar link temporário');
                    }
                    
                    const result = await response.json();
                    if (!result.success || !result.temp_url) {
                        throw new Error('Erro ao gerar link temporário');
                    }
                    
                    // Abrir link temporário no navegador externo
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                        const { Browser } = window.Capacitor.Plugins;
                        await Browser.open({ url: result.temp_url });
                    } else {
                        window.location.href = result.temp_url;
                    }
                } catch (error) {
                    console.error('Erro ao gerar link temporário:', error);
                    // Fallback: tentar abrir URL original
                    window.open(fileUrl, '_system');
                }
                return;
            }
            
            // No web: fazer download do PDF diretamente (igual view_content)
            try {
                await downloadPdfWeb(fileUrl, fileName);
            } catch (error) {
                console.error('Erro ao baixar PDF:', error);
                throw error;
            }
        }
        
        async function downloadPdfWithCapacitor(fileUrl, fileName) {
            // Verificar se os plugins estão disponíveis
            try {
                // Tentar usar Capacitor Filesystem se disponível
                let Filesystem;
                
                if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
                    Filesystem = window.Capacitor.Plugins.Filesystem;
                } else if (window.Capacitor && window.Capacitor.getPlatform() !== 'web') {
                    // Tentar import dinâmico (Capacitor 5)
                    try {
                        const { Filesystem: FS } = await import('@capacitor/filesystem');
                        Filesystem = FS;
                    } catch (e) {
                    }
                }
                
                if (Filesystem) {
                    // Baixar o arquivo usando fetch com autenticação
                    const response = await authenticatedFetch(fileUrl);
                    if (!response.ok) {
                        throw new Error(`Erro HTTP: ${response.status}`);
                    }
                    
                    // Converter para base64
                    const blob = await response.blob();
                    const reader = new FileReader();
                    const base64Data = await new Promise((resolve, reject) => {
                        reader.onloadend = () => {
                            const base64 = reader.result.split(',')[1];
                            resolve(base64);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    
                    // Salvar usando Filesystem
                    const filePath = `Downloads/${fileName}`;
                    
                    // Tentar ExternalStorage primeiro, depois Documents
                    try {
                        await Filesystem.writeFile({
                            path: filePath,
                            data: base64Data,
                            directory: Filesystem.Directory.ExternalStorage
                        });
                    } catch (e) {
                        // Fallback para Documents
                        await Filesystem.writeFile({
                            path: filePath,
                            data: base64Data,
                            directory: Filesystem.Directory.Documents
                        });
                    }
                    
                    return;
                }
            } catch (error) {
                // Fallback para método web
            }
            
            // Fallback: tentar usar método web mesmo em Capacitor
            await downloadPdfWeb(fileUrl, fileName);
        }
        
        async function downloadPdfWeb(fileUrl, fileName) {
            try {
                // Verificar se a URL está completa
                let fullUrl = fileUrl;
                if (!fullUrl.match(/^https?:\/\//)) {
                    // Se não começa com http, adicionar BASE_APP_URL
                    if (fullUrl.startsWith('/')) {
                        fullUrl = window.BASE_APP_URL + fullUrl;
                    } else {
                        fullUrl = window.BASE_APP_URL + '/' + fullUrl;
                    }
                }
                
                // Buscar o arquivo com autenticação
                const response = await authenticatedFetch(fullUrl);
                
                if (!response.ok) {
                    const text = await response.text();
                    
                    // Verificar se é uma página 404 do servidor (HTML)
                    if (response.status === 404 && text.includes('<!DOCTYPE')) {
                        throw new Error('Endpoint de download não encontrado. Verifique se o arquivo foi enviado para o servidor.');
                    }
                    
                    if (response.status === 401) {
                        throw new Error('Acesso negado. Faça login novamente.');
                    } else if (response.status === 403) {
                        throw new Error('Você não tem permissão para acessar este arquivo.');
                    } else if (response.status === 404) {
                        throw new Error('Arquivo não encontrado no servidor.');
                    }
                    
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                
                // Converter para blob
                const blob = await response.blob();
                
                // Verificar se o blob é válido
                if (!blob || blob.size === 0) {
                    throw new Error('Arquivo vazio ou inválido');
                }
                
                // Criar URL temporária
                const blobUrl = window.URL.createObjectURL(blob);
                
                // Criar link de download
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName;
                link.style.display = 'none';
                
                // Adicionar ao DOM, clicar e remover
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Limpar URL temporária após um delay
                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
                
            } catch (error) {
                // Não fazer fallback para abrir em nova aba, pois o endpoint requer autenticação
                throw error;
            }
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
            dietContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-utensils"></i>
                    </div>
                    <h3>Nenhuma dieta disponível</h3>
                    <p>Nenhuma dieta disponível no momento. Entre em contato com seu nutricionista!</p>
                </div>
            `;
        }
        
        // Carregar dados ao iniciar
        function init() {
            loadDiets();
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
