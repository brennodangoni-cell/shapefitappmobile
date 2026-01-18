<?php
// api/add_entire_meal.php - API para adicionar uma refeição completa

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

// Ler dados do POST
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data) {
    $data = $_POST;
}

$log_date_str = trim($data['log_date'] ?? date('Y-m-d'));
$log_meal_type = trim($data['log_meal_type'] ?? '');
$meal_items_json = $data['meal_items_json'] ?? '[]';
$meal_items = json_decode($meal_items_json, true);

// Validações
if (empty($log_meal_type)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Tipo de refeição não selecionado.']);
    exit();
}

if (empty($meal_items) || !is_array($meal_items)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nenhum alimento foi adicionado à refeição.']);
    exit();
}

$date_obj = DateTime::createFromFormat('Y-m-d', $log_date_str);
if (!$date_obj || $date_obj->format('Y-m-d') !== $log_date_str) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Data de consumo inválida.']);
    exit();
}

$log_date = $date_obj->format('Y-m-d');

$conn->begin_transaction();

try {
    $total_kcal_meal = 0;
    $total_protein_meal = 0;
    $total_carbs_meal = 0;
    $total_fat_meal = 0;

    // Processar cada item da refeição
    foreach ($meal_items as $item) {
        $recipe_id = isset($item['recipe_id']) && $item['recipe_id'] !== '' ? (int)$item['recipe_id'] : null;
        $servings_consumed = isset($item['servings_consumed']) ? (float)$item['servings_consumed'] : 0;
        $meal_time = trim($item['meal_time'] ?? date('H:i'));
        $custom_meal_name = trim($item['custom_meal_name'] ?? '');
        $kcal_per_serving = (float)($item['kcal_per_serving'] ?? 0);
        $protein_per_serving = (float)($item['protein_per_serving'] ?? 0);
        $carbs_per_serving = (float)($item['carbs_per_serving'] ?? 0);
        $fat_per_serving = (float)($item['fat_per_serving'] ?? 0);
        $is_food = !empty($item['is_food']);

        // Calcular totais
        $kcal_consumed = round($kcal_per_serving * $servings_consumed);
        $protein_consumed = round($protein_per_serving * $servings_consumed * 10) / 10;
        $carbs_consumed = round($carbs_per_serving * $servings_consumed * 10) / 10;
        $fat_consumed = round($fat_per_serving * $servings_consumed * 10) / 10;

        $total_kcal_meal += $kcal_consumed;
        $total_protein_meal += $protein_consumed;
        $total_carbs_meal += $carbs_consumed;
        $total_fat_meal += $fat_consumed;

        // Inserir no log
        $logged_at = $log_date . ' ' . $meal_time . ':00';
        $stmt_insert = $conn->prepare("
            INSERT INTO sf_user_meal_log 
            (user_id, recipe_id, meal_type, date_consumed, servings_consumed, kcal_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, custom_meal_name, logged_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt_insert->bind_param("iissidddsss", $user_id, $recipe_id, $log_meal_type, $log_date, $servings_consumed,
            $kcal_consumed, $protein_consumed, $carbs_consumed, $fat_consumed, $custom_meal_name, $logged_at);
        $stmt_insert->execute();
        $stmt_insert->close();
    }

    // Adicionar pontos (uma vez por tipo de refeição por dia)
    $action_key_log = "MEAL_LOGGED_{$log_meal_type}";
    $php_timestamp = date('Y-m-d H:i:s');
    $stmt_log_check = $conn->prepare("INSERT IGNORE INTO sf_user_points_log (user_id, points_awarded, action_key, date_awarded, timestamp) VALUES (?, 5, ?, ?, ?)");
    $stmt_log_check->bind_param("issss", $user_id, $action_key_log, $log_date, $php_timestamp);
    $stmt_log_check->execute();
    $stmt_log_check->close();

    // Atualizar pontos do usuário
    addPointsToUser($conn, $user_id, 5, $action_key_log);

    // Recalcular totais diários
    updateDailyTracking($conn, $user_id, $log_date);

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Refeição registrada com sucesso!',
        'redirect' => BASE_APP_URL . '/diary.html?date=' . $log_date
    ]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    error_log("Erro em api/add_entire_meal.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao registrar refeição: ' . $e->getMessage()]);
}

$conn->close();
?>

