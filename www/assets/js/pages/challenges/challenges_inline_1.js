// challenges_inline_1.js - Lógica principal da página de desafios

(function() {
    'use strict';
    
    const API_BASE_URL = window.API_BASE_URL || 'https://appshapefit.com/api';
    
    // Obter parâmetro ID da URL
    function getChallengeIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        return id ? parseInt(id) : null;
    }
    
    // Formatar data
    function formatDate(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    // Calcular status do desafio
    function getChallengeStatus(startDate, endDate) {
        const today = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        today.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        if (today < start) {
            return { class: 'scheduled', text: 'Agendado' };
        } else if (today >= start && today <= end) {
            return { class: 'active', text: 'Em andamento' };
        } else {
            return { class: 'completed', text: 'Concluído' };
        }
    }
    
    // Calcular progresso do desafio
    function calculateChallengeProgress(startDate, endDate) {
        const today = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const daysPassed = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
        const percentage = Math.min(100, Math.round((daysPassed / totalDays) * 100));
        
        return { totalDays, daysPassed, daysRemaining, percentage };
    }
    
    // Renderizar lista de desafios
    function renderChallengesList(challenges) {
        const container = document.getElementById('challenges-list-container');
        
        // Esconder botão de ajuda na lista
        const helpButton = document.getElementById('challenges-help-button');
        if (helpButton) {
            helpButton.style.display = 'none';
        }
        
        const goalIcons = {
            'calories': 'fas fa-fire',
            'water': 'fas fa-tint',
            'exercise': 'fas fa-dumbbell',
            'sleep': 'fas fa-bed'
        };
        const goalLabels = {
            'calories': 'Calorias',
            'water': 'Água',
            'exercise': 'Exercício',
            'sleep': 'Sono'
        };
        const goalUnits = {
            'calories': 'kcal',
            'water': 'ml',
            'exercise': 'min',
            'sleep': 'h'
        };
        
        let html = '';
        
        challenges.forEach(challenge => {
            const status = getChallengeStatus(challenge.start_date, challenge.end_date);
            const progress = calculateChallengeProgress(challenge.start_date, challenge.end_date);
            const goals = Array.isArray(challenge.goals) ? challenge.goals : (challenge.goals ? JSON.parse(challenge.goals) : []);
            
            html += `
                <div class="challenge-card" onclick="window.SPARouter.navigate('/fragments/challenges.html?id=${challenge.id}')">
                    <div class="challenge-card-header">
                        <h2 class="challenge-card-title">${escapeHtml(challenge.name)}</h2>
                        <span class="challenge-status ${status.class}">${status.text}</span>
                    </div>
                    
                    ${challenge.description ? `
                        <p class="challenge-description">${escapeHtml(challenge.description.substring(0, 150))}${challenge.description.length > 150 ? '...' : ''}</p>
                    ` : ''}
                    
                    <div class="challenge-meta">
                        <div class="challenge-meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(challenge.start_date)} - ${formatDate(challenge.end_date)}</span>
                        </div>
                        <div class="challenge-meta-item">
                            <i class="fas fa-users"></i>
                            <span>${challenge.total_participants} participante${challenge.total_participants > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    
                    ${status.class === 'active' ? `
                        <div class="challenge-progress">
                            <div class="challenge-progress-info">
                                <span>${progress.daysRemaining} dia${progress.daysRemaining !== 1 ? 's' : ''} restante${progress.daysRemaining !== 1 ? 's' : ''}</span>
                                <span>${progress.percentage}%</span>
                            </div>
                            <div class="challenge-progress-bar">
                                <div class="challenge-progress-fill" style="width: ${progress.percentage}%;"></div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${goals.length > 0 ? `
                        <div class="challenge-goals">
                            ${goals.map(goal => {
                                const icon = goalIcons[goal.type] || 'fas fa-bullseye';
                                const label = goalLabels[goal.type] || goal.type;
                                const unit = goalUnits[goal.type] || '';
                                return `
                                    <span class="challenge-goal-badge">
                                        <i class="${icon}"></i>
                                        <span>${label}</span>
                                        ${goal.value ? `<span>${goal.value} ${unit}</span>` : ''}
                                    </span>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        container.style.display = 'block';
    }
    
    // Controlar modal de ajuda
    function setupHelpModal() {
        const helpButton = document.getElementById('challenges-help-button');
        const helpModal = document.getElementById('challenges-help-modal');
        const closeButton = document.getElementById('challenges-help-close');
        
        if (helpButton && helpModal && closeButton) {
            helpButton.addEventListener('click', () => {
                helpModal.classList.add('active');
            });
            
            closeButton.addEventListener('click', () => {
                helpModal.classList.remove('active');
            });
            
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.classList.remove('active');
                }
            });
        }
    }
    
    // Renderizar detalhes do desafio
    function renderChallengeDetail(challenge, participants) {
        const container = document.getElementById('challenge-detail-container');
        const status = getChallengeStatus(challenge.start_date, challenge.end_date);
        const progress = calculateChallengeProgress(challenge.start_date, challenge.end_date);
        const goals = Array.isArray(challenge.goals) ? challenge.goals : (challenge.goals ? JSON.parse(challenge.goals) : []);
        
        // Mostrar botão de ajuda
        const helpButton = document.getElementById('challenges-help-button');
        if (helpButton) {
            helpButton.style.display = 'flex';
        }
        
        const goalIcons = {
            'calories': 'fas fa-fire',
            'water': 'fas fa-tint',
            'exercise': 'fas fa-dumbbell',
            'sleep': 'fas fa-bed'
        };
        const goalLabels = {
            'calories': 'Calorias',
            'water': 'Água',
            'exercise': 'Exercício',
            'sleep': 'Sono'
        };
        const goalUnits = {
            'calories': 'kcal',
            'water': 'ml',
            'exercise': 'min',
            'sleep': 'h'
        };
        
        // Atualizar título da página
        const titleSpan = document.querySelector('.challenges-page-title span');
        if (titleSpan) {
            titleSpan.textContent = challenge.name;
        }
        
        let html = `
            <div class="challenge-card">
                <div class="challenge-card-header">
                    <h2 class="challenge-card-title">${escapeHtml(challenge.name)}</h2>
                    <span class="challenge-status ${status.class}">${status.text}</span>
                </div>
                
                ${challenge.description ? `
                    <p class="challenge-description">${escapeHtml(challenge.description).replace(/\n/g, '<br>')}</p>
                ` : ''}
                
                <div class="challenge-meta">
                    <div class="challenge-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formatDate(challenge.start_date)} - ${formatDate(challenge.end_date)}</span>
                    </div>
                    <div class="challenge-meta-item">
                        <i class="fas fa-users"></i>
                        <span>${challenge.total_participants} participante${challenge.total_participants > 1 ? 's' : ''}</span>
                    </div>
                </div>
                
                ${status.class === 'active' ? `
                    <div class="challenge-progress">
                        <div class="challenge-progress-info">
                            <span>${progress.daysRemaining} dia${progress.daysRemaining !== 1 ? 's' : ''} restante${progress.daysRemaining !== 1 ? 's' : ''}</span>
                            <span>${progress.percentage}%</span>
                        </div>
                        <div class="challenge-progress-bar">
                            <div class="challenge-progress-fill" style="width: ${progress.percentage}%;"></div>
                        </div>
                    </div>
                ` : ''}
                
                ${goals.length > 0 ? `
                    <div class="challenge-goals">
                        ${goals.map(goal => {
                            const icon = goalIcons[goal.type] || 'fas fa-bullseye';
                            const label = goalLabels[goal.type] || goal.type;
                            const unit = goalUnits[goal.type] || '';
                            return `
                                <span class="challenge-goal-badge">
                                    <i class="${icon}"></i>
                                    <span>${label}</span>
                                    ${goal.value ? `<span>${goal.value} ${unit}</span>` : ''}
                                </span>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                
                <!-- Progresso do Usuário -->
                <div class="challenge-dashboard-section">
                    <h3 class="challenge-dashboard-title">
                        <i class="fas fa-chart-line"></i>
                        Meu Progresso
                    </h3>
                    
                    <div class="challenge-stats-grid">
                        <div class="challenge-stat-card">
                            <div class="challenge-stat-icon" style="background: rgba(255, 107, 0, 0.1);">
                                <i class="fas fa-trophy" style="color: var(--accent-orange);"></i>
                            </div>
                            <div class="challenge-stat-value">${challenge.user_total_points || 0}</div>
                            <div class="challenge-stat-label">Pontos</div>
                        </div>
                        <div class="challenge-stat-card">
                            <div class="challenge-stat-icon" style="background: rgba(34, 197, 94, 0.1);">
                                <i class="fas fa-medal" style="color: #22C55E;"></i>
                            </div>
                            <div class="challenge-stat-value">#${challenge.user_rank || '-'}</div>
                            <div class="challenge-stat-label">Posição</div>
                        </div>
                        <div class="challenge-stat-card">
                            <div class="challenge-stat-icon" style="background: rgba(59, 130, 246, 0.1);">
                                <i class="fas fa-calendar-check" style="color: #3B82F6;"></i>
                            </div>
                            <div class="challenge-stat-value">${challenge.days_active || 0}</div>
                            <div class="challenge-stat-label">Dias</div>
                        </div>
                    </div>
                </div>
                
                <!-- Participantes -->
                ${participants && participants.length > 0 ? `
                    <div class="challenge-participants-section">
                        <h3 class="challenge-participants-title">Participantes</h3>
                        <div class="challenge-participants-list">
                            ${participants.map((p, index) => {
                                const rank = index + 1;
                                const colors = ['#FF6B00', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#F59E0B'];
                                const colorIndex = p.name.charCodeAt(0) % colors.length;
                                const bgColor = colors[colorIndex];
                                
                                // Gerar iniciais
                                const nameParts = p.name.split(' ');
                                let initials = '';
                                if (nameParts.length >= 2) {
                                    initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
                                } else {
                                    initials = p.name.substring(0, 2).toUpperCase();
                                }
                                
                                const hasPhoto = p.profile_image_filename && p.profile_image_filename.trim() !== '';
                                const photoUrl = hasPhoto ? `https://appshapefit.com/assets/images/users/${p.profile_image_filename}` : '';
                                
                                return `
                                    <div class="challenge-participant-item">
                                        <div class="challenge-participant-rank">#${rank}</div>
                                        <div class="challenge-participant-avatar" style="background-color: ${hasPhoto ? 'transparent' : bgColor}; color: white;">
                                            ${hasPhoto ? `<img src="${photoUrl}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'; this.parentElement.textContent='${initials}'; this.parentElement.style.backgroundColor='${bgColor}';">` : initials}
                                        </div>
                                        <div class="challenge-participant-info">
                                            <div class="challenge-participant-name">${escapeHtml(p.name)}</div>
                                            <div class="challenge-participant-points">${(p.challenge_points || 0).toLocaleString('pt-BR')} pontos</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
    }
    
    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Carregar lista de desafios
    async function loadChallengesList() {
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Token não encontrado');
            }
            
            const response = await authenticatedFetch(`${API_BASE_URL}/challenge_rooms.php`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar desafios');
            }
            
            const data = await response.json();
            
            document.getElementById('challenges-loading').style.display = 'none';
            
            if (data.success && data.challenges && data.challenges.length > 0) {
                renderChallengesList(data.challenges);
            } else {
                document.getElementById('challenges-empty').style.display = 'block';
            }
        } catch (error) {
            console.error('[Challenges] Erro ao carregar lista:', error);
            document.getElementById('challenges-loading').style.display = 'none';
            document.getElementById('challenges-empty').style.display = 'block';
        }
    }
    
    // Carregar detalhes do desafio
    async function loadChallengeDetail(challengeId) {
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Token não encontrado');
            }
            
            const response = await authenticatedFetch(`${API_BASE_URL}/challenge_rooms.php?id=${challengeId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar desafio');
            }
            
            const data = await response.json();
            
            document.getElementById('challenges-loading').style.display = 'none';
            
            if (data.success && data.challenge) {
                renderChallengeDetail(data.challenge, data.participants || []);
            } else {
                // Redirecionar para lista se desafio não encontrado
                window.SPARouter.navigate('/fragments/challenges.html');
            }
        } catch (error) {
            console.error('[Challenges] Erro ao carregar detalhes:', error);
            document.getElementById('challenges-loading').style.display = 'none';
            // Redirecionar para lista em caso de erro
            window.SPARouter.navigate('/fragments/challenges.html');
        }
    }
    
    // Inicializar página
    function initChallengePage() {
        // Setup do modal de ajuda
        setupHelpModal();
        
        const challengeId = getChallengeIdFromUrl();
        
        if (challengeId) {
            // Carregar detalhes do desafio específico
            loadChallengeDetail(challengeId);
        } else {
            // Carregar lista de desafios
            loadChallengesList();
        }
    }
    
    // Iniciar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChallengePage);
    } else {
        initChallengePage();
    }
})();
