<?php
// api/update_exercises.php - API para atualizar apenas exercícios e frequência

while (ob_get_level()) {
    ob_end_clean();
}

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

// Ler dados do POST (JSON)
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data) {
    sendJsonResponse(['success' => false, 'message' => 'Dados inválidos.'], 400);
}

$exercise_type = isset($data['exercise_type']) && $data['exercise_type'] !== null && trim($data['exercise_type']) !== '' ? trim($data['exercise_type']) : null;
$exercise_frequency = trim($data['exercise_frequency'] ?? 'sedentary');

// Validação: se não há exercícios, garantir que a frequência seja sedentary
if ($exercise_type === null || $exercise_type === '') {
    $exercise_frequency = 'sedentary';
}

// Validação de frequência
$valid_frequencies = ['sedentary', '1_2x_week', '3_4x_week', '5_6x_week', '6_7x_week', '7plus_week'];
if (!in_array($exercise_frequency, $valid_frequencies)) {
    sendJsonResponse(['success' => false, 'message' => 'Frequência inválida.'], 400);
}

$conn->begin_transaction();
try {
    // Atualizar apenas exercise_type e exercise_frequency
    $stmt = $conn->prepare("UPDATE sf_user_profiles SET exercise_type = ?, exercise_frequency = ? WHERE user_id = ?");
    $stmt->bind_param("ssi", $exercise_type, $exercise_frequency, $user_id);
    $stmt->execute();
    $stmt->close();
    
    $conn->commit();
    
    sendJsonResponse([
        'success' => true,
        'message' => 'Exercícios atualizados com sucesso!'
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("Erro em api/update_exercises.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Ocorreu um erro ao salvar os exercícios.'], 500);
}

$conn->close();
?>

