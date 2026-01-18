<?php
// api/get_units.php - API para buscar unidades de medida

// Desabilitar qualquer output automático
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Iniciar output buffering ANTES de qualquer coisa
while (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once '../includes/config.php';
require_once APP_ROOT_PATH . '/includes/db.php';
require_once APP_ROOT_PATH . '/includes/units_manager.php';

// Limpar qualquer output que possa ter sido gerado pelos includes
ob_clean();

// Headers CORS completos para permitir requisições do navegador
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 3600');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

// Responder a requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $units_manager = new UnitsManager($conn);
    
    $action = $_GET['action'] ?? 'all';
    $food_id = $_GET['food_id'] ?? null;
    $category = $_GET['category'] ?? null;
    
    switch ($action) {
        case 'all':
            $units = $units_manager->getAllUnits();
            break;
            
        case 'by_category':
            if (!$category) {
                throw new Exception('Categoria não fornecida');
            }
            $units = $units_manager->getUnitsByCategory($category);
            break;
            
        case 'for_food':
            if (!$food_id) {
                throw new Exception('ID do alimento não fornecido');
            }
            
            // Resolver IDs com prefixo (ex.: taco_66, off_7890123) para o ID interno
            $resolved_food_id = null;
            if (is_numeric($food_id)) {
                $resolved_food_id = (int)$food_id;
                // Se não houver conversões para este ID, tentar tratar como taco_id
                $check_stmt = $conn->prepare("SELECT COUNT(*) FROM sf_food_item_conversions WHERE food_item_id = ?");
                if ($check_stmt) {
                    $check_stmt->bind_param("i", $resolved_food_id);
                    $check_stmt->execute();
                    $check_stmt->bind_result($cnt);
                    if ($check_stmt->fetch() && (int)$cnt === 0) {
                        $check_stmt->close();
                        $stmt_find = $conn->prepare("SELECT id FROM sf_food_items WHERE taco_id = ? LIMIT 1");
                        if ($stmt_find) {
                            $identifier = (string)$food_id;
                            $stmt_find->bind_param("s", $identifier);
                            $stmt_find->execute();
                            $stmt_find->bind_result($found_id);
                            if ($stmt_find->fetch()) {
                                $resolved_food_id = (int)$found_id;
                            }
                            $stmt_find->close();
                        }
                    } else {
                        $check_stmt->close();
                    }
                }
            } else {
                $id_parts = explode('_', $food_id, 2);
                if (count($id_parts) === 2) {
                    $prefix = $id_parts[0];
                    $identifier = $id_parts[1];
                    if ($prefix === 'taco' && is_numeric($identifier)) {
                        $stmt_find = $conn->prepare("SELECT id FROM sf_food_items WHERE taco_id = ? LIMIT 1");
                        if ($stmt_find) {
                            $stmt_find->bind_param("s", $identifier);
                            $stmt_find->execute();
                            $stmt_find->bind_result($found_id);
                            if ($stmt_find->fetch()) {
                                $resolved_food_id = (int)$found_id;
                            }
                            $stmt_find->close();
                        }
                    } elseif ($prefix === 'off' && is_numeric($identifier)) {
                        $stmt_find = $conn->prepare("SELECT id FROM sf_food_items WHERE barcode = ? LIMIT 1");
                        if ($stmt_find) {
                            $stmt_find->bind_param("s", $identifier);
                            $stmt_find->execute();
                            $stmt_find->bind_result($found_id);
                            if ($stmt_find->fetch()) {
                                $resolved_food_id = (int)$found_id;
                            }
                            $stmt_find->close();
                        }
                    }
                }
            }
            
            if (!$resolved_food_id) {
                // Se mesmo após todas as tentativas não resolver, retorna um erro claro.
                throw new Exception('Alimento não encontrado ou ID inválido: ' . $food_id);
            }
            
            $units = $units_manager->getUnitsForFood($resolved_food_id);

            // FALLBACK: Se nenhuma unidade específica for encontrada, busca as unidades padrão.
            if (empty($units)) {
                error_log("Nenhuma unidade específica para food_id {$resolved_food_id}. Buscando unidades padrão.");
                $units = $units_manager->getDefaultUnits();
            }

            break;
            
        case 'suggested':
            $food_name = $_GET['food_name'] ?? '';
            $units = $units_manager->getSuggestedUnits($food_name);
            break;
            
        default:
            throw new Exception('Ação inválida');
    }
    
    // Garantir que $units é um array
    if (!is_array($units)) {
        $units = [];
    }
    
    // Normalizar os dados para garantir tipos corretos
    $normalized_units = [];
    foreach ($units as $unit) {
        $normalized_units[] = [
            'id' => (int)($unit['id'] ?? $unit->id ?? 0),
            'name' => (string)($unit['name'] ?? $unit->name ?? ''),
            'abbreviation' => (string)($unit['abbreviation'] ?? $unit->abbreviation ?? ''),
            'conversion_factor' => isset($unit['conversion_factor']) ? (string)$unit['conversion_factor'] : (isset($unit->conversion_factor) ? (string)$unit->conversion_factor : '1.0000'),
            'is_default' => isset($unit['is_default']) ? (int)$unit['is_default'] : (isset($unit->is_default) ? (int)$unit->is_default : 0)
        ];
    }
    
    // Log para debug (apenas no servidor, não vai para o output)
    error_log("🔍 [get_units.php] Retornando " . count($normalized_units) . " unidades para action={$action}, food_id={$food_id}");
    error_log("🔍 [get_units.php] Primeira unidade: " . json_encode($normalized_units[0] ?? null));
    
    // Preparar resposta
    $response = [
        'success' => true,
        'data' => $normalized_units
    ];
    
    // Limpar qualquer output que possa ter sido gerado
    ob_clean();
    
    // Enviar resposta JSON
    $json_output = json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
    // Verificar se o JSON é válido
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("❌ [get_units.php] Erro ao gerar JSON: " . json_last_error_msg());
        throw new Exception('Erro ao gerar resposta JSON');
    }
    
    error_log("🔍 [get_units.php] JSON que será enviado (primeiros 500 chars): " . substr($json_output, 0, 500));
    error_log("🔍 [get_units.php] Tamanho do JSON: " . strlen($json_output) . " bytes");
    
    // Validar estrutura antes de enviar
    $test_parse = json_decode($json_output, true);
    if (!isset($test_parse['success']) || !isset($test_parse['data'])) {
        error_log("❌ [get_units.php] Estrutura JSON inválida!");
        throw new Exception('Estrutura de resposta inválida');
    }
    error_log("✅ [get_units.php] Estrutura JSON válida: success=" . ($test_parse['success'] ? 'true' : 'false') . ", data_count=" . count($test_parse['data']));
    
    // Limpar TODOS os buffers e enviar apenas o JSON
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Enviar headers novamente para garantir
    header('Content-Type: application/json; charset=utf-8', true);
    header('Content-Length: ' . strlen($json_output));
    header('X-Content-Type-Options: nosniff');
    
    echo $json_output;
    flush();
    exit; // Garantir que nada mais é enviado
    
} catch (Exception $e) {
    // Limpar qualquer output anterior em caso de erro
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    error_log("❌ [get_units.php] Erro: " . $e->getMessage());
    
    $response = [
        'success' => false,
        'error' => $e->getMessage()
    ];
    
    $json_output = json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    
    header('Content-Type: application/json; charset=utf-8', true);
    header('Content-Length: ' . strlen($json_output));
    
    echo $json_output;
    flush();
    exit;
}

