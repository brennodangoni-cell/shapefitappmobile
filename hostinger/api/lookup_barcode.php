<?php
// api/lookup_barcode.php - Busca código de barras no banco local e Open Food Facts
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../includes/config.php';
require_once APP_ROOT_PATH . '/includes/db.php';
require_once APP_ROOT_PATH . '/includes/auth.php';

// Autenticação
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autenticado.']);
    exit();
}

$barcode = isset($_GET['barcode']) ? trim($_GET['barcode']) : '';

if (empty($barcode) || !preg_match('/^\d+$/', $barcode)) {
    echo json_encode(['success' => false, 'message' => 'Código de barras inválido.']);
    exit();
}

// 1. Buscar no banco de dados local primeiro
try {
    $stmt = $conn->prepare("SELECT id, name_pt, brand, energy_kcal_100g, protein_g_100g, carbohydrate_g_100g, fat_g_100g, barcode FROM sf_food_items WHERE barcode = ? LIMIT 1");
    $stmt->bind_param("s", $barcode);
    $stmt->execute();
    $result = $stmt->get_result();
    $local_product = $result->fetch_assoc();
    $stmt->close();
    
    if ($local_product) {
        echo json_encode([
            'success' => true,
            'data' => [
                'name' => $local_product['name_pt'],
                'brand' => $local_product['brand'] ?: '',
                'kcal_100g' => (float)$local_product['energy_kcal_100g'],
                'protein_100g' => (float)$local_product['protein_g_100g'],
                'carbs_100g' => (float)$local_product['carbohydrate_g_100g'],
                'fat_100g' => (float)$local_product['fat_g_100g'],
                'barcode' => $barcode
            ]
        ], JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
        exit();
    }
} catch (Exception $e) {
    error_log("Erro ao buscar código de barras no banco local: " . $e->getMessage());
}

// 2. Se não encontrou no banco local, buscar na Open Food Facts
try {
    $off_url = "https://world.openfoodfacts.org/api/v2/product/{$barcode}.json";
    $ch = curl_init($off_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_USERAGENT, 'ShapeFIT/1.0');
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code === 200 && $response) {
        $off_data = json_decode($response, true);
        
        if (isset($off_data['status']) && $off_data['status'] === 1 && isset($off_data['product'])) {
            $p = $off_data['product'];
            $n = $p['nutriments'] ?? [];
            
            // Converter energia para kcal se necessário
            $kcal = null;
            if (isset($n['energy-kcal_100g'])) {
                $kcal = (float)$n['energy-kcal_100g'];
            } elseif (isset($n['energy_100g'])) {
                $kcal = (float)$n['energy_100g'] / 4.184; // Converter kJ para kcal
            }
            
            $product_data = [
                'name' => $p['product_name_pt'] ?? $p['product_name'] ?? '',
                'brand' => $p['brands'] ?? '',
                'kcal_100g' => $kcal ? round($kcal) : 0,
                'protein_100g' => isset($n['proteins_100g']) ? (float)$n['proteins_100g'] : 0,
                'carbs_100g' => isset($n['carbohydrates_100g']) ? (float)$n['carbohydrates_100g'] : 0,
                'fat_100g' => isset($n['fat_100g']) ? (float)$n['fat_100g'] : 0,
                'barcode' => $barcode
            ];
            
            echo json_encode([
                'success' => true,
                'data' => $product_data
            ], JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
            exit();
        }
    }
} catch (Exception $e) {
    error_log("Erro ao buscar código de barras na Open Food Facts: " . $e->getMessage());
}

// 3. Produto não encontrado
echo json_encode([
    'success' => false,
    'message' => 'Produto não encontrado na base de dados.'
], JSON_UNESCAPED_UNICODE);

$conn->close();
?>

