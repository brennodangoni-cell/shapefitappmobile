<?php
// api/get_edit_profile_data.php - Dados para a página edit_profile

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

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit();
}

$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    sendJsonResponse(['success' => false, 'message' => 'Não autorizado.'], 401);
}

$user_id = $user['id'];

try {
    // Buscar dados completos do perfil (incluindo email)
    $stmt = $conn->prepare("
        SELECT u.*, u.email, p.* 
        FROM sf_users u 
        LEFT JOIN sf_user_profiles p ON u.id = p.user_id 
        WHERE u.id = ?
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $profile_data = $result->fetch_assoc();
    $stmt->close();
    
    if (!$profile_data) {
        sendJsonResponse(['success' => false, 'message' => 'Perfil não encontrado.'], 404);
    }
    
    // Lógica do contador de peso
    $can_edit_weight = true;
    $days_until_next_weight_update = 0;
    try {
        $stmt_last_weight = $conn->prepare("SELECT MAX(date_recorded) AS last_date FROM sf_user_weight_history WHERE user_id = ?");
        if ($stmt_last_weight) {
            $stmt_last_weight->bind_param("i", $user_id);
            $stmt_last_weight->execute();
            $result_weight = $stmt_last_weight->get_result()->fetch_assoc();
            $stmt_last_weight->close();
            if ($result_weight && !empty($result_weight['last_date'])) {
                $last_log_date = new DateTime($result_weight['last_date']);
                $unlock_date = (clone $last_log_date)->modify('+7 days');
                $today = new DateTime('today');
                if ($today < $unlock_date) {
                    $can_edit_weight = false;
                    $days_until_next_weight_update = (int)$today->diff($unlock_date)->days;
                    if ($days_until_next_weight_update == 0) $days_until_next_weight_update = 1;
                }
            }
        }
    } catch (Exception $e) {
        error_log("Erro ao processar data de peso: " . $e->getMessage());
    }
    
    // Restrições alimentares
    $user_selected_restrictions = [];
    $stmt = $conn->prepare("SELECT restriction_id FROM sf_user_selected_restrictions WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $user_selected_restrictions[] = $row['restriction_id'];
    }
    $stmt->close();
    
    // Todas as restrições disponíveis
    $all_restrictions = [];
    $stmt = $conn->prepare("SELECT id, name FROM sf_dietary_restrictions_options ORDER BY id");
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $all_restrictions[] = [
            'id' => $row['id'],
            'name' => $row['name']
        ];
    }
    $stmt->close();
    
    // Foto de perfil
    $profile_image_filename = $profile_data['profile_image_filename'] ?? null;
    $profile_image_url = null;
    if ($profile_image_filename) {
        $profile_image_url = BASE_APP_URL . '/assets/images/users/' . $profile_image_filename;
    }
    
    sendJsonResponse([
        'success' => true,
            'data' => [
                'profile' => [
                    'name' => $profile_data['name'] ?? '',
                    'email' => $profile_data['email'] ?? '',
                    'dob' => $profile_data['dob'] ?? '',
                'gender' => $profile_data['gender'] ?? 'other',
                'height_cm' => $profile_data['height_cm'] ?? null,
                'weight_kg' => $profile_data['weight_kg'] ?? null,
                'objective' => $profile_data['objective'] ?? '',
                'activity_level' => $profile_data['activity_level'] ?? '',
                'exercise_frequency' => $profile_data['exercise_frequency'] ?? '',
                'bowel_movement' => $profile_data['bowel_movement'] ?? '',
                'exercise_type' => $profile_data['exercise_type'] ?? '',
                'custom_calories_goal' => $profile_data['custom_calories_goal'] ?? null,
                'custom_protein_goal_g' => $profile_data['custom_protein_goal_g'] ?? null,
                'custom_carbs_goal_g' => $profile_data['custom_carbs_goal_g'] ?? null,
                'custom_fat_goal_g' => $profile_data['custom_fat_goal_g'] ?? null,
                'custom_water_goal_ml' => $profile_data['custom_water_goal_ml'] ?? null
            ],
            'profile_image_url' => $profile_image_url,
            'can_edit_weight' => $can_edit_weight,
            'days_until_next_weight_update' => $days_until_next_weight_update,
            'user_selected_restrictions' => $user_selected_restrictions,
            'all_restrictions' => $all_restrictions,
            'base_url' => BASE_APP_URL
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro em api/get_edit_profile_data.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Erro ao buscar dados: ' . $e->getMessage()], 500);
}

$conn->close();
?>

