
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
        const contentTitle = document.getElementById('content-title');
        
        // Obter ID do conteúdo da URL
        const urlParams = new URLSearchParams(window.location.search);
        const contentId = parseInt(urlParams.get('id') || '0');
        
        if (contentId <= 0) {
            if (window.SPARouter) {
                window.SPARouter.navigate('/content');
            } else {
                window.location.href = './content.html';
            }
            return;
        }
        
        // Carregar conteúdo
        async function loadContent() {
            try {
                const apiUrl = `/api/get_view_content_data.php?id=${contentId}`;
                console.log('Carregando conteúdo de:', apiUrl);
                
                const response = await authenticatedFetch(apiUrl);
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error('Erro HTTP:', response.status);
                    console.error('Resposta do servidor:', text.substring(0, 1000));
                    
                    if (response.status === 404) {
                        throw new Error('API não encontrada. Verifique se o arquivo existe no servidor.');
                    }
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
                    if (result.message && result.message.includes('não encontrado')) {
                        if (window.SPARouter) {
                            window.SPARouter.navigate('/content');
                        } else {
                            window.location.href = './content.html';
                        }
                        return;
                    }
                    throw new Error(result.message || 'Erro ao carregar conteúdo');
                }
                
                renderContent(result.data.content, result.data.files);
                
                // Registrar visualização
                registerContentView(contentId);
                
            } catch (error) {
                console.error('Erro ao carregar conteúdo:', error);
                renderError();
            }
        }
        
        function renderContent(content, files) {
            // Atualizar título
            contentTitle.textContent = content.title;
            
            let html = '<div class="content-container">';
            
            // Descrição
            if (content.description) {
                html += `<p class="content-description">${escapeHtml(content.description)}</p>`;
            }
            
            // Arquivos
            if (!files || files.length === 0) {
                html += `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Arquivo não disponível</h3>
                        <p>O arquivo deste conteúdo não está disponível no momento.</p>
                    </div>
                `;
            } else {
                html += '<div class="files-list" style="display: flex; flex-direction: column;">';
                
                files.forEach((file, index) => {
                    const isVideo = isVideoFile(file);
                    const isPdf = isPdfFile(file);
                    
                    if (isVideo) {
                        html += renderVideoFile(file);
                    } else if (isPdf) {
                        html += renderPdfFile(file);
                    }
                    
                    // Separador entre arquivos
                    if (index < files.length - 1) {
                        html += `
                            <div class="content-separator">
                                <div class="content-separator-line"></div>
                                <div class="content-separator-dots">
                                    <div class="content-separator-dot"></div>
                                    <div class="content-separator-dot"></div>
                                    <div class="content-separator-dot"></div>
                                </div>
                                <div class="content-separator-line"></div>
                            </div>
                        `;
                    }
                });
                
                html += '</div>';
            }
            
            // Meta informações
            const dateToShow = (content.updated_at && content.updated_at !== '0000-00-00 00:00:00') 
                ? content.updated_at 
                : content.created_at;
            const date = new Date(dateToShow);
            const dateStr = date.toLocaleDateString('pt-BR');
            
            html += `
                <div class="content-meta">
                    <div class="content-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${dateStr}</span>
                    </div>
                </div>
            `;
            
            html += '</div>';
            
            contentContainer.innerHTML = html;
            
            // Adicionar event listeners para download de PDFs
            setupPdfDownloadListeners();
        }
        
        function setupPdfDownloadListeners() {
            const pdfCards = document.querySelectorAll('.content-pdf-card[data-file-url]');
            pdfCards.forEach(card => {
                card.addEventListener('click', function() {
                    const fileUrl = this.dataset.fileUrl;
                    const fileName = this.dataset.fileName;
                    downloadPdf(fileUrl, fileName, this);
                });
            });
        }
        
        async function downloadPdf(fileUrl, fileName, cardElement) {
            const statusEl = cardElement.querySelector('.pdf-download-status');
            const labelEl = cardElement.querySelector('.content-pdf-label span');
            
            // Log para debug
            console.log('Iniciando download PDF:', { fileUrl, fileName });
            
            // Mostrar status de download
            if (statusEl) {
                statusEl.style.display = 'flex';
                statusEl.style.alignItems = 'center';
                statusEl.style.gap = '8px';
                statusEl.style.justifyContent = 'center';
            }
            if (labelEl) {
                labelEl.textContent = 'Baixando...';
            }
            cardElement.style.pointerEvents = 'none';
            cardElement.style.opacity = '0.7';
            
            try {
                // Verificar se está rodando em Capacitor (app mobile)
                const isCapacitor = window.Capacitor !== undefined || window.CapacitorWeb !== undefined;
                
                if (isCapacitor) {
                    // Usar Capacitor para download no mobile
                    await downloadPdfWithCapacitor(fileUrl, fileName);
                } else {
                    // Usar método web padrão
                    await downloadPdfWeb(fileUrl, fileName);
                }
                
                // Sucesso
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> <span>Download concluído!</span>';
                    statusEl.style.color = '#4CAF50';
                }
                if (labelEl) {
                    labelEl.textContent = 'Download concluído!';
                }
                
                // Resetar após 2 segundos
                setTimeout(() => {
                    if (statusEl) {
                        statusEl.style.display = 'none';
                    }
                    if (labelEl) {
                        labelEl.textContent = 'Baixar PDF';
                    }
                    cardElement.style.pointerEvents = '';
                    cardElement.style.opacity = '1';
                }, 2000);
                
            } catch (error) {
                console.error('Erro ao baixar PDF:', error);
                
                // Erro
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Erro ao baixar</span>';
                    statusEl.style.color = '#ef5350';
                }
                if (labelEl) {
                    labelEl.textContent = 'Erro ao baixar';
                }
                
                // Resetar após 3 segundos
                setTimeout(() => {
                    if (statusEl) {
                        statusEl.style.display = 'none';
                    }
                    if (labelEl) {
                        labelEl.textContent = 'Baixar PDF';
                    }
                    cardElement.style.pointerEvents = '';
                    cardElement.style.opacity = '1';
                }, 3000);
            }
        }
        
        async function downloadPdfWithCapacitor(fileUrl, fileName) {
            // Verificar se os plugins estão disponíveis
            // Capacitor 5 usa import dinâmico ou window.Capacitor.Plugins
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
                        console.log('Filesystem plugin não disponível via import');
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
                console.error('Erro com Capacitor plugins:', error);
                // Fallback para método web
            }
            
            // Fallback: tentar usar método web mesmo em Capacitor
            await downloadPdfWeb(fileUrl, fileName);
        }
        
        async function downloadPdfWeb(fileUrl, fileName) {
            try {
                console.log('Tentando baixar PDF (web):', fileUrl);
                
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
                
                console.log('URL completa para download:', fullUrl);
                
                // Buscar o arquivo com autenticação
                // O endpoint serve_content_file.php já lida com autenticação e permissões
                const response = await authenticatedFetch(fullUrl);
                
                if (!response.ok) {
                    const text = await response.text();
                    console.error('Erro HTTP ao baixar PDF:', response.status);
                    console.error('Resposta do servidor:', text.substring(0, 1000));
                    
                    // Verificar se é uma página 404 do servidor (HTML)
                    if (response.status === 404 && text.includes('<!DOCTYPE')) {
                        console.error('⚠️ Endpoint não encontrado! Verifique se api/serve_content_file.php foi enviado para o servidor.');
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
                
                console.log('Blob criado com sucesso, tamanho:', blob.size);
                
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
                console.error('Erro ao baixar PDF (web):', error);
                // Não fazer fallback para abrir em nova aba, pois o endpoint requer autenticação
                throw error;
            }
        }
        
        function isVideoFile(file) {
            if (file.mime_type) {
                return file.mime_type.startsWith('video/');
            }
            const ext = (file.file_path || '').split('.').pop().toLowerCase();
            return ['mp4', 'mov', 'avi', 'webm'].includes(ext);
        }
        
        function isPdfFile(file) {
            if (file.mime_type) {
                return file.mime_type === 'application/pdf';
            }
            const ext = (file.file_path || '').split('.').pop().toLowerCase();
            return ext === 'pdf';
        }
        
        function renderVideoFile(file) {
            // Usar file_url se disponível, senão file_path
            let fileUrl = file.file_url || file.file_path || '';
            
            // Garantir URL completa para funcionar no Capacitor/iOS
            if (fileUrl && !fileUrl.match(/^https?:\/\//)) {
                if (!fileUrl.startsWith('/')) {
                    fileUrl = '/' + fileUrl;
                }
                // Usar BASE_APP_URL para URL completa
                fileUrl = 'https://appshapefit.com' + fileUrl;
            }
            
            let poster = '';
            if (file.thumbnail_url) {
                poster = file.thumbnail_url;
                if (!poster.match(/^https?:\/\//)) {
                    if (!poster.startsWith('/')) {
                        poster = '/' + poster;
                    }
                    poster = 'https://appshapefit.com' + poster;
                }
            }
            
            const title = file.video_title || 'Sem título';
            const mimeType = file.mime_type || 'video/mp4';
            
            console.log('[ViewContent] Renderizando vídeo:', { fileUrl, poster, title });
            
            return `
                <div class="file-container">
                    <h3 class="file-title">${escapeHtml(title)}</h3>
                    <div class="content-media">
                        <video class="content-video" controls preload="metadata" playsinline webkit-playsinline ${poster ? `poster="${escapeHtml(poster)}"` : ''}>
                            <source src="${escapeHtml(fileUrl)}" type="${escapeHtml(mimeType)}">
                            Seu navegador não suporta a reprodução de vídeos.
                        </video>
                    </div>
                </div>
            `;
        }
        
        function renderPdfFile(file) {
            // Usar file_url se disponível (da API), senão construir a partir de file_path
            let fileUrl = file.file_url || file.file_path || '';
            
            // Construir URL completa
            if (!fileUrl) {
                console.error('Arquivo PDF sem URL:', file);
                return '';
            }
            
            // Se já é URL completa, usar como está
            if (fileUrl.match(/^https?:\/\//)) {
                // URL completa já
            } else {
                // Construir URL completa
                if (!fileUrl.startsWith('/')) {
                    fileUrl = '/' + fileUrl;
                }
                fileUrl = window.BASE_APP_URL + fileUrl;
            }
            
            const title = file.video_title || 'Sem título';
            const fileName = file.file_name || title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
            const fileId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            return `
                <div class="file-container">
                    <h3 class="file-title">${escapeHtml(title)}</h3>
                    <div class="content-pdf-card" id="${fileId}" data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}" style="cursor: pointer;">
                        <i class="fas fa-file-pdf content-pdf-icon"></i>
                        <div class="content-pdf-label">
                            <span>Baixar PDF</span>
                            <i class="fas fa-download"></i>
                        </div>
                        <div class="pdf-download-status" style="display: none; margin-top: 12px; font-size: 0.875rem; color: var(--accent-orange);">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Baixando...</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function renderError() {
            contentContainer.innerHTML = `
                <div class="content-container">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Erro ao carregar conteúdo</h3>
                        <p>Não foi possível carregar o conteúdo. Tente novamente mais tarde.</p>
                    </div>
                </div>
            `;
        }
        
        async function registerContentView(contentId) {
            try {
                await authenticatedFetch(`/api/register_content_view.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content_id: contentId
                    })
                });
            } catch (error) {
                // Ignorar erro de registro de visualização
                console.error('Erro ao registrar visualização:', error);
            }
        }
        
        // Carregar dados ao iniciar
        function init() {
            loadContent();
        }
        
        // SPA: executar imediatamente se DOM já carregou
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(init, 0);
        } else {
            document.addEventListener('DOMContentLoaded', init);
        }
        
        // Também ouvir eventos do SPA
        window.addEventListener('fragmentReady', init);
        window.addEventListener('pageLoaded', init);
    
})();
