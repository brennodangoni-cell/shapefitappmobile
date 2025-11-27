
/**
 * Script Inline Protegido - inline_1
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        let pointsData = null;
        // Função helper para obter mês atual (local)
        function getLocalMonthString() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}`;
        }
        let currentMonth = new URLSearchParams(window.location.search).get('month') || getLocalMonthString();
        
        // Carregar dados
        (async function() {
            const authenticated = await requireAuth();
            if (!authenticated) return;
            
            const BASE_URL = window.BASE_APP_URL;
            
            try {
                const response = await authenticatedFetch(`${BASE_URL}/api/get_points_history_data.php?month=${currentMonth}`);
                if (!response) return;
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.message || 'Erro ao carregar dados');
                }
                
                pointsData = result.data;
                renderPointsPage();
                
                document.getElementById('points-container').style.display = 'block';
                
            } catch (error) {
                console.error('Erro ao carregar histórico:', error);
                document.getElementById('history-feed').innerHTML = `
                    <div class="feed-empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erro ao carregar dados. Tente novamente.</p>
                    </div>
                `;
            }
        })();
        
        function formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        
        function formatDate(dateStr) {
            const date = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Função helper para obter data local
            function getLocalDateStr() {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            function getYesterdayStr() {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            
            if (dateStr === getLocalDateStr()) {
                return 'Hoje';
            } else if (dateStr === getYesterdayStr()) {
                return 'Ontem';
            } else {
                const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                return days[date.getDay()] + ', ' + date.getDate() + ' de ' + months[date.getMonth()];
            }
        }
        
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        
        function renderPointsPage() {
            if (!pointsData) return;
            
            // Atualizar pontos e nível
            document.getElementById('points-value').textContent = formatNumber(pointsData.user_points);
            document.getElementById('level-tag').textContent = pointsData.level.name;
            document.getElementById('level-progress-bar').style.width = pointsData.level.progress_percentage + '%';
            
            if (pointsData.level.is_max_level) {
                document.getElementById('next-level-text').innerHTML = '<strong>Você está no nível máximo!</strong>';
            } else {
                document.getElementById('next-level-text').innerHTML = 
                    'Faltam <strong>' + formatNumber(pointsData.level.points_remaining) + '</strong> pontos...';
            }
            
            // Renderizar meses disponíveis
            const monthSelect = document.getElementById('month-filter');
            monthSelect.innerHTML = '';
            if (pointsData.available_months && pointsData.available_months.length > 0) {
                pointsData.available_months.forEach(month => {
                    const option = document.createElement('option');
                    option.value = month.month_key;
                    option.textContent = month.month_display;
                    if (month.month_key === currentMonth) {
                        option.selected = true;
                    }
                    monthSelect.appendChild(option);
                });
                
                monthSelect.addEventListener('change', function() {
                    window.location.href = `./points_history.html?month=${this.value}`;
                });
            }
            
            // Renderizar histórico
            const historyFeed = document.getElementById('history-feed');
            if (!pointsData.points_log || pointsData.points_log.length === 0) {
                historyFeed.innerHTML = `
                    <div class="feed-empty-state">
                        <i class="fas fa-calendar-times"></i>
                        <h3>Nenhuma Atividade</h3>
                        <p>Não há registros de pontos para este período.</p>
                    </div>
                `;
                return;
            }
            
            let html = '';
            pointsData.points_log.forEach(group => {
                html += `<div class="feed-date-separator">${formatDate(group.date)}</div>`;
                html += '<div class="feed-group">';
                
                group.entries.forEach(entry => {
                    const details = entry.details || { icon: 'fa-question-circle', text: 'Ação registrada', color: '#A0A0A0' };
                    html += `
                        <div class="feed-item">
                            <div class="feed-icon" style="background-color: ${details.color}20;">
                                <i class="fas ${details.icon}" style="color: ${details.color};"></i>
                            </div>
                            <div class="feed-info">
                                <p class="feed-reason">${escapeHtml(details.text)}</p>
                                <span class="feed-time">${formatTime(entry.timestamp)}</span>
                            </div>
                            <span class="feed-points">+${formatNumber(entry.points_awarded)}</span>
                        </div>
                    `;
                });
                
                html += '</div>';
            });
            
            historyFeed.innerHTML = html;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    
})();
