
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        let codeReader = null;
        let selectedDeviceId = null;
        let scanning = false;

        // Verificar autenticação
        document.addEventListener('DOMContentLoaded', async function() {
            const authenticated = await requireAuth();
            if (!authenticated) return;
            
            initializeScanner();
            
            // Remover readonly quando clicar no input
            const manualInput = document.getElementById('manual-barcode-input');
            manualInput.addEventListener('click', function() {
                this.focus();
            });
            
            // Permitir buscar ao pressionar Enter
            manualInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchManualBarcode();
                }
            });
        });

        async function initializeScanner() {
            try {
                codeReader = new ZXing.BrowserMultiFormatReader();
                
                // Solicitar permissão e obter câmera traseira
                const videoInputDevices = await codeReader.listVideoInputDevices();
                
                if (videoInputDevices.length === 0) {
                    showCameraError('Nenhuma câmera encontrada no dispositivo.');
                    return;
                }

                // Tentar usar câmera traseira (environment) se disponível
                selectedDeviceId = videoInputDevices[0].deviceId;
                for (const device of videoInputDevices) {
                    if (device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('traseira')) {
                        selectedDeviceId = device.deviceId;
                        break;
                    }
                }

                startScanning();
            } catch (err) {
                console.error('Erro ao inicializar scanner:', err);
                showCameraError('Não foi possível acessar a câmera. Verifique as permissões.');
            }
        }

        function startScanning() {
            if (scanning) return;
            scanning = true;

            const videoElement = document.getElementById('camera-video');
            
            codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
                if (result) {
                    // Código de barras detectado!
                    const barcode = result.text;
                    console.log('Código detectado:', barcode);
                    
                    // Parar scanning temporariamente
                    scanning = false;
                    
                    // Buscar produto
                    searchBarcode(barcode);
                }
                
                if (err && !(err instanceof ZXing.NotFoundException)) {
                    console.error('Erro no scanner:', err);
                }
            });
        }

        function showCameraError(message) {
            const container = document.getElementById('camera-container');
            container.innerHTML = `
                <div class="camera-error">
                    <i class="fas fa-camera-slash"></i>
                    <h3>Câmera Indisponível</h3>
                    <p>${message}</p>
                </div>
            `;
        }

        async function searchBarcode(barcode) {
            // Mostrar loading
            document.getElementById('loading-overlay').classList.add('active');
            
            try {
                const response = await authenticatedFetch(`${window.BASE_APP_URL}/api/lookup_barcode.php?barcode=${encodeURIComponent(barcode)}`);
                const data = await response.json();
                
                // Esconder loading
                document.getElementById('loading-overlay').classList.remove('active');
                
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
                    
                    window.location.href = `create_custom_food.html?${params.toString()}`;
                } else {
                    // Produto não encontrado - mostrar modal
                    showProductNotFoundModal(barcode);
                }
            } catch (error) {
                console.error('Erro ao buscar produto:', error);
                document.getElementById('loading-overlay').classList.remove('active');
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

        // Limpar recursos ao sair da página
        window.addEventListener('beforeunload', function() {
            if (codeReader) {
                codeReader.reset();
            }
        });

        // Função para mostrar modal de produto não encontrado
        function showProductNotFoundModal(barcode) {
            const modal = document.getElementById('product-not-found-modal');
            const barcodeInput = document.getElementById('manual-barcode-input');
            
            // Preencher o input com o código escaneado
            barcodeInput.value = barcode;
            
            // Armazenar barcode para usar no cadastro manual
            modal.dataset.barcode = barcode;
            
            // Mostrar modal
            modal.style.display = 'flex';
        }

        // Função para fechar modal
        function closeProductNotFoundModal() {
            document.getElementById('product-not-found-modal').style.display = 'none';
        }

        // Função para cadastrar manualmente
        function registerManually() {
            const modal = document.getElementById('product-not-found-modal');
            const barcode = modal.dataset.barcode || document.getElementById('manual-barcode-input').value;
            
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
