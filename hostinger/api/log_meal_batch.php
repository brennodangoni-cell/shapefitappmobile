<?php
// api/log_meal_batch.php - API para registrar múltiplas refeições no diário (batch)

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

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    sendJsonResponse(['success' => false, 'message' => 'Não autorizado.'], 401);
}

$user_id = $user['id'];

// Validação CSRF apenas se for sessão (não token)
// Se há token Bearer, não precisa de CSRF
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

// Verificar se é batch
$is_batch = isset($data['batch']) && ($data['batch'] === '1' || $data['batch'] === 1);
$items_raw = $data['items'] ?? null;

if ($is_batch) {
    // Se items_raw já é um array, usar diretamente; senão, tentar decodificar JSON
    if (is_array($items_raw)) {
        $items = $items_raw;
    } else if (is_string($items_raw)) {
        $items = json_decode($items_raw, true);
    } else {
        $items = [];
    }
    
    if (!is_array($items) || empty($items)) {
        sendJsonResponse(['success' => false, 'message' => 'Nenhuma refeição foi informada.'], 400);
    }
    
    $conn->begin_transaction();
    
    try {
        $redirectDate = null;
        
        foreach ($items as $batchItem) {
            // Processar cada item
            $recipe_id = isset($batchItem['recipe_id']) && $batchItem['recipe_id'] !== '' ? (int)$batchItem['recipe_id'] : null;
            $servings_consumed = isset($batchItem['servings_consumed']) ? (float)$batchItem['servings_consumed'] : 0;
            $meal_type = trim($batchItem['meal_type'] ?? '');
            $date_consumed = trim($batchItem['date_consumed'] ?? '');
            $custom_meal_name = trim($batchItem['custom_meal_name'] ?? '');
            $is_food = !empty($batchItem['is_food']);
            
            if ($servings_consumed <= 0 || $meal_type === '' || $date_consumed === '' || $custom_meal_name === '') {
                throw new Exception('Dados inválidos para registrar a refeição.');
            }
            
            // Calcular valores totais
            $total_kcal = isset($batchItem['total_kcal']) ? (float)$batchItem['total_kcal'] : 0;
            $total_protein = isset($batchItem['total_protein']) ? (float)$batchItem['total_protein'] : 0;
            $total_carbs = isset($batchItem['total_carbs']) ? (float)$batchItem['total_carbs'] : 0;
            $total_fat = isset($batchItem['total_fat']) ? (float)$batchItem['total_fat'] : 0;
            
            $logged_at = date('Y-m-d H:i:s');
            
            if ($is_food) {
                // Inserir alimento customizado
                $stmt_log = $conn->prepare("
                    INSERT INTO sf_user_meal_log 
                    (user_id, custom_meal_name, meal_type, date_consumed, servings_consumed, kcal_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, logged_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt_log->bind_param("isssddddds", $user_id, $custom_meal_name, $meal_type, $date_consumed, $servings_consumed,
                    $total_kcal, $total_protein, $total_carbs, $total_fat, $logged_at);
            } else {
                // Inserir receita
                if (!$recipe_id) {
                    throw new Exception('ID da receita é obrigatório.');
                }
                $stmt_log = $conn->prepare("
                    INSERT INTO sf_user_meal_log 
                    (user_id, recipe_id, meal_type, date_consumed, servings_consumed, kcal_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, logged_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt_log->bind_param("iissddddds", $user_id, $recipe_id, $meal_type, $date_consumed, $servings_consumed,
                    $total_kcal, $total_protein, $total_carbs, $total_fat, $logged_at);
            }
            
            $stmt_log->execute();
            $stmt_log->close();
            
            if (!$redirectDate) {
                $redirectDate = $date_consumed;
            }
        }
        
        // Recalcular totais diários para todas as datas afetadas
        $dates = array_unique(array_column($items, 'date_consumed'));
        foreach ($dates as $date) {
            // Recalcular totais do zero para evitar inconsistências
            $stmt_totals = $conn->prepare("
                SELECT SUM(kcal_consumed) as total_kcal, 
                       SUM(protein_consumed_g) as total_protein, 
                       SUM(carbs_consumed_g) as total_carbs, 
                       SUM(fat_consumed_g) as total_fat
                FROM sf_user_meal_log 
                WHERE user_id = ? AND date_consumed = ?
            ");
            $stmt_totals->bind_param("is", $user_id, $date);
            $stmt_totals->execute();
            $totals = $stmt_totals->get_result()->fetch_assoc();
            $stmt_totals->close();
            
            // Atualizar ou inserir registro diário
            $stmt_daily = $conn->prepare("
                INSERT INTO sf_user_daily_tracking 
                (user_id, date, kcal_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    kcal_consumed = VALUES(kcal_consumed),
                    protein_consumed_g = VALUES(protein_consumed_g),
                    carbs_consumed_g = VALUES(carbs_consumed_g),
                    fat_consumed_g = VALUES(fat_consumed_g)
            ");
            $total_kcal = (float)($totals['total_kcal'] ?? 0);
            $total_protein = (float)($totals['total_protein'] ?? 0);
            $total_carbs = (float)($totals['total_carbs'] ?? 0);
            $total_fat = (float)($totals['total_fat'] ?? 0);
            
            $stmt_daily->bind_param("isdddd", $user_id, $date, $total_kcal, $total_protein, $total_carbs, $total_fat);
            $stmt_daily->execute();
            $stmt_daily->close();
        }
        
        $conn->commit();
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Refeições registradas com sucesso!',
            'redirect' => BASE_APP_URL . '/diary.html?date=' . ($redirectDate ?: date('Y-m-d'))
        ]);
        
    } catch (Exception $e) {
        $conn->rollback();
        error_log("Erro em api/log_meal_batch.php para user_id {$user_id}: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Erro ao registrar refeições: ' . $e->getMessage()], 500);
    }
} else {
    sendJsonResponse(['success' => false, 'message' => 'Esta API requer batch=1.'], 400);
}

$conn->close();
?>

