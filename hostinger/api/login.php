<?php
// api/login.php - API de login que retorna token

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../includes/config.php';
require_once '../includes/db.php';
require_once '../includes/auth.php';

$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email inválido.']);
    exit();
}

if (empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Senha não fornecida.']);
    exit();
}

// Verificar se as colunas status e approval_status existem
$check_status = $conn->query("SHOW COLUMNS FROM sf_users LIKE 'status'");
$has_status_column = $check_status && $check_status->num_rows > 0;
if ($check_status) $check_status->free();

$check_approval = $conn->query("SHOW COLUMNS FROM sf_users LIKE 'approval_status'");
$has_approval_column = $check_approval && $check_approval->num_rows > 0;
if ($check_approval) $check_approval->free();

if (!$has_approval_column) {
    $conn->query("ALTER TABLE sf_users ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER status");
    $has_approval_column = true;
}

$status_field = $has_status_column ? ", COALESCE(status, 'active') as status" : ", 'active' as status";
$approval_field = $has_approval_column ? ", COALESCE(approval_status, 'pending') as approval_status" : ", 'pending' as approval_status";
$stmt_login = $conn->prepare("SELECT id, password_hash, onboarding_complete, name$status_field$approval_field FROM sf_users WHERE email = ?");

if (!$stmt_login) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro no sistema de login.']);
    exit();
}

$stmt_login->bind_param("s", $email);
$stmt_login->execute();
$result_login = $stmt_login->get_result();
$user_login = $result_login->fetch_assoc();
$stmt_login->close();

// Verificar se o usuário existe
if (!$user_login) {
    // Email não cadastrado
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não há conta registrada com este email.']);
    exit();
}

// Verificar senha
if (!password_verify($password, $user_login['password_hash'])) {
    // Senha incorreta
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Senha incorreta.']);
    exit();
}

// Verificar se a conta está ativa
$user_status = $user_login['status'] ?? 'active';
if ($user_status === 'inactive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Sua conta foi desativada. Entre em contato com o suporte.']);
    exit();
}

// Verificar se a conta está aprovada
$approval_status = $user_login['approval_status'] ?? 'pending';
if ($approval_status === 'pending') {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'message' => 'Sua conta está aguardando aprovação do nutricionista.',
        'requires_approval' => true
    ]);
    exit();
}

if ($approval_status === 'rejected') {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'message' => 'Sua conta não foi aprovada. Entre em contato com o suporte.',
        'requires_approval' => true
    ]);
    exit();
}

// Gerar token de autenticação
$token = bin2hex(random_bytes(32));
$expires_at = date('Y-m-d H:i:s', strtotime('+30 days')); // Token válido por 30 dias

// Salvar token no banco
$stmt_token = $conn->prepare("UPDATE sf_users SET auth_token = ?, auth_token_expires_at = ? WHERE id = ?");
if ($stmt_token) {
    $stmt_token->bind_param("ssi", $token, $expires_at, $user_login['id']);
    $stmt_token->execute();
    $stmt_token->close();
}

echo json_encode([
    'success' => true,
    'token' => $token,
    'user' => [
        'id' => $user_login['id'],
        'name' => $user_login['name'],
        'email' => $email,
        'onboarding_complete' => (bool)$user_login['onboarding_complete']
    ]
]);

$conn->close();
?>

