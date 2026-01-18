<?php
// api/get_dashboard_goals_data.php - Dados para a página dashboard

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
    // Buscar dados do perfil
    $stmt_profile = $conn->prepare("
        SELECT
            u.name,
            p.dob, p.gender, p.height_cm, p.weight_kg, p.objective,
            p.exercise_frequency,
            p.custom_calories_goal,
            p.custom_protein_goal_g,
            p.custom_carbs_goal_g,
            p.custom_fat_goal_g,
            p.custom_water_goal_ml
        FROM sf_users u
        LEFT JOIN sf_user_profiles p ON u.id = p.user_id
        WHERE u.id = ?
    ");
    $stmt_profile->bind_param("i", $user_id);
    $stmt_profile->execute();
    $result_profile = $stmt_profile->get_result();
    
    if ($result_profile->num_rows === 0) {
        sendJsonResponse(['success' => false, 'message' => 'Perfil não encontrado.'], 404);
    }
    
    $profile = $result_profile->fetch_assoc();
    $stmt_profile->close();
    
    // Cálculos
    $dob = $profile['dob'] ?? '1990-01-01';
    $age_years = date_diff(date_create($dob), date_create('today'))->y;
    
    $weight_kg = (float)($profile['weight_kg'] ?? 70);
    $height_cm = (int)($profile['height_cm'] ?? 170);
    $gender = $profile['gender'] ?? 'female';
    $objective = $profile['objective'] ?? 'maintain_weight';
    $exercise_frequency = $profile['exercise_frequency'] ?? 'sedentary';
    
    // Priorizar metas customizadas se existirem
    if (!empty($profile['custom_calories_goal'])) {
        $daily_calories = (int)$profile['custom_calories_goal'];
    } else {
        $daily_calories = calculateTargetDailyCalories($gender, $weight_kg, $height_cm, $age_years, $exercise_frequency, $objective);
    }
    
    // Macros: usar customizadas se existirem, senão calcular
    if (!empty($profile['custom_protein_goal_g']) && !empty($profile['custom_carbs_goal_g']) && !empty($profile['custom_fat_goal_g'])) {
        $protein_g = (float)$profile['custom_protein_goal_g'];
        $carbs_g = (float)$profile['custom_carbs_goal_g'];
        $fat_g = (float)$profile['custom_fat_goal_g'];
    } else {
        // Cálculo básico de macros (40% carb, 30% prot, 30% gordura)
        $carbs_g = round(($daily_calories * 0.4) / 4);
        $protein_g = round(($daily_calories * 0.3) / 4);
        $fat_g = round(($daily_calories * 0.3) / 9);
    }
    
    $current_date = date('Y-m-d');
    
    // Buscar consumo do dia
    $daily_tracking = getDailyTrackingRecord($conn, $user_id, $current_date);
    $protein_consumed = $daily_tracking['protein_consumed_g'] ?? 0;
    $carbs_consumed = $daily_tracking['carbs_consumed_g'] ?? 0;
    $fat_consumed = $daily_tracking['fat_consumed_g'] ?? 0;
    // Ingestão de água: no tracking normalmente é salvo em copos
    // (alguns ambientes não têm water_consumed_ml).
    $water_consumed_ml = 0;
    if (isset($daily_tracking['water_consumed_ml']) && is_numeric($daily_tracking['water_consumed_ml'])) {
        $water_consumed_ml = (int)$daily_tracking['water_consumed_ml'];
    } else {
        $water_consumed_ml = ((int)($daily_tracking['water_consumed_cups'] ?? 0)) * 250;
    }
    
    // Meta de água: priorizar customizada se existir
    if (!empty($profile['custom_water_goal_ml'])) {
        $water_goal_ml = (int)$profile['custom_water_goal_ml'];
    } else {
        $water_goal_data = getWaterIntakeSuggestion($weight_kg);
        $water_goal_ml = $water_goal_data['total_ml'];
    }
    
    sendJsonResponse([
        'success' => true,
        'data' => [
            'name' => $profile['name'],
            'goals' => [
                'calories' => [
                    'goal' => $daily_calories,
                    'consumed' => $daily_tracking['kcal_consumed'] ?? 0
                ],
                'protein' => [
                    'goal' => round((float)$protein_g, 1),
                    'consumed' => round((float)$protein_consumed, 1)
                ],
                'carbs' => [
                    'goal' => round((float)$carbs_g, 1),
                    'consumed' => round((float)$carbs_consumed, 1)
                ],
                'fat' => [
                    'goal' => round((float)$fat_g, 1),
                    'consumed' => round((float)$fat_consumed, 1)
                ],
                'water' => [
                    'goal' => $water_goal_ml,
                    'consumed' => $water_consumed_ml
                ]
            ],
            'has_custom_goals' => [
                'calories' => !empty($profile['custom_calories_goal']),
                'macros' => !empty($profile['custom_protein_goal_g']),
                'water' => !empty($profile['custom_water_goal_ml'])
            ],
            'base_url' => BASE_APP_URL
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro em api/get_dashboard_goals_data.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Erro ao buscar dados: ' . $e->getMessage()], 500);
}

$conn->close();
?>

