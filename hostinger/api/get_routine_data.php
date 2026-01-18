<?php
// api/get_routine_data.php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
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

function sendJsonResponse($success, $data = null, $message = null, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    // Buscar todos os itens do dia
    $user_profile = getUserProfileData($conn, $user_id);
    $all_routine_items = getRoutineItemsForUser($conn, $user_id, $current_date, $user_profile);
    
    // Separar os itens
    $routine_todos = [];
    $routine_completed = [];
    
    foreach ($all_routine_items as $item) {
        if ($item['completion_status'] == 1) {
            $routine_completed[] = $item;
        } else {
            $routine_todos[] = $item;
        }
    }
    
    // Calcular o progresso
    $total_items = count($all_routine_items);
    $completed_count = count($routine_completed);
    $progress_percentage = ($total_items > 0) ? round(($completed_count / $total_items) * 100) : 0;
    
    sendJsonResponse(true, [
        'todos' => $routine_todos,
        'completed' => $routine_completed,
        'progress' => [
            'total' => $total_items,
            'completed' => $completed_count,
            'percentage' => $progress_percentage
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro em get_routine_data.php para user {$user_id}: " . $e->getMessage());
    sendJsonResponse(false, null, 'Erro ao carregar dados da rotina.', 500);
}
?>

