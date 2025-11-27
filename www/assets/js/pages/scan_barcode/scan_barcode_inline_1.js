
/**
 * Scanner de código de barras - VERSÃO ZXing (biblioteca web pura)
 * Funciona sem plugins nativos - igual ao projeto antigo
 */
(function() {

    let codeReader = null;
    let selectedDeviceId = null;
    let scanning = false;

    function moveModalToBody() {
        const modal = document.getElementById('product-not-found-modal');
        if (modal && modal.parentElement && modal.parentElement.classList.contains('page-root')) {
            document.body.appendChild(modal);
        }
    }
    
    async function initPage() {
        try {
            moveModalToBody();
            
            const scannerContainer = document.querySelector('.scanner-container');
            if (scannerContainer) {
                scannerContainer.style.display = '';
                scannerContainer.style.opacity = '1';
                scannerContainer.style.visibility = 'visible';
            }
            
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
            
            // Inicializar scanner imediatamente (sem delay)
            initializeScanner();
            
            // Marcar página como pronta após iniciar scanner
            if (window.PageLoader) {
                window.PageLoader.ready();
            }
            
        } catch (error) {
            showCameraError('Erro ao inicializar scanner.');
            if (window.PageLoader) {
                window.PageLoader.ready();
            }
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }

    /**
     * Inicializar scanner ZXing (biblioteca web pura) - OTIMIZADO
     */
    async function initializeScanner() {
        try {
            // Se ZXing já está carregado, iniciar imediatamente
            if (typeof ZXing !== 'undefined') {
                await initZXing();
                return;
            }
            
            // Se não está carregado, aguardar um pouco (script está no HTML)
            // Verificar periodicamente se já carregou
            let attempts = 0;
            const maxAttempts = 20; // 2 segundos máximo
            
            const checkZXing = setInterval(() => {
                attempts++;
                
                if (typeof ZXing !== 'undefined') {
                    clearInterval(checkZXing);
                    initZXing();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkZXing);
                    showCameraError('Erro ao carregar biblioteca de scanner.');
                }
            }, 100);
            
        } catch (err) {
            showCameraError('Erro ao inicializar scanner: ' + err.message);
        }
    }

    async function initZXing() {
        try {
            codeReader = new ZXing.BrowserMultiFormatReader();
            
            // Solicitar permissão e obter câmera traseira
            const videoInputDevices = await codeReader.listVideoInputDevices();
            
            if (videoInputDevices.length === 0) {
                hideLoading();
                showCameraError('Nenhuma câmera encontrada no dispositivo.');
                return;
            }

            // Tentar usar câmera traseira (environment) se disponível
            selectedDeviceId = videoInputDevices[0].deviceId;
            for (const device of videoInputDevices) {
                const label = device.label.toLowerCase();
                if (label.includes('back') || label.includes('traseira') || label.includes('environment')) {
                    selectedDeviceId = device.deviceId;
                    break;
                }
            }

            // Iniciar scanning (vai mostrar vídeo quando estiver pronto)
            startScanning();
        } catch (err) {
            hideLoading();
            showCameraError('Não foi possível acessar a câmera. Verifique as permissões.');
        }
    }

    function startScanning() {
        if (scanning) return;
        scanning = true;

        const videoElement = document.getElementById('camera-video');
        if (!videoElement) {
            hideLoading();
            showCameraError('Elemento de vídeo não encontrado.');
            scanning = false;
            return;
        }
        
        // Aguardar vídeo estar pronto antes de mostrar
        videoElement.addEventListener('playing', () => {
            // Vídeo está transmitindo - mostrar e esconder loading
            hideLoading();
            showCamera();
        }, { once: true });
        
        // Iniciar scanning (decodeFromVideoDevice já solicita permissão automaticamente)
        codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
            if (result) {
                // Código de barras detectado!
                const barcode = result.text;
                
                // Parar scanning temporariamente
                scanning = false;
                if (codeReader) {
                    codeReader.reset();
                }
                
                // Buscar produto
                searchBarcode(barcode);
            }
            
            if (err && !(err instanceof ZXing.NotFoundException)) {
                // Erro não crítico - apenas log
            }
        });
    }
    
    function hideLoading() {
        const loading = document.getElementById('camera-loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }
    
    function showCamera() {
        const videoElement = document.getElementById('camera-video');
        const overlay = document.querySelector('.scanning-overlay');
        
        if (videoElement) {
            videoElement.style.display = 'block';
        }
        
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    function showCameraError(message) {
        hideLoading();
        const container = document.getElementById('camera-container');
        if (container) {
            container.innerHTML = `
                <div class="camera-error" style="text-align: center; padding: 40px 20px; position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <i class="fas fa-camera-slash" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                    <h3 style="margin: 0 0 12px 0;">Câmera Indisponível</h3>
                    <p style="margin: 0 0 24px 0; color: var(--text-secondary);">${message}</p>
                </div>
            `;
        }
    }

    /**
     * Buscar produto usando Open Food Facts diretamente
     */
    async function searchBarcode(barcode) {
        if (!barcode || typeof barcode !== 'string') {
            setTimeout(() => startScanning(), 1000);
            return;
        }
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.add('active');
        
        try {
            // Buscar direto na API do Open Food Facts
            const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
            
            if (!response || !response.ok) {
                throw new Error('Produto não encontrado');
            }
            
            const data = await response.json();
            
            if (loadingOverlay) loadingOverlay.classList.remove('active');
            
            // Verificar se produto existe
            if (data.status === 1 && data.product) {
                const product = data.product;
                
                // Redirecionar para criar alimento com dados do produto
                const params = new URLSearchParams({
                    food_name: product.product_name_pt || product.product_name || '',
                    brand_name: product.brands || '',
                    kcal_100g: product.nutriments?.energy_kcal_100g || product.nutriments?.['energy-kcal_100g'] || '',
                    protein_100g: product.nutriments?.proteins_100g || product.nutriments?.proteins || '',
                    carbs_100g: product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || '',
                    fat_100g: product.nutriments?.fat_100g || product.nutriments?.fat || '',
                    barcode: barcode
                });
                
                // Preservar query params da URL original
                const urlParams = new URLSearchParams(window.location.search);
                const date = urlParams.get('date');
                const mealType = urlParams.get('meal_type');
                if (date) params.set('date', date);
                if (mealType) params.set('meal_type', mealType);
                
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
            if (loadingOverlay) loadingOverlay.classList.remove('active');
            // Produto não encontrado - mostrar modal
            showProductNotFoundModal(barcode);
        }
    }

    function searchManualBarcode() {
        const input = document.getElementById('manual-barcode-input');
        const barcode = input?.value?.trim();
        
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

    function showProductNotFoundModal(barcode) {
        const modal = document.getElementById('product-not-found-modal');
        const barcodeInput = document.getElementById('manual-barcode-input');
        
        if (!modal) {
            setTimeout(() => startScanning(), 1000);
            return;
        }
        
        if (barcodeInput) {
            barcodeInput.value = barcode || '';
        }
        
        modal.dataset.barcode = barcode || '';
        modal.classList.add('visible');
        document.body.classList.add('scan-modal-open');
        document.body.style.overflow = 'hidden';
    }

    function closeProductNotFoundModal() {
        const modal = document.getElementById('product-not-found-modal');
        if (modal) {
            modal.classList.remove('visible');
            document.body.classList.remove('scan-modal-open');
            document.body.style.overflow = '';
        }
        // Reabrir scanner após fechar modal
        setTimeout(() => startScanning(), 500);
    }

    function registerManually() {
        const modal = document.getElementById('product-not-found-modal');
        const barcode = modal?.dataset.barcode || document.getElementById('manual-barcode-input')?.value;
        
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
    
    // Limpar recursos ao sair da página
    window.addEventListener('beforeunload', function() {
        if (codeReader) {
            codeReader.reset();
        }
    });

    // Limpar quando a página for desmontada
    if (window.addEventListener) {
        window.addEventListener('pagehide', function() {
            if (codeReader) {
                codeReader.reset();
            }
        });
    }
    
    window.searchManualBarcode = searchManualBarcode;
    window.closeProductNotFoundModal = closeProductNotFoundModal;
    window.registerManually = registerManually;

})();
