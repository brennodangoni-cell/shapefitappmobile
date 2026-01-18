<?php
// api/log_meal.php - API para registrar uma refeição no diário

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
// Se há token Bearer, não precisa de CSRF
$hasToken = !empty($_SERVER['HTTP_AUTHORIZATION']);
if (isLoggedIn() && !$hasToken && ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token']))) {
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

$recipe_id = filter_var($data['recipe_id'] ?? 0, FILTER_VALIDATE_INT);
$meal_type = trim($data['meal_type'] ?? '');
$date_consumed = trim($data['date_consumed'] ?? date('Y-m-d'));
$servings_consumed = filter_var($data['servings_consumed'] ?? 1.0, FILTER_VALIDATE_FLOAT);

// Validações
if (!$recipe_id || empty($meal_type) || !$servings_consumed || $servings_consumed <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados inválidos.']);
    exit();
}

try {
    // Buscar dados da receita
    $stmt_recipe = $conn->prepare("SELECT kcal_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving FROM sf_recipes WHERE id = ? AND is_public = TRUE");
    $stmt_recipe->bind_param("i", $recipe_id);
    $stmt_recipe->execute();
    $recipe = $stmt_recipe->get_result()->fetch_assoc();
    $stmt_recipe->close();

    if (!$recipe) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Receita não encontrada.']);
        exit();
    }

    // Calcular valores totais
    $kcal_consumed = round($recipe['kcal_per_serving'] * $servings_consumed);
    $protein_consumed = round($recipe['protein_g_per_serving'] * $servings_consumed * 10) / 10;
    $carbs_consumed = round($recipe['carbs_g_per_serving'] * $servings_consumed * 10) / 10;
    $fat_consumed = round($recipe['fat_g_per_serving'] * $servings_consumed * 10) / 10;

    // Inserir no log
    $logged_at = date('Y-m-d H:i:s');
    $stmt_insert = $conn->prepare("
        INSERT INTO sf_user_meal_log 
        (user_id, recipe_id, meal_type, date_consumed, servings_consumed, kcal_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, logged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt_insert->bind_param("iissidddds", $user_id, $recipe_id, $meal_type, $date_consumed, $servings_consumed,
        $kcal_consumed, $protein_consumed, $carbs_consumed, $fat_consumed, $logged_at);
    $stmt_insert->execute();
    $stmt_insert->close();

    // Recalcular totais diários
    updateDailyTracking($conn, $user_id, $date_consumed);

    echo json_encode([
        'success' => true,
        'message' => 'Refeição registrada com sucesso!',
        'redirect' => BASE_APP_URL . '/diary.html?date=' . $date_consumed
    ]);

} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em api/log_meal.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao registrar refeição: ' . $e->getMessage()]);
}

$conn->close();
?>

