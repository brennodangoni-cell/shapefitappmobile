
/**
 * Script Inline Protegido - inline_3
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        // ========================================
        // CARREGAR E RENDERIZAR RANKING
        // ========================================
        (async function() {
            const BASE_URL = window.BASE_APP_URL;
            let currentLimit = 15;
            let totalUsers = 0;
            let currentUserId = null;
            
            // Verificar autenticação
            const authenticated = await requireAuth();
            if (!authenticated) {
                return;
            }
            
            // Função para renderizar foto de perfil (igual ao PHP: getUserProfileImageHtml)
            function renderUserAvatar(playerData, size = 'normal') {
                if (!playerData) return '';
                
                const isLarge = size === 'large';
                const classSize = isLarge ? 'player-avatar-large' : 'player-avatar';
                
                if (playerData.image_url || playerData.profile_image_filename) {
                    const imageUrl = playerData.image_url || `${BASE_URL}/assets/images/users/${playerData.profile_image_filename}`;
                    const thumbUrl = playerData.thumb_url || (playerData.profile_image_filename ? `${BASE_URL}/assets/images/users/thumb_${playerData.profile_image_filename}` : null);
                    
                    // Tentar imagem original primeiro, depois thumbnail, depois ícone (igual ao PHP)
                    if (thumbUrl) {
                        return `
                            <div class="${classSize}">
                                <img src="${imageUrl}" alt="Foto de Perfil" onerror="this.onerror=null; this.src='${thumbUrl}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}">
                                <i class="fas fa-user" style="display:none;"></i>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="${classSize}">
                                <img src="${imageUrl}" alt="Foto de Perfil" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <i class="fas fa-user" style="display:none;"></i>
                            </div>
                        `;
                    }
                }
                
                // Se não tem foto, mostrar ícone (igual ao PHP)
                return `<div class="${classSize}"><i class="fas fa-user"></i></div>`;
            }
            
            // Função para formatar número
            function formatNumber(num) {
                return new Intl.NumberFormat('pt-BR').format(num);
            }
            
            // Função para renderizar avatar do pódio com badge
            function renderPodiumAvatar(playerData, badgeContent) {
                const avatarHtml = playerData 
                    ? (playerData.image_url || playerData.profile_image_filename 
                        ? `<img src="${playerData.image_url || `${BASE_URL}/assets/images/users/${playerData.profile_image_filename}`}" alt="Foto" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <i class="fas fa-user" style="display:none;"></i>`
                        : `<i class="fas fa-user"></i>`)
                    : `<i class="fas fa-user"></i>`;
                
                return `
                    <div class="podium-avatar-wrapper">
                        <div class="player-avatar-large">
                            ${avatarHtml}
                        </div>
                        <div class="rank-badge">${badgeContent}</div>
                    </div>
                `;
            }
            
            // Função para renderizar pódio
            function renderPodium(podium) {
                const container = document.getElementById('podium-container');
                if (!container) return;
                
                if (!podium || podium.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhum usuário no ranking ainda.</p>';
                    return;
                }
                
                // Garantir que temos pelo menos 3 posições (preencher com null se necessário)
                const first = podium[0] || null;
                const second = podium[1] || null;
                const third = podium[2] || null;
                
                let html = '';
                
                // 2º Lugar
                html += `
                    <div class="podium-place second">
                        ${renderPodiumAvatar(second, '2')}
                        <span class="podium-name">${second ? escapeHtml(second.name.split(' ')[0]) : '-'}</span>
                        <span class="podium-level">${second ? escapeHtml(second.level) : '-'}</span>
                        <span class="podium-points">${second ? formatNumber(second.points) + ' pts' : '-'}</span>
                    </div>
                `;
                
                // 1º Lugar
                html += `
                    <div class="podium-place first">
                        ${renderPodiumAvatar(first, '<i class="fas fa-crown"></i>')}
                        <span class="podium-name">${first ? escapeHtml(first.name.split(' ')[0]) : '-'}</span>
                        <span class="podium-level">${first ? escapeHtml(first.level) : '-'}</span>
                        <span class="podium-points">${first ? formatNumber(first.points) + ' pts' : '-'}</span>
                    </div>
                `;
                
                // 3º Lugar
                html += `
                    <div class="podium-place third">
                        ${renderPodiumAvatar(third, '3')}
                        <span class="podium-name">${third ? escapeHtml(third.name.split(' ')[0]) : '-'}</span>
                        <span class="podium-level">${third ? escapeHtml(third.level) : '-'}</span>
                        <span class="podium-points">${third ? formatNumber(third.points) + ' pts' : '-'}</span>
                    </div>
                `;
                
                container.innerHTML = html;
            }
            
            // Função para renderizar lista
            function renderList(list, currentUserId) {
                const listEl = document.getElementById('ranking-list');
                if (!listEl) return;
                
                if (!list || list.length === 0) {
                    listEl.innerHTML = '<li style="text-align: center; padding: 40px; color: var(--text-secondary);">Nenhum usuário na lista.</li>';
                    return;
                }
                
                let html = '';
                list.forEach(player => {
                    const isCurrentUser = player.id == currentUserId;
                    html += `
                        <li class="ranking-item ${isCurrentUser ? 'current-user' : ''}">
                            <div class="rank-position">${player.user_rank}</div>
                            <div class="player-content">
                                ${renderUserAvatar(player)}
                                <div class="player-info">
                                    <h3 class="player-name">${escapeHtml(player.name)}</h3>
                                    <p class="player-level">${escapeHtml(player.level)}</p>
                                </div>
                            </div>
                            <span class="player-points">${formatNumber(player.points)} pts</span>
                        </li>
                    `;
                });
                
                listEl.innerHTML = html;
            }
            
            // Função para carregar dados do ranking
            async function loadRankingData(limit = 15) {
                try {
                    const response = await authenticatedFetch(`${BASE_URL}/api/get_ranking_data.php?limit=${limit}`);
                    if (!response) {
                        console.error('❌ [Ranking] Resposta vazia da API');
                        return null;
                    }
                    
                    // Clonar resposta para poder ler como texto (debug) e JSON
                    const responseClone = response.clone();
                    
                    // Verificar status da resposta
                    if (!response.ok) {
                        console.error('❌ [Ranking] Erro HTTP:', response.status, response.statusText);
                        const text = await responseClone.text();
                        console.error('❌ [Ranking] Resposta:', text);
                        return null;
                    }
                    
                    // Ler resposta como texto primeiro para debug
                    const text = await responseClone.text();
                    console.log('📥 [Ranking] Resposta da API (primeiros 500 chars):', text.substring(0, 500));
                    
                    // Tentar parsear JSON
                    let result;
                    try {
                        result = JSON.parse(text);
                    } catch (parseError) {
                        console.error('❌ [Ranking] Erro ao parsear JSON:', parseError);
                        console.error('❌ [Ranking] Texto completo:', text);
                        return null;
                    }
                    
                    if (!result.success) {
                        console.error('❌ [Ranking] API retornou erro:', result.message || result.error);
                        throw new Error(result.message || 'Erro ao carregar ranking');
                    }
                    
                    return result.data;
                } catch (error) {
                    console.error('❌ [Ranking] Erro ao carregar ranking:', error);
                    return null;
                }
            }
            
            // Carregar dados iniciais
            const data = await loadRankingData(currentLimit);
            
            if (data) {
                currentUserId = data.current_user?.id || null;
                totalUsers = data.total_users || 0;
                currentLimit = data.current_limit || 15;
                
                // Atualizar pontos do usuário
                const pointsDisplay = document.getElementById('user-points-display');
                if (pointsDisplay) {
                    pointsDisplay.textContent = formatNumber(data.user_points || 0);
                }
                
                // Renderizar pódio
                renderPodium(data.podium || []);
                
                // Renderizar lista
                renderList(data.list || [], currentUserId);
                
                // Mostrar botão "Carregar Mais" se houver mais usuários
                const loadMoreContainer = document.getElementById('load-more-container');
                const loadMoreBtn = document.getElementById('load-more-btn');
                
                if (data.has_more_users && loadMoreContainer && loadMoreBtn) {
                    loadMoreContainer.style.display = 'flex';
                    const remaining = totalUsers - currentLimit;
                    loadMoreBtn.querySelector('.users-count').textContent = `(${remaining} restantes)`;
                    
                    loadMoreBtn.addEventListener('click', async function(e) {
                        e.preventDefault();
                        
                        if (this.classList.contains('loading')) return;
                        
                        this.classList.add('loading');
                        this.innerHTML = '<i class="fas fa-spinner"></i>Carregando...';
                        
                        const newLimit = Math.min(currentLimit + 15, totalUsers);
                        const newData = await loadRankingData(newLimit);
                        
                        if (newData) {
                            currentLimit = newData.current_limit || newLimit;
                            
                            // Adicionar novos usuários à lista (após os 3 primeiros do pódio)
                            const newList = newData.list || [];
                            const currentList = document.getElementById('ranking-list');
                            
                            // Obter ranks já existentes na lista
                            const existingRanks = new Set();
                            Array.from(currentList.children).forEach(li => {
                                const rankPos = li.querySelector('.rank-position');
                                if (rankPos) {
                                    existingRanks.add(parseInt(rankPos.textContent));
                                }
                            });
                            
                            // Adicionar apenas usuários novos (que não estão na lista)
                            newList.forEach(player => {
                                if (!existingRanks.has(player.user_rank)) {
                                    const isCurrentUser = player.id == currentUserId;
                                    const li = document.createElement('li');
                                    li.className = `ranking-item ${isCurrentUser ? 'current-user' : ''}`;
                                    li.innerHTML = `
                                        <div class="rank-position">${player.user_rank}</div>
                                        <div class="player-content">
                                            ${renderUserAvatar(player)}
                                            <div class="player-info">
                                                <h3 class="player-name">${escapeHtml(player.name)}</h3>
                                                <p class="player-level">${escapeHtml(player.level)}</p>
                                            </div>
                                        </div>
                                        <span class="player-points">${formatNumber(player.points)} pts</span>
                                    `;
                                    currentList.appendChild(li);
                                    existingRanks.add(player.user_rank);
                                }
                            });
                            
                            // Atualizar ou remover botão
                            if (newData.has_more_users) {
                                const remaining = totalUsers - currentLimit;
                                this.classList.remove('loading');
                                this.innerHTML = `
                                    <i class="fas fa-chevron-down"></i>
                                    Carregar Mais
                                    <span class="users-count">(${remaining} restantes)</span>
                                `;
                            } else {
                                loadMoreContainer.style.display = 'none';
                            }
                        } else {
                            this.classList.remove('loading');
                            this.innerHTML = `
                                <i class="fas fa-chevron-down"></i>
                                Carregar Mais
                                <span class="users-count">(${totalUsers - currentLimit} restantes)</span>
                            `;
                            alert('Erro ao carregar mais usuários. Tente novamente.');
                        }
                    });
                } else if (loadMoreContainer) {
                    loadMoreContainer.style.display = 'none';
                }
            } else {
                // Mostrar erro
                const rankingList = document.getElementById('ranking-list');
                if (rankingList) {
                    rankingList.innerHTML = '<li style="text-align: center; padding: 40px; color: var(--text-secondary);">Erro ao carregar ranking. Tente novamente.</li>';
                }
            }
        })();
    
})();
