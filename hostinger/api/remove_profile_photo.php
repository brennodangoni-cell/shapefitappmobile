<?php
// api/remove_profile_photo.php - API para remover foto de perfil

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

// Ler dados do POST (JSON ou FormData)
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data) {
    $data = $_POST;
}

$should_remove = isset($data['remove']) && ($data['remove'] === true || $data['remove'] === '1' || $data['remove'] === 1);

if (!$should_remove) {
    sendJsonResponse(['success' => false, 'message' => 'Parâmetro inválido.'], 400);
}

try {
    // Buscar foto atual
    $stmt_old = $conn->prepare("SELECT profile_image_filename FROM sf_user_profiles WHERE user_id = ?");
    $stmt_old->bind_param("i", $user_id);
    $stmt_old->execute();
    $result_old = $stmt_old->get_result();
    $old_photo = $result_old->fetch_assoc();
    $stmt_old->close();
    
    // Deletar arquivo físico se existir
    if ($old_photo && !empty($old_photo['profile_image_filename'])) {
        $upload_dir = APP_ROOT_PATH . '/assets/images/users/';
        $old_file = $upload_dir . $old_photo['profile_image_filename'];
        if (file_exists($old_file)) {
            @unlink($old_file);
        }
    }
    
    // Remover do banco de dados
    $stmt = $conn->prepare("UPDATE sf_user_profiles SET profile_image_filename = NULL WHERE user_id = ?");
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . $conn->error);
    }
    
    $stmt->bind_param("i", $user_id);
    if (!$stmt->execute()) {
        throw new Exception('Erro ao remover foto do banco de dados: ' . $stmt->error);
    }
    $stmt->close();
    
    sendJsonResponse([
        'success' => true,
        'message' => 'Foto de perfil removida com sucesso!'
    ]);
    
} catch (Exception $e) {
    error_log("Erro em api/remove_profile_photo.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Erro ao remover foto: ' . $e->getMessage()], 500);
}

$conn->close();
?>

