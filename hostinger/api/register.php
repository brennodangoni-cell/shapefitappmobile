<?php
// api/register.php - API de registro de usuário

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

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$confirm_password = $data['confirm_password'] ?? '';

$errors = [];

if (empty($name)) {
    $errors['name'] = "Nome é obrigatório.";
}

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = "Email inválido.";
} else {
    // Verificar se email já existe em sf_users ou sf_pending_registrations
    $stmt_check_email = $conn->prepare("
        SELECT id FROM sf_users WHERE email = ?
        UNION
        SELECT id FROM sf_pending_registrations WHERE email = ?
    ");
    if ($stmt_check_email) {
        $stmt_check_email->bind_param("ss", $email, $email);
        $stmt_check_email->execute();
        $result_check_email = $stmt_check_email->get_result();
        if ($result_check_email->num_rows > 0) {
            $errors['email'] = "Este email já está cadastrado.";
        }
        $stmt_check_email->close();
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao verificar email. Tente mais tarde.']);
        exit();
    }
}

if (empty($password) || strlen($password) < 6) {
    $errors['password'] = "Senha deve ter pelo menos 6 caracteres.";
}

if ($password !== $confirm_password) {
    $errors['confirm_password'] = "As senhas não coincidem.";
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit();
}

// Criar registro temporário em sf_pending_registrations
// A conta só será criada em sf_users quando o onboarding for completado
// Isso evita contas "fantasmas" no painel admin
$password_hash = password_hash($password, PASSWORD_DEFAULT);
$registration_token = bin2hex(random_bytes(32));
$expires_at = date('Y-m-d H:i:s', strtotime('+24 hours')); // Token válido por 24 horas

// Verificar se a tabela existe, se não existir, criar
$check_table = $conn->query("SHOW TABLES LIKE 'sf_pending_registrations'");
if ($check_table && $check_table->num_rows == 0) {
    // Criar tabela se não existir
    $create_table = $conn->query("
        CREATE TABLE IF NOT EXISTS sf_pending_registrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            registration_token VARCHAR(64) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            INDEX idx_email (email),
            INDEX idx_token (registration_token),
            INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    if (!$create_table) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao criar tabela temporária. Tente mais tarde.']);
        exit();
    }
}

$stmt_insert_pending = $conn->prepare("INSERT INTO sf_pending_registrations (name, email, password_hash, registration_token, expires_at) VALUES (?, ?, ?, ?, ?)");

if (!$stmt_insert_pending) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro no sistema de registro. Tente mais tarde.']);
    exit();
}

$stmt_insert_pending->bind_param("sssss", $name, $email, $password_hash, $registration_token, $expires_at);

if (!$stmt_insert_pending->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao registrar. Tente novamente.']);
    $stmt_insert_pending->close();
    exit();
}

$stmt_insert_pending->close();

// O token de autenticação será o registration_token
// Ele será usado para autenticar durante o onboarding
$token = $registration_token;

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Sua conta foi criada com sucesso! Aguarde a aprovação do nutricionista para começar a usar o aplicativo.',
    'requires_approval' => true,
    'token' => $token,
    'user' => [
        'name' => $name,
        'email' => $email,
        'onboarding_complete' => false
    ]
]);
?>

