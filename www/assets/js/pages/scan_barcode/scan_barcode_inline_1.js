
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        let codeReader = null;
        let selectedDeviceId = null;
        let scanning = false;

        // ✅ Mover modal para fora do page-root para funcionar corretamente com position: fixed
        function moveModalToBody() {
            const modal = document.getElementById('product-not-found-modal');
            if (modal && modal.parentElement && modal.parentElement.classList.contains('page-root')) {
                document.body.appendChild(modal);
                console.log('✅ Modal movido para body');
            }
        }
        
        // Verificar autenticação
        document.addEventListener('DOMContentLoaded', async function() {
            // ✅ Mover modal para body primeiro
            moveModalToBody();
            
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
                // ✅ SOLICITAR PERMISSÃO DE CÂMERA PRIMEIRO (especialmente no Capacitor iOS/Android)
                const isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
                const isIOS = isNative && window.Capacitor.getPlatform() === 'ios';
                const isAndroid = isNative && window.Capacitor.getPlatform() === 'android';
                
                if (isNative) {
                    console.log('[Scanner] App nativo detectado (' + window.Capacitor.getPlatform() + ') - solicitando permissão de câmera...');
                    
                    let permissionGranted = false;
                    
                    // ✅ NO iOS E ANDROID: Usar plugin Camera do Capacitor (mais confiável)
                    try {
                        const Camera = window.Capacitor.Plugins?.Camera;
                        if (Camera) {
                            console.log('[Scanner] Plugin Camera encontrado, solicitando permissão...');
                            
                            // No iOS, o plugin Camera é mais confiável que getUserMedia
                            const permissionResult = await Camera.requestPermissions({ permissions: ['camera'] });
                            console.log('[Scanner] Resultado da permissão Camera:', permissionResult);
                            
                            // iOS retorna 'granted' ou 'yes', Android pode retornar 'granted'
                            if (permissionResult.camera === 'granted' || permissionResult.camera === 'yes') {
                                permissionGranted = true;
                                console.log('[Scanner] Permissão concedida via plugin Camera');
                            } else {
                                const platformName = isIOS ? 'iOS' : 'Android';
                                showCameraError(`Permissão de câmera negada. Por favor, permita o acesso à câmera nas Configurações > ${platformName === 'iOS' ? 'ShapeFit' : 'App'} > Câmera.`);
                                return;
                            }
                        } else {
                            console.warn('[Scanner] Plugin Camera não encontrado, tentando getUserMedia...');
                        }
                    } catch (capError) {
                        console.warn('[Scanner] Erro ao solicitar permissão via Capacitor Camera:', capError);
                        // Continuar tentando com getUserMedia como fallback
                    }
                    
                    // ✅ FALLBACK: Se não conseguiu via plugin, tentar getUserMedia
                    // No Android pode funcionar, no iOS geralmente não funciona bem no Capacitor
                    if (!permissionGranted) {
                        console.log('[Scanner] Tentando solicitar permissão via getUserMedia (fallback)...');
                    }
                }
                
                // Solicitar permissão via getUserMedia (web ou fallback no nativo)
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    try {
                        // Solicitar permissão primeiro
                        const videoConstraints = {
                            facingMode: 'environment' // Preferir câmera traseira
                        };
                        
                        // No iOS, pode precisar de constraints diferentes
                        if (isIOS) {
                            // iOS pode não suportar facingMode, usar constraints mais simples
                            videoConstraints.facingMode = undefined;
                        }
                        
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                            video: videoConstraints
                        });
                        // Parar o stream imediatamente - só queríamos a permissão
                        stream.getTracks().forEach(track => track.stop());
                        console.log('[Scanner] Permissão de câmera concedida via getUserMedia');
                    } catch (permError) {
                        console.error('[Scanner] Erro ao solicitar permissão via getUserMedia:', permError);
                        
                        // Se já tentou via plugin e falhou, mostrar erro
                        if (isNative && !permissionGranted) {
                            const platformName = isIOS ? 'iOS' : 'Android';
                            showCameraError(`Não foi possível acessar a câmera. Por favor, verifique as permissões em Configurações > ${platformName === 'iOS' ? 'ShapeFit' : 'App'} > Câmera.`);
                            return;
                        }
                        
                        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
                            showCameraError('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações.');
                            return;
                        } else if (permError.name === 'NotFoundError' || permError.name === 'DevicesNotFoundError') {
                            showCameraError('Nenhuma câmera encontrada no dispositivo.');
                            return;
                        } else {
                            showCameraError('Não foi possível acessar a câmera. Verifique as permissões.');
                            return;
                        }
                    }
                }
                
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
                    if (device.label.toLowerCase().includes('back') || 
                        device.label.toLowerCase().includes('traseira') ||
                        device.label.toLowerCase().includes('environment') ||
                        device.label.toLowerCase().includes('rear')) {
                        selectedDeviceId = device.deviceId;
                        console.log('[Scanner] Câmera traseira selecionada:', device.label);
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
            
            // Mostrar modal usando classe (padrão do main_app)
            modal.classList.add('visible');
            // ✅ Bloquear scroll do body quando modal está aberto
            document.body.classList.add('scan-modal-open');
            document.body.style.overflow = 'hidden';
        }

        // Função para fechar modal
        function closeProductNotFoundModal() {
            const modal = document.getElementById('product-not-found-modal');
            modal.classList.remove('visible');
            // ✅ Restaurar scroll do body quando modal fecha
            document.body.classList.remove('scan-modal-open');
            document.body.style.overflow = '';
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
