
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 * Scanner de código de barras usando @capacitor-mlkit/barcode-scanning
 * Baseado no padrão do add_food_logic.js que funciona corretamente
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
         * Inicializar scanner usando MLKit Barcode Scanner
         * Baseado no padrão do add_food_logic.js que funciona corretamente
         */
        async function initializeMLKitScanner() {
            try {
                // Verificar se está em app nativo (Capacitor)
                const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
                
                if (!isNative) {
                    const scannerContainer = document.querySelector('.scanner-container');
                    if (scannerContainer) {
                        scannerContainer.style.display = '';
                        scannerContainer.style.opacity = '1';
                        scannerContainer.style.visibility = 'visible';
                    }
                    showCameraError('Scanner de código de barras disponível apenas no app mobile (iOS/Android).');
                    if (window.PageLoader) {
                        window.PageLoader.ready();
                    }
                    return;
                }
                
                // ✅ USAR EXATAMENTE O MESMO PADRÃO DO add_food_logic.js
                if (!window.Capacitor || !window.Capacitor.isNativePlatform() || !window.Capacitor.Plugins.BarcodeScanner) {
                    console.error('[Scanner] BarcodeScanner plugin não encontrado!');
                    showCameraError('Scanner não disponível. Verifique se o plugin @capacitor-mlkit/barcode-scanning está instalado e sincronizado.');
                    
                    const scannerContainer = document.querySelector('.scanner-container');
                    if (scannerContainer) {
                        scannerContainer.style.display = '';
                        scannerContainer.style.opacity = '1';
                        scannerContainer.style.visibility = 'visible';
                    }
                    
                    if (window.PageLoader) {
                        window.PageLoader.ready();
                    }
                    return;
                }
                
                const { BarcodeScanner } = window.Capacitor.Plugins;
                const { Camera } = window.Capacitor.Plugins;
                
                // Mostrar conteúdo
                const scannerContainer = document.querySelector('.scanner-container');
                if (scannerContainer) {
                    scannerContainer.style.display = '';
                    scannerContainer.style.opacity = '1';
                    scannerContainer.style.visibility = 'visible';
                }
                
                // Mostrar estado inicial
                const container = document.getElementById('camera-container');
                if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px 20px; color: var(--text-primary);">
                            <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                            <p style="margin: 0; color: var(--text-secondary);">Preparando câmera...</p>
                        </div>
                    `;
                }
                
                // ✅ ABRIR SCANNER DIRETAMENTE (MLKit solicita permissão automaticamente)
                // O MLKit Barcode Scanner solicita permissão de câmera automaticamente
                // quando startScan() é chamado, então não precisamos solicitar antes
                try {
                    // Aguardar um pouco para garantir que tudo está pronto
                    setTimeout(async () => {
                        await startBarcodeScan(BarcodeScanner);
                    }, 100);
                    
                } catch (error) {
                    console.error('[Scanner] Erro ao iniciar scanner:', error);
                    showCameraError('Erro ao abrir câmera. Tente novamente.');
                    
                    if (container) {
                        container.style.display = '';
                    }
                }
                
                // Página pronta
                if (window.PageLoader) {
                    window.PageLoader.ready();
                }
                
            } catch (error) {
                console.error('[Scanner] Erro ao inicializar:', error);
                showCameraError('Erro ao inicializar scanner. Tente novamente.');
                
                const scannerContainer = document.querySelector('.scanner-container');
                if (scannerContainer) {
                    scannerContainer.style.display = '';
                    scannerContainer.style.opacity = '1';
                    scannerContainer.style.visibility = 'visible';
                }
                
                if (window.PageLoader) {
                    window.PageLoader.ready();
                }
            }
        }
        
        /**
         * Iniciar scan de código de barras
         * Baseado no padrão do add_food_logic.js
         */
        async function startBarcodeScan(BarcodeScanner) {
            try {
                console.log('[Scanner] Iniciando scan...');
                
                // ✅ USAR EXATAMENTE O MESMO PADRÃO DO add_food_logic.js
                const result = await BarcodeScanner.startScan();
                
                console.log('[Scanner] Resultado do scan:', result);
                console.log('[Scanner] Tipo do resultado:', typeof result);
                
                // ✅ VERIFICAR RESULTADO (mesmo padrão do add_food_logic.js)
                let barcode = null;
                
                if (!result) {
                    console.log('[Scanner] Resultado vazio ou undefined');
                } else if (result && result.hasContent && result.content) {
                    barcode = String(result.content).trim();
                    console.log('[Scanner] Código detectado (hasContent):', barcode);
                } else if (result && result.content) {
                    barcode = String(result.content).trim();
                    console.log('[Scanner] Código detectado (content):', barcode);
                } else if (result && result.barcodes && Array.isArray(result.barcodes) && result.barcodes.length > 0) {
                    barcode = String(result.barcodes[0].rawValue || result.barcodes[0].displayValue || '').trim();
                    console.log('[Scanner] Código detectado (barcodes):', barcode);
                } else if (result && result.barcode) {
                    barcode = String(result.barcode).trim();
                    console.log('[Scanner] Código detectado (barcode):', barcode);
                } else {
                    console.log('[Scanner] Resultado não contém código de barras válido');
                }
                
                if (barcode) {
                    // Código escaneado com sucesso!
                    console.log('[Scanner] Processando código:', barcode);
                    await searchBarcode(barcode);
                } else {
                    // Scan cancelado ou sem resultado - reabrir câmera automaticamente
                    console.log('[Scanner] Scan cancelado ou sem resultado - reabrindo câmera...');
                    // Reabrir câmera automaticamente após um breve delay
                    setTimeout(async () => {
                        await startBarcodeScan(BarcodeScanner);
                    }, 500);
                }
                
            } catch (error) {
                console.error('[Scanner] Erro ao fazer scan:', error);
                
                const errorMessage = error.message || error.toString() || '';
                const errorLower = errorMessage.toLowerCase();
                
                if (errorLower.includes('permission') || errorLower.includes('denied')) {
                    showCameraError('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do app.');
                } else if (errorLower.includes('cancel') || errorLower.includes('cancelled')) {
                    // Usuário cancelou - reabrir câmera automaticamente
                    console.log('[Scanner] Scan cancelado - reabrindo câmera...');
                    setTimeout(async () => {
                        if (window.Capacitor?.Plugins?.BarcodeScanner) {
                            const { BarcodeScanner: Scanner } = window.Capacitor.Plugins;
                            await startBarcodeScan(Scanner);
                        }
                    }, 500);
                } else {
                    // Outro erro - tentar reabrir após mostrar erro brevemente
                    showCameraError(`Erro ao escanear. Tentando novamente...`);
                    setTimeout(async () => {
                        if (window.Capacitor?.Plugins?.BarcodeScanner) {
                            const { BarcodeScanner: Scanner } = window.Capacitor.Plugins;
                            await startBarcodeScan(Scanner);
                        }
                    }, 2000);
                }
            }
        }
        
        /**
         * Reabrir scanner automaticamente (sem mostrar botão)
         * A câmera fica sempre aberta esperando código
         */
        async function reopenScanner() {
            if (!window.Capacitor?.Plugins?.BarcodeScanner) {
                showCameraError('Scanner não disponível.');
                return;
            }
            
            const container = document.getElementById('camera-container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-primary);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                        <p style="margin: 0; color: var(--text-secondary);">Abrindo câmera...</p>
                    </div>
                `;
            }
            
            const { BarcodeScanner } = window.Capacitor.Plugins;
            
            try {
                await startBarcodeScan(BarcodeScanner);
            } catch (error) {
                console.error('[Scanner] Erro ao reabrir scanner:', error);
                // Tentar novamente após delay
                setTimeout(() => reopenScanner(), 1000);
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
            if (!barcode || typeof barcode !== 'string') {
                console.error('[Scanner] Código de barras inválido:', barcode);
                return;
            }
            
            // Mostrar loading
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('active');
            }
            
            try {
                const baseUrl = window.BASE_APP_URL || '';
                if (!baseUrl) {
                    throw new Error('BASE_APP_URL não está definido');
                }
                
                const response = await authenticatedFetch(`${baseUrl}/api/lookup_barcode.php?barcode=${encodeURIComponent(barcode)}`);
                if (!response || !response.ok) {
                    throw new Error(`Erro na resposta: ${response?.status || 'desconhecido'}`);
                }
                
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
                console.error('[Scanner] Erro ao buscar produto:', error);
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('active');
                }
                // Mostrar modal mesmo em caso de erro para permitir cadastro manual
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
