
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        const contentContainer = document.getElementById('content-container');
        const contentTitle = document.getElementById('content-title');
        
        if (!contentContainer || !contentTitle) {
            
            return;
        }
        
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
        
        // Flag para evitar múltiplas execuções
        let isLoading = false;
        let isInitialized = false;
        
        // Carregar conteúdo
        async function loadContent() {
            // Evitar múltiplas execuções simultâneas
            if (isLoading) {
                return;
            }
            isLoading = true;
            
            try {
                const apiUrl = `${window.API_BASE_URL}/get_view_content_data.php?id=${contentId}`;
                
                const response = await authenticatedFetch(apiUrl);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('API não encontrada. Verifique se o arquivo existe no servidor.');
                    }
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                
                // Verificar se a resposta é JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
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
                
                // Registrar visualização de forma não-bloqueante (não aguardar)
                registerContentView(contentId).catch(err => {
                    // Ignorar erros de registro de visualização
                    
                });
                
            } catch (error) {
                console.error('[ViewContent] Erro ao carregar conteúdo:', error);
                renderError();
            } finally {
                isLoading = false;
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
            
            // Verificar se está rodando em Capacitor (app mobile)
            const isCapacitor = window.Capacitor !== undefined || window.CapacitorWeb !== undefined;
            const isIOS = isCapacitor && (window.Capacitor?.getPlatform() === 'ios' || /iPad|iPhone|iPod/.test(navigator.userAgent));
            const isAndroid = isCapacitor && (window.Capacitor?.getPlatform() === 'android');
            
            // ✅ NO iOS E ANDROID: GERAR LINK TEMPORÁRIO E ABRIR NO NAVEGADOR EXTERNO
            if (isIOS || isAndroid) {
                // Extrair file_id ou content_id dos data attributes ou da URL
                const fileId = cardElement.dataset.fileId || new URLSearchParams(fileUrl.split('?')[1] || '').get('id') || '0';
                const contentId = cardElement.dataset.contentId || new URLSearchParams(fileUrl.split('?')[1] || '').get('content_id') || '0';
                
                // Mostrar status
                if (statusEl) {
                    statusEl.style.display = 'flex';
                    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Gerando link temporário...</span>';
                    statusEl.style.color = 'var(--accent-orange)';
                }
                if (labelEl) {
                    labelEl.textContent = 'Gerando link...';
                }
                cardElement.style.pointerEvents = 'none';
                cardElement.style.opacity = '0.7';
                
                try {
                    // Chamar endpoint para gerar link temporário
                    const apiBase = window.API_BASE_URL;
                    let tempUrlEndpoint = `${apiBase}/serve_pdf.php?`;
                    if (fileId !== '0') {
                        tempUrlEndpoint += `id=${fileId}`;
                    } else if (contentId !== '0') {
                        tempUrlEndpoint += `content_id=${contentId}`;
                    } else {
                        // Se não tem ID, tentar extrair da URL do arquivo
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
                    // No iOS/Android WebView, window.location.href abre no navegador padrão
                    // Ou usar window.open se disponível
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                        // Se tiver plugin Browser, usar ele
                        const { Browser } = window.Capacitor.Plugins;
                        await Browser.open({ url: result.temp_url });
                    } else {
                        // Fallback: usar window.location.href (abre no navegador externo)
                        window.location.href = result.temp_url;
                    }
                    
                    // Atualizar status
                    if (statusEl) {
                        statusEl.innerHTML = '<i class="fas fa-external-link-alt"></i> <span>Abrindo no navegador...</span>';
                        statusEl.style.color = '#4CAF50';
                    }
                    if (labelEl) {
                        labelEl.textContent = 'Abrindo...';
                    }
                    
                    // Resetar após 2 segundos
                    setTimeout(() => {
                        if (statusEl) {
                            statusEl.style.display = 'none';
                        }
                        if (labelEl) {
                            labelEl.textContent = 'Abrir PDF';
                        }
                        cardElement.style.pointerEvents = '';
                        cardElement.style.opacity = '1';
                    }, 2000);
                    
                } catch (error) {
                    console.error('Erro ao gerar link temporário:', error);
                    
                    // Fallback: tentar abrir URL original (pode pedir login)
                    window.open(fileUrl, '_system');
                    
                    if (statusEl) {
                        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Erro ao gerar link</span>';
                        statusEl.style.color = '#ef5350';
                    }
                    if (labelEl) {
                        labelEl.textContent = 'Erro';
                    }
                    
                    setTimeout(() => {
                        if (statusEl) {
                            statusEl.style.display = 'none';
                        }
                        if (labelEl) {
                            labelEl.textContent = 'Abrir PDF';
                        }
                        cardElement.style.pointerEvents = '';
                        cardElement.style.opacity = '1';
                    }, 3000);
                }
                
                return; // Sair da função
            }
            
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
                if (isCapacitor) {
                    // Usar Capacitor para download no mobile (Android)
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
                // O endpoint serve_content_file.php já lida com autenticação e permissões
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
            // ✅ USAR API PARA SERVIR VÍDEO (com autenticação e streaming)
            let fileUrl = '';
            
            // Priorizar ID do arquivo, senão usar path
            if (file.id) {
                fileUrl = `${window.API_BASE_URL}/serve_video.php?id=${file.id}`;
            } else if (file.file_path) {
                // Se não tem ID, usar path
                const encodedPath = encodeURIComponent(file.file_path);
                fileUrl = `${window.API_BASE_URL}/serve_video.php?path=${encodedPath}`;
            } else {
                return '';
            }
            
            // ✅ ADICIONAR TOKEN À URL PARA AUTENTICAÇÃO
            const token = getAuthToken();
            if (token) {
                fileUrl += (fileUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
            }
            
            let poster = '';
            if (file.thumbnail_url) {
                poster = file.thumbnail_url;
                if (!poster.match(/^https?:\/\//)) {
                    if (!poster.startsWith('/')) {
                        poster = '/' + poster;
                    }
                    poster = window.BASE_APP_URL + poster;
                }
            } else if (file.thumbnail_path) {
                // ✅ TENTAR thumbnail_path SE thumbnail_url NÃO EXISTIR
                poster = file.thumbnail_path;
                if (!poster.match(/^https?:\/\//)) {
                    if (!poster.startsWith('/')) {
                        poster = '/' + poster;
                    }
                    poster = window.BASE_APP_URL + poster;
                }
            }
            
            const title = file.video_title || 'Sem título';
            const mimeType = file.mime_type || 'video/mp4';
            
            
            // ✅ GARANTIR QUE POSTER ESTÁ NO ATRIBUTO CORRETO
            const posterAttr = poster ? ` poster="${escapeHtml(poster)}"` : '';
            const posterStyle = poster ? ` style="--poster-bg: url('${escapeHtml(poster)}');"` : '';
            
            return `
                <div class="file-container">
                    <h3 class="file-title">${escapeHtml(title)}</h3>
                    <div class="content-media">
                        <video class="content-video" controls preload="metadata" playsinline webkit-playsinline crossorigin="anonymous"${posterAttr}${posterStyle}>
                            <source src="${escapeHtml(fileUrl)}" type="${escapeHtml(mimeType)}">
                            Seu navegador não suporta a reprodução de vídeos.
                        </video>
                    </div>
                </div>
            `;
        }
        
        function renderPdfFile(file) {
            // ✅ USAR API PARA SERVIR PDF (similar ao vídeo)
            let fileUrl = '';
            let fileId = null;
            let contentId = null;
            
            // Priorizar ID do arquivo, senão usar path
            if (file.id) {
                fileId = file.id;
                fileUrl = `${window.API_BASE_URL}/serve_pdf.php?id=${file.id}`;
            } else if (file.content_id) {
                contentId = file.content_id;
                fileUrl = `${window.API_BASE_URL}/serve_pdf.php?content_id=${file.content_id}`;
            } else if (file.file_url || file.file_path) {
                // Fallback: usar URL/path direto
                fileUrl = file.file_url || file.file_path;
                if (!fileUrl.match(/^https?:\/\//)) {
                    if (!fileUrl.startsWith('/')) {
                        fileUrl = '/' + fileUrl;
                    }
                    fileUrl = window.BASE_APP_URL + fileUrl;
                }
            } else {
                return '';
            }
            
            const title = file.video_title || 'Sem título';
            const fileName = file.file_name || title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
            const cardId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // ✅ DETECTAR SE É iOS PARA MUDAR O TEXTO DO BOTÃO
            const isCapacitor = window.Capacitor !== undefined || window.CapacitorWeb !== undefined;
            const isIOS = isCapacitor && (window.Capacitor?.getPlatform() === 'ios' || /iPad|iPhone|iPod/.test(navigator.userAgent));
            const buttonText = isIOS ? 'Abrir PDF' : 'Baixar PDF';
            const buttonIcon = isIOS ? 'fa-external-link-alt' : 'fa-download';
            
            // Adicionar data attributes para IDs (para gerar link temporário)
            let dataAttrs = `data-file-url="${escapeHtml(fileUrl)}" data-file-name="${escapeHtml(fileName)}"`;
            if (fileId) {
                dataAttrs += ` data-file-id="${fileId}"`;
            }
            if (contentId) {
                dataAttrs += ` data-content-id="${contentId}"`;
            }
            
            return `
                <div class="file-container">
                    <h3 class="file-title">${escapeHtml(title)}</h3>
                    <div class="content-pdf-card" id="${cardId}" ${dataAttrs} style="cursor: pointer;">
                        <i class="fas fa-file-pdf content-pdf-icon"></i>
                        <div class="content-pdf-label">
                            <span>${escapeHtml(buttonText)}</span>
                            <i class="fas ${buttonIcon}"></i>
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
                await authenticatedFetch(`${window.API_BASE_URL}/register_content_view.php`, {
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
            }
        }
        
        // Carregar dados ao iniciar
        function init() {
            // Evitar múltiplas inicializações
            if (isInitialized) {
                return;
            }
            isInitialized = true;
            
            // Usar requestAnimationFrame para não bloquear o thread principal
            requestAnimationFrame(() => {
                loadContent();
            });
        }
        
        // SPA: executar imediatamente se DOM já carregou
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            // Pequeno delay para garantir que outros scripts carregaram
            setTimeout(init, 50);
        } else {
            document.addEventListener('DOMContentLoaded', init, { once: true });
        }
        
        // Também ouvir eventos do SPA (com debounce)
        let initTimeout = null;
        const debouncedInit = () => {
            if (initTimeout) clearTimeout(initTimeout);
            initTimeout = setTimeout(init, 100);
        };
        
        window.addEventListener('fragmentReady', debouncedInit, { once: true });
        window.addEventListener('pageLoaded', debouncedInit, { once: true });
    
})();
