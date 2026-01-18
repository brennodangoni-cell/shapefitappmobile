<?php
// api/save_custom_food.php - Salva alimento customizado
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

$user_id = $user['id'];

// Ler dados do POST (JSON ou form-data)
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$name_pt = trim($input['food_name'] ?? $input['name_pt'] ?? '');
$brand = trim($input['brand_name'] ?? $input['brand'] ?? '');
$kcal = isset($input['kcal_100g']) ? filter_var($input['kcal_100g'], FILTER_VALIDATE_FLOAT) : null;
$protein = isset($input['protein_100g']) ? filter_var($input['protein_100g'], FILTER_VALIDATE_FLOAT) : null;
$carbs = isset($input['carbs_100g']) ? filter_var($input['carbs_100g'], FILTER_VALIDATE_FLOAT) : null;
$fat = isset($input['fat_100g']) ? filter_var($input['fat_100g'], FILTER_VALIDATE_FLOAT) : null;
$barcode = trim($input['barcode'] ?? '');

// Validação
if (empty($name_pt) || $kcal === null || $kcal === false || $protein === null || $protein === false || $carbs === null || $carbs === false || $fat === null || $fat === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Por favor, preencha todos os campos obrigatórios corretamente.']);
    exit();
}

$source_table = "user_created";

try {
    // Se tem código de barras, verificar se já existe
    if (!empty($barcode)) {
        $check_sql = "SELECT id, added_by_user_id FROM sf_food_items WHERE barcode = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param("s", $barcode);
        $check_stmt->execute();
        $existing = $check_stmt->get_result()->fetch_assoc();
        $check_stmt->close();
        
        if ($existing && $existing['added_by_user_id'] === null) {
            // Existe mas foi criado pelo sistema (TACO/Sonia), não atualizar
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Este código de barras já está cadastrado no sistema.']);
            exit();
        }
        
        // INSERT com ON DUPLICATE KEY UPDATE
        $sql = "INSERT INTO sf_food_items (barcode, name_pt, brand, energy_kcal_100g, protein_g_100g, carbohydrate_g_100g, fat_g_100g, added_by_user_id, source_table)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name_pt = VALUES(name_pt),
                    brand = VALUES(brand),
                    energy_kcal_100g = VALUES(energy_kcal_100g),
                    protein_g_100g = VALUES(protein_g_100g),
                    carbohydrate_g_100g = VALUES(carbohydrate_g_100g),
                    fat_g_100g = VALUES(fat_g_100g),
                    source_table = VALUES(source_table)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("sssddddis", $barcode, $name_pt, $brand, $kcal, $protein, $carbs, $fat, $user_id, $source_table);
    } else {
        // INSERT simples sem código de barras
        $sql = "INSERT INTO sf_food_items (name_pt, brand, energy_kcal_100g, protein_g_100g, carbohydrate_g_100g, fat_g_100g, added_by_user_id, source_table)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ssddddis", $name_pt, $brand, $kcal, $protein, $carbs, $fat, $user_id, $source_table);
    }
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Alimento salvo com sucesso!'
        ], JSON_UNESCAPED_UNICODE);
    } else {
        error_log("Erro ao salvar alimento customizado: " . $stmt->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao salvar o alimento no banco de dados.']);
    }
    
    $stmt->close();
} catch (Exception $e) {
    error_log("Exceção ao salvar alimento customizado: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao processar a solicitação.']);
}

$conn->close();
?>

