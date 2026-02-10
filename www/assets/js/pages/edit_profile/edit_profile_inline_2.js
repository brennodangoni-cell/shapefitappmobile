
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
        // Verificar se estamos na página de edit_profile
        const isEditProfilePage = document.querySelector('.ep-container') || document.querySelector('.edit-profile-container');
        if (!isEditProfilePage) {
            return;
        }
        
        // Evitar execução duplicada na mesma navegação
        if (window._editProfileLoaded) {
            return;
        }
        window._editProfileLoaded = true;

        let profileData = null;
        let selectedRestrictions = [];
        
        function updateExercisesDisplay(exerciseType) {
            const displayEl = document.getElementById('exercises-display');
            const exerciseTypeInput = document.getElementById('exercise_type');
            
            // Se os elementos não existem, estamos em outra página - sair silenciosamente
            if (!displayEl || !exerciseTypeInput) return;
            
            if (exerciseType && exerciseType !== '0' && exerciseType.trim() !== '') {
                const exercises = exerciseType.split(',').map(e => e.trim()).filter(e => e);
                if (exercises.length === 0) {
                    displayEl.textContent = 'Nenhum exercício selecionado';
                } else if (exercises.length === 1) {
                    displayEl.textContent = exercises[0];
                } else {
                    displayEl.textContent = `${exercises.length} exercícios selecionados`;
                }
                exerciseTypeInput.value = exerciseType;
            } else {
                displayEl.textContent = 'Nenhum exercício selecionado';
                exerciseTypeInput.value = '';
            }
        }
        
        async function loadProfileData() {
            // Verificar se ainda estamos na página de edit_profile antes de fazer qualquer coisa
            const isStillOnPage = document.querySelector('.ep-container') || document.querySelector('.edit-profile-container');
            if (!isStillOnPage) {
                return;
            }
            
            try {
                // Mostrar estado de carregamento
                const fullNameInput = document.getElementById('full_name');
                const emailDisplay = document.getElementById('email-display');
                
                if (fullNameInput && !fullNameInput.value) {
                    fullNameInput.placeholder = 'Carregando...';
                }
                if (emailDisplay) {
                    emailDisplay.textContent = 'Carregando...';
                }
                
                const response = await authenticatedFetch(`${window.API_BASE_URL}/get_edit_profile_data.php`);
                
                if (!response) return;
                
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
                
                profileData = result.data;
                
                // Preencher formulário de uma vez para evitar "piscadas"
                // Usar requestAnimationFrame para garantir renderização suave
                requestAnimationFrame(() => {
                    if (fullNameInput) {
                        fullNameInput.value = profileData.profile.name || '';
                        fullNameInput.placeholder = '';
                    }
                    if (emailDisplay) {
                        emailDisplay.textContent = profileData.profile.email || 'N/A';
                    }
                });
                
                // Preencher campos com verificação null
                const dobEl = document.getElementById('dob');
                const genderEl = document.getElementById('gender');
                const heightEl = document.getElementById('height_cm');
                const weightEl = document.getElementById('weight_kg');
                const objectiveEl = document.getElementById('objective');
                const freqEl = document.getElementById('exercise_frequency');
                
                if (dobEl) dobEl.value = profileData.profile.dob || '';
                if (genderEl) genderEl.value = profileData.profile.gender || '';
                if (heightEl) heightEl.value = profileData.profile.height_cm || '';
                if (weightEl) weightEl.value = profileData.profile.weight_kg || '';
                if (objectiveEl) objectiveEl.value = profileData.profile.objective || '';
                if (freqEl) freqEl.value = profileData.profile.exercise_frequency || 'sedentary';
                
                // Exercícios - atualizar display
                const exerciseType = profileData.profile.exercise_type || '';
                updateExercisesDisplay(exerciseType);
                
                // Foto de perfil
                const profilePhotoDisplay = document.getElementById('profile-photo-display');
                const photoWrapper = document.querySelector('.ep-photo-wrapper');
                if (profileData.profile_image_url) {
                    // Criar imagem
                    const img = document.createElement('img');
                    img.id = 'profile-photo-display';
                    img.src = profileData.profile_image_url + '?t=' + Date.now(); // Adicionar timestamp para evitar cache
                    img.alt = 'Foto de Perfil';
                    img.className = 'ep-photo profile-photo';
                    img.style.cursor = 'pointer';
                    img.onerror = function() {
                        // Se a imagem falhar, mostrar placeholder
                        const placeholder = document.createElement('div');
                        placeholder.id = 'profile-photo-display';
                        placeholder.className = 'ep-photo-placeholder profile-photo profile-icon-placeholder';
                        placeholder.innerHTML = '<i class="fas fa-user"></i>';
                        placeholder.style.cursor = 'pointer';
                        if (photoWrapper) photoWrapper.replaceChild(placeholder, img);
                        const removeBtn = document.getElementById('remove-photo-btn');
                        if (removeBtn) removeBtn.style.display = 'none';
                    };
                    // Substituir placeholder pela imagem
                    if (profilePhotoDisplay && photoWrapper) {
                        photoWrapper.replaceChild(img, profilePhotoDisplay);
                    } else if (photoWrapper) {
                        photoWrapper.appendChild(img);
                    }
                    // Não precisa adicionar evento de click - o wrapper já cuida disso (delegação de eventos)
                    const removePhotoBtn = document.getElementById('remove-photo-btn');
                    if (removePhotoBtn) removePhotoBtn.style.display = 'inline-flex';
                } else {
                    // Se não tem foto, garantir que o placeholder está clicável
                    if (profilePhotoDisplay) {
                        profilePhotoDisplay.style.cursor = 'pointer';
                    }
                }
                
                // Lógica de peso
                if (!profileData.can_edit_weight) {
                    const weightInput = document.getElementById('weight_kg');
                    const lockTextEl = document.getElementById('weight-lock-text');
                    const lockInfoEl = document.getElementById('weight-lock-info');
                    
                    if (weightInput) {
                        weightInput.readOnly = true;
                        weightInput.classList.add('ep-input-readonly');
                    }
                    if (lockTextEl) {
                        const lockText = `Você só pode ajustar o peso a cada 7 dias. Próximo ajuste em <strong>${profileData.days_until_next_weight_update}</strong> ${profileData.days_until_next_weight_update === 1 ? 'dia' : 'dias'}.`;
                        lockTextEl.innerHTML = lockText;
                    }
                    if (lockInfoEl) {
                        lockInfoEl.style.display = 'flex';
                    }
                }
                
                // Restrições
                selectedRestrictions = profileData.user_selected_restrictions || [];
                renderRestrictionsModal();
                updateRestrictionsCount();
                
                // ✅ PÁGINA PRONTA - Remover skeleton
                if (window.PageLoader) window.PageLoader.ready();
                
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
                showStatus('Erro ao carregar dados do perfil.', false);
                // ✅ Mesmo com erro, remover skeleton
                if (window.PageLoader) window.PageLoader.ready();
            }
        }
        
        function renderRestrictionsModal() {
            const grid = document.getElementById('modal-restrictions-grid');
            if (!grid || !profileData || !profileData.all_restrictions) return;
            
            grid.innerHTML = '';
            
            profileData.all_restrictions.forEach(restriction => {
                const item = document.createElement('div');
                item.className = 'restriction-item';
                
                const isChecked = selectedRestrictions.includes(restriction.id);
                
                item.innerHTML = `
                    <label class="custom-checkbox">
                        <input type="checkbox" value="${restriction.id}" ${isChecked ? 'checked' : ''}>
                        <span class="checkbox-label">${escapeHtml(restriction.name)}</span>
                    </label>
                `;
                
                grid.appendChild(item);
            });
        }
        
        function updateRestrictionsCount() {
            const countEl = document.getElementById('restrictions-selected-count');
            const hiddenEl = document.getElementById('restrictions-hidden');
            if (!countEl || !hiddenEl) return;
            
            const count = selectedRestrictions.length;
            if (count === 0) {
                countEl.textContent = 'Nenhuma restrição';
            } else if (count === 1) {
                countEl.textContent = '1 restrição selecionada';
            } else {
                countEl.textContent = `${count} restrições selecionadas`;
            }
            hiddenEl.value = JSON.stringify(selectedRestrictions);
        }
        
        function showStatus(message, isSuccess) {
            const statusEl = document.getElementById('upload-status');
            if (!statusEl) {
                return;
            }
            statusEl.textContent = message;
            statusEl.className = `ep-status ${isSuccess ? 'ep-status-success' : 'ep-status-error'}`;
            statusEl.style.display = 'block';
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // ✅ Mover modais para fora do page-root para funcionar corretamente com position: fixed
        function moveModalsToBody() {
            const modals = [
                document.getElementById('crop-modal'),
                document.getElementById('restrictions-modal'),
                document.getElementById('confirm-delete-account-modal')
            ];
            modals.forEach(modal => {
                if (modal && modal.parentElement && modal.parentElement.classList.contains('page-root')) {
                    document.body.appendChild(modal);
                }
            });
        }
        
        // Função principal de inicialização
        async function initEditProfile() {
            // ✅ Mover modais para body primeiro
            moveModalsToBody();
            
            // Verificar se elementos existem
            if (!document.getElementById('edit-profile-form')) {
                return;
            }
            
            // Aguardar auth.js estar carregado
            if (typeof requireAuth !== 'function' || typeof authenticatedFetch !== 'function') {
                setTimeout(initEditProfile, 100);
                return;
            }
            
            // Adicionar classe de loading para evitar "piscadas"
            document.body.classList.add('profile-loading');
            
            const authenticated = await requireAuth();
            if (!authenticated) {
                document.body.classList.remove('profile-loading');
                return;
            }
            
            await loadProfileData();
            
            // Remover classe de loading após carregar
            document.body.classList.remove('profile-loading');
            document.body.classList.add('profile-loaded');
            
            // Recarregar dados quando a página voltar ao foco (após editar exercícios)
            // Usar uma flag para evitar múltiplas chamadas simultâneas
            let isLoadingData = false;
            window.addEventListener('focus', () => {
                if (!isLoadingData) {
                    isLoadingData = true;
                    loadProfileData().finally(() => {
                        isLoadingData = false;
                    });
                }
            });
            
            // Foto de perfil - evento de click
            const photoWrapper = document.querySelector('.ep-photo-wrapper');
            const photoInput = document.getElementById('profile-photo-input');
            
            // Variáveis para o crop
            let currentImageFile = null;
            let isDragging = false;
            let isZooming = false;
            let startX = 0;
            let startY = 0;
            let currentX = 0;
            let currentY = 0;
            let currentScale = 1;
            let lastDistance = 0;
            let isModalOpen = false; // Flag para evitar cliques enquanto modal está aberto
            let isProcessingFile = false; // Flag para evitar processamento simultâneo
            
            // Adicionar evento de click no wrapper (delegação de eventos)
            // Isso evita duplicidade de eventos e funciona mesmo quando a imagem muda
            photoWrapper.addEventListener('click', function(e) {
                // Se o modal está aberto ou está processando, não permitir clicar no input
                if (isModalOpen || isProcessingFile) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                
                // Verifica se clicou no wrapper OU em qualquer coisa dentro dele que seja a foto/ícone
                if (e.target === photoWrapper || e.target.closest('.ep-photo-wrapper')) {
                    photoInput.click();
                }
            });
            
            photoInput.addEventListener('change', function(e) {
                // Se já está processando ou modal está aberto, ignorar completamente
                if (isProcessingFile || isModalOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.value = ''; // Resetar imediatamente
                    return;
                }
                
                const file = e.target.files[0];
                if (!file) {
                    this.value = '';
                    return;
                }
                
                isProcessingFile = true; // Marcar como processando
                currentImageFile = file;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    isModalOpen = true; // Marcar modal como aberto
                    isProcessingFile = false; // Liberar flag
                    openCropModal(e.target.result);
                };
                reader.onerror = function() {
                    console.error('Erro ao ler arquivo');
                    isProcessingFile = false;
                    isModalOpen = false;
                    photoInput.value = '';
                };
                reader.readAsDataURL(file);
            });
            
            // Abrir modal de crop (versão simplificada - CSS cuida do blur)
            function openCropModal(imageSrc) {
                const modal = document.getElementById('crop-modal');
                const cropImage = document.getElementById('crop-image');
                const cropBackground = document.getElementById('crop-background');
                
                // Configurar imagem de fundo (Blur via CSS agora funciona no iOS)
                cropBackground.src = imageSrc;
                cropBackground.style.display = 'block';
                
                // Configurar imagem principal (Frente)
                cropImage.src = imageSrc;
                cropImage.style.zIndex = '10';
                
                modal.classList.add('visible');
                // ✅ Bloquear scroll do body quando modal está aberto
                document.body.classList.add('ep-modal-open');
                document.body.style.overflow = 'hidden';
                
                // Quando a imagem carregar, calcular o zoom inicial e centralizar
                cropImage.onload = () => {
                    const cropCircleDiameter = 200;
                    const minImageDim = Math.min(cropImage.naturalWidth, cropImage.naturalHeight);
                    
                    // Calcular escala inicial
                    let initialScale = 1;
                    if (minImageDim > cropCircleDiameter) {
                        initialScale = cropCircleDiameter / minImageDim;
                    }
                    // Um pouco de zoom extra inicial fica mais bonito
                    currentScale = initialScale * 1.1;
                    
                    // Centralizar a imagem: como o CSS já centraliza via transform: translate(-50%, -50%),
                    // precisamos apenas resetar os offsets para 0 para que a imagem fique centralizada
                    currentX = 0;
                    currentY = 0;
                    
                    updateImageTransform();
                };
            }
            
            // Fechar modal de crop
            function closeCropModal(resetInput = true) {
                const modal = document.getElementById('crop-modal');
                const cropBackground = document.getElementById('crop-background');
                modal.classList.remove('visible');
                // ✅ Restaurar scroll do body quando modal fecha
                document.body.classList.remove('ep-modal-open');
                document.body.style.overflow = '';
                isModalOpen = false; // Marcar modal como fechado
                isProcessingFile = false; // Liberar flag de processamento
                // Resetar elementos
                if (cropBackground) {
                    cropBackground.style.display = '';
                }
                // Resetar input apenas se solicitado (quando cancelar, não quando salvar)
                if (resetInput) {
                    // Usar setTimeout para garantir que o modal fechou primeiro
                    setTimeout(() => {
                        photoInput.value = '';
                    }, 200);
                }
            }
            
            // Atualizar transformação da imagem na tela
            function updateImageTransform() {
                const cropImage = document.getElementById('crop-image');
                cropImage.style.transform = `translate(-50%, -50%) translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
            }
            
            // Calcular distância entre dois toques (para zoom)
            function getDistance(touch1, touch2) {
                const dx = touch1.clientX - touch2.clientX;
                const dy = touch1.clientY - touch2.clientY;
                return Math.sqrt(dx * dx + dy * dy);
            }
            
            // Event listeners para mouse (desktop)
            const cropImageEl = document.getElementById('crop-image');
            cropImageEl.addEventListener('mousedown', function(e) {
                e.preventDefault();
                isDragging = true;
                startX = e.clientX - currentX;
                startY = e.clientY - currentY;
            });
            
            document.addEventListener('mousemove', function(e) {
                // Só bloquear se estiver no modal de crop
                const cropModal = document.getElementById('crop-modal');
                if (!cropModal || !cropModal.classList.contains('visible')) return;
                if (!isDragging) return;
                e.preventDefault();
                currentX = e.clientX - startX;
                currentY = e.clientY - startY;
                updateImageTransform();
            });
            
            document.addEventListener('mouseup', () => { isDragging = false; });
            document.addEventListener('mouseleave', () => { isDragging = false; });
            
            // Event listeners para touch (mobile)
            cropImageEl.addEventListener('touchstart', function(e) {
                e.preventDefault();
                if (e.touches.length === 1) {
                    isDragging = true;
                    isZooming = false;
                    const touch = e.touches[0];
                    startX = touch.clientX - currentX;
                    startY = touch.clientY - currentY;
                } else if (e.touches.length === 2) {
                    isDragging = false;
                    isZooming = true;
                    lastDistance = getDistance(e.touches[0], e.touches[1]);
                }
            }, { passive: false });
            
            document.addEventListener('touchmove', function(e) {
                // Só bloquear se estiver no modal de crop
                const cropModal = document.getElementById('crop-modal');
                if (!cropModal || !cropModal.classList.contains('visible')) return;
                if (!isDragging && !isZooming) return;
                e.preventDefault();
                
                if (e.touches.length === 1 && isDragging) {
                    const touch = e.touches[0];
                    currentX = touch.clientX - startX;
                    currentY = touch.clientY - startY;
                    updateImageTransform();
                } else if (e.touches.length === 2 && isZooming) {
                    const distance = getDistance(e.touches[0], e.touches[1]);
                    const scaleChange = distance / lastDistance;
                    currentScale = Math.max(0.2, Math.min(5, currentScale * scaleChange));
                    lastDistance = distance;
                    updateImageTransform();
                }
            }, { passive: false });
            
            document.addEventListener('touchend', function(e) {
                if (e.touches.length === 0) {
                    isDragging = false;
                    isZooming = false;
                } else if (e.touches.length === 1) {
                    isZooming = false;
                    isDragging = true;
                    const touch = e.touches[0];
                    startX = touch.clientX - currentX;
                    startY = touch.clientY - currentY;
                }
            });
            
            // Event listeners dos botões do modal
            document.getElementById('close-crop-modal').addEventListener('click', closeCropModal);
            document.getElementById('cancel-crop').addEventListener('click', closeCropModal);
            
            // Salvar crop - Solução Definitiva: Blur por Superimposição (Funciona liso no iOS)
            document.getElementById('save-crop').addEventListener('click', function() {
                const cropImage = document.getElementById('crop-image');
                
                if (!currentImageFile || !cropImage.complete || cropImage.naturalWidth === 0) return;

                // Configurações
                const cropCircleDiameter = 200;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = cropCircleDiameter;
                canvas.height = cropCircleDiameter;

                // Cálculos de proporção (Cover)
                const hRatio = canvas.width / cropImage.naturalWidth;
                const vRatio = canvas.height / cropImage.naturalHeight;
                const ratio = Math.max(hRatio, vRatio);
                const centerShift_x = (canvas.width - cropImage.naturalWidth * ratio) / 2;
                const centerShift_y = (canvas.height - cropImage.naturalHeight * ratio) / 2;

                // --- 1. FUNDO "VIDRO FOSCO" (Técnica de Superimposição) ---
                // Essa técnica desenha a imagem várias vezes com leve deslocamento
                // É a única forma de fazer blur de alta qualidade no Canvas do iOS sem bibliotecas pesadas
                
                const blurRadius = 15; // Força do Blur (igual WhatsApp)
                const iterations = 30; // Qualidade (quanto maior, mais liso, mas mais lento)
                
                ctx.save();
                // Desenhar a base escura primeiro (fundo preto)
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Configurar transparência para as camadas
                ctx.globalAlpha = 1 / (iterations / 2); // Ajuste de opacidade
                
                // Loop mágico do Blur
                for (let i = -iterations; i <= iterations; i += 2) {
                    for (let j = -iterations; j <= iterations; j += 2) {
                        // Só desenha se estiver dentro de um círculo aleatório (para evitar marcas quadradas)
                        if (Math.random() > 0.8) { 
                            const xOff = (Math.random() - 0.5) * blurRadius * 2;
                            const yOff = (Math.random() - 0.5) * blurRadius * 2;
                            
                            ctx.drawImage(
                                cropImage, 
                                centerShift_x + xOff, 
                                centerShift_y + yOff, 
                                cropImage.naturalWidth * ratio * 1.05, // Escala um pouco maior para evitar bordas
                                cropImage.naturalHeight * ratio * 1.05
                            );
                        }
                    }
                }
                ctx.restore();

                // --- 2. ESCURECIMENTO (Igual WhatsApp) ---
                // WhatsApp usa um overlay bem escuro no fundo
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; 
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // --- 3. FOTO DE PERFIL NÍTIDA (CORTE CIRCULAR) ---
                const sourceCropSize = cropCircleDiameter / currentScale;
                const sourceCenterX = cropImage.naturalWidth / 2 - (currentX / currentScale);
                const sourceCenterY = cropImage.naturalHeight / 2 - (currentY / currentScale);
                const sx = sourceCenterX - sourceCropSize / 2;
                const sy = sourceCenterY - sourceCropSize / 2;
                
                ctx.save();
                ctx.beginPath();
                ctx.arc(cropCircleDiameter / 2, cropCircleDiameter / 2, cropCircleDiameter / 2, 0, Math.PI * 2, true);
                ctx.clip();
                
                // Qualidade máxima para o rosto
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(
                    cropImage,
                    sx, sy, sourceCropSize, sourceCropSize,
                    0, 0, cropCircleDiameter, cropCircleDiameter
                );
                ctx.restore();

                // --- 4. SALVAR ---
                // (Borda laranja removida - a borda é aplicada via CSS, não na imagem salva)
                canvas.toBlob(function(blob) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const photoDisplay = document.getElementById('profile-photo-display');
                        
                        if (photoDisplay.tagName === 'DIV') {
                            const newImg = document.createElement('img');
                            newImg.id = 'profile-photo-display';
                            newImg.className = 'ep-photo profile-photo';
                            newImg.src = e.target.result;
                            newImg.alt = 'Foto de Perfil';
                            newImg.style.cursor = 'pointer';
                            // Não precisa adicionar evento de click - o wrapper já cuida disso (delegação de eventos)
                            photoDisplay.parentNode.replaceChild(newImg, photoDisplay);
                        } else {
                            photoDisplay.src = e.target.result;
                        }
                        
                        const fileName = currentImageFile ? currentImageFile.name : 'profile_photo.jpg';
                        const croppedFile = new File([blob], fileName, { type: 'image/jpeg' });
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(croppedFile);
                        document.getElementById('profile-photo-input').files = dataTransfer.files;
                        
                        currentImageFile = croppedFile;
                        document.getElementById('remove-photo-btn').style.display = 'inline-flex';
                        
                        // NÃO limpar o input aqui - deixar para limpar apenas após upload bem-sucedido
                        isProcessingFile = false;
                    };
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', 0.95); // Alta qualidade
                
                closeCropModal(false);
            });
            
            // Fechar modal clicando no overlay
            document.getElementById('crop-modal').addEventListener('click', function(e) {
                if (e.target === this) {
                    closeCropModal();
                }
            });
            
            // Remover foto - FUNÇÃO SIMPLIFICADA E ROBUSTA
            const removePhotoBtn = document.getElementById('remove-photo-btn');
            if (removePhotoBtn) {
                // Remover qualquer listener anterior para evitar duplicação
                const newRemoveBtn = removePhotoBtn.cloneNode(true);
                removePhotoBtn.parentNode.replaceChild(newRemoveBtn, removePhotoBtn);
                
                newRemoveBtn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[EditProfile] Botão remover foto clicado');
                    
                    if (!confirm('Tem certeza que deseja remover sua foto de perfil?')) {
                        console.log('[EditProfile] Usuário cancelou remoção');
                        return;
                    }
                    
                    console.log('[EditProfile] Usuário confirmou remoção');
                    const removeBtn = this;
                    const originalText = removeBtn.innerHTML;
                    removeBtn.disabled = true;
                    removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removendo...';
                    
                    // Buscar elementos
                    const photoWrapper = document.querySelector('.ep-photo-wrapper');
                    const photoInput = document.getElementById('profile-photo-input');
                    const currentPhoto = document.getElementById('profile-photo-display');
                    
                    console.log('[EditProfile] Elementos encontrados:', {
                        photoWrapper: !!photoWrapper,
                        photoInput: !!photoInput,
                        currentPhoto: !!currentPhoto
                    });
                    
                    // PRIMEIRO: Atualizar visualmente (sempre funciona)
                    const placeholder = document.createElement('div');
                    placeholder.id = 'profile-photo-display';
                    placeholder.className = 'ep-photo-placeholder profile-photo profile-icon-placeholder';
                    placeholder.innerHTML = '<i class="fas fa-user"></i>';
                    placeholder.style.cursor = 'pointer';
                    
                    if (currentPhoto) {
                        if (currentPhoto.parentNode) {
                            currentPhoto.parentNode.replaceChild(placeholder, currentPhoto);
                            console.log('[EditProfile] Foto substituída visualmente');
                        } else if (photoWrapper) {
                            photoWrapper.appendChild(placeholder);
                            console.log('[EditProfile] Foto adicionada ao wrapper');
                        }
                    } else if (photoWrapper) {
                        photoWrapper.appendChild(placeholder);
                        console.log('[EditProfile] Placeholder adicionado ao wrapper');
                    }
                    
                    // Limpar input e esconder botão
                    if (photoInput) {
                        photoInput.value = '';
                    }
                    removeBtn.style.display = 'none';
                    
                    const removeFlag = document.getElementById('remove-photo-flag');
                    if (removeFlag) {
                        removeFlag.value = '0';
                    }
                    
                    // SEGUNDO: Tentar remover no servidor
                    try {
                        const token = getAuthToken();
                        if (!token) {
                            console.warn('[EditProfile] Token não encontrado');
                            showStatus('Foto removida visualmente. Faça login novamente para persistir.', true);
                            return;
                        }
                        
                        console.log('[EditProfile] Tentando remover foto no servidor...');
                        
                        // Tentar múltiplas APIs
                        let success = false;
                        let errorMessage = '';
                        
                        // Tentativa 1: update_profile.php
                        try {
                            const response = await authenticatedFetch(`${window.API_BASE_URL}/update_profile.php`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ remove_photo: true })
                            });
                            
                            if (response && response.ok) {
                                const result = await response.json();
                                if (result && result.success) {
                                    success = true;
                                    console.log('[EditProfile] Foto removida via update_profile.php');
                                }
                            } else if (response) {
                                errorMessage = `HTTP ${response.status}`;
                            }
                        } catch (err) {
                            console.error('[EditProfile] Erro em update_profile.php:', err);
                            errorMessage = err.message;
                        }
                        
                        // Se não funcionou, tentar remove_profile_photo.php
                        if (!success) {
                            try {
                                const response = await authenticatedFetch(`${window.API_BASE_URL}/remove_profile_photo.php`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ remove: true })
                                });
                                
                                if (response && response.ok) {
                                    const result = await response.json();
                                    if (result && result.success) {
                                        success = true;
                                        console.log('[EditProfile] Foto removida via remove_profile_photo.php');
                                    }
                                }
                            } catch (err) {
                                console.error('[EditProfile] Erro em remove_profile_photo.php:', err);
                            }
                        }
                        
                        // Mostrar resultado
                        if (success) {
                            showStatus('Foto removida com sucesso!', true);
                        } else {
                            console.warn('[EditProfile] Foto removida visualmente, mas não no servidor');
                            showStatus('Foto removida visualmente. Recarregue a página para verificar se persistiu.', true);
                        }
                        
                    } catch (error) {
                        console.error('[EditProfile] Erro geral ao remover foto:', error);
                        showStatus('Foto removida visualmente. Recarregue a página para verificar.', true);
                    } finally {
                        removeBtn.disabled = false;
                        removeBtn.innerHTML = originalText;
                    }
                });
                
                console.log('[EditProfile] Listener de remover foto configurado');
            } else {
                console.error('[EditProfile] Botão remover foto não encontrado!');
            }
            
            // Modal de restrições
            const restrictionsModal = document.getElementById('restrictions-modal');
            
            document.getElementById('open-restrictions-modal').addEventListener('click', () => {
                restrictionsModal.classList.add('visible');
            });
            
            document.getElementById('close-restrictions-modal').addEventListener('click', () => {
                restrictionsModal.classList.remove('visible');
                // ✅ Restaurar scroll do body quando modal fecha
                document.body.classList.remove('ep-modal-open');
                document.body.style.overflow = '';
            });
            
            document.getElementById('cancel-restrictions').addEventListener('click', () => {
                restrictionsModal.classList.remove('visible');
                // ✅ Restaurar scroll do body quando modal fecha
                document.body.classList.remove('ep-modal-open');
                document.body.style.overflow = '';
                renderRestrictionsModal(); // Resetar checkboxes
            });
            
            document.getElementById('save-restrictions').addEventListener('click', () => {
                selectedRestrictions = [];
                document.querySelectorAll('#modal-restrictions-grid input[type="checkbox"]:checked').forEach(checkbox => {
                    selectedRestrictions.push(parseInt(checkbox.value));
                });
                updateRestrictionsCount();
                restrictionsModal.classList.remove('visible');
                // ✅ Restaurar scroll do body quando modal fecha
                document.body.classList.remove('ep-modal-open');
                document.body.style.overflow = '';
            });
            
            // Fechar modal ao clicar fora dele
            restrictionsModal.addEventListener('click', function(e) {
                if (e.target === this) {
                    restrictionsModal.classList.remove('visible');
                    // ✅ Restaurar scroll do body quando modal fecha
                    document.body.classList.remove('ep-modal-open');
                    document.body.style.overflow = '';
                    renderRestrictionsModal(); // Resetar checkboxes
                }
            });
            
            // Submit do formulário
            document.getElementById('edit-profile-form').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const saveBtn = document.getElementById('save-btn');
                const originalText = saveBtn.innerHTML;
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                
                try {
                    // Fazer upload da foto se houver uma nova
                    const photoInput = document.getElementById('profile-photo-input');
                    if (photoInput.files && photoInput.files.length > 0) {
                        const photoFormData = new FormData();
                        photoFormData.append('profile_photo', photoInput.files[0]);
                        
                        // Para FormData, não definir Content-Type (deixa o browser definir automaticamente)
                        const token = getAuthToken();
                        if (!token) {
                            window.location.href = './auth/login.html';
                            return;
                        }
                        
                        const uploadUrl = `${window.API_BASE_URL}/upload_profile_photo.php`;
                        const photoResponse = await fetch(uploadUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            body: photoFormData
                        });
                        // Se receber 401, redirecionar para login
                        if (photoResponse.status === 401) {
                            clearAuthToken();
                            window.location.href = './auth/login.html';
                            return;
                        }
                        
                        if (!photoResponse.ok) {
                            const photoText = await photoResponse.text();
                            console.error('Erro ao fazer upload da foto:', photoResponse.status, photoText);
                            
                            // Se for 404, verificar se o arquivo existe
                            if (photoResponse.status === 404) {
                                throw new Error('API de upload não encontrada. Verifique se o arquivo api/upload_profile_photo.php existe no servidor.');
                            }
                            
                            throw new Error('Erro ao fazer upload da foto');
                        }
                        
                        const photoResult = await photoResponse.json();
                        if (!photoResult.success) {
                            throw new Error(photoResult.message || 'Erro ao fazer upload da foto');
                        }
                        // Atualizar a imagem exibida
                        if (photoResult.image_url) {
                            const currentPhoto = document.getElementById('profile-photo-display');
                            if (currentPhoto) {
                                if (currentPhoto.tagName === 'IMG') {
                                    // Adicionar timestamp para forçar reload
                                    currentPhoto.src = photoResult.image_url + '?t=' + Date.now();
                                } else if (currentPhoto.tagName === 'DIV') {
                                    // Se for um div placeholder, criar uma imagem
                                    const newImg = document.createElement('img');
                                    newImg.id = 'profile-photo-display';
                                    newImg.className = 'ep-photo profile-photo';
                                    newImg.src = photoResult.image_url + '?t=' + Date.now();
                                    newImg.alt = 'Foto de Perfil';
                                    newImg.style.cursor = 'pointer';
                                    // Não precisa adicionar evento de click - o wrapper já cuida disso (delegação de eventos)
                                    currentPhoto.parentNode.replaceChild(newImg, currentPhoto);
                                }
                            }
                            // Resetar flag de remoção se uma nova foto foi enviada
                            const removeFlag = document.getElementById('remove-photo-flag');
                            if (removeFlag) {
                                removeFlag.value = '0';
                            }
                            // Esconder botão de remover se estiver visível
                            const removeBtn = document.getElementById('remove-photo-btn');
                            if (removeBtn) {
                                removeBtn.style.display = 'inline-flex';
                            }
                            
                            // Limpar o input APENAS após upload bem-sucedido
                            setTimeout(() => {
                                document.getElementById('profile-photo-input').value = '';
                            }, 100);
                        }
                    } else {
                    }
                    
                    // Depois, atualizar os dados do perfil
                    const formData = {
                        full_name: document.getElementById('full_name').value,
                        dob: document.getElementById('dob').value,
                        gender: document.getElementById('gender').value,
                        height_cm: parseInt(document.getElementById('height_cm').value),
                        weight_kg: parseFloat(document.getElementById('weight_kg').value),
                        objective: document.getElementById('objective').value,
                        exercise_type: document.getElementById('exercise_type').value,
                        exercise_frequency: document.getElementById('exercise_frequency').value,
                        restrictions: selectedRestrictions
                    };
                    
                    const response = await authenticatedFetch(`${window.API_BASE_URL}/update_profile.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                    
                    if (!response) return;
                    
                    if (!response.ok) {
                        const text = await response.text();
                        console.error('Erro HTTP:', response.status, text);
                        throw new Error(`Erro ao salvar: ${response.status}`);
                    }
                    
                    const text = await response.text();
                    let result;
                    try {
                        result = JSON.parse(text);
                    } catch (parseError) {
                        console.error('Erro ao parsear JSON:', parseError);
                        throw new Error('Resposta inválida do servidor');
                    }
                    
                    if (result.success) {
                        showStatus(result.message || 'Perfil atualizado com sucesso!', true);
                    } else {
                        throw new Error(result.message || 'Erro ao salvar perfil');
                    }
                    
                } catch (error) {
                    console.error('Erro ao salvar perfil:', error);
                    showStatus(error.message || 'Erro ao salvar perfil. Tente novamente.', false);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
            });
        }
        
        // ============================================
        // FUNCIONALIDADE DE DELETAR CONTA
        // ============================================
        function initDeleteAccount() {
            const deleteAccountBtn = document.getElementById('delete-account-btn');
            const deleteModal = document.getElementById('confirm-delete-account-modal');
            const confirmDeleteBtn = document.getElementById('confirm-delete-account-btn');
            const cancelDeleteBtn = document.getElementById('cancel-delete-account-btn');
            
            if (!deleteAccountBtn || !deleteModal) return;
            
            // Abrir modal ao clicar em deletar conta
            deleteAccountBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Bloquear scroll do body
                document.body.classList.add('ep-modal-open');
                deleteModal.classList.add('visible');
            });
            
            // Fechar modal ao clicar em cancelar ou fora
            function closeDeleteModal() {
                document.body.classList.remove('ep-modal-open');
                deleteModal.classList.remove('visible');
            }
            
            if (cancelDeleteBtn) {
                cancelDeleteBtn.addEventListener('click', closeDeleteModal);
            }
            
            // Fechar ao clicar no overlay (fora do modal)
            deleteModal.addEventListener('click', function(e) {
                if (e.target === deleteModal) {
                    closeDeleteModal();
                }
            });
            
            // Confirmar deleção
            if (confirmDeleteBtn) {
                confirmDeleteBtn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const btn = this;
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deletando...';
                    
                    try {
                        console.log('[DeleteAccount] ========== INICIANDO DELEÇÃO ==========');
                        console.log('[DeleteAccount] Iniciando deleção de conta...');
                        
                        // Usar URL relativa para que o interceptador do config.js faça o trabalho
                        const deleteUrl = `${window.API_BASE_URL}/delete_account.php`;
                        const apiUrl = window.API_BASE_URL || 'https://appshapefit.com/api';
                        const fullUrl = `${apiUrl}/delete_account.php`;
                        
                        console.log('[DeleteAccount] URL relativa:', deleteUrl);
                        console.log('[DeleteAccount] URL completa esperada:', fullUrl);
                        console.log('[DeleteAccount] API_BASE_URL configurado:', window.API_BASE_URL);
                        console.log('[DeleteAccount] Token disponível:', !!getAuthToken());
                        
                        if (!getAuthToken()) {
                            throw new Error('Token de autenticação não encontrado. Faça login novamente.');
                        }
                        
                        const requestBody = { confirm: true };
                        console.log('[DeleteAccount] Body da requisição:', requestBody);
                        
                        // Usar authenticatedFetch que já cuida de tudo
                        console.log('[DeleteAccount] Usando authenticatedFetch...');
                        
                        let response;
                        try {
                            // Primeiro, testar se o arquivo existe fazendo uma requisição simples
                            console.log('[DeleteAccount] Testando conectividade...');
                            console.log('[DeleteAccount] Navegador online:', navigator.onLine);
                            
                            response = await authenticatedFetch(deleteUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(requestBody)
                            });
                            
                            console.log('[DeleteAccount] Resposta recebida:', {
                                status: response ? response.status : 'null',
                                statusText: response ? response.statusText : 'null',
                                ok: response ? response.ok : 'null',
                                type: response ? response.type : 'null'
                            });
                            
                            if (!response) {
                                console.error('[DeleteAccount] Resposta é null - pode ser problema de autenticação ou rede');
                                throw new Error('Não foi possível conectar com o servidor. Verifique sua conexão.');
                            }
                            
                        } catch (fetchError) {
                            console.error('[DeleteAccount] ========== ERRO NA REQUISIÇÃO ==========');
                            console.error('[DeleteAccount] Tipo do erro:', fetchError.constructor.name);
                            console.error('[DeleteAccount] Nome do erro:', fetchError.name);
                            console.error('[DeleteAccount] Mensagem:', fetchError.message);
                            console.error('[DeleteAccount] Stack completo:', fetchError.stack);
                            console.error('[DeleteAccount] Navegador online:', navigator.onLine);
                            console.error('[DeleteAccount] URL tentada:', deleteUrl);
                            
                            // Verificar tipo de erro específico
                            let errorMessage = 'Erro ao conectar com o servidor. ';
                            let errorDetails = '';
                            
                            if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
                                errorMessage += '\n\nPossíveis causas:\n';
                                errorMessage += '1. Servidor não está acessível\n';
                                errorMessage += '2. Problema de CORS\n';
                                errorMessage += '3. Arquivo não existe no servidor\n';
                                errorMessage += '4. Erro fatal no PHP antes de retornar resposta\n\n';
                                errorMessage += 'Verifique:\n';
                                errorMessage += '- Se o arquivo existe em: ' + fullUrl + '\n';
                                errorMessage += '- Console do navegador para mais detalhes';
                                errorDetails = 'Failed to fetch - verifique servidor e CORS';
                            } else if (fetchError.message.includes('NetworkError')) {
                                errorMessage += 'Erro de rede. Verifique sua conexão com a internet.';
                                errorDetails = 'NetworkError';
                            } else if (fetchError.message.includes('CORS')) {
                                errorMessage += 'Erro de CORS. O servidor precisa permitir requisições do app.';
                                errorDetails = 'CORS Error';
                            } else {
                                errorMessage += fetchError.message;
                                errorDetails = fetchError.message;
                            }
                            
                            console.error('[DeleteAccount] Detalhes do erro:', errorDetails);
                            console.error('[DeleteAccount] ==========================================');
                            
                            throw new Error(errorMessage);
                        }
                        
                        if (!response) {
                            console.warn('[DeleteAccount] Resposta é null - token pode ser inválido');
                            return;
                        }
                        
                        // Ler o texto da resposta
                        console.log('[DeleteAccount] Lendo resposta do servidor...');
                        let text;
                        try {
                            text = await response.text();
                            console.log('[DeleteAccount] Texto da resposta recebido');
                            console.log('[DeleteAccount] Tamanho da resposta:', text ? text.length : 0);
                            console.log('[DeleteAccount] Primeiros 500 caracteres:', text ? text.substring(0, 500) : 'vazio');
                        } catch (textError) {
                            console.error('[DeleteAccount] Erro ao ler texto da resposta:', textError);
                            throw new Error('Erro ao ler resposta do servidor: ' + textError.message);
                        }
                        
                        if (!text || text.trim() === '') {
                            console.error('[DeleteAccount] Resposta vazia do servidor');
                            throw new Error('Resposta vazia do servidor. Status: ' + response.status);
                        }
                        
                        // Verificar Content-Type
                        const contentType = response.headers.get('content-type');
                        console.log('[DeleteAccount] Content-Type:', contentType);
                        
                        if (!contentType || !contentType.includes('application/json')) {
                            console.error('[DeleteAccount] Resposta não é JSON:', contentType);
                            console.error('[DeleteAccount] Primeiros 500 caracteres:', text.substring(0, 500));
                            
                            // Pode ser um erro PHP não capturado
                            if (text.includes('<') && text.includes('>')) {
                                throw new Error('Erro no servidor (resposta HTML). Verifique os logs do servidor.');
                            }
                            
                            throw new Error('Resposta inválida do servidor. Tipo: ' + contentType);
                        }
                        
                        // Parsear JSON
                        let result;
                        try {
                            result = JSON.parse(text);
                            console.log('[DeleteAccount] JSON parseado com sucesso:', result);
                        } catch (parseError) {
                            console.error('[DeleteAccount] Erro ao parsear JSON:', parseError);
                            console.error('[DeleteAccount] Texto que falhou:', text);
                            throw new Error('Resposta inválida do servidor (JSON inválido). Verifique os logs.');
                        }
                        
                        // Verificar status HTTP
                        if (!response.ok) {
                            console.error('[DeleteAccount] Resposta não OK:', {
                                status: response.status,
                                result: result
                            });
                            
                            const errorMessage = result.message || 
                                result.debug?.error || 
                                'Erro ao deletar conta. Status: ' + response.status;
                            
                            if (result.debug) {
                                console.error('[DeleteAccount] Debug info:', result.debug);
                            }
                            
                            throw new Error(errorMessage);
                        }
                        
                        // Verificar sucesso no resultado
                        if (result.success) {
                            console.log('[DeleteAccount] Conta deletada com sucesso!');
                            
                            // Limpar localStorage
                            localStorage.removeItem('shapefit_auth_token');
                            localStorage.removeItem('shapefitUserToken');
                            localStorage.removeItem('shapefitUserData');
                            
                            // Limpar cache de auth
                            if (window.clearAuthToken) {
                                window.clearAuthToken();
                            }
                            window._authResult = undefined;
                            window._authChecking = false;
                            
                            console.log('[DeleteAccount] Dados locais limpos, mostrando página de sucesso...');
                            
                            // Fechar modal de confirmação primeiro
                            const deleteModal = document.getElementById('confirm-delete-account-modal');
                            if (deleteModal) {
                                document.body.classList.remove('ep-modal-open');
                                deleteModal.classList.remove('visible');
                            }
                            
                            // Navegar para página de sucesso usando router SPA
                            if (window.SPARouter && typeof window.SPARouter.navigate === 'function') {
                                // Navegar para página de sucesso
                                window.SPARouter.navigate('/fragments/account_deleted.html', true);
                            } else {
                                // Fallback: redirecionar direto para sucesso
                                window.location.href = '/fragments/account_deleted.html';
                            }
                        } else {
                            console.error('[DeleteAccount] Resultado indica falha:', result);
                            throw new Error(result.message || 'Erro ao deletar conta.');
                        }
                        
                    } catch (error) {
                        console.error('[DeleteAccount] ERRO GERAL:', error);
                        console.error('[DeleteAccount] Tipo:', error.constructor.name);
                        console.error('[DeleteAccount] Mensagem:', error.message);
                        console.error('[DeleteAccount] Stack:', error.stack);
                        
                        // Mostrar erro mais detalhado
                        let errorMessage = error.message || 'Erro ao deletar conta. Tente novamente.';
                        
                        // Adicionar instruções se for erro de rede
                        if (error.message && error.message.includes('Failed to fetch')) {
                            errorMessage += '\n\nVerifique:\n- Conexão com internet\n- Se o servidor está acessível\n- Logs do console para mais detalhes';
                        }
                        
                        alert(errorMessage);
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            }
        }
        
        // Executar imediatamente (script carregado dinamicamente no SPA)
        initEditProfile();
        
        // Inicializar funcionalidade de deletar conta
        setTimeout(() => {
            initDeleteAccount();
        }, 100);
        
        // ✅ Recarregar dados quando internet volta
        window.addEventListener('reloadPageData', function(e) {
            if (e.detail && e.detail.reason === 'connection-restored') {
                initEditProfile();
            }
        });
    
})();
