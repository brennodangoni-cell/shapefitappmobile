<?php
// Arquivo: api/get_add_food_data.php - API para buscar dados da página de adicionar alimento

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

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

$user_id = $user['id'];
$target_date_str = $_GET['date'] ?? date('Y-m-d');
$target_meal_type_slug = $_GET['meal_type'] ?? 'breakfast';

// Validar data
$date_obj_target = DateTime::createFromFormat('Y-m-d', $target_date_str);
if (!$date_obj_target || $date_obj_target->format('Y-m-d') !== $target_date_str) {
    $target_date_str = date('Y-m-d');
}

$meal_type_options = [
    'breakfast' => 'Café da Manhã', 
    'morning_snack' => 'Lanche da Manhã', 
    'lunch' => 'Almoço',
    'afternoon_snack' => 'Lanche da Tarde', 
    'dinner' => 'Jantar', 
    'supper' => 'Ceia'
];

if (empty($target_meal_type_slug) || !isset($meal_type_options[$target_meal_type_slug])) {
    $current_hour_for_select = (int)date('G');
    if ($current_hour_for_select >= 5 && $current_hour_for_select < 10) { $target_meal_type_slug = 'breakfast'; }
    elseif ($current_hour_for_select >= 10 && $current_hour_for_select < 12) { $target_meal_type_slug = 'morning_snack'; }
    elseif ($current_hour_for_select >= 12 && $current_hour_for_select < 15) { $target_meal_type_slug = 'lunch'; }
    elseif ($current_hour_for_select >= 15 && $current_hour_for_select < 18) { $target_meal_type_slug = 'afternoon_snack'; }
    elseif ($current_hour_for_select >= 18 && $current_hour_for_select < 21) { $target_meal_type_slug = 'dinner'; }
    else { $target_meal_type_slug = 'supper'; }
}

$response = ['success' => false, 'data' => []];

try {
    // Buscar receitas favoritas do usuário
    $favorite_recipes = [];
    $stmt_fav = $conn->prepare("
        SELECT r.id, r.name, r.image_filename, r.kcal_per_serving, r.protein_g_per_serving, r.carbs_g_per_serving, r.fat_g_per_serving
        FROM sf_recipes r
        JOIN sf_user_favorite_recipes ufr ON r.id = ufr.recipe_id
        WHERE ufr.user_id = ? AND r.is_public = TRUE
        ORDER BY r.name ASC
        LIMIT 20
    ");
    $stmt_fav->bind_param("i", $user_id);
    $stmt_fav->execute();
    $result_fav = $stmt_fav->get_result();
    while ($recipe = $result_fav->fetch_assoc()) {
        $favorite_recipes[] = $recipe;
    }
    $stmt_fav->close();

    // Buscar receitas recentes
    $recent_recipes = [];
    $stmt_recent = $conn->prepare("
        SELECT DISTINCT r.id, r.name, r.image_filename, r.kcal_per_serving, r.protein_g_per_serving, r.carbs_g_per_serving, r.fat_g_per_serving
        FROM sf_recipes r
        JOIN sf_user_meal_log log ON r.id = log.recipe_id
        WHERE log.user_id = ? AND r.is_public = TRUE
        ORDER BY log.logged_at DESC
        LIMIT 10
    ");
    $stmt_recent->bind_param("i", $user_id);
    $stmt_recent->execute();
    $result_recent = $stmt_recent->get_result();
    while ($recipe = $result_recent->fetch_assoc()) {
        $recent_recipes[] = $recipe;
    }
    $stmt_recent->close();

    $response['success'] = true;
    $response['data'] = [
        'date' => $target_date_str,
        'meal_type' => $target_meal_type_slug,
        'meal_type_options' => $meal_type_options,
        'favorite_recipes' => $favorite_recipes,
        'recent_recipes' => $recent_recipes,
        'base_url' => BASE_APP_URL
    ];

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = "Erro no servidor: " . $e->getMessage();
    error_log("Erro em get_add_food_data.php para user_id {$user_id}: " . $e->getMessage());
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
$conn->close();
?>

