<?php
// api/complete_exercise_with_duration.php (VERSÃO COM TOKEN)

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
$current_date = date('Y-m-d');
$points_to_award = 5;
$action_key = 'ROUTINE_COMPLETE';

// Ler dados do JSON
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);
$routine_id_or_name = $data['routine_id'] ?? '';
$duration_minutes = filter_var($data['duration_minutes'] ?? null, FILTER_VALIDATE_INT);

// Pode ser ID (int) ou nome da atividade (string para onboarding)
$is_id = is_numeric($routine_id_or_name);
$routine_id = $is_id ? filter_var($routine_id_or_name, FILTER_VALIDATE_INT) : null;
$activity_name = $is_id ? null : trim($routine_id_or_name);

if (empty($routine_id_or_name)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID ou nome da rotina inválido.']);
    exit();
}

if (!$duration_minutes || $duration_minutes < 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Duração inválida. Deve ser pelo menos 1 minuto.']);
    exit();
}

$conn->begin_transaction();

try {
    // Se for nome de atividade (onboarding), usar tabela de onboarding
    if ($activity_name) {
        // 1. Verificar se esta atividade de onboarding já foi concluída hoje
        $stmt_check = $conn->prepare("SELECT id FROM sf_user_onboarding_completion WHERE user_id = ? AND activity_name = ? AND completion_date = ?");
        if (!$stmt_check) {
            throw new Exception("Erro ao preparar verificação: " . $conn->error);
        }
        $stmt_check->bind_param("iss", $user_id, $activity_name, $current_date);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows > 0) {
            $stmt_check->close();
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Esta atividade já foi concluída hoje.']);
            exit();
        }
        $stmt_check->close();

        // 2. Inserir na tabela de conclusão de onboarding
        $stmt_insert = $conn->prepare("INSERT INTO sf_user_onboarding_completion (user_id, activity_name, completion_date) VALUES (?, ?, ?)");
        if (!$stmt_insert) {
            throw new Exception("Erro ao preparar inserção: " . $conn->error);
        }
        $stmt_insert->bind_param("iss", $user_id, $activity_name, $current_date);
        if (!$stmt_insert->execute()) {
            throw new Exception("Erro ao executar inserção: " . $stmt_insert->error);
        }
        
        if ($stmt_insert->affected_rows === 0) {
            throw new Exception("Falha ao registrar a conclusão da atividade.");
        }
        $stmt_insert->close();
        
        // 3. Salvar duração na tabela de durações (sem coluna date, igual ao original)
        if ($duration_minutes) {
            $stmt_duration = $conn->prepare("INSERT INTO sf_user_exercise_durations (user_id, exercise_name, duration_minutes) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE duration_minutes = VALUES(duration_minutes)");
            if ($stmt_duration) {
                $stmt_duration->bind_param("isi", $user_id, $activity_name, $duration_minutes);
                $stmt_duration->execute();
                $stmt_duration->close();
            }
        }
        
        // 4. Verificar se já existe log de pontos para esta ação hoje
        $stmt_check_log = $conn->prepare("SELECT id FROM sf_user_points_log WHERE user_id = ? AND action_key = ? AND action_context_id = ? AND date_awarded = ?");
        if (!$stmt_check_log) {
            throw new Exception("Erro ao preparar verificação de log: " . $conn->error);
        }
        $stmt_check_log->bind_param("isss", $user_id, $action_key, $activity_name, $current_date);
        $stmt_check_log->execute();
        $log_exists = $stmt_check_log->get_result()->num_rows > 0;
        $stmt_check_log->close();
        
        $context_id = $activity_name;
    } else {
        // Se for ID de rotina normal
        // 1. Verificar se a missão já foi concluída hoje
        $stmt_check = $conn->prepare("SELECT id FROM sf_user_routine_log WHERE user_id = ? AND routine_item_id = ? AND date = ?");
        if (!$stmt_check) {
            throw new Exception("Erro ao preparar verificação: " . $conn->error);
        }
        $stmt_check->bind_param("iis", $user_id, $routine_id, $current_date);
        $stmt_check->execute();
        $result_check = $stmt_check->get_result();
        
        if ($result_check->num_rows > 0) {
            $stmt_check->close();
            $conn->rollback();
            echo json_encode(['success' => false, 'message' => 'Esta missão já foi concluída hoje.']);
            exit();
        }
        $stmt_check->close();

        // 2. Inserir o registro de conclusão com duração
        $stmt_insert = $conn->prepare("INSERT INTO sf_user_routine_log (user_id, routine_item_id, date, is_completed, exercise_duration_minutes) VALUES (?, ?, ?, 1, ?)");
        if (!$stmt_insert) {
            throw new Exception("Erro ao preparar inserção: " . $conn->error);
        }
        $stmt_insert->bind_param("iisi", $user_id, $routine_id, $current_date, $duration_minutes);
        if (!$stmt_insert->execute()) {
            throw new Exception("Erro ao executar inserção: " . $stmt_insert->error);
        }
        
        if ($stmt_insert->affected_rows === 0) {
            throw new Exception("Falha ao registrar a conclusão da missão.");
        }
        $stmt_insert->close();
        
        // 3. Registrar duração do exercício na tabela específica
        $stmt_routine = $conn->prepare("SELECT title FROM sf_user_routine_items WHERE id = ?");
        if ($stmt_routine) {
            $stmt_routine->bind_param("i", $routine_id);
            $stmt_routine->execute();
            $routine_result = $stmt_routine->get_result()->fetch_assoc();
            $exercise_name = $routine_result['title'] ?? '';
            $stmt_routine->close();
            
            if ($exercise_name && $duration_minutes) {
                $stmt_exercise = $conn->prepare("
                    INSERT INTO sf_user_exercise_durations (user_id, exercise_name, duration_minutes) 
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE duration_minutes = VALUES(duration_minutes)
                ");
                if ($stmt_exercise) {
                    $stmt_exercise->bind_param("isi", $user_id, $exercise_name, $duration_minutes);
                    $stmt_exercise->execute();
                    $stmt_exercise->close();
                }
            }
        }
        
        // 4. Verificar se já existe log de pontos para esta ação hoje
        $stmt_check_log = $conn->prepare("SELECT id FROM sf_user_points_log WHERE user_id = ? AND action_key = ? AND action_context_id = ? AND date_awarded = ?");
        if (!$stmt_check_log) {
            throw new Exception("Erro ao preparar verificação de log: " . $conn->error);
        }
        $routine_id_str = (string)$routine_id;
        $stmt_check_log->bind_param("isss", $user_id, $action_key, $routine_id_str, $current_date);
        $stmt_check_log->execute();
        $log_exists = $stmt_check_log->get_result()->num_rows > 0;
        $stmt_check_log->close();
        
        $context_id = $routine_id_str;
    }
    
    // 5. Só adiciona pontos se não existir log para esta ação hoje
    $points_awarded = 0;
    if (!$log_exists) {
        // Registrar a ação no log de pontos
        $stmt_log = $conn->prepare("INSERT INTO sf_user_points_log (user_id, points_awarded, action_key, action_context_id, date_awarded, timestamp) VALUES (?, ?, ?, ?, ?, NOW())");
        if (!$stmt_log) {
            throw new Exception("Erro ao preparar log de pontos: " . $conn->error);
        }
        $stmt_log->bind_param("iisss", $user_id, $points_to_award, $action_key, $context_id, $current_date);
        if (!$stmt_log->execute()) {
            throw new Exception("Erro ao executar log de pontos: " . $stmt_log->error);
        }
        $stmt_log->close();
        
        // Adicionar pontos ao usuário usando a função auxiliar
        if (function_exists('addPointsToUser')) {
            $description = $activity_name 
                ? "Completou atividade: {$activity_name} ({$duration_minutes} min)"
                : "Completou exercício ID: {$routine_id} ({$duration_minutes} min)";
            addPointsToUser($conn, $user_id, $points_to_award, $description);
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
    
    // 6. Sincronizar pontos de desafio (se a função existir)
    if (function_exists('updateChallengePoints')) {
        updateChallengePoints($conn, $user_id, 'routine_complete');
    }

    // 7. Buscar o novo total de pontos
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
        'message' => 'Exercício registrado com sucesso!',
        'duration_minutes' => (int)$duration_minutes,
        'points_awarded' => (int)$points_awarded,
        'new_total_points' => $new_total_points
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("Erro ao completar exercício com duração para user {$user_id}: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Erro ao processar solicitação.',
        'error' => $e->getMessage()
    ]);
} catch (Error $e) {
    $conn->rollback();
    error_log("Erro fatal ao completar exercício com duração para user {$user_id}: " . $e->getMessage());
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

