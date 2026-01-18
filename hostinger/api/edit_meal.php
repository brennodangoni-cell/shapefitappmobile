<?php
// api/edit_meal.php - API para editar uma refeição

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../includes/config.php';
require_once '../includes/db.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

$user_id = $user['id'];

// Validação CSRF apenas se for sessão (não token)
if (isLoggedIn() && ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token']))) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acesso negado.']);
    exit();
}

// Ler dados do POST (pode ser JSON ou form-data)
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data) {
    $data = $_POST;
}

$meal_id = filter_var($data['meal_id'] ?? 0, FILTER_VALIDATE_INT);
$servings_consumed = filter_var($data['servings'] ?? 0, FILTER_VALIDATE_FLOAT);
$meal_type = trim($data['meal_type'] ?? '');
$date_consumed = trim($data['date_consumed'] ?? date('Y-m-d'));
$meal_time = trim($data['time_consumed'] ?? date('H:i'));
$custom_meal_name = trim($data['meal_name'] ?? '');

// Validações básicas
if (!$meal_id || !$servings_consumed || empty($meal_type) || empty($custom_meal_name) || $servings_consumed <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados inválidos. Todos os campos são obrigatórios.']);
    exit();
}

$conn->begin_transaction();

try {
    // Buscar dados originais da refeição
    $stmt_old = $conn->prepare("SELECT * FROM sf_user_meal_log WHERE id = ? AND user_id = ?");
    $stmt_old->bind_param("ii", $meal_id, $user_id);
    $stmt_old->execute();
    $old_meal = $stmt_old->get_result()->fetch_assoc();
    $stmt_old->close();

    if (!$old_meal) {
        throw new Exception("Refeição não encontrada.");
    }

    // Buscar dados nutricionais base (por porção)
    $kcal_per_serving = 0;
    $protein_per_serving = 0;
    $carbs_per_serving = 0;
    $fat_per_serving = 0;

    if ($old_meal['recipe_id']) {
        $stmt_recipe = $conn->prepare("SELECT kcal_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving FROM sf_recipes WHERE id = ?");
        $stmt_recipe->bind_param("i", $old_meal['recipe_id']);
        $stmt_recipe->execute();
        $recipe_data = $stmt_recipe->get_result()->fetch_assoc();
        $stmt_recipe->close();
        
        if ($recipe_data) {
            $kcal_per_serving = (float)$recipe_data['kcal_per_serving'];
            $protein_per_serving = (float)$recipe_data['protein_g_per_serving'];
            $carbs_per_serving = (float)$recipe_data['carbs_g_per_serving'];
            $fat_per_serving = (float)$recipe_data['fat_g_per_serving'];
        }
    } else {
        // Calcular por porção baseado nos valores originais
        $old_servings = (float)$old_meal['servings_consumed'] ?: 1;
        $kcal_per_serving = (float)$old_meal['kcal_consumed'] / $old_servings;
        $protein_per_serving = (float)$old_meal['protein_consumed_g'] / $old_servings;
        $carbs_per_serving = (float)$old_meal['carbs_consumed_g'] / $old_servings;
        $fat_per_serving = (float)$old_meal['fat_consumed_g'] / $old_servings;
    }

    // Calcular novos totais
    $new_kcal = round($kcal_per_serving * $servings_consumed);
    $new_protein = round($protein_per_serving * $servings_consumed * 10) / 10;
    $new_carbs = round($carbs_per_serving * $servings_consumed * 10) / 10;
    $new_fat = round($fat_per_serving * $servings_consumed * 10) / 10;

    // Combinar data e hora
    $logged_at = $date_consumed . ' ' . $meal_time . ':00';

    // Atualizar refeição
    $stmt_update = $conn->prepare("
        UPDATE sf_user_meal_log 
        SET meal_type = ?, custom_meal_name = ?, date_consumed = ?, servings_consumed = ?, 
            kcal_consumed = ?, protein_consumed_g = ?, carbs_consumed_g = ?, fat_consumed_g = ?, logged_at = ?
        WHERE id = ? AND user_id = ?
    ");
    $stmt_update->bind_param("sssdddddsii", $meal_type, $custom_meal_name, $date_consumed, $servings_consumed,
        $new_kcal, $new_protein, $new_carbs, $new_fat, $logged_at, $meal_id, $user_id);
    $stmt_update->execute();
    $stmt_update->close();

    // Recalcular totais diários para ambas as datas (antiga e nova)
    updateDailyTracking($conn, $user_id, $old_meal['date_consumed']);
    if ($date_consumed !== $old_meal['date_consumed']) {
        updateDailyTracking($conn, $user_id, $date_consumed);
    }

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Refeição atualizada com sucesso!',
        'redirect' => BASE_APP_URL . '/diary.html?date=' . $date_consumed
    ]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    error_log("Erro em api/edit_meal.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao atualizar refeição: ' . $e->getMessage()]);
}

$conn->close();
?>

