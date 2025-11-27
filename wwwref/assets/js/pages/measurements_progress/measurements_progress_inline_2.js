
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // Verificar autenticação
        (async function() {
            const authenticated = await requireAuth();
            if (!authenticated) {
                return; // Já redirecionou para login
            }
            
            // Usar URLs relativas para passar pelo proxy
            const BASE_URL = '';
            let pageData = null;
            
            // Função para mostrar alertas
            function showAlert(message, type = 'success') {
                const alertContainer = document.getElementById('alert-messages');
                const alert = document.createElement('div');
                alert.className = `alert alert-${type}`;
                alert.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${escapeHtml(message)}`;
                alertContainer.appendChild(alert);
                
                setTimeout(() => {
                    alert.remove();
                }, 5000);
            }
            
            // Verificar mensagens da URL
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('success') === '1') {
                showAlert(urlParams.get('msg') || 'Operação realizada com sucesso!', 'success');
            }
            if (urlParams.get('error') === '1') {
                showAlert(urlParams.get('msg') || 'Erro ao processar a solicitação.', 'error');
            }
            
            // Carregar dados da página
            async function loadPageData() {
                try {
                    const apiUrl = `${BASE_URL}/api/get_measurements_data.php`;
                    const response = await authenticatedFetch(apiUrl);
                    
                    if (!response) return; // Token inválido, já redirecionou
                    
                    const result = await response.json();
                    
                    if (!result.success) {
                        throw new Error(result.message || 'Erro ao carregar dados');
                    }
                    
                    pageData = result.data;
                    
                    // Preencher peso do perfil
                    const weightInput = document.getElementById('weight_kg');
                    if (weightInput && pageData.user_profile && pageData.user_profile.weight_kg) {
                        weightInput.value = parseFloat(pageData.user_profile.weight_kg).toFixed(1);
                        weightInput.placeholder = parseFloat(pageData.user_profile.weight_kg).toFixed(1);
                    }
                    
                    // Definir data padrão (hoje)
                    const dateInput = document.getElementById('date_recorded');
                    if (dateInput) {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        dateInput.value = `${year}-${month}-${day}`;
                        dateInput.setAttribute('max', `${year}-${month}-${day}`);
                    }
                    
                    // Renderizar galeria
                    renderGallery();
                    
                } catch (error) {
                    console.error('Erro ao carregar dados:', error);
                    document.getElementById('loading-state').innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; color: var(--accent-orange);"></i>
                        <p>Erro ao carregar dados. Tente novamente.</p>
                    `;
                }
            }
            
            function renderGallery() {
                document.getElementById('loading-state').style.display = 'none';
                
                if (!pageData.history || pageData.history.length === 0) {
                    document.getElementById('empty-state').style.display = 'block';
                    document.getElementById('gallery-container').style.display = 'none';
                    return;
                }
                
                document.getElementById('empty-state').style.display = 'none';
                document.getElementById('gallery-container').style.display = 'flex';
                
                // Agrupar por data e sessão
                const groupedSessions = {};
                pageData.history.forEach(record => {
                    const dateKey = record.date_recorded;
                    const timeKey = record.created_at ? new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    if (!groupedSessions[dateKey]) {
                        groupedSessions[dateKey] = {};
                    }
                    
                    if (!groupedSessions[dateKey][timeKey]) {
                        groupedSessions[dateKey][timeKey] = {
                            date: record.date_recorded,
                            time: timeKey,
                            weight: record.weight_kg,
                            photos: [],
                            measurements: []
                        };
                    }
                    
                    // Adicionar fotos
                    const photoTypes = [
                        { key: 'photo_front', label: 'Frente' },
                        { key: 'photo_side', label: 'Lado' },
                        { key: 'photo_back', label: 'Costas' }
                    ];
                    
                    photoTypes.forEach(({ key, label }) => {
                        if (record[key]) {
                            groupedSessions[dateKey][timeKey].photos.push({
                                id: record.id,
                                type: key,
                                label: label,
                                filename: record[key]
                            });
                        }
                    });
                });
                
                // Renderizar HTML
                let html = '';
                Object.keys(groupedSessions).sort().reverse().forEach(dateKey => {
                    const sessions = groupedSessions[dateKey];
                    const sessionsWithPhotos = Object.values(sessions).filter(session => session.photos.length > 0);
                    
                    if (sessionsWithPhotos.length === 0) return;
                    
                    const dateDisplay = new Date(dateKey).toLocaleDateString('pt-BR');
                    html += `
                        <div class="session-group">
                            <div class="session-header">
                                <h4><i class="fas fa-calendar-day"></i> ${dateDisplay}</h4>
                            </div>
                    `;
                    
                    Object.values(sessionsWithPhotos).forEach(session => {
                        html += `
                            <div class="session-card">
                                <div class="session-info">
                                    <span class="session-time">
                                        <i class="fas fa-clock"></i> ${session.time}
                                    </span>
                                    ${session.weight ? `
                                        <span class="session-weight">
                                            <i class="fas fa-weight"></i> ${parseFloat(session.weight).toFixed(1)} kg
                                        </span>
                                    ` : ''}
                                </div>
                                <div class="session-photos">
                        `;
                        
                        session.photos.forEach(photo => {
                            const photoUrl = `${pageData.base_url}/uploads/measurements/${escapeHtml(photo.filename)}`;
                            html += `
                                <div class="photo-item-container">
                                    <div class="photo-item" onclick="openPhotoModal('${photoUrl}', '${photo.label}', '${dateDisplay} ${session.time}', ${photo.id}, '${photo.type}')">
                                        <img src="${photoUrl}" alt="${photo.label}" onerror="this.style.display='none'">
                                        <div class="photo-overlay">
                                            <span class="photo-type">${photo.label}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                });
                
                document.getElementById('gallery-container').innerHTML = html;
            }
            
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // Função helper para obter data local
            function getLocalDateString() {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            
            // Função para inicializar preview de fotos
            function setupPhotoPreview() {
                const photoInputs = document.querySelectorAll('input[type="file"]');
                
                photoInputs.forEach(input => {
                    // Não remover listeners - apenas adicionar se não existir
                    if (input.dataset.listenerAdded) {
                        return; // Já tem listener
                    }
                    input.dataset.listenerAdded = 'true';
                    
                    input.addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        if (file) {
                            console.log('Arquivo selecionado:', file.name);
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                const photoType = input.id.replace('photo_', '');
                                const preview = document.getElementById(photoType + 'Preview');
                                const slot = document.getElementById('slot-' + photoType);
                                console.log('Preview element:', preview, 'Photo type:', photoType);
                                
                                if (preview) {
                                    preview.innerHTML = '';
                                    
                                    const img = document.createElement('img');
                                    img.src = e.target.result;
                                    
                                    preview.appendChild(img);
                                    
                                    // Adicionar classe has-photo ao slot
                                    if (slot) {
                                        slot.classList.add('has-photo');
                                    }
                                    
                                    console.log('Preview atualizado com sucesso');
                                } else {
                                    console.error('Elemento preview não encontrado:', photoType + 'Preview');
                                }
                            };
                            reader.onerror = function(error) {
                                console.error('Erro ao ler arquivo:', error);
                                showAlert('Erro ao carregar a imagem. Tente novamente.', 'error');
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                });
            }
            
            // Inicializar quando DOM estiver pronto
            function initializeForm() {
                const form = document.getElementById('measurements-form');
                const submitBtn = document.getElementById('submit-btn');
                const dateInput = document.getElementById('date_recorded');
                
                // Validar data futura
                if (dateInput) {
                    const today = getLocalDateString();
                    dateInput.setAttribute('max', today);
                    
                    dateInput.addEventListener('change', function() {
                        const selectedDate = new Date(this.value);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        
                        if (selectedDate > todayDate) {
                            showAlert('Não é possível registrar fotos com data futura. Por favor, selecione uma data válida.', 'error');
                            this.value = today;
                        }
                    });
                }
                
                // Validar envio de formulário
                if (form) {
                    form.addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        // Verificar se pelo menos uma foto foi enviada
                        const photoInputs = ['photo_front', 'photo_side', 'photo_back'];
                        let hasPhoto = false;
                        let photoCount = 0;
                        
                        photoInputs.forEach(inputId => {
                            const input = document.getElementById(inputId);
                            console.log('Verificando input:', inputId, input);
                            if (input) {
                                console.log('Input files:', input.files, 'Length:', input.files ? input.files.length : 0);
                                if (input.files && input.files.length > 0) {
                                    // Verificar se o arquivo tem tamanho maior que 0
                                    const file = input.files[0];
                                    if (file && file.size > 0) {
                                        hasPhoto = true;
                                        photoCount++;
                                        console.log('Foto encontrada em:', inputId, 'Tamanho:', file.size, 'bytes');
                                    } else {
                                        console.log('Arquivo vazio ignorado em:', inputId);
                                    }
                                }
                            }
                        });
                        
                        console.log('Total de fotos encontradas:', photoCount, 'hasPhoto:', hasPhoto);
                        
                        if (!hasPhoto) {
                            console.error('ERRO: Nenhuma foto válida encontrada!');
                            showAlert('Por favor, envie pelo menos uma foto antes de salvar.', 'error');
                            return false;
                        }
                        
                        console.log('Validação de foto passou! Prosseguindo com validação de data...');
                        
                        // Validar data (verificação dupla)
                        if (dateInput) {
                            const selectedDate = new Date(dateInput.value);
                            const todayDate = new Date();
                            todayDate.setHours(0, 0, 0, 0);
                            
                            console.log('Data selecionada:', selectedDate, 'Data de hoje:', todayDate);
                            
                            if (selectedDate > todayDate) {
                                console.error('ERRO: Data futura detectada!');
                                showAlert('Não é possível registrar fotos com data futura. Por favor, selecione uma data válida.', 'error');
                                dateInput.value = getLocalDateString();
                                return false;
                            }
                            console.log('Validação de data passou!');
                        }
                        
                        console.log('Todas as validações passaram! Enviando para servidor...');
                        
                        // Desabilitar botão
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                        
                        try {
                            // Criar FormData
                            const originalFormData = new FormData(form);
                            
                            // Remover arquivos vazios (0 bytes) do FormData
                            const cleanFormData = new FormData();
                            for (let pair of originalFormData.entries()) {
                                if (pair[1] instanceof File) {
                                    if (pair[1].size > 0) {
                                        cleanFormData.append(pair[0], pair[1]);
                                        console.log('Arquivo válido adicionado:', pair[0], pair[1].name, pair[1].size, 'bytes');
                                    } else {
                                        console.log('Arquivo vazio ignorado:', pair[0]);
                                    }
                                } else {
                                    cleanFormData.append(pair[0], pair[1]);
                                }
                            }
                            
                            // Debug: verificar o que está no FormData limpo
                            console.log('FormData limpo. Verificando arquivos:');
                            for (let pair of cleanFormData.entries()) {
                                if (pair[1] instanceof File) {
                                    console.log('Arquivo encontrado:', pair[0], pair[1].name, pair[1].size, 'bytes');
                                } else {
                                    console.log('Campo:', pair[0], pair[1]);
                                }
                            }
                            
                            // Usar FormData limpo
                            const formData = cleanFormData;
                            
                            // Verificar se há arquivos no FormData antes de enviar
                            let hasFilesInFormData = false;
                            for (let pair of formData.entries()) {
                                if (pair[1] instanceof File && pair[1].size > 0) {
                                    hasFilesInFormData = true;
                                    console.log('Arquivo confirmado no FormData antes de enviar:', pair[0], pair[1].name, pair[1].size, 'bytes');
                                }
                            }
                            
                            if (!hasFilesInFormData) {
                                console.error('ERRO: Nenhum arquivo válido no FormData antes de enviar!');
                                showAlert('Erro: Nenhuma foto válida foi preparada para envio.', 'error');
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Medidas e Fotos';
                                return;
                            }
                            
                            console.log('Enviando FormData para servidor...');
                            console.log('FormData é instância de FormData?', formData instanceof FormData);
                            console.log('Tipo do formData:', typeof formData, formData.constructor.name);
                            
                            // Obter token para Authorization
                            const token = getAuthToken();
                            
                            // Criar headers manualmente - apenas Authorization, SEM Content-Type
                            const headers = {};
                            if (token) {
                                headers['Authorization'] = `Bearer ${token}`;
                            }
                            
                            console.log('Headers que serão enviados:', headers);
                            
                            // Enviar usando fetch direto para garantir que FormData funcione corretamente
                            const response = await fetch(`${BASE_URL}/api/save_measurements.php`, {
                                method: 'POST',
                                body: formData,
                                headers: headers // Apenas Authorization - browser vai adicionar Content-Type automaticamente
                            });
                            
                            console.log('Resposta recebida do servidor. Status:', response.status);
                            
                            // Verificar se recebeu 401 (não autorizado)
                            if (response.status === 401) {
                                console.error('Token inválido (401) - redirecionando para login');
                                if (typeof clearAuthToken === 'function') {
                                    clearAuthToken();
                                }
                                if (window.SPARouter) {
                                    window.SPARouter.navigate('/login');
                                } else {
                                    window.location.href = '/auth/login.html';
                                }
                                return;
                            }
                            
                            const result = await response.json();
                            console.log('Resultado do servidor:', result);
                            
                            if (result.success) {
                                console.log('Sucesso! Medidas salvas.');
                                showAlert(result.message || 'Medidas salvas com sucesso!', 'success');
                                
                                // Limpar formulário
                                form.reset();
                                
                                // Restaurar previews
                                ['front', 'side', 'back'].forEach(type => {
                                    removePhoto(type);
                                });
                                
                                // Recarregar dados
                                await loadPageData();
                                
                                // Reconfigurar preview após reset
                                setupPhotoPreview();
                            } else {
                                console.error('ERRO do servidor:', result.message);
                                showAlert(result.message || 'Erro ao salvar medidas.', 'error');
                            }
                        } catch (error) {
                            console.error('Erro ao salvar:', error);
                            console.error('Stack trace:', error.stack);
                            showAlert('Erro ao salvar medidas. Tente novamente.', 'error');
                        } finally {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Medidas e Fotos';
                        }
                    });
                }
                
                // Configurar preview de fotos
                setupPhotoPreview();
            }
            
            // Função para remover foto
            window.removePhoto = function(photoType) {
                const input = document.getElementById('photo_' + photoType);
                const preview = document.getElementById(photoType + 'Preview');
                const slot = document.getElementById('slot-' + photoType);
                
                if (input) input.value = '';
                
                if (preview) {
                    preview.innerHTML = '';
                }
                
                if (slot) {
                    slot.classList.remove('has-photo');
                }
            };
            
            // Função para abrir modal de foto
            window.openPhotoModal = function(imageSrc, label, date, photoId = null, photoType = null) {
                const allPhotos = [];
                document.querySelectorAll('.photo-item img').forEach((img, index) => {
                    if (img.src && !img.src.includes('data:image')) {
                        const photoItem = img.closest('.photo-item');
                        const onclick = photoItem.getAttribute('onclick');
                        if (onclick) {
                            const match = onclick.match(/openPhotoModal\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*'([^']+)'\)/);
                            if (match) {
                                allPhotos.push({
                                    src: match[1],
                                    label: match[2],
                                    date: match[3],
                                    id: match[4],
                                    type: match[5]
                                });
                            }
                        }
                    }
                });
                
                let currentIndex = allPhotos.findIndex(photo => photo.src === imageSrc);
                if (currentIndex === -1) currentIndex = 0;
                
                const modal = document.createElement('div');
                modal.id = 'photoModal';
                modal.className = 'photo-modal';
                modal.style.display = 'block';
                modal.innerHTML = `
                    <div class="photo-modal-content">
                        <div class="photo-modal-header">
                            <div class="photo-modal-title">
                                <h3>${escapeHtml(label)}</h3>
                                <span class="photo-modal-date">${escapeHtml(date)}</span>
                            </div>
                            <div class="photo-modal-actions">
                                <button class="photo-modal-close" onclick="closePhotoModal()">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="photo-modal-body">
                            <div class="photo-viewer">
                                ${allPhotos.length > 1 ? `<button class="photo-nav-btn photo-prev" onclick="navigatePhoto(-1)">
                                    <i class="fas fa-chevron-left"></i>
                                </button>` : ''}
                                <div class="photo-container">
                                    <img id="modalPhoto" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(label)}">
                                </div>
                                ${allPhotos.length > 1 ? `<button class="photo-nav-btn photo-next" onclick="navigatePhoto(1)">
                                    <i class="fas fa-chevron-right"></i>
                                </button>` : ''}
                            </div>
                        </div>
                        <div class="photo-modal-footer">
                            <div class="photo-modal-info">
                                ${allPhotos.length > 1 ? `<div class="photo-counter">
                                    <span id="photoCounter">${currentIndex + 1} / ${allPhotos.length}</span>
                                </div>` : ''}
                                ${photoId ? `<button class="delete-photo-btn-modal" onclick="deletePhoto(${photoId}, '${photoType}')" title="Excluir foto">
                                    <i class="fas fa-trash-alt"></i>
                                    <span>Excluir</span>
                                </button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                
                modal.allPhotos = allPhotos;
                modal.currentIndex = currentIndex;
                
                document.body.appendChild(modal);
                document.body.style.overflow = 'hidden';
            };
            
            // Função para navegar entre fotos
            window.navigatePhoto = function(direction) {
                const modal = document.getElementById('photoModal');
                if (!modal || !modal.allPhotos) return;
                
                modal.currentIndex += direction;
                
                if (modal.currentIndex >= modal.allPhotos.length) {
                    modal.currentIndex = 0;
                } else if (modal.currentIndex < 0) {
                    modal.currentIndex = modal.allPhotos.length - 1;
                }
                
                const photo = modal.allPhotos[modal.currentIndex];
                const img = document.getElementById('modalPhoto');
                const counter = document.getElementById('photoCounter');
                const title = modal.querySelector('.photo-modal-title h3');
                const date = modal.querySelector('.photo-modal-date');
                const deleteBtn = modal.querySelector('.delete-photo-btn-modal');
                
                if (img) img.src = photo.src;
                if (counter) counter.textContent = `${modal.currentIndex + 1} / ${modal.allPhotos.length}`;
                if (title) title.textContent = photo.label;
                if (date) date.textContent = photo.date;
                
                if (deleteBtn) {
                    deleteBtn.setAttribute('onclick', `deletePhoto(${photo.id}, '${photo.type}')`);
                }
            };
            
            // Função para fechar modal
            window.closePhotoModal = function() {
                const modal = document.getElementById('photoModal');
                if (modal) {
                    modal.remove();
                    document.body.style.overflow = 'auto';
                }
            };
            
            // Função para deletar foto
            window.deletePhoto = async function(measurementId, photoType) {
                if (!confirm('Tem certeza que deseja remover esta foto?')) {
                    return;
                }
                
                try {
                    const response = await authenticatedFetch(`${BASE_URL}/api/delete_measurement_photo.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            measurement_id: measurementId,
                            photo_type: photoType
                        })
                    });
                    
                    if (!response) return;
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showAlert(result.message || 'Foto removida com sucesso!', 'success');
                        closePhotoModal();
                        await loadPageData();
                    } else {
                        showAlert(result.message || 'Erro ao remover foto.', 'error');
                    }
                } catch (error) {
                    console.error('Erro ao deletar foto:', error);
                    showAlert('Erro ao remover foto. Tente novamente.', 'error');
                }
            };
            
            // Fechar modal com ESC
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closePhotoModal();
                }
            });
            
            // Fechar modal clicando fora
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('photo-modal')) {
                    closePhotoModal();
                }
            });
            
            // Aguardar DOM estar pronto antes de inicializar
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    // Inicializar formulário imediatamente
                    initializeForm();
                    // Carregar dados
                    loadPageData();
                });
            } else {
                // DOM já está pronto
                initializeForm();
                // Carregar dados
                loadPageData();
            }
        })();
    
})();
