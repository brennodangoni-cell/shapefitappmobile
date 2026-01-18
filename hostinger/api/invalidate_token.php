<?php
// --- INVALIDAR TOKEN - Shape Fit ---

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../includes/config.php';
require_once '../includes/db.php';

// Pegar token do header
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (!$token) {
    echo json_encode(['success' => false, 'message' => 'Token não fornecido']);
    exit();
}

// Invalidar token no banco
$stmt = $conn->prepare("UPDATE sf_users SET auth_token = NULL, auth_token_expires_at = NULL WHERE auth_token = ?");
if ($stmt) {
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $stmt->close();
}

echo json_encode(['success' => true, 'message' => 'Token invalidado']);
?>

