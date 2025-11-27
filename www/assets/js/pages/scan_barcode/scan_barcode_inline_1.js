
/**
 * Scanner de código de barras - VERSÃO SIMPLES E ESTÁVEL
 * Sem reabertura automática - botão para escanear
 */
(function() {

    let isScanning = false; // Prevenir múltiplas chamadas

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
            
            // Mostrar botão de escanear ao invés de abrir automaticamente
            showScanButton();
            
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
     * Mostrar botão para escanear
     */
    function showScanButton() {
        const container = document.getElementById('camera-container');
        if (!container) return;
        
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <i class="fas fa-qrcode" style="font-size: 80px; color: var(--accent-orange); margin-bottom: 30px;"></i>
                <h3 style="margin: 0 0 12px 0; font-size: 20px; color: var(--text-primary);">Escanear Código de Barras</h3>
                <p style="margin: 0 0 40px 0; color: var(--text-secondary); font-size: 14px; max-width: 280px;">Toque no botão abaixo para abrir a câmera e escanear um código de barras</p>
                <button id="scan-button" style="padding: 18px 36px; background: var(--accent-orange); color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);">
                    <i class="fas fa-camera"></i> Escanear Agora
                </button>
            </div>
        `;
        
        const scanBtn = document.getElementById('scan-button');
        if (scanBtn) {
            scanBtn.addEventListener('click', startScanner);
        }
    }

    /**
     * Iniciar scanner - UMA VEZ por vez
     */
    async function startScanner() {
        if (isScanning) return; // Prevenir múltiplas chamadas
        isScanning = true;

        if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
            isScanning = false;
            showCameraError('Scanner disponível apenas no app mobile (iOS/Android).');
            return;
        }

        if (!window.Capacitor.Plugins.BarcodeScanner) {
            isScanning = false;
            showCameraError('Scanner não disponível. Verifique se o plugin está instalado.');
            return;
        }

        const { BarcodeScanner } = window.Capacitor.Plugins;
        
        // Mostrar loading
        const container = document.getElementById('camera-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                    <p style="margin: 0; color: var(--text-secondary);">Abrindo câmera...</p>
                </div>
            `;
        }

        try {
            // MLKit solicita permissão automaticamente
            const result = await BarcodeScanner.startScan();
            
            isScanning = false;
            
            if (result && result.hasContent && result.content) {
                // Código escaneado - buscar produto
                await searchBarcode(result.content);
            } else {
                // Cancelado ou sem resultado - mostrar botão novamente
                showScanButton();
            }

        } catch (error) {
            isScanning = false;
            const errorMsg = error.message || error.toString() || '';
            const errorLower = errorMsg.toLowerCase();
            
            if (errorLower.includes('cancelled') || errorLower.includes('cancel')) {
                // Usuário cancelou - mostrar botão
                showScanButton();
            } else if (errorLower.includes('permission') || errorLower.includes('denied')) {
                showCameraError('Permissão de câmera negada. Permita o acesso nas configurações do app.');
            } else {
                showCameraError('Erro ao abrir câmera. Tente novamente.');
                setTimeout(() => showScanButton(), 2000);
            }
        }
    }

    function showCameraError(message) {
        const container = document.getElementById('camera-container');
        if (container) {
            container.innerHTML = `
                <div class="camera-error" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-camera-slash" style="font-size: 48px; color: var(--accent-orange); margin-bottom: 20px;"></i>
                    <h3 style="margin: 0 0 12px 0;">Câmera Indisponível</h3>
                    <p style="margin: 0 0 24px 0; color: var(--text-secondary);">${message}</p>
                    <button onclick="location.reload()" style="padding: 12px 24px; background: var(--accent-orange); color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    /**
     * Buscar produto usando Open Food Facts diretamente
     */
    async function searchBarcode(barcode) {
        if (!barcode || typeof barcode !== 'string') {
            showScanButton();
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
            // Se não tem modal, voltar para botão de escanear
            showScanButton();
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
        // Voltar para botão de escanear
        showScanButton();
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
    
    window.searchManualBarcode = searchManualBarcode;
    window.closeProductNotFoundModal = closeProductNotFoundModal;
    window.registerManually = registerManually;

})();
