
/**
 * Script Inline Protegido - inline_1
 * Scanner de código de barras - VERSÃO SIMPLIFICADA
 * Abre câmera automaticamente ao carregar página
 */
(function() {

    // Mover modal para fora do page-root
    function moveModalToBody() {
        const modal = document.getElementById('product-not-found-modal');
        if (modal && modal.parentElement && modal.parentElement.classList.contains('page-root')) {
            document.body.appendChild(modal);
        }
    }
    
    // Inicializar página
    async function initPage() {
        try {
            moveModalToBody();
            
            // Mostrar container
            const scannerContainer = document.querySelector('.scanner-container');
            if (scannerContainer) {
                scannerContainer.style.display = '';
                scannerContainer.style.opacity = '1';
                scannerContainer.style.visibility = 'visible';
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
            
            // Página pronta primeiro
            if (window.PageLoader) {
                window.PageLoader.ready();
            }
            
            // Aguardar um pouco e então abrir scanner automaticamente
            setTimeout(() => {
                startScanner();
            }, 500);
        } catch (error) {
            console.error('[Scanner] Erro na inicialização:', error);
            showCameraError('Erro ao inicializar scanner.');
            if (window.PageLoader) {
                window.PageLoader.ready();
            }
        }
    }
    
    // Aguardar DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }

    /**
     * Iniciar scanner - VERSÃO SIMPLIFICADA baseada no add_food_logic.js
     */
    async function startScanner() {
        // Verificar se está em app nativo
        if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
            showCameraError('Scanner disponível apenas no app mobile (iOS/Android).');
            return;
        }

        // Verificar plugin
        if (!window.Capacitor.Plugins.BarcodeScanner) {
            console.error('[Scanner] BarcodeScanner plugin não encontrado!');
            showCameraError('Scanner não disponível. Verifique se o plugin está instalado.');
            return;
        }

        const { BarcodeScanner } = window.Capacitor.Plugins;
        const { Camera } = window.Capacitor.Plugins;

        try {
            // Solicitar permissão de câmera (igual ao add_food_logic.js)
            const permissionStatus = await Camera.requestPermissions();
            if (permissionStatus.camera !== 'granted' && permissionStatus.camera !== 'yes') {
                showCameraError('Permissão de câmera negada. Permita o acesso nas configurações do app.');
                return;
            }
            
            // Abrir scanner (igual ao add_food_logic.js)
            const result = await BarcodeScanner.startScan();
            
            // Processar resultado
            if (result && result.hasContent && result.content) {
                await searchBarcode(result.content);
            } else {
                // Cancelado ou sem resultado - reabrir automaticamente
                setTimeout(() => startScanner(), 300);
            }

        } catch (error) {
            const errorMsg = error.message || error.toString() || '';
            const errorLower = errorMsg.toLowerCase();
            
            if (errorLower.includes('cancelled') || errorLower.includes('cancel')) {
                // Usuário cancelou - reabrir automaticamente
                setTimeout(() => startScanner(), 300);
            } else if (errorLower.includes('permission') || errorLower.includes('denied')) {
                showCameraError('Permissão de câmera negada. Permita o acesso nas configurações do app.');
            } else {
                console.error('[Scanner] Erro:', error);
                // Tentar novamente após delay
                setTimeout(() => startScanner(), 1000);
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
                    <p style="margin: 0; color: var(--text-secondary);">${message}</p>
                </div>
            `;
        }
    }

    async function searchBarcode(barcode) {
        if (!barcode || typeof barcode !== 'string') {
            console.error('[Scanner] Código inválido:', barcode);
            return;
        }
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.add('active');
        
        try {
            const baseUrl = window.BASE_APP_URL || '';
            if (!baseUrl) {
                throw new Error('BASE_APP_URL não definido');
            }
            
            const response = await authenticatedFetch(`${baseUrl}/api/lookup_barcode.php?barcode=${encodeURIComponent(barcode)}`);
            if (!response || !response.ok) {
                throw new Error(`Erro HTTP: ${response?.status || 'desconhecido'}`);
            }
            
            const data = await response.json();
            
            if (loadingOverlay) loadingOverlay.classList.remove('active');
            
            if (data.success) {
                // Produto encontrado - redirecionar
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
                // Reabrir scanner após mostrar modal
                setTimeout(() => startScanner(), 500);
            }
        } catch (error) {
            console.error('[Scanner] Erro ao buscar produto:', error);
            if (loadingOverlay) loadingOverlay.classList.remove('active');
            showProductNotFoundModal(barcode);
            // Reabrir scanner após erro
            setTimeout(() => startScanner(), 500);
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
        
        if (!modal) return;
        
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
        setTimeout(() => startScanner(), 300);
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
    
    // Expor funções globalmente
    window.searchManualBarcode = searchManualBarcode;
    window.closeProductNotFoundModal = closeProductNotFoundModal;
    window.registerManually = registerManually;

})();
