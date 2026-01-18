<?php
/**
 * API: get_banners.php
 * Retorna lista de banners ativos para o carrossel
 * 
 * Resposta:
 * {
 *   "success": true,
 *   "banners": [
 *     { "json_path": "/assets/banners/banner1.json", "link_url": "/explorar" },
 *     ...
 *   ]
 * }
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir configuração do banco
define('IS_AJAX_REQUEST', true);
require_once '../includes/config.php';
require_once '../includes/db.php';

try {
    // Buscar banners ativos ordenados
    $stmt = $conn->prepare("
        SELECT json_path, link_url 
        FROM sf_banners 
        WHERE is_active = 1 
        ORDER BY display_order ASC, id ASC
    ");
    
    if (!$stmt) {
        throw new Exception("Erro ao preparar query: " . $conn->error);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $banners = [];
    while ($row = $result->fetch_assoc()) {
        $banners[] = [
            'json_path' => $row['json_path'],
            'link_url' => $row['link_url'] ?: null
        ];
    }
    
    $stmt->close();
    
    // Cache por 5 minutos (pode ajustar)
    header("Cache-Control: public, max-age=300");
    
    echo json_encode([
        'success' => true,
        'banners' => $banners
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em get_banners.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao carregar banners'
    ]);
}

if (isset($conn)) {
    $conn->close();
}
?>

