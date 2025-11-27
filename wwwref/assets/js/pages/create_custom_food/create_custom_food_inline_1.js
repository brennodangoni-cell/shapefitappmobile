
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {
    
    async function initCreateCustomFood() {
        // Verificar se estamos na página correta
        const form = document.getElementById('custom-food-form');
        if (!form) {
            console.log('[CreateCustomFood] Formulário não encontrado.');
            return;
        }
        
        // Evitar inicialização duplicada
        if (form.dataset.initialized === 'true') {
            console.log('[CreateCustomFood] Já inicializado.');
            return;
        }
        form.dataset.initialized = 'true';

        // Verificar autenticação
        if (typeof requireAuth === 'function') {
            const authenticated = await requireAuth();
            if (!authenticated) return;
        }
        
        // Pegar parâmetros da URL
        const urlParams = new URLSearchParams(window.location.search);
        const barcode = urlParams.get('barcode');
        const foodName = urlParams.get('food_name');
        const brandName = urlParams.get('brand_name');
        const kcal = urlParams.get('kcal_100g');
        const protein = urlParams.get('protein_100g');
        const carbs = urlParams.get('carbs_100g');
        const fat = urlParams.get('fat_100g');
        const mealType = urlParams.get('meal_type');
        const date = urlParams.get('date');
        
        // Configurar botão de voltar
        const backBtn = document.getElementById('ccf-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function(e) {
                e.preventDefault();
                let backUrl = '/adicionar-alimento';
                const params = new URLSearchParams();
                if (mealType) params.set('meal_type', mealType);
                if (date) params.set('date', date);
                if (params.toString()) {
                    backUrl += '?' + params.toString();
                }
                if (window.SPARouter && window.SPARouter.navigate) {
                    window.SPARouter.navigate(backUrl);
                } else {
                    window.location.href = backUrl;
                }
            });
        }
        
        const barcodeInfo = document.getElementById('barcode-info');
        const barcodeValue = document.getElementById('barcode-value');
        
        if (barcode && barcodeInfo && barcodeValue) {
            barcodeInfo.style.display = 'flex';
            barcodeValue.textContent = barcode;
            // Adicionar campo hidden para o barcode
            let hiddenInput = form.querySelector('input[name="barcode"]');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = 'barcode';
                form.appendChild(hiddenInput);
            }
            hiddenInput.value = barcode;
        }
        
        // Preencher campos se vieram da URL
        if (foodName) {
            const el = document.getElementById('food_name');
            if (el) el.value = foodName;
        }
        if (brandName) {
            const el = document.getElementById('brand_name');
            if (el) el.value = brandName;
        }
        if (kcal) {
            const el = document.getElementById('kcal_100g');
            if (el) el.value = kcal;
        }
        if (protein) {
            const el = document.getElementById('protein_100g');
            if (el) el.value = protein;
        }
        if (carbs) {
            const el = document.getElementById('carbs_100g');
            if (el) el.value = carbs;
        }
        if (fat) {
            const el = document.getElementById('fat_100g');
            if (el) el.value = fat;
        }
        
        // Event listener do formulário
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submit-btn');
            if (!submitBtn || submitBtn.disabled) return;
            
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            
            const formData = {
                food_name: document.getElementById('food_name')?.value.trim() || '',
                brand_name: document.getElementById('brand_name')?.value.trim() || '',
                kcal_100g: parseFloat(document.getElementById('kcal_100g')?.value) || 0,
                protein_100g: parseFloat(document.getElementById('protein_100g')?.value) || 0,
                carbs_100g: parseFloat(document.getElementById('carbs_100g')?.value) || 0,
                fat_100g: parseFloat(document.getElementById('fat_100g')?.value) || 0
            };
            
            const barcodeInput = form.querySelector('input[name="barcode"]');
            if (barcodeInput && barcodeInput.value) {
                formData.barcode = barcodeInput.value;
            }
            
            try {
                const response = await authenticatedFetch('/api/save_custom_food.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (!response) {
                    throw new Error('Sem resposta do servidor');
                }
                
                const data = await response.json();
                
                if (data.success) {
                    showAlert('success', data.message || 'Alimento salvo com sucesso!');
                    
                    // Redirecionar para adicionar ao diário
                    setTimeout(() => {
                        let redirectUrl = '/adicionar-alimento';
                        
                        const params = new URLSearchParams();
                        if (mealType) params.set('meal_type', mealType);
                        if (date) params.set('date', date);
                        
                        if (params.toString()) {
                            redirectUrl += '?' + params.toString();
                        }
                        
                        if (window.SPARouter && window.SPARouter.navigate) {
                            window.SPARouter.navigate(redirectUrl);
                        } else {
                            window.location.href = redirectUrl;
                        }
                    }, 1500);
                } else {
                    showAlert('danger', data.message || 'Erro ao salvar o alimento.');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            } catch (error) {
                console.error('[CreateCustomFood] Erro ao salvar:', error);
                showAlert('danger', 'Erro ao salvar o alimento. Verifique sua conexão.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
    function showAlert(type, message) {
        const container = document.getElementById('alert-container');
        if (!container) {
            alert(message);
            return;
        }
        container.innerHTML = `<div class="ccf-alert ccf-alert-${type}">${message}</div>`;
        setTimeout(() => {
            if (container) container.innerHTML = '';
        }, 5000);
    }

    // Inicialização
    function tryInit() {
        // Verificar se o formulário existe antes de inicializar
        if (document.getElementById('custom-food-form')) {
            initCreateCustomFood();
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
    
    // Para SPA
    window.addEventListener('pageLoaded', tryInit);
    window.addEventListener('fragmentReady', tryInit);
    
})();
