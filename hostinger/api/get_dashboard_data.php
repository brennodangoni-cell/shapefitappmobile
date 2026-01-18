<?php
// Arquivo: api/get_dashboard_data.php (VERSÃO FINAL COMPLETA COM TOKEN)

// Desabilitar output buffering e limpar qualquer output anterior
while (ob_get_level()) {
    ob_end_clean();
}

// Ativar error reporting para debug (remover em produção se necessário)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Não mostrar erros na tela, apenas logar

// Headers de CORS que permitem a autenticação por token
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header('Content-Type: application/json; charset=utf-8');

// Função para enviar resposta JSON e sair
function sendJsonResponse($data, $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit();
}

// Responde a requisições de pré-verificação (preflight) do navegador/app
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Carrega todas as dependências
require_once '../includes/config.php';
$conn = require '../includes/db.php'; // Capturar o retorno do db.php
require_once '../includes/auth.php'; // Para a função getUserByAuthToken
require_once '../includes/functions.php';

// --- NOVA AUTENTICAÇÃO POR TOKEN ---
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
// Remove o "Bearer " do início do cabeçalho para obter o token puro
$token = $auth_header ? str_replace('Bearer ', '', $auth_header) : null;

try {
    $user = getUserByAuthToken($conn, $token);
} catch (Exception $e) {
    error_log("Erro ao buscar usuário por token: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Erro ao validar token.'], 500);
}

if (!$user) {
    sendJsonResponse(['success' => false, 'message' => 'Token inválido ou expirado. Por favor, faça o login novamente.'], 401);
}
$user_id = $user['id']; // Temos o ID do usuário validado!
// --- FIM DA NOVA AUTENTICAÇÃO ---

// Prepara o array de resposta padrão
$response = ['success' => false, 'data' => []];
$current_date = date('Y-m-d');

try {
    // --- COLETA DE TODOS OS DADOS PARA O DASHBOARD ---

    // 1. Dados do Perfil e Metas
    try {
        $user_profile_data = getUserProfileData($conn, $user_id);
    } catch (Exception $e) {
        error_log("Erro ao buscar perfil do usuário: " . $e->getMessage());
        throw new Exception("Erro ao buscar perfil: " . $e->getMessage());
    }
    
    if (!$user_profile_data) {
        throw new Exception("Perfil de usuário não encontrado.");
    }

    $age_years = calculateAge($user_profile_data['dob']);
    $total_daily_calories_goal = calculateTargetDailyCalories($user_profile_data['gender'], (float)$user_profile_data['weight_kg'], (int)$user_profile_data['height_cm'], $age_years, $user_profile_data['exercise_frequency'], $user_profile_data['objective']);
    $macros_goal = calculateMacronutrients($total_daily_calories_goal, $user_profile_data['objective']);
    // Meta de água: priorizar customizada se existir
    if (!empty($user_profile_data['custom_water_goal_ml'])) {
        $customMl = (int)$user_profile_data['custom_water_goal_ml'];
        $cupSize = 250;
        $water_goal_data = [
            'total_ml' => $customMl,
            'cup_size_ml' => $cupSize,
            'cups' => (int)ceil($customMl / $cupSize),
        ];
    } else {
        $water_goal_data = getWaterIntakeSuggestion((float)$user_profile_data['weight_kg']);
    }
    
    // 2. Dados de Consumo Diário
    updateDailyTracking($conn, $user_id, $current_date);
    $daily_tracking = getDailyTrackingRecord($conn, $user_id, $current_date);
    
    // Calcular calorias por tipo de refeição
    $calories_by_meal_type = [];
    $stmt_meal_types = $conn->prepare("
        SELECT meal_type, SUM(kcal_consumed) as total_kcal 
        FROM sf_user_meal_log 
        WHERE user_id = ? AND date_consumed = ? 
        GROUP BY meal_type
    ");
    if ($stmt_meal_types) {
        $stmt_meal_types->bind_param("is", $user_id, $current_date);
        $stmt_meal_types->execute();
        $result_meal_types = $stmt_meal_types->get_result();
        while ($row = $result_meal_types->fetch_assoc()) {
            $calories_by_meal_type[$row['meal_type']] = (float)$row['total_kcal'];
        }
        $stmt_meal_types->close();
    }

    // 3. Lógica do Banner de Peso
    $stmt_last_weight = $conn->prepare("SELECT MAX(date_recorded) AS last_date FROM sf_user_weight_history WHERE user_id = ?");
    $stmt_last_weight->bind_param("i", $user_id);
    $stmt_last_weight->execute();
    $result_weight = $stmt_last_weight->get_result()->fetch_assoc();
    $stmt_last_weight->close();

    $show_edit_button = true;
    $days_until_next_weight_update = 0;
    if ($result_weight && !empty($result_weight['last_date'])) {
        $last_log_date = new DateTime($result_weight['last_date']);
        $unlock_date = (clone $last_log_date)->modify('+7 days');
        $today = new DateTime('today');
        if ($today < $unlock_date) {
            $show_edit_button = false;
            $days_until_next_weight_update = (int)$today->diff($unlock_date)->days;
            if ($days_until_next_weight_update == 0) $days_until_next_weight_update = 1;
        }
    }

    // 4. Lógica de Rotina / Missões
    $routine_items = getRoutineItemsForUser($conn, $user_id, $current_date, $user_profile_data);
    $completed_missions = 0;
    foreach($routine_items as $item) {
        if ($item['completion_status'] == 1) {
            $completed_missions++;
        }
    }
    $total_missions = count($routine_items);
    $routine_progress_percentage = ($total_missions > 0) ? round(($completed_missions / $total_missions) * 100) : 0;
    
    // 5. Lógica de Sugestão de Refeição
    $meal_suggestion_data = getMealSuggestions($conn);
    
    // Adicionar URLs completas das imagens para receitas nas sugestões
    if (!empty($meal_suggestion_data['recipes'])) {
        foreach ($meal_suggestion_data['recipes'] as &$recipe) {
            if (!empty($recipe['image_filename'])) {
                $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/' . $recipe['image_filename'];
            } else {
                $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/placeholder_food.jpg';
            }
        }
        unset($recipe);
    }
    
    // 6. Lógica do Ranking (com filtro de status)
    // Verificar se a coluna status existe
    $check_status = $conn->query("SHOW COLUMNS FROM sf_users LIKE 'status'");
    $has_status_column = $check_status && $check_status->num_rows > 0;
    if ($check_status) $check_status->free();
    
    $status_condition_rank = $has_status_column ? "WHERE COALESCE(status, 'active') = 'active'" : "";
    $stmt_my_rank = $conn->prepare("SELECT rank, points FROM (SELECT id, points, RANK() OVER (ORDER BY points DESC, name ASC) as rank FROM sf_users $status_condition_rank) as r WHERE id = ?");
    $stmt_my_rank->bind_param("i", $user_id);
    $stmt_my_rank->execute();
    $my_rank_result = $stmt_my_rank->get_result()->fetch_assoc();
    $my_rank = $my_rank_result['rank'] ?? 'N/A';
    $my_points = $my_rank_result['points'] ?? 0;
    $stmt_my_rank->close();
    
    $opponent_rank = ($my_rank > 1) ? $my_rank - 1 : 2;
    $opponent_data = null;
    if ($opponent_rank > 0) {
        $status_condition_opponent = $has_status_column ? "WHERE COALESCE(u.status, 'active') = 'active'" : "";
        $stmt_opponent = $conn->prepare("SELECT * FROM (SELECT u.id, u.name, u.points, up.profile_image_filename, up.gender, RANK() OVER (ORDER BY u.points DESC, name ASC) as rank FROM sf_users u LEFT JOIN sf_user_profiles up ON u.id = up.user_id $status_condition_opponent) as ranked_users WHERE rank = ? LIMIT 1");
        $stmt_opponent->bind_param("i", $opponent_rank);
        $stmt_opponent->execute();
        $opponent_data = $stmt_opponent->get_result()->fetch_assoc();
        $stmt_opponent->close();
    }
    
    $user_progress_percentage = 0;
    if ($my_rank > 1 && isset($opponent_data['points']) && $opponent_data['points'] > 0) {
        $user_progress_percentage = min(100, round(($my_points / $opponent_data['points']) * 100));
    } elseif ($my_rank == 1) {
        $user_progress_percentage = 100;
    }
    
    // 7. Grupos de Desafio
    $challenge_groups_query = "
        SELECT 
            cg.*,
            COUNT(DISTINCT cgm.user_id) as total_participants
        FROM sf_challenge_groups cg
        INNER JOIN sf_challenge_group_members cgm ON cg.id = cgm.group_id
        WHERE cgm.user_id = ? AND cg.status != 'inactive'
        GROUP BY cg.id
        ORDER BY cg.start_date DESC, cg.created_at DESC
        LIMIT 5
    ";
    $stmt_challenges = $conn->prepare($challenge_groups_query);
    $stmt_challenges->bind_param("i", $user_id);
    $stmt_challenges->execute();
    $challenge_groups_result = $stmt_challenges->get_result();
    $user_challenge_groups = [];
    while ($row = $challenge_groups_result->fetch_assoc()) {
        $row['goals'] = json_decode($row['goals'] ?? '[]', true);
        $user_challenge_groups[] = $row;
    }
    $stmt_challenges->close();
    
    // 8. Notificações de Desafios
    $challenge_notifications = getChallengeNotifications($conn, $user_id, 5);
    $unread_notifications_count = count($challenge_notifications);
    
    // 9. Check-in disponível - LÓGICA REFATORADA
    // Regra: Check-in semanal que fica disponível desde o dia configurado até ser respondido ou até a próxima semana
    $available_checkin = null;
    
    // Calcular semana atual (domingo da semana ATUAL, não próxima)
    $today = date('Y-m-d');
    $today_day_of_week = (int)date('w'); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    
    // Calcular o domingo desta semana (o que já passou, ou hoje se for domingo)
    if ($today_day_of_week == 0) {
        // Hoje é domingo
        $week_start = $today;
    } else {
        // Voltar até o domingo desta semana
        $week_start = date('Y-m-d', strtotime("-{$today_day_of_week} days"));
    }
    
    error_log("=== CHECK-IN DEBUG INICIAL ===");
    error_log("user_id = {$user_id}");
    error_log("today = {$today}");
    error_log("today_day_of_week = {$today_day_of_week} (0=Domingo, 4=Quinta)");
    error_log("week_start = {$week_start} (domingo DESTA semana)");
    
    // Buscar check-ins ativos
    $stmt = $conn->prepare("SELECT id, name, description, day_of_week FROM sf_checkin_configs WHERE is_active = 1 ORDER BY id ASC");
    if (!$stmt) {
        error_log("ERRO ao preparar query de check-ins: " . $conn->error);
    } else {
        $stmt->execute();
        $checkins = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        error_log("Check-ins ativos encontrados: " . count($checkins));
    }
    
    foreach ($checkins as $checkin) {
        $config_id = (int)$checkin['id'];
        $day_of_week = (int)$checkin['day_of_week'];
        $checkin_name = $checkin['name'];
        
        error_log("--- Verificando check-in: config_id={$config_id}, name={$checkin_name}, day_of_week={$day_of_week} ---");
        error_log("Dia configurado: {$day_of_week} (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)");
        error_log("Dia de hoje: {$today_day_of_week} (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado)");
        
        // Calcular data do check-in desta semana (domingo + dia da semana)
        $checkin_date = date('Y-m-d', strtotime("{$week_start} +{$day_of_week} days"));
        $checkin_timestamp = strtotime($checkin_date . ' 00:00:00');
        $today_timestamp = strtotime($today . ' 00:00:00');
        
        error_log("checkin_date = {$checkin_date}");
        error_log("today = {$today}");
        error_log("checkin_timestamp = {$checkin_timestamp}");
        error_log("today_timestamp = {$today_timestamp}");
        error_log("Comparação: today ({$today}) >= checkin_date ({$checkin_date})? " . ($today >= $checkin_date ? 'SIM' : 'NÃO'));
        error_log("Comparação timestamp: today_timestamp ({$today_timestamp}) >= checkin_timestamp ({$checkin_timestamp})? " . ($today_timestamp >= $checkin_timestamp ? 'SIM' : 'NÃO'));
        
        // Se ainda não chegou o dia configurado, pular
        // Comparar strings de data diretamente (mais confiável)
        if ($today < $checkin_date) {
            error_log("❌ Ainda não chegou o dia configurado ({$checkin_date}), hoje é {$today}, pulando...");
            continue;
        }
        
        error_log("✅ Data OK - hoje ({$today}) >= checkin_date ({$checkin_date})");
        
        error_log("✅ Já passou o dia configurado, continuando verificação...");
        
        // Verificar se usuário tem acesso
        // 1. Verificar se há distribuição
        $stmt_dist = $conn->prepare("SELECT COUNT(*) as cnt FROM sf_checkin_distribution WHERE config_id = ?");
        $stmt_dist->bind_param("i", $config_id);
        $stmt_dist->execute();
        $dist_result = $stmt_dist->get_result()->fetch_assoc();
        $has_distribution = (int)$dist_result['cnt'] > 0;
        $stmt_dist->close();
        
        error_log("has_distribution = " . ($has_distribution ? 'SIM' : 'NÃO'));
        
        $user_has_access = false;
        
        if (!$has_distribution) {
            // Sem distribuição = disponível para todos
            $user_has_access = true;
            error_log("✅ Sem distribuição = acesso liberado para todos");
        } else {
            // Listar distribuições para debug
            $stmt_debug = $conn->prepare("SELECT target_type, target_id FROM sf_checkin_distribution WHERE config_id = ?");
            $stmt_debug->bind_param("i", $config_id);
            $stmt_debug->execute();
            $debug_result = $stmt_debug->get_result();
            $distributions = [];
            while ($row = $debug_result->fetch_assoc()) {
                $distributions[] = $row;
            }
            $stmt_debug->close();
            error_log("Distribuições encontradas: " . json_encode($distributions));
            
            // Verificar grupos do usuário
            $stmt_groups = $conn->prepare("SELECT group_id FROM sf_user_group_members WHERE user_id = ?");
            $stmt_groups->bind_param("i", $user_id);
            $stmt_groups->execute();
            $groups_result = $stmt_groups->get_result();
            $user_groups = [];
            while ($row = $groups_result->fetch_assoc()) {
                $user_groups[] = $row['group_id'];
            }
            $stmt_groups->close();
            error_log("Grupos do usuário: " . json_encode($user_groups));
            
            // Verificar acesso: usuário direto, grupos de usuário ou grupos de desafio
            $stmt_access = $conn->prepare("
                SELECT COUNT(*) as cnt
                FROM sf_checkin_distribution cd
                LEFT JOIN sf_user_group_members ugm ON cd.target_type = 'group' AND cd.target_id > 0 AND cd.target_id = ugm.group_id AND ugm.user_id = ?
                LEFT JOIN sf_challenge_group_members cgm ON cd.target_type = 'group' AND cd.target_id < 0 AND ABS(cd.target_id) = cgm.group_id AND cgm.user_id = ?
                WHERE cd.config_id = ?
                AND (
                    (cd.target_type = 'user' AND cd.target_id = ?)
                    OR ugm.user_id = ?
                    OR cgm.user_id = ?
                )
            ");
            if (!$stmt_access) {
                error_log("ERRO ao preparar query de acesso: " . $conn->error);
            } else {
                $stmt_access->bind_param("iiiiii", $user_id, $user_id, $config_id, $user_id, $user_id, $user_id);
                if (!$stmt_access->execute()) {
                    error_log("ERRO ao executar query de acesso: " . $stmt_access->error);
                } else {
                    $access_result = $stmt_access->get_result()->fetch_assoc();
                    $user_has_access = (int)$access_result['cnt'] > 0;
                    error_log("user_has_access = " . ($user_has_access ? 'SIM' : 'NÃO') . " (count = {$access_result['cnt']})");
                }
                $stmt_access->close();
            }
        }
        
        if (!$user_has_access) {
            error_log("❌ Usuário NÃO tem acesso, pulando...");
            continue;
        }
        
        error_log("✅ Usuário tem acesso, verificando se já completou...");
        
        // Verificar se já completou o check-in desta semana
        $stmt_comp = $conn->prepare("SELECT is_completed FROM sf_checkin_availability WHERE config_id = ? AND user_id = ? AND week_date = ?");
        $stmt_comp->bind_param("iis", $config_id, $user_id, $week_start);
        $stmt_comp->execute();
        $comp = $stmt_comp->get_result()->fetch_assoc();
        $is_completed = $comp ? (int)$comp['is_completed'] : 0;
        $stmt_comp->close();
        
        error_log("is_completed = " . ($is_completed ? 'SIM' : 'NÃO'));
        
        if ($is_completed) {
            error_log("❌ Check-in JÁ COMPLETADO esta semana (config_id={$config_id}, user_id={$user_id}, week_start={$week_start}), pulando...");
            continue;
        }
        
        error_log("✅ Não completou ainda, check-in DISPONÍVEL!");
        
        // Check-in disponível! Buscar perguntas
        $stmt_questions = $conn->prepare("SELECT * FROM sf_checkin_questions WHERE config_id = ? ORDER BY order_index ASC");
        $stmt_questions->bind_param("i", $config_id);
        $stmt_questions->execute();
        $questions_result = $stmt_questions->get_result();
        $questions = [];
        while ($q = $questions_result->fetch_assoc()) {
            $q['options'] = !empty($q['options']) ? json_decode($q['options'], true) : null;
            $q['conditional_logic'] = !empty($q['conditional_logic']) ? json_decode($q['conditional_logic'], true) : null;
            $questions[] = $q;
        }
        $stmt_questions->close();
        
        error_log("Perguntas encontradas: " . count($questions));
        
        // Criar/garantir registro de disponibilidade
        $stmt_avail = $conn->prepare("
            INSERT INTO sf_checkin_availability (config_id, user_id, week_date, is_available, available_at) 
            VALUES (?, ?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE is_available = 1
        ");
        $stmt_avail->bind_param("iis", $config_id, $user_id, $week_start);
        if (!$stmt_avail->execute()) {
            error_log("ERRO ao criar registro de disponibilidade: " . $stmt_avail->error);
        } else {
            error_log("✅ Registro de disponibilidade criado/atualizado");
        }
        $stmt_avail->close();
        
        // Montar objeto do check-in disponível
        $available_checkin = [
            'id' => $config_id,
            'name' => $checkin['name'],
            'description' => $checkin['description'],
            'day_of_week' => $day_of_week,
            'questions' => $questions
        ];
        
        error_log("🎉 CHECK-IN DISPONÍVEL ENCONTRADO! config_id={$config_id}, name={$checkin['name']}, questions=" . count($questions));
        break; // Pegar apenas o primeiro check-in disponível
    }
    
    error_log("=== FIM VERIFICAÇÃO CHECK-IN ===");
    error_log("available_checkin é " . ($available_checkin ? 'NÃO NULL' : 'NULL'));

    // --- MONTAGEM DO OBJETO DE DADOS FINAL PARA O APP ---
    $response['success'] = true;
    $response['data'] = [
        'greeting' => 'Olá, ' . htmlspecialchars(explode(' ', $user_profile_data['name'])[0]),
        'points' => (float)($user_profile_data['points'] ?? 0),
        'profile_image' => $user_profile_data['profile_image_filename'] ?? null,
        'weight_banner' => [
            'show_edit_button' => $show_edit_button,
            'current_weight' => number_format((float)$user_profile_data['weight_kg'], 1) . "kg",
            'days_until_update' => $days_until_next_weight_update
        ],
        'daily_summary' => [
            'kcal' => ['consumed' => (float)($daily_tracking['kcal_consumed'] ?? 0), 'goal' => $total_daily_calories_goal],
            'carbs' => ['consumed' => (float)($daily_tracking['carbs_consumed_g'] ?? 0), 'goal' => $macros_goal['carbs_g']],
            'protein' => ['consumed' => (float)($daily_tracking['protein_consumed_g'] ?? 0), 'goal' => $macros_goal['protein_g']],
            'fat' => ['consumed' => (float)($daily_tracking['fat_consumed_g'] ?? 0), 'goal' => $macros_goal['fat_g']],
        ],
        'water' => [
            'consumed_cups' => (int)($daily_tracking['water_consumed_cups'] ?? 0),
            'goal_cups' => $water_goal_data['cups'],
            'goal_ml' => $water_goal_data['total_ml'],
            'cup_size_ml' => $water_goal_data['cup_size_ml']
        ],
        'routine' => [
            'progress_percentage' => $routine_progress_percentage,
            'completed_missions' => $completed_missions,
            'total_missions' => $total_missions,
            'items' => $routine_items
        ],
        'meal_suggestion' => $meal_suggestion_data,
        'calories_by_meal' => $calories_by_meal_type,
        'ranking' => [
            'my_rank' => $my_rank,
            'my_points' => $my_points,
            'opponent' => $opponent_data,
            'progress_percentage' => $user_progress_percentage
        ],
        'challenge_groups' => $user_challenge_groups,
        'challenge_notifications' => $challenge_notifications,
        'unread_notifications_count' => $unread_notifications_count,
        'available_checkin' => $available_checkin,
        'base_url' => BASE_APP_URL
    ];
    
    // Log final para debug
    if ($available_checkin) {
        error_log("Check-in Debug FINAL: Retornando check-in disponível - config_id = {$available_checkin['id']}, nome = " . ($available_checkin['name'] ?? 'N/A') . ", perguntas = " . (isset($available_checkin['questions']) ? count($available_checkin['questions']) : 0));
    } else {
        error_log("Check-in Debug FINAL: NENHUM check-in será retornado (available_checkin é null)");
    }

} catch (Exception $e) {
    error_log("Erro em get_dashboard_data.php para user_id " . ($user_id ?? 'N/A') . ": " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    $response = ['success' => false, 'message' => "Erro no servidor: " . $e->getMessage()];
} catch (Error $e) {
    // Capturar erros fatais do PHP 7+
    error_log("Erro fatal em get_dashboard_data.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    $response = ['success' => false, 'message' => "Erro fatal no servidor: " . $e->getMessage()];
}

// Envia a resposta JSON final
try {
    if (!isset($response)) {
        $response = ['success' => false, 'message' => 'Erro desconhecido - resposta não definida'];
    }
    sendJsonResponse($response, isset($response['success']) && $response['success'] ? 200 : 500);
} catch (Exception $e) {
    // Último recurso - se até o json_encode falhar
    error_log("Erro ao enviar resposta JSON: " . $e->getMessage());
    http_response_code(500);
    echo '{"success":false,"message":"Erro crítico ao processar resposta"}';
    exit();
}

// Fechar conexão se ainda estiver aberta
if (isset($conn) && $conn) {
    $conn->close();
}
?>