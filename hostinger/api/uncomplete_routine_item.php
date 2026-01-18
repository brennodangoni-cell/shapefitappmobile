<?php
// api/uncomplete_routine_item.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../includes/config.php';
$conn = require '../includes/db.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

// Limpar qualquer output buffer
while (ob_get_level()) {
    ob_end_clean();
}

// Autenticação
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
$token = $auth_header ? str_replace('Bearer ', '', $auth_header) : null;

$user = getUserByAuthToken($conn, $token);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado.']);
    exit();
}

$user_id = $user['id'];
$current_date = date('Y-m-d');
$points_to_deduct = 5;

// Ler dados do JSON
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);
$routine_id = filter_var($data['routine_id'] ?? null, FILTER_VALIDATE_INT);

if (!$routine_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID da rotina inválido.']);
    exit();
}

$conn->begin_transaction();

try {
    // 1. Deletar o registro de conclusão
    $stmt_delete = $conn->prepare(
        "DELETE FROM sf_user_routine_log WHERE user_id = ? AND routine_item_id = ? AND date = ?"
    );
    $stmt_delete->bind_param("iis", $user_id, $routine_id, $current_date);
    $stmt_delete->execute();

    if ($stmt_delete->affected_rows === 0) {
        $stmt_delete->close();
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Nenhuma tarefa correspondente encontrada para desfazer.']);
        exit();
    }
    $stmt_delete->close();

    // 2. Remover o log de pontos correspondente
    $routine_id_str = (string)$routine_id;
    $stmt_delete_points_log = $conn->prepare(
        "DELETE FROM sf_user_points_log WHERE user_id = ? AND action_key = 'ROUTINE_COMPLETE' AND action_context_id = ? AND date_awarded = ?"
    );
    $stmt_delete_points_log->bind_param("iss", $user_id, $routine_id_str, $current_date);
    $stmt_delete_points_log->execute();
    $stmt_delete_points_log->close();

    // 3. Deduzir os pontos do usuário
    $stmt_update_points = $conn->prepare(
        "UPDATE sf_users SET points = GREATEST(points - ?, 0) WHERE id = ?"
    );
    $stmt_update_points->bind_param("ii", $points_to_deduct, $user_id);
    $stmt_update_points->execute();
    $stmt_update_points->close();

    // 4. Buscar o novo total de pontos
    $stmt_get_points = $conn->prepare("SELECT points FROM sf_users WHERE id = ?");
    $stmt_get_points->bind_param("i", $user_id);
    $stmt_get_points->execute();
    $result_points = $stmt_get_points->get_result()->fetch_assoc();
    $new_total_points = $result_points['points'];
    $stmt_get_points->close();
    
    $conn->commit();

    echo json_encode([
        'success' => true,
        'points_deducted' => $points_to_deduct,
        'new_total_points' => $new_total_points
    ]);

} catch (Exception $e) {
    $conn->rollback();
    error_log("Erro ao desfazer rotina para user {$user_id}: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ocorreu um erro no servidor ao desfazer a tarefa.']);
}
?>

