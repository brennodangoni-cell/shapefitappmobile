<?php
// api/get_ranking_data.php - Busca dados do ranking

// Limpar qualquer output buffer antes de começar
while (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../includes/config.php';
require_once '../includes/db.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

// Função helper para enviar resposta JSON
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit();
}

// Autenticação via token ou sessão
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    sendJsonResponse(['success' => false, 'message' => 'Não autenticado.'], 401);
}

$user_id = $user['id'];
$initial_limit = 15;
$current_limit = isset($_GET['limit']) ? (int)$_GET['limit'] : $initial_limit;

// ===================================================================
// === SISTEMA DE NÍVEIS POR CATEGORIA ==============================
// ===================================================================

$level_categories = [
    ['name' => 'Franguinho',           'threshold' => 0],
    ['name' => 'Frango',               'threshold' => 1500],
    ['name' => 'Frango de Elite',      'threshold' => 4000],
    ['name' => 'Atleta de Bronze',     'threshold' => 8000],
    ['name' => 'Atleta de Prata',      'threshold' => 14000],
    ['name' => 'Atleta de Ouro',       'threshold' => 22000],
    ['name' => 'Atleta de Platina',    'threshold' => 32000],
    ['name' => 'Atleta de Diamante',   'threshold' => 45000],
    ['name' => 'Atleta de Elite',      'threshold' => 60000],
    ['name' => 'Mestre',               'threshold' => 80000],
    ['name' => 'Virtuoso',             'threshold' => 105000],
    ['name' => 'Campeão',              'threshold' => 135000],
    ['name' => 'Titã',                 'threshold' => 170000],
    ['name' => 'Pioneiro',             'threshold' => 210000],
    ['name' => 'Lenda',                'threshold' => 255000],
];

function toRoman($number) {
    $romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return $romans[$number] ?? 'X';
}

function getUserLevel($points, $categories) {
    foreach ($categories as $index => $category) {
        if ($points < $category['threshold']) {
            $previous_category = $index > 0 ? $categories[$index - 1] : ['threshold' => 0];
            $sublevel = min(10, max(1, floor(($points - $previous_category['threshold']) / (($category['threshold'] - $previous_category['threshold']) / 10)) + 1));
            return $category['name'] . ' ' . toRoman($sublevel);
        }
    }
    $last_category = end($categories);
    return $last_category['name'] . ' X';
}

