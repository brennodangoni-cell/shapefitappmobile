<?php
// api/upload_profile_photo.php - API para upload de foto de perfil

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

// Validação CSRF apenas se for sessão (não token)
$hasToken = !empty($_SERVER['HTTP_AUTHORIZATION']);
if (isLoggedIn() && !$hasToken && ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token']))) {
    sendJsonResponse(['success' => false, 'message' => 'Acesso negado.'], 403);
}

// Verificar se há arquivo enviado
if (!isset($_FILES['profile_photo']) || $_FILES['profile_photo']['error'] !== UPLOAD_ERR_OK) {
    sendJsonResponse(['success' => false, 'message' => 'Nenhum arquivo enviado ou erro no upload.'], 400);
}

$file = $_FILES['profile_photo'];

// Validar tipo de arquivo
$allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp'];
$mime_type = mime_content_type($file['tmp_name']);
if ($mime_type === false) {
    $mime_type = $file['type'];
}

if (!in_array($mime_type, $allowed_mime_types)) {
    sendJsonResponse(['success' => false, 'message' => 'Formato de arquivo inválido. Use JPG, PNG ou WEBP.'], 400);
}

// Validar tamanho (máximo 5MB)
if ($file['size'] > 5 * 1024 * 1024) {
    sendJsonResponse(['success' => false, 'message' => 'O arquivo é muito grande (máximo 5MB).'], 400);
}

try {
    // Criar diretório se não existir
    $upload_dir = APP_ROOT_PATH . '/assets/images/users/';
    if (!is_dir($upload_dir)) {
        if (!mkdir($upload_dir, 0755, true)) {
            throw new Exception('Erro ao criar diretório de upload');
        }
    }
    
    // Buscar foto antiga para deletar
    $stmt_old = $conn->prepare("SELECT profile_image_filename FROM sf_user_profiles WHERE user_id = ?");
    $stmt_old->bind_param("i", $user_id);
    $stmt_old->execute();
    $result_old = $stmt_old->get_result();
    $old_photo = $result_old->fetch_assoc();
    $stmt_old->close();
    
    // Deletar foto antiga se existir
    if ($old_photo && !empty($old_photo['profile_image_filename'])) {
        $old_file = $upload_dir . $old_photo['profile_image_filename'];
        if (file_exists($old_file)) {
            @unlink($old_file);
        }
    }
    
    // Gerar nome único para a imagem
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $new_filename = 'user_' . $user_id . '_' . time() . '_' . uniqid() . '.' . $extension;
    $file_path = $upload_dir . $new_filename;
    
    // Mover arquivo
    if (!move_uploaded_file($file['tmp_name'], $file_path)) {
        throw new Exception('Erro ao fazer upload do arquivo.');
    }
    
    // Atualizar no banco de dados
    $stmt = $conn->prepare("UPDATE sf_user_profiles SET profile_image_filename = ? WHERE user_id = ?");
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . $conn->error);
    }
    
    $stmt->bind_param("si", $new_filename, $user_id);
    if (!$stmt->execute()) {
        throw new Exception('Erro ao salvar no banco de dados: ' . $stmt->error);
    }
    
    $affected_rows = $stmt->affected_rows;
    $stmt->close();
    
    // Verificar se realmente atualizou
    if ($affected_rows === 0) {
        error_log("AVISO: Nenhuma linha foi atualizada no banco para user_id {$user_id} - pode ser que o perfil não exista ainda");
        // Tentar INSERT se não existir
        $stmt_insert = $conn->prepare("INSERT INTO sf_user_profiles (user_id, profile_image_filename) VALUES (?, ?) ON DUPLICATE KEY UPDATE profile_image_filename = ?");
        if ($stmt_insert) {
            $stmt_insert->bind_param("iss", $user_id, $new_filename, $new_filename);
            $stmt_insert->execute();
            $stmt_insert->close();
        }
    }
    
    // NÃO adicionar pontos ao atualizar foto de perfil
    
    $image_url = BASE_APP_URL . '/assets/images/users/' . $new_filename . '?t=' . time();
    
    error_log("Upload de foto bem-sucedido para user_id {$user_id}: {$new_filename}");
    
    sendJsonResponse([
        'success' => true,
        'message' => 'Foto de perfil atualizada!',
        'image_url' => $image_url
    ]);
    
} catch (Exception $e) {
    error_log("Erro em api/upload_profile_photo.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Erro ao fazer upload: ' . $e->getMessage()], 500);
}

$conn->close();
?>






