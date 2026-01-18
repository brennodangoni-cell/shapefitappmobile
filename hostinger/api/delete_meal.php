<?php
// api/delete_meal.php - API para deletar uma refeição

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

$meal_id = filter_var($data['meal_id'] ?? 0, FILTER_VALIDATE_INT);

if (!$meal_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID da refeição inválido.']);
    exit();
}

try {
    // Buscar dados da refeição antes de excluir
    $stmt_find = $conn->prepare("SELECT date_consumed FROM sf_user_meal_log WHERE id = ? AND user_id = ?");
    $stmt_find->bind_param("ii", $meal_id, $user_id);
    $stmt_find->execute();
    $result_find = $stmt_find->get_result();
    $meal_data = $result_find->fetch_assoc();
    $stmt_find->close();

    if (!$meal_data) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Refeição não encontrada.']);
        exit();
    }

    $date_consumed = $meal_data['date_consumed'];

    // Excluir a refeição
    $stmt_delete = $conn->prepare("DELETE FROM sf_user_meal_log WHERE id = ? AND user_id = ?");
    $stmt_delete->bind_param("ii", $meal_id, $user_id);

    if ($stmt_delete->execute()) {
        $stmt_delete->close();
        
        // Recalcular totais diários
        updateDailyTracking($conn, $user_id, $date_consumed);

        echo json_encode([
            'success' => true,
            'message' => 'Refeição excluída com sucesso!',
            'redirect' => BASE_APP_URL . '/diary.html?date=' . $date_consumed
        ]);
    } else {
        throw new Exception("Erro ao excluir refeição.");
    }

} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em api/delete_meal.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao excluir refeição: ' . $e->getMessage()]);
}

$conn->close();
?>

