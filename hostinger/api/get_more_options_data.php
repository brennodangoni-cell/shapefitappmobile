<?php
// api/get_more_options_data.php - Dados para a página more_options

while (ob_get_level()) {
    ob_end_clean();
}

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

try {
    $user_profile_data = getUserProfileData($conn, $user_id);
    
    if (!$user_profile_data) {
        sendJsonResponse(['success' => false, 'message' => 'Perfil não encontrado.'], 404);
    }
    
    // Pegar primeiro nome
    $first_name = explode(' ', $user_profile_data['name'])[0];
    
    // Foto de perfil
    $profile_image_filename = $user_profile_data['profile_image_filename'] ?? null;
    $profile_image_url = null;
    
    if ($profile_image_filename) {
        $profile_image_url = BASE_APP_URL . '/assets/images/users/' . $profile_image_filename;
    }
    
    sendJsonResponse([
        'success' => true,
        'data' => [
            'first_name' => $first_name,
            'profile_image_url' => $profile_image_url,
            'base_url' => BASE_APP_URL
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Erro em api/get_more_options_data.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Erro ao buscar dados: ' . $e->getMessage()], 500);
}

$conn->close();
?>

