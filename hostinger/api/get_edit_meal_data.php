<?php
// Arquivo: api/get_edit_meal_data.php - API para buscar dados da refeição para edição

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
$meal_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$response = ['success' => false, 'data' => []];

if (!$meal_id) {
    http_response_code(400);
    $response['message'] = 'ID da refeição inválido.';
    echo json_encode($response);
    exit();
}

try {
    // Buscar dados da refeição
    $stmt = $conn->prepare("
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
            r.kcal_per_serving,
            r.protein_g_per_serving,
            r.carbs_g_per_serving,
            r.fat_g_per_serving
        FROM sf_user_meal_log log
        LEFT JOIN sf_recipes r ON log.recipe_id = r.id
        WHERE log.id = ? AND log.user_id = ?
    ");

    if (!$stmt) {
        throw new Exception('Erro na consulta ao banco de dados.');
    }

    $stmt->bind_param("ii", $meal_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $meal = $result->fetch_assoc();
    $stmt->close();

    if (!$meal) {
        http_response_code(404);
        $response['message'] = 'Refeição não encontrada.';
        echo json_encode($response);
        exit();
    }

    // Opções de tipos de refeição
    $meal_type_options = [
        'breakfast' => 'Café da Manhã',
        'morning_snack' => 'Lanche da Manhã',
        'lunch' => 'Almoço',
        'afternoon_snack' => 'Lanche da Tarde',
        'dinner' => 'Jantar',
        'supper' => 'Ceia',
        'pre_workout' => 'Pré-Treino',
        'post_workout' => 'Pós-Treino'
    ];

    $response['success'] = true;
    $response['data'] = [
        'meal' => $meal,
        'meal_type_options' => $meal_type_options,
        'base_url' => BASE_APP_URL
    ];

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = "Erro no servidor: " . $e->getMessage();
    error_log("Erro em get_edit_meal_data.php para user_id {$user_id}, meal_id {$meal_id}: " . $e->getMessage());
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
$conn->close();
?>

