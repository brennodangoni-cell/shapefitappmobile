<?php
// api/complete_sleep_routine.php (VERSÃO COM TOKEN)

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../includes/config.php';
$conn = require '../includes/db.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

// Autenticação por token
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
$token = $auth_header ? str_replace('Bearer ', '', $auth_header) : null;

$user = getUserByAuthToken($conn, $token);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado.']);
    exit();
}

$user_id = $user['id'];

// Ler dados do JSON
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);
$sleep_time = $data['sleep_time'] ?? '';
$wake_time = $data['wake_time'] ?? '';
$routine_id = filter_var($data['routine_id'] ?? null, FILTER_VALIDATE_INT);

// Validar dados
if (empty($sleep_time) || empty($wake_time) || !$routine_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados obrigatórios não fornecidos']);
    exit();
}

// Validar formato das horas (HH:MM)
if (!preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $sleep_time) || 
    !preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $wake_time)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Formato de hora inválido']);
    exit();
}

try {
    // Calcular horas de sono
    $sleep_timestamp = strtotime($sleep_time);
    $wake_timestamp = strtotime($wake_time);
    
    // Se acordou no dia seguinte
    if ($wake_timestamp <= $sleep_timestamp) {
        $wake_timestamp += 24 * 3600; // Adicionar 24 horas
    }
    
    $sleep_hours = ($wake_timestamp - $sleep_timestamp) / 3600;
    
    // Verificar se as horas de sono são razoáveis (entre 3 e 15 horas)
    if ($sleep_hours < 3 || $sleep_hours > 15) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Horas de sono devem estar entre 3 e 15 horas']);
        exit();
    }
    
    $current_date = date('Y-m-d');
    $points_to_award = 5;
    $action_key = 'ROUTINE_COMPLETE';
    
    $conn->begin_transaction();
    
    // Verificar se a missão já foi concluída hoje
    $stmt_check = $conn->prepare("SELECT id FROM sf_user_routine_log WHERE user_id = ? AND routine_item_id = ? AND date = ?");
    if (!$stmt_check) {
        throw new Exception("Erro ao preparar verificação: " . $conn->error);
    }
    $stmt_check->bind_param("iis", $user_id, $routine_id, $current_date);
    $stmt_check->execute();
    $result_check = $stmt_check->get_result();
    
    // Se já existe, atualizar; se não, inserir
    if ($result_check->num_rows > 0) {
        $stmt_update = $conn->prepare("
            UPDATE sf_user_routine_log 
            SET is_completed = 1, activity_key = 'sleep_tracking', completed_at = NOW() 
            WHERE user_id = ? AND routine_item_id = ? AND date = ?
        ");
        if (!$stmt_update) {
            throw new Exception("Erro ao preparar atualização: " . $conn->error);
        }
        $stmt_update->bind_param("iis", $user_id, $routine_id, $current_date);
        if (!$stmt_update->execute()) {
            throw new Exception("Erro ao executar atualização: " . $stmt_update->error);
        }
        $stmt_update->close();
    } else {
        // Inserir no log de rotina
        $stmt = $conn->prepare("
            INSERT INTO sf_user_routine_log (user_id, routine_item_id, date, is_completed, activity_key, completed_at) 
            VALUES (?, ?, ?, 1, 'sleep_tracking', NOW())
        ");
        if (!$stmt) {
            throw new Exception("Erro ao preparar inserção: " . $conn->error);
        }
        $stmt->bind_param("iis", $user_id, $routine_id, $current_date);
        if (!$stmt->execute()) {
            throw new Exception("Erro ao executar inserção: " . $stmt->error);
        }
        $stmt->close();
    }
    $stmt_check->close();
    
    // Atualizar também na tabela de tracking diário
    $stmt_tracking = $conn->prepare("
        INSERT INTO sf_user_daily_tracking (user_id, date, sleep_hours) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE sleep_hours = VALUES(sleep_hours)
    ");
    if (!$stmt_tracking) {
        throw new Exception("Erro ao preparar tracking: " . $conn->error);
    }
    $stmt_tracking->bind_param("isd", $user_id, $current_date, $sleep_hours);
    if (!$stmt_tracking->execute()) {
        throw new Exception("Erro ao executar tracking: " . $stmt_tracking->error);
    }
    $stmt_tracking->close();
    
    // Verificar se já existe log de pontos para esta ação hoje
    $stmt_check_log = $conn->prepare("SELECT id FROM sf_user_points_log WHERE user_id = ? AND action_key = ? AND action_context_id = ? AND date_awarded = ?");
    if (!$stmt_check_log) {
        throw new Exception("Erro ao preparar verificação de log: " . $conn->error);
    }
    $routine_id_str = (string)$routine_id;
    $stmt_check_log->bind_param("isss", $user_id, $action_key, $routine_id_str, $current_date);
    $stmt_check_log->execute();
    $log_exists = $stmt_check_log->get_result()->num_rows > 0;
    $stmt_check_log->close();
    
    // Só adiciona pontos se não existir log para esta ação hoje
    $points_awarded = 0;
    if (!$log_exists) {
        // Registrar a ação no log de pontos
        $stmt_log = $conn->prepare("INSERT INTO sf_user_points_log (user_id, points_awarded, action_key, action_context_id, date_awarded, timestamp) VALUES (?, ?, ?, ?, ?, NOW())");
        if (!$stmt_log) {
            throw new Exception("Erro ao preparar log de pontos: " . $conn->error);
        }
        $stmt_log->bind_param("iisss", $user_id, $points_to_award, $action_key, $routine_id_str, $current_date);
        if (!$stmt_log->execute()) {
            throw new Exception("Erro ao executar log de pontos: " . $stmt_log->error);
        }
        $stmt_log->close();
        
        // Adicionar pontos ao usuário usando a função auxiliar
        if (function_exists('addPointsToUser')) {
            addPointsToUser($conn, $user_id, $points_to_award, "Completou rotina de sono ID: {$routine_id}");
        } else {
            // Fallback se a função não existir
            $stmt_points = $conn->prepare("UPDATE sf_users SET points = points + ? WHERE id = ?");
            if ($stmt_points) {
                $stmt_points->bind_param("ii", $points_to_award, $user_id);
                $stmt_points->execute();
                $stmt_points->close();
            }
        }
        $points_awarded = $points_to_award;
    }
    
    // Sincronizar pontos de desafio (se a função existir)
    if (function_exists('updateChallengePoints')) {
        updateChallengePoints($conn, $user_id, 'routine_complete');
    }
    
    // Buscar o novo total de pontos
    $stmt_get_points = $conn->prepare("SELECT points FROM sf_users WHERE id = ?");
    if (!$stmt_get_points) {
        throw new Exception("Erro ao preparar busca de pontos: " . $conn->error);
    }
    $stmt_get_points->bind_param("i", $user_id);
    $stmt_get_points->execute();
    $result_points = $stmt_get_points->get_result()->fetch_assoc();
    $stmt_get_points->close();
    
    $new_total_points = isset($result_points['points']) ? (int)round((float)$result_points['points']) : 0;
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Sono registrado com sucesso!',
        'sleep_hours' => round($sleep_hours, 1),
        'points_awarded' => (int)$points_awarded,
        'new_total_points' => $new_total_points
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("Erro ao completar rotina de sono para user {$user_id}: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Erro ao processar solicitação.',
        'error' => $e->getMessage()
    ]);
} catch (Error $e) {
    $conn->rollback();
    error_log("Erro fatal ao completar rotina de sono para user {$user_id}: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Erro fatal ao processar solicitação.',
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>

