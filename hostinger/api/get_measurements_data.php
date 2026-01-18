<?php
// api/get_measurements_data.php - Dados para página de medidas

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

$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado.']);
    exit();
}

$user_id = $user['id'];

try {
    // Buscar dados do usuário
    $user_profile_data = getUserProfileData($conn, $user_id);
    
    // Buscar histórico de medidas
    $stmt = $conn->prepare("
        SELECT * FROM sf_user_measurements 
        WHERE user_id = ? 
        ORDER BY created_at DESC, date_recorded DESC 
        LIMIT 20
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $history_data = [];
    while ($row = $result->fetch_assoc()) {
        $history_data[] = $row;
    }
    $stmt->close();
    
    // Buscar último registro para comparação
    $last_measurement = !empty($history_data) ? $history_data[0] : null;
    
    echo json_encode([
        'success' => true,
        'data' => [
            'user_profile' => $user_profile_data,
            'history' => $history_data,
            'last_measurement' => $last_measurement,
            'base_url' => BASE_APP_URL,
            'base_asset_url' => BASE_ASSET_URL
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $e->getMessage()]);
}

$conn->close();
?>

