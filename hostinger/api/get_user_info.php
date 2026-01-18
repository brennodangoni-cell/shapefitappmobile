<?php
// api/get_user_info.php - Retorna informações do usuário autenticado

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

$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
$token = $auth_header ? preg_replace('/Bearer\s+/i', '', $auth_header) : null;

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token não fornecido.']);
    exit();
}

$user = getUserByAuthToken($conn, $token);

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado.']);
    exit();
}

// Buscar onboarding_complete do banco
$user_id = $user['id'];
$stmt = $conn->prepare("SELECT onboarding_complete FROM sf_users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();
$user_data = $result->fetch_assoc();
$stmt->close();

echo json_encode([
    'success' => true,
    'user' => [
        'id' => $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'onboarding_complete' => (bool)($user_data['onboarding_complete'] ?? false)
    ]
], JSON_UNESCAPED_UNICODE);

$conn->close();
?>

