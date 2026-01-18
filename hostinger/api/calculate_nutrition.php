<?php
// api/calculate_nutrition.php - API para calcular valores nutricionais com unidades

require_once '../includes/config.php';
require_once APP_ROOT_PATH . '/includes/db.php';
require_once APP_ROOT_PATH . '/includes/units_manager.php';

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Tratar requisições OPTIONS (preflight CORS)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

try {
    $units_manager = new UnitsManager($conn);
    
    // Tentar ler dados de $_POST primeiro, se vazio, tentar parsear php://input
    $input_data = $_POST;
    if (empty($input_data) || !isset($input_data['food_id'])) {
        $raw_input = file_get_contents('php://input');
        if (!empty($raw_input)) {
            // Tentar parsear como URL-encoded
            parse_str($raw_input, $input_data);
        }
    }
    
    $food_id = $input_data['food_id'] ?? null;
    $quantity = floatval($input_data['quantity'] ?? 0);
    $unit_id = intval($input_data['unit_id'] ?? 0);
    $is_recipe = $input_data['is_recipe'] ?? '0';
    
    error_log("🔍 [calculate_nutrition.php] REQUEST_METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'N/A'));
    error_log("🔍 [calculate_nutrition.php] Parâmetros extraídos: food_id={$food_id}, quantity={$quantity}, unit_id={$unit_id}, is_recipe={$is_recipe}");
    
    if (!$food_id || !$quantity || !$unit_id) {
        throw new Exception(sprintf(
            'Parâmetros obrigatórios não fornecidos (food_id=%s, quantity=%s, unit_id=%s)',
            var_export($food_id, true),
            var_export($quantity, true),
            var_export($unit_id, true)
        ));
    }
    
    // Buscar dados nutricionais do alimento/receita
    // Usar COALESCE para garantir que valores NULL sejam tratados como 0
    if ($is_recipe === '1') {
        $sql = "SELECT 
                    COALESCE(kcal_per_serving, 0) as kcal_per_serving, 
                    COALESCE(protein_g_per_serving, 0) as protein_g_per_serving, 
                    COALESCE(carbs_g_per_serving, 0) as carbs_g_per_serving, 
                    COALESCE(fat_g_per_serving, 0) as fat_g_per_serving 
                FROM sf_recipes WHERE id = ?";
    } else {
        $sql = "SELECT 
                    COALESCE(energy_kcal_100g, 0) as energy_kcal_100g, 
                    COALESCE(protein_g_100g, 0) as protein_g_100g, 
                    COALESCE(carbohydrate_g_100g, 0) as carbohydrate_g_100g, 
                    COALESCE(fat_g_100g, 0) as fat_g_100g 
                FROM sf_food_items WHERE id = ?";
    }
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $food_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if (!$food = $result->fetch_assoc()) {
        error_log("❌ [calculate_nutrition.php] Alimento/receita não encontrado: food_id={$food_id}, is_recipe={$is_recipe}");
        throw new Exception('Alimento/receita não encontrado');
    }
    
    // Log para debug - verificar se os valores estão NULL ou 0
    error_log("🔍 [calculate_nutrition.php] Dados do alimento/receita: " . json_encode($food));
    error_log("🔍 [calculate_nutrition.php] Parâmetros: food_id={$food_id}, quantity={$quantity}, unit_id={$unit_id}, is_recipe={$is_recipe}");
    
    // Verificar se todos os valores nutricionais são zero
    $allZero = true;
    if ($is_recipe === '1') {
        $allZero = (
            floatval($food['kcal_per_serving'] ?? 0) == 0 &&
            floatval($food['protein_g_per_serving'] ?? 0) == 0 &&
            floatval($food['carbs_g_per_serving'] ?? 0) == 0 &&
            floatval($food['fat_g_per_serving'] ?? 0) == 0
        );
    } else {
        $allZero = (
            floatval($food['energy_kcal_100g'] ?? 0) == 0 &&
            floatval($food['protein_g_100g'] ?? 0) == 0 &&
            floatval($food['carbohydrate_g_100g'] ?? 0) == 0 &&
            floatval($food['fat_g_100g'] ?? 0) == 0
        );
    }
    
    if ($allZero) {
        error_log("⚠️ [calculate_nutrition.php] ATENÇÃO: Todos os valores nutricionais são ZERO para food_id={$food_id}");
    }
    
    // Converter quantidade para unidade base
    $quantity_in_base_unit = $units_manager->convertToBaseUnit($quantity, $unit_id, $food_id);
    error_log("🔍 [calculate_nutrition.php] Quantidade em unidade base: {$quantity_in_base_unit}");
    
    // Preparar dados nutricionais por 100g
    if ($is_recipe === '1') {
        $nutrition_per_100g = [
            'kcal' => floatval($food['kcal_per_serving'] ?? 0),
            'protein' => floatval($food['protein_g_per_serving'] ?? 0),
            'carbs' => floatval($food['carbs_g_per_serving'] ?? 0),
            'fat' => floatval($food['fat_g_per_serving'] ?? 0)
        ];
        // Para receitas, assumimos que 1 porção = 100g
        $factor = $quantity_in_base_unit / 100;
    } else {
        $nutrition_per_100g = [
            'kcal' => floatval($food['energy_kcal_100g'] ?? 0),
            'protein' => floatval($food['protein_g_100g'] ?? 0),
            'carbs' => floatval($food['carbohydrate_g_100g'] ?? 0),
            'fat' => floatval($food['fat_g_100g'] ?? 0)
        ];
        $factor = $quantity_in_base_unit / 100;
    }
    
    // Calcular valores nutricionais (garantir que não seja negativo)
    $calculated_nutrition = [
        'kcal' => max(0, round(($nutrition_per_100g['kcal'] ?? 0) * $factor, 1)),
        'protein' => max(0, round(($nutrition_per_100g['protein'] ?? 0) * $factor, 1)),
        'carbs' => max(0, round(($nutrition_per_100g['carbs'] ?? 0) * $factor, 1)),
        'fat' => max(0, round(($nutrition_per_100g['fat'] ?? 0) * $factor, 1))
    ];
    
    // Log para debug
    error_log("🔍 [calculate_nutrition.php] Nutrição calculada: " . json_encode($calculated_nutrition));
    error_log("🔍 [calculate_nutrition.php] Factor: {$factor}, Nutrition per 100g: " . json_encode($nutrition_per_100g));
    
    // Buscar informações da unidade
    $sql = "SELECT name, abbreviation FROM sf_measurement_units WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $unit_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $unit_info = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'data' => [
            'nutrition' => $calculated_nutrition,
            'quantity_in_base_unit' => round($quantity_in_base_unit, 2),
            'unit_info' => $unit_info,
            'factor' => round($factor, 4)
        ]
    ]);
    
} catch (Exception $e) {
    error_log("❌ [calculate_nutrition.php] ERRO: " . $e->getMessage());
    error_log("❌ [calculate_nutrition.php] Stack trace: " . $e->getTraceAsString());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} catch (Error $e) {
    error_log("❌ [calculate_nutrition.php] ERRO FATAL: " . $e->getMessage());
    error_log("❌ [calculate_nutrition.php] Stack trace: " . $e->getTraceAsString());
    echo json_encode([
        'success' => false,
        'error' => 'Erro fatal: ' . $e->getMessage()
    ]);
}
?>
