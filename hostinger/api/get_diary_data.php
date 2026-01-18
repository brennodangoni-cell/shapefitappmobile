<?php
// api/get_diary_data.php - Dados para a página de diário

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
    sendJsonResponse(['success' => false, 'message' => 'Não autenticado.'], 401);
}

$user_id = $user['id'];
$selected_date = $_GET['date'] ?? date('Y-m-d');

try {
    // Buscar dados do usuário e metas
    $user_profile_data = getUserProfileData($conn, $user_id);
    
    // Calcular metas
    $age_years = calculateAge($user_profile_data['dob']);
    $total_daily_calories_goal = calculateTargetDailyCalories(
        $user_profile_data['gender'], 
        (float)$user_profile_data['weight_kg'], 
        (int)$user_profile_data['height_cm'], 
        $age_years, 
        $user_profile_data['exercise_frequency'], 
        $user_profile_data['objective']
    );
    $macros_goal = calculateMacronutrients($total_daily_calories_goal, $user_profile_data['objective']);
    
    // Garantir que os totais diários estejam atualizados com base nas refeições
    updateDailyTracking($conn, $user_id, $selected_date);
    
    // Buscar dados de tracking diário
    $daily_tracking = getDailyTrackingRecord($conn, $user_id, $selected_date);
    
    $kcal_consumed = $daily_tracking['kcal_consumed'] ?? 0;
    $protein_consumed = $daily_tracking['protein_consumed_g'] ?? 0;
    $carbs_consumed = $daily_tracking['carbs_consumed_g'] ?? 0;
    $fat_consumed = $daily_tracking['fat_consumed_g'] ?? 0;
    
    // Buscar refeições do dia
    $stmt_meals = $conn->prepare("
        SELECT 
            log.id,
            log.meal_type,
            log.custom_meal_name,
            log.date_consumed,
            log.servings_consumed,
            log.kcal_consumed,
            log.protein_consumed_g,
            log.carbs_consumed_g,
            log.fat_consumed_g,
            log.logged_at,
            r.name as recipe_name,
            r.id as recipe_id
        FROM sf_user_meal_log log
        LEFT JOIN sf_recipes r ON log.recipe_id = r.id
        WHERE log.user_id = ? AND log.date_consumed = ?
        ORDER BY log.logged_at ASC
    ");
    
    if (!$stmt_meals) {
        throw new Exception("Erro ao preparar query: " . $conn->error);
    }
    
    $stmt_meals->bind_param("is", $user_id, $selected_date);
    $stmt_meals->execute();
    $result_meals = $stmt_meals->get_result();
    
    $meals = [];
    while ($row = $result_meals->fetch_assoc()) {
        $meals[] = $row;
    }
    $stmt_meals->close();
    
    // Agrupar refeições por tipo
    $meal_types = [
        'breakfast' => 'Café da Manhã',
        'morning_snack' => 'Lanche da Manhã',
        'lunch' => 'Almoço',
        'afternoon_snack' => 'Lanche da Tarde',
        'dinner' => 'Jantar',
        'supper' => 'Ceia',
        'pre_workout' => 'Pré-Treino',
        'post_workout' => 'Pós-Treino'
    ];
    
    $meal_groups = [];
    foreach ($meal_types as $type_key => $type_name) {
        $group_meals = array_filter($meals, function($meal) use ($type_key) {
            return $meal['meal_type'] === $type_key;
        });
        
        if (!empty($group_meals)) {
            $group_kcal = array_sum(array_column($group_meals, 'kcal_consumed'));
            $group_protein = array_sum(array_column($group_meals, 'protein_consumed_g'));
            $group_carbs = array_sum(array_column($group_meals, 'carbs_consumed_g'));
            $group_fat = array_sum(array_column($group_meals, 'fat_consumed_g'));
            
            $meal_groups[] = [
                'type' => $type_key,
                'name' => $type_name,
                'meals' => array_values($group_meals),
                'total_kcal' => round($group_kcal),
                'total_protein' => round($group_protein * 10) / 10,
                'total_carbs' => round($group_carbs * 10) / 10,
                'total_fat' => round($group_fat * 10) / 10
            ];
        }
    }
    
    // Formatar data para display
    $date_obj = new DateTime($selected_date);
    $date_display = $date_obj->format('d/m/Y');
    
    sendJsonResponse([
        'success' => true,
        'data' => [
            'date' => $selected_date,
            'date_display' => $date_display,
            'nutrition' => [
                'kcal' => [
                    'consumed' => round($kcal_consumed),
                    'goal' => round($total_daily_calories_goal)
                ],
                'protein' => [
                    'consumed' => round($protein_consumed * 10) / 10,
                    'goal' => round($macros_goal['protein_g'] * 10) / 10
                ],
                'carbs' => [
                    'consumed' => round($carbs_consumed * 10) / 10,
                    'goal' => round($macros_goal['carbs_g'] * 10) / 10
                ],
                'fat' => [
                    'consumed' => round($fat_consumed * 10) / 10,
                    'goal' => round($macros_goal['fat_g'] * 10) / 10
                ]
            ],
            'meal_groups' => $meal_groups,
            'meal_types' => $meal_types,
            'base_url' => BASE_APP_URL
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro em get_diary_data.php: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao buscar dados do diário.',
        'error' => $e->getMessage()
    ], 500);
}

$conn->close();
?>





