// www/assets/js/spa-fixes.js
// Correções globais para Modais, Água e Interações em ambiente SPA

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 [SPA Fixes] Inicializado');

    // ============================================================
    // 1. SISTEMA UNIVERSAL DE MODAIS (Peso, etc)
    // ============================================================
    document.body.addEventListener('click', (e) => {
        // ABRIR MODAL (Procura por data-action="open-weight-modal" ou similar)
        const openTrigger = e.target.closest('[data-action^="open-"]');
        if (openTrigger) {
            const action = openTrigger.getAttribute('data-action');
            // Ex: open-weight-modal -> weight-modal (assumindo padrao de ID)
            // Se for especifico do peso:
            if (action === 'open-weight-modal') {
                const modal = document.getElementById('edit-weight-modal');
                if (modal) {
                    modal.classList.add('modal-visible', 'active'); // Tenta as duas classes comuns
                    modal.style.display = 'flex'; // Força display
                    document.body.style.overflow = 'hidden'; // Trava scroll
                    
                    // Preencher valor atual se existir
                    const currentVal = document.getElementById('current-weight-value');
                    const input = document.getElementById('new-weight-input');
                    if (currentVal && input) {
                        input.value = parseFloat(currentVal.textContent.replace(',', '.')) || '';
                    }
                }
            }
        }

        // FECHAR MODAL (Botão X, Cancelar ou Fundo Escuro)
        const closeTrigger = e.target.closest('[data-action="close-modal"]') || 
                             e.target.closest('.modal-close') ||
                             (e.target.classList.contains('modal-overlay')); // Clicou fora
                             
        if (closeTrigger || e.target.classList.contains('modal-container')) {
            const modal = e.target.closest('.modal') || document.querySelector('.modal.modal-visible') || document.querySelector('.modal.active');
            if (modal) {
                modal.classList.remove('modal-visible', 'active');
                modal.style.display = 'none';
                document.body.style.overflow = ''; // Destrava scroll
            }
        }
    });

    // ============================================================
    // 2. LÓGICA DA ÁGUA (Reimplantada Globalmente)
    // ============================================================
    // Variáveis de estado local para a água (já que o PHP não está recarregando)
    window.spaWaterState = {
        current: 0,
        goal: 2000,
        cupSize: 250
    };

    document.body.addEventListener('click', async (e) => {
        // BOTÃO ADICIONAR ÁGUA (+)
        const addBtn = e.target.closest('#add-water-btn') || e.target.closest('.water-btn-add');
        if (addBtn) {
            e.preventDefault();
            updateWater(window.spaWaterState.cupSize);
        }

        // BOTÃO REMOVER ÁGUA (-)
        const removeBtn = e.target.closest('#remove-water-btn') || e.target.closest('.water-btn-remove');
        if (removeBtn) {
            e.preventDefault();
            updateWater(-window.spaWaterState.cupSize);
        }
    });

    // Função para atualizar visual e enviar para API
    async function updateWater(amount) {
        // 1. Atualizar Estado Visual Imediatamente (Feedback rápido)
        const display = document.getElementById('water-amount-display');
        const waveGroup = document.getElementById('water-level-group');
        
        if (!display) return;

        // Pegar valor atual do HTML se o estado estiver zerado (primeira carga)
        let currentVal = parseInt(display.textContent) || window.spaWaterState.current;
        let newVal = Math.max(0, currentVal + amount);
        
        // Atualiza Texto
        display.textContent = newVal;
        window.spaWaterState.current = newVal;

        // Atualiza Onda (Animação SVG)
        if (waveGroup) {
            const goalText = document.getElementById('water-goal-display')?.textContent || '2000';
            const goal = parseInt(goalText) || 2000;
            const percentage = Math.min(newVal / goal, 1);
            // 275.785 é a altura total da gota no SVG padrão
            const yTranslate = 275.785 * (1 - percentage); 
            waveGroup.setAttribute('transform', `translate(0, ${yTranslate})`);
        }

        // 2. Enviar para o Servidor (Hostinger)
        try {
            // Usa o authenticatedFetch global se existir, ou fetch normal
            const fetcher = window.authenticatedFetch || fetch;
            const formData = new FormData();
            formData.append('amount_ml', amount); // A API espera o delta ou total? Geralmente delta em 'add_water.php'
            
            // Ajuste conforme sua API real. Supondo 'register_water.php' ou similar
            await fetcher(`${window.BASE_APP_URL}/api/register_water.php`, {
                method: 'POST',
                body: formData
            });
            console.log('💧 Água salva:', newVal);
        } catch (error) {
            console.error('Erro ao salvar água:', error);
        }
    }

    // ============================================================
    // 3. CORREÇÃO DO CHECK-IN (Limpar ao navegar)
    // ============================================================
    // Ouve mudanças de rota para limpar modais persistentes
    window.addEventListener('pageLoaded', () => {
        // Fecha qualquer modal aberto ao trocar de página
        document.querySelectorAll('.modal').forEach(m => {
            m.style.display = 'none';
            m.classList.remove('active', 'modal-visible');
        });
        document.body.style.overflow = '';

        // Verifica se o check-in deve aparecer
        // Se não tiver a flag explícita do backend nesta carga, esconde
        const checkinModal = document.getElementById('checkinModal');
        if (checkinModal) {
            // Só mostra se o JS da página explicitamente o chamou
            // Por padrão, esconde para evitar o "sempre aberto"
            if (!checkinModal.classList.contains('force-show')) {
                checkinModal.style.display = 'none';
            }
        }
    });
});