try {
    // Verificar se a coluna status existe
    $check_status = $conn->query("SHOW COLUMNS FROM sf_users LIKE 'status'");
    $has_status_column = $check_status && $check_status->num_rows > 0;
    if ($check_status) $check_status->free();
    
    $status_condition = $has_status_column ? "AND COALESCE(u.status, 'active') = 'active'" : "";
    
    // Buscar rankings
    $rankings = [];
    $stmt = $conn->prepare("SELECT u.id, u.name, u.points, up.profile_image_filename, up.gender, RANK() OVER (ORDER BY u.points DESC, u.name ASC) as user_rank FROM sf_users u LEFT JOIN sf_user_profiles up ON u.id = up.user_id WHERE 1=1 $status_condition ORDER BY user_rank ASC LIMIT ?");
    $stmt->bind_param("i", $current_limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $loaded_user_ids = [];
    while ($row = $result->fetch_assoc()) {
        $row['level'] = getUserLevel($row['points'], $level_categories);
        // Adicionar URL completa da imagem
        if (!empty($row['profile_image_filename'])) {
            $row['image_url'] = BASE_APP_URL . '/assets/images/users/' . $row['profile_image_filename'];
            $row['thumb_url'] = BASE_APP_URL . '/assets/images/users/thumb_' . $row['profile_image_filename'];
        } else {
            $row['image_url'] = null;
            $row['thumb_url'] = null;
        }
        $rankings[] = $row;
        $loaded_user_ids[] = $row['id'];
    }
    $stmt->close();
    
    // Verificar se há mais usuários para carregar
    $total_users_sql = "SELECT COUNT(*) as total FROM sf_users";
    if ($has_status_column) {
        $total_users_sql .= " WHERE COALESCE(status, 'active') = 'active'";
    }
    $total_users_stmt = $conn->prepare($total_users_sql);
    $total_users_stmt->execute();
    $total_users_result = $total_users_stmt->get_result();
    $total_users = $total_users_result->fetch_assoc()['total'];
    $total_users_stmt->close();
    
    $has_more_users = $current_limit < $total_users;
    
    // Verificar se o usuário atual está na lista carregada
    $current_user_in_loaded_list = in_array($user_id, $loaded_user_ids);
    
    // Buscar dados do usuário atual (com filtro de status)
    $status_condition_rank = $has_status_column ? "WHERE COALESCE(status, 'active') = 'active'" : "";
    $stmt_my_rank = $conn->prepare("SELECT rank, points FROM (SELECT id, points, RANK() OVER (ORDER BY points DESC, name ASC) as rank FROM sf_users $status_condition_rank) as r WHERE id = ?");
    $stmt_my_rank->bind_param("i", $user_id);
    $stmt_my_rank->execute();
    $my_rank_result = $stmt_my_rank->get_result()->fetch_assoc();
    $my_rank = $my_rank_result['rank'] ?? null;
    $my_points = $my_rank_result['points'] ?? 0;
    $stmt_my_rank->close();
    
    // Buscar oponente (pessoa que aparece na disputa no main_app) - com filtro de status
    $opponent_rank = ($my_rank && $my_rank > 1) ? $my_rank - 1 : ($my_rank == 1 ? 2 : null);
    $opponent_data = null;
    if ($opponent_rank && $opponent_rank > 0) {
        $status_condition_opponent = $has_status_column ? "WHERE COALESCE(u.status, 'active') = 'active'" : "";
        $stmt_opponent = $conn->prepare("SELECT * FROM (SELECT u.id, u.name, u.points, up.profile_image_filename, up.gender, RANK() OVER (ORDER BY u.points DESC, u.name ASC) as rank FROM sf_users u LEFT JOIN sf_user_profiles up ON u.id = up.user_id $status_condition_opponent) as ranked_users WHERE rank = ? LIMIT 1");
        $stmt_opponent->bind_param("i", $opponent_rank);
        $stmt_opponent->execute();
        $opponent_data = $stmt_opponent->get_result()->fetch_assoc();
        if ($opponent_data) {
            $opponent_data['level'] = getUserLevel($opponent_data['points'], $level_categories);
            $opponent_data['user_rank'] = $opponent_data['rank'];
            // Adicionar URL completa da imagem
            if (!empty($opponent_data['profile_image_filename'])) {
                $opponent_data['image_url'] = BASE_APP_URL . '/assets/images/users/' . $opponent_data['profile_image_filename'];
                $opponent_data['thumb_url'] = BASE_APP_URL . '/assets/images/users/thumb_' . $opponent_data['profile_image_filename'];
            } else {
                $opponent_data['image_url'] = null;
                $opponent_data['thumb_url'] = null;
            }
        }
        $stmt_opponent->close();
    }
    
    // Se o usuário não está na lista, adicionar ele
    $current_user_data = null;
    if (!$current_user_in_loaded_list && $user_id && $my_rank) {
        $status_condition_subquery = $has_status_column ? "WHERE COALESCE(status, 'active') = 'active'" : "";
        $stmt_user = $conn->prepare("SELECT u.id, u.name, u.points, up.profile_image_filename, up.gender, r.user_rank FROM sf_users u LEFT JOIN sf_user_profiles up ON u.id = up.user_id JOIN (SELECT id, RANK() OVER (ORDER BY points DESC, name ASC) as user_rank FROM sf_users $status_condition_subquery) r ON u.id = r.id WHERE u.id = ?");
        $stmt_user->bind_param("i", $user_id);
        $stmt_user->execute();
        $current_user_data = $stmt_user->get_result()->fetch_assoc();
        
        if ($current_user_data) {
            $current_user_data['level'] = getUserLevel($current_user_data['points'], $level_categories);
            // Adicionar URL completa da imagem
            if (!empty($current_user_data['profile_image_filename'])) {
                $current_user_data['image_url'] = BASE_APP_URL . '/assets/images/users/' . $current_user_data['profile_image_filename'];
                $current_user_data['thumb_url'] = BASE_APP_URL . '/assets/images/users/thumb_' . $current_user_data['profile_image_filename'];
            } else {
                $current_user_data['image_url'] = null;
                $current_user_data['thumb_url'] = null;
            }
        }
        $stmt_user->close();
    }
    
    // Se o oponente não está na lista, adicionar ele também
    if ($opponent_data && !in_array($opponent_data['id'], $loaded_user_ids)) {
        $rankings[] = $opponent_data;
    }
    
    // Reordenar rankings por rank
    usort($rankings, function($a, $b) {
        return $a['user_rank'] <=> $b['user_rank'];
    });
    
    // Separar pódio (top 3) e lista (resto)
    // IMPORTANTE: O pódio são os 3 primeiros (índices 0, 1, 2)
    // A lista começa do índice 3 em diante
    $podium = array_slice($rankings, 0, 3);
    $list = array_slice($rankings, 3);
    
    // Se o usuário atual não está na lista carregada, adicionar ele
    if ($current_user_data && !in_array($current_user_data['id'], $loaded_user_ids)) {
        // Verificar se já não está no pódio ou na lista
        $already_in_podium = false;
        $already_in_list = false;
        foreach ($podium as $p) {
            if ($p['id'] == $current_user_data['id']) {
                $already_in_podium = true;
                break;
            }
        }
        if (!$already_in_podium) {
            foreach ($list as $l) {
                if ($l['id'] == $current_user_data['id']) {
                    $already_in_list = true;
                    break;
                }
            }
            if (!$already_in_list) {
                $list[] = $current_user_data;
                // Reordenar lista por rank
                usort($list, function($a, $b) {
                    return $a['user_rank'] <=> $b['user_rank'];
                });
            }
        }
    }
    
    // Buscar dados do perfil do usuário para pontos
    $user_profile_data = getUserProfileData($conn, $user_id);
    
    sendJsonResponse([
        'success' => true,
        'data' => [
            'podium' => $podium,
            'list' => $list,
            'current_user' => $current_user_data,
            'my_rank' => $my_rank,
            'my_points' => (float)$my_points,
            'user_points' => (float)($user_profile_data['points'] ?? 0),
            'total_users' => (int)$total_users,
            'current_limit' => $current_limit,
            'has_more_users' => $has_more_users
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro em get_ranking_data.php: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao buscar dados do ranking.',
        'error' => $e->getMessage()
    ], 500);
}
?>

