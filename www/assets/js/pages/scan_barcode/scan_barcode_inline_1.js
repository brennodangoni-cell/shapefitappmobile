
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 * USA APENAS MLKit Barcode Scanner (sem fallback)
 */
(function() {

        // ✅ Mover modal para fora do page-root para funcionar corretamente com position: fixed
        function moveModalToBody() {
            const modal = document.getElementById('product-not-found-modal');
            if (modal && modal.parentElement && modal.parentElement.classList.contains('page-root')) {
                document.body.appendChild(modal);
                console.log('✅ Modal movido para body');
            }
        }
        
        // Verificar autenticação e inicializar
        async function initPage() {
            try {
                // ✅ Mover modal para body primeiro
                moveModalToBody();
                
                // ✅ ESCONDER CONTEÚDO ATÉ ESTAR PRONTO
                const scannerContainer = document.querySelector('.scanner-container');
                if (scannerContainer) {
                    scannerContainer.style.display = 'none';
                    scannerContainer.style.opacity = '0';
                    scannerContainer.style.visibility = 'hidden';
                }
                
                // Verificar autenticação (com timeout de segurança)
                let authenticated = false;
                if (typeof requireAuth === 'function') {
                    try {
                        authenticated = await Promise.race([
                            requireAuth(),
                            new Promise((resolve) => setTimeout(() => resolve(false), 3000))
                        ]);
                    } catch (authError) {
                        console.error('[Scanner] Erro ao verificar autenticação:', authError);
                        authenticated = false;
                    }
                } else {
                    // Se não há requireAuth, assumir autenticado
                    authenticated = true;
                }
                
                if (!authenticated) {
                    // ✅ MOSTRAR CONTEÚDO MESMO SEM AUTENTICAÇÃO (pode redirecionar depois)
                    if (scannerContainer) {
                        scannerContainer.style.display = '';
                        scannerContainer.style.opacity = '1';
                        scannerContainer.style.visibility = 'visible';
                    }
                    // ✅ PÁGINA PRONTA - Remover skeleton
                    if (window.PageLoader) {
                        window.PageLoader.ready();
                    }
                    return;
                }
                
                // Configurar input manual
                const manualInput = document.getElementById('manual-barcode-input');
                if (manualInput) {
                    manualInput.addEventListener('click', function() {
                        this.focus();
                    });
                    
                    manualInput.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            searchManualBarcode();
                        }
                    });
                }
                
                // Inicializar scanner MLKit
                await initializeMLKitScanner();
            } catch (error) {
                console.error('[Scanner] Erro na inicialização:', error);
                
                // ✅ MOSTRAR CONTEÚDO MESMO COM ERRO
                const scannerContainer = document.querySelector('.scanner-container');
                if (scannerContainer) {
                    scannerContainer.style.display = '';
                    scannerContainer.style.opacity = '1';
                    scannerContainer.style.visibility = 'visible';
                }
                
                // ✅ PÁGINA PRONTA - Remover skeleton
                if (window.PageLoader) {
                    window.PageLoader.ready();
                }
            }
        }
        
        // Aguardar DOM carregar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initPage);
        } else {
            initPage();
        }

        /**
         * Inicializar scanner usando APENAS MLKit Barcode Scanner
         */
        async function initializeMLKitScanner() {
            try {
                // Verificar se está em app nativo (Capacitor)
                const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
                
                if (!isNative) {
                    // ✅ MOSTRAR CONTEÚDO MESMO EM WEB (para debug/teste)
                    const scannerContainer = document.querySelector('.scanner-container');
                    if (scannerContainer) {
                        scannerContainer.style.display = '';
                        scannerContainer.style.opacity = '1';
                        scannerContainer.style.visibility = 'visible';
                    }
                    showCameraError('Scanner de código de barras disponível apenas no app mobile (iOS/Android).');
                    // ✅ PÁGINA PRONTA - Remover skeleton mesmo em web
                    if (window.PageLoader) {
                        window.PageLoader.ready();
                    }
                    return;
                }
                
                console.log('[Scanner] Inicializando MLKit Barcode Scanner...');
                
                // Verificar se o plugin MLKit está disponível
                // Pode estar em window.Capacitor.Plugins com diferentes nomes
                let MLKitBarcodeScanner = null;
                
                // Tentar diferentes formas de acessar o plugin
                const plugins = window.Capacitor?.Plugins || {};
                console.log('[Scanner] Plugins disponíveis:', Object.keys(plugins));
                
                // Tentar nomes comuns
                MLKitBarcodeScanner = plugins.MLKitBarcodeScanner || 
                                     plugins.MlkitBarcodeScanner || 
                                     plugins['@capacitor-mlkit/barcode-scanning'] ||
                                     plugins.BarcodeScanner;
                
                // Se não encontrou, tentar importar dinamicamente
                if (!MLKitBarcodeScanner) {
                    try {
                        const mlkitModule = await import('@capacitor-mlkit/barcode-scanning');
                        MLKitBarcodeScanner = mlkitModule.MLKitBarcodeScanner || mlkitModule.default;
                        console.log('[Scanner] MLKit importado dinamicamente');
                    } catch (importError) {
                        console.error('[Scanner] Erro ao importar MLKit:', importError);
                    }
                }
                
                if (!MLKitBarcodeScanner) {
                    console.error('[Scanner] MLKit Barcode Scanner plugin não encontrado!');
                    console.error('[Scanner] Todos os plugins:', plugins);
                    showCameraError('Scanner não disponível. Verifique se o plugin @capacitor-mlkit/barcode-scanning está instalado e sincronizado no Appflow.');
                    
                    // ✅ MOSTRAR CONTEÚDO MESMO SEM PLUGIN
                    const scannerContainer = document.querySelector('.scanner-container');
                    if (scannerContainer) {
                        scannerContainer.style.display = '';
                        scannerContainer.style.opacity = '1';
                        scannerContainer.style.visibility = 'visible';
                    }
                    
                    // ✅ PÁGINA PRONTA - Remover skeleton
                    if (window.PageLoader) {
                        window.PageLoader.ready();
                    }
                    return;
                }
                
                console.log('[Scanner] Plugin MLKit encontrado:', MLKitBarcodeScanner);
                
                console.log('[Scanner] Plugin MLKit encontrado');
                
                // Verificar e solicitar permissões usando Camera plugin (MLKit usa as mesmas permissões)
                try {
                    const Camera = window.Capacitor?.Plugins?.Camera;
                    if (Camera) {
                        const permissionResult = await Camera.requestPermissions({ permissions: ['camera'] });
                        console.log('[Scanner] Resultado da permissão:', permissionResult);
                        
                        if (permissionResult.camera !== 'granted' && permissionResult.camera !== 'yes') {
                            const platformName = window.Capacitor.getPlatform() === 'ios' ? 'iOS' : 'Android';
                            showCameraError(`Permissão de câmera negada. Por favor, permita o acesso à câmera nas Configurações > ShapeFit > Câmera.`);
                            
                            // ✅ MOSTRAR CONTEÚDO MESMO SEM PERMISSÃO
                            const scannerContainer = document.querySelector('.scanner-container');
                            if (scannerContainer) {
                                scannerContainer.style.display = '';
                                scannerContainer.style.opacity = '1';
                                scannerContainer.style.visibility = 'visible';
                            }
                            
                            // ✅ PÁGINA PRONTA - Remover skeleton
                            if (window.PageLoader) {
                                window.PageLoader.ready();
                            }
                            return;
                        }
                        console.log('[Scanner] Permissão de câmera concedida');
                    } else {
                        console.warn('[Scanner] Plugin Camera não encontrado, tentando scan sem verificar permissão...');
                    }
                    
                } catch (permError) {
                    console.error('[Scanner] Erro ao verificar/solicitar permissão:', permError);
                    // Continuar mesmo assim - o MLKit pode solicitar permissão automaticamente
                }
                
                // Configurar botão para iniciar scan
                setupScanButton(MLKitBarcodeScanner);
                
                // Mostrar instruções
                const container = document.getElementById('camera-container');
                if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px 20px; color: var(--text-primary);">
                            <i class="fas fa-qrcode" style="font-size: 64px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                            <h3 style="margin: 0 0 12px 0; font-size: 18px;">Pronto para escanear</h3>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">Toque no botão abaixo para abrir a câmera e escanear o código de barras</p>
                            <button id="start-scan-btn" style="margin-top: 24px; padding: 14px 28px; background: var(--accent-orange); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;">
                                <i class="fas fa-camera"></i> Abrir Scanner
                            </button>
                        </div>
                    `;
                }
                
                // ✅ MOSTRAR CONTEÚDO APÓS INICIALIZAR
                const scannerContainer = document.querySelector('.scanner-container');
                if (scannerContainer) {
                    scannerContainer.style.display = '';
                    scannerContainer.style.opacity = '1';
                    scannerContainer.style.visibility = 'visible';
                }
                
                // ✅ PÁGINA PRONTA - Remover skeleton
                if (window.PageLoader) {
                    window.PageLoader.ready();
                }
                
            } catch (error) {
                console.error('[Scanner] Erro ao inicializar:', error);
                showCameraError('Erro ao inicializar scanner. Tente novamente.');
                
                // ✅ MOSTRAR CONTEÚDO MESMO COM ERRO
                const scannerContainer = document.querySelector('.scanner-container');
                if (scannerContainer) {
                    scannerContainer.style.display = '';
                    scannerContainer.style.opacity = '1';
                    scannerContainer.style.visibility = 'visible';
                }
                
                // ✅ Mesmo com erro, remover skeleton
                if (window.PageLoader) {
                    window.PageLoader.ready();
                }
            }
        }
        
        /**
         * Configurar botão para iniciar scan
         */
        function setupScanButton(MLKitBarcodeScanner) {
            // Remover listener anterior se existir
            const existingBtn = document.getElementById('start-scan-btn');
            if (existingBtn) {
                existingBtn.replaceWith(existingBtn.cloneNode(true));
            }
            
            // Adicionar listener ao botão
            setTimeout(() => {
                const scanBtn = document.getElementById('start-scan-btn');
                if (scanBtn) {
                    scanBtn.addEventListener('click', async () => {
                        await startMLKitScan(MLKitBarcodeScanner);
                    });
                }
            }, 100);
        }
        
        /**
         * Iniciar scan com MLKit
         */
        async function startMLKitScan(MLKitBarcodeScanner) {
            try {
                console.log('[Scanner] Iniciando scan...');
                
                // Atualizar UI
                const container = document.getElementById('camera-container');
                if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px 20px; color: var(--text-primary);">
                            <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                            <p style="margin: 0; color: var(--text-secondary);">Abrindo câmera...</p>
                        </div>
                    `;
                }
                
                // Iniciar scan
                // MLKit retorna { barcodes: [{ rawValue, displayValue, format }] }
                const result = await MLKitBarcodeScanner.startScan();
                
                console.log('[Scanner] Resultado do scan:', result);
                
                if (result && result.barcodes && result.barcodes.length > 0) {
                    // Código escaneado com sucesso!
                    const barcode = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
                    console.log('[Scanner] Código detectado:', barcode);
                    
                    // Buscar produto
                    await searchBarcode(barcode);
                } else if (result && result.barcode) {
                    // Formato alternativo de retorno
                    const barcode = result.barcode;
                    console.log('[Scanner] Código detectado (formato alternativo):', barcode);
                    await searchBarcode(barcode);
                } else {
                    // Scan cancelado ou sem resultado
                    console.log('[Scanner] Scan cancelado ou sem resultado');
                    // Restaurar UI
                    initializeMLKitScanner();
                }
                
            } catch (error) {
                console.error('[Scanner] Erro ao fazer scan:', error);
                
                // Se for erro de permissão
                if (error.message && error.message.includes('permission')) {
                    showCameraError('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do app.');
                } else if (error.message && error.message.includes('cancel')) {
                    // Usuário cancelou - restaurar UI
                    initializeMLKitScanner();
                } else {
                    showCameraError('Erro ao escanear código. Tente novamente.');
                    // Restaurar UI após 2 segundos
                    setTimeout(() => {
                        initializeMLKitScanner();
                    }, 2000);
                }
            }
        }

        function showCameraError(message) {
            const container = document.getElementById('camera-container');
            if (container) {
                container.innerHTML = `
                    <div class="camera-error">
                        <i class="fas fa-camera-slash"></i>
                        <h3>Câmera Indisponível</h3>
                        <p>${message}</p>
                    </div>
                `;
            }
        }

        async function searchBarcode(barcode) {
            // Mostrar loading
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('active');
            }
            
            try {
                const response = await authenticatedFetch(`${window.BASE_APP_URL}/api/lookup_barcode.php?barcode=${encodeURIComponent(barcode)}`);
                const data = await response.json();
                
                // Esconder loading
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                
                if (data.success) {
                    // Produto encontrado! Redirecionar para criar/editar
                    const product = data.data;
                    const params = new URLSearchParams({
                        food_name: product.name || '',
                        brand_name: product.brand || '',
                        kcal_100g: product.kcal_100g || '',
                        protein_100g: product.protein_100g || '',
                        carbs_100g: product.carbs_100g || '',
                        fat_100g: product.fat_100g || '',
                        barcode: barcode
                    });
                    
                    if (window.SPARouter && window.SPARouter.navigate) {
                        window.SPARouter.navigate(`/criar-alimento?${params.toString()}`);
                    } else {
                        window.location.href = `create_custom_food.html?${params.toString()}`;
                    }
                } else {
                    // Produto não encontrado - mostrar modal
                    showProductNotFoundModal(barcode);
                }
            } catch (error) {
                console.error('Erro ao buscar produto:', error);
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                showProductNotFoundModal(barcode);
            }
        }

        function searchManualBarcode() {
            const input = document.getElementById('manual-barcode-input');
            const barcode = input.value.trim();
            
            if (!barcode) {
                alert('Por favor, digite um código de barras.');
                return;
            }
            
            if (!/^\d+$/.test(barcode)) {
                alert('Código de barras inválido. Use apenas números.');
                return;
            }
            
            searchBarcode(barcode);
        }

        // Função para mostrar modal de produto não encontrado
        function showProductNotFoundModal(barcode) {
            const modal = document.getElementById('product-not-found-modal');
            const barcodeInput = document.getElementById('manual-barcode-input');
            
            if (!modal) return;
            
            // Preencher o input com o código escaneado
            if (barcodeInput) {
                barcodeInput.value = barcode;
            }
            
            // Armazenar barcode para usar no cadastro manual
            modal.dataset.barcode = barcode;
            
            // Mostrar modal usando classe (padrão do main_app)
            modal.classList.add('visible');
            // ✅ Bloquear scroll do body quando modal está aberto
            document.body.classList.add('scan-modal-open');
            document.body.style.overflow = 'hidden';
        }

        // Função para fechar modal
        function closeProductNotFoundModal() {
            const modal = document.getElementById('product-not-found-modal');
            if (modal) {
                modal.classList.remove('visible');
                // ✅ Restaurar scroll do body quando modal fecha
                document.body.classList.remove('scan-modal-open');
                document.body.style.overflow = '';
            }
        }

        // Função para cadastrar manualmente
        function registerManually() {
            const modal = document.getElementById('product-not-found-modal');
            const barcode = modal?.dataset.barcode || document.getElementById('manual-barcode-input')?.value;
            
            // Preservar parâmetros de data e meal_type
            const urlParams = new URLSearchParams(window.location.search);
            const date = urlParams.get('date');
            const mealType = urlParams.get('meal_type');
            
            const params = new URLSearchParams();
            if (barcode) params.set('barcode', barcode);
            if (date) params.set('date', date);
            if (mealType) params.set('meal_type', mealType);
            
            const queryString = params.toString() ? '?' + params.toString() : '';
            
            if (window.SPARouter && window.SPARouter.navigate) {
                window.SPARouter.navigate('/criar-alimento' + queryString);
            } else {
                window.location.href = 'create_custom_food.html' + queryString;
            }
        }
        
        // Expor funções globalmente para onclick no HTML
        window.searchManualBarcode = searchManualBarcode;
        window.closeProductNotFoundModal = closeProductNotFoundModal;
        window.registerManually = registerManually;
    
})();
