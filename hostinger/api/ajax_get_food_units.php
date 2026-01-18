<?php
// api/ajax_get_food_units.php - Buscar unidades ESPECÍFICAS de um alimento

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
require_once __DIR__ . '/../includes/config.php';
require_once APP_ROOT_PATH . '/includes/db.php';

require_once APP_ROOT_PATH . '/includes/auth.php';

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autenticado.']);
    exit;
}

if (!isset($_SESSION)) {
    session_start();
}

$_SESSION['user_id'] = $user['id'];

$food_id_string = $_GET['food_id'] ?? '';

if (empty($food_id_string)) {
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

// Extrair ID do alimento
$food_db_id = null;
$id_parts = explode('_', $food_id_string, 2);
if (count($id_parts) === 2) {
    $prefix = $id_parts[0];
    $identifier = $id_parts[1];

    if ($prefix === 'taco' && is_numeric($identifier)) {
        $stmt_find = $conn->prepare("SELECT id FROM sf_food_items WHERE taco_id = ? LIMIT 1");
    } elseif ($prefix === 'off' && is_numeric($identifier)) {
        $stmt_find = $conn->prepare("SELECT id FROM sf_food_items WHERE barcode = ? LIMIT 1");
    } else {
        $stmt_find = false;
    }
    
    if ($stmt_find) {
        $stmt_find->bind_param("s", $identifier);
        $stmt_find->execute();
        $stmt_find->bind_result($found_id);
        if ($stmt_find->fetch()) {
            $food_db_id = $found_id;
        }
        $stmt_find->close();
    }
}

$units = [];

if ($food_db_id) {
    // IMPORTANTE: Buscar APENAS na tabela sf_food_units (unidades específicas do alimento)
    // NÃO fazer JOIN com sf_measurement_units para evitar unidades hardcoded
    $units_sql = "SELECT fu.*, mu.name as unit_name, mu.abbreviation, mu.conversion_factor, mu.conversion_unit
                  FROM sf_food_units fu 
                  JOIN sf_measurement_units mu ON fu.unit_id = mu.id 
                  WHERE fu.food_id = ? 
                  ORDER BY fu.is_default DESC, mu.abbreviation";
        if ($stmt = $conn->prepare($units_sql)) {
            $stmt->bind_param("i", $food_db_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                $units[] = [
                    'id' => (int)$row['unit_id'],
                    'abbreviation' => $row['abbreviation'],
                    'name' => $row['unit_name'],
                    'factor' => (float)$row['conversion_factor'],
                    'unit' => $row['conversion_unit'],
                    'is_default' => (bool)$row['is_default']
                ];
            }
            $stmt->close();
        }
}

// IMPORTANTE: Retornar array vazio se não há unidades específicas para o alimento
// Isso fará com que o JavaScript mostre a mensagem de "não classificado"
echo json_encode(['success' => true, 'data' => $units], JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
?>