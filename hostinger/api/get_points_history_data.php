<?php
// api/get_points_history_data.php - Dados para histórico de pontos

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

// Lógica de filtro de data
$filter_month_str = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $filter_month_str) || !DateTime::createFromFormat('Y-m', $filter_month_str)) {
    $filter_month_str = date('Y-m');
}
$start_date = $filter_month_str . '-01';
$end_date = date('Y-m-t', strtotime($start_date));

try {
    // Buscar dados do usuário
    $stmt_user = $conn->prepare("SELECT u.name, u.points, r.rank FROM sf_users u LEFT JOIN (SELECT id, RANK() OVER (ORDER BY points DESC, name ASC) as rank FROM sf_users) r ON u.id = r.id WHERE u.id = ?");
    $stmt_user->bind_param("i", $user_id);
    $stmt_user->execute();
    $user_data = $stmt_user->get_result()->fetch_assoc();
    $stmt_user->close();
    
    $user_points = $user_data['points'] ?? 0;
    $user_rank = $user_data['rank'] ?? 0;
    
    // Lógica de níveis
    function toRoman($number) {
        $map = [10 => 'X', 9 => 'IX', 5 => 'V', 4 => 'IV', 1 => 'I'];
        $roman = '';
        while ($number > 0) { 
            foreach ($map as $val => $char) { 
                if ($number >= $val) { 
                    $roman .= $char; 
                    $number -= $val; 
                    break; 
                } 
            } 
        }
        return $roman;
    }
    
    $level_categories = [
        ['name' => 'Franguinho', 'threshold' => 0], 
        ['name' => 'Frango', 'threshold' => 1500], 
        ['name' => 'Frango de Elite', 'threshold' => 4000],
        ['name' => 'Atleta de Bronze', 'threshold' => 8000], 
        ['name' => 'Atleta de Prata', 'threshold' => 14000], 
        ['name' => 'Atleta de Ouro', 'threshold' => 22000], 
        ['name' => 'Atleta de Platina', 'threshold' => 32000], 
        ['name' => 'Atleta de Diamante', 'threshold' => 45000],
        ['name' => 'Elite', 'threshold' => 60000], 
        ['name' => 'Mestre', 'threshold' => 80000], 
        ['name' => 'Virtuoso', 'threshold' => 105000],
        ['name' => 'Campeão', 'threshold' => 135000], 
        ['name' => 'Titã', 'threshold' => 170000], 
        ['name' => 'Pioneiro', 'threshold' => 210000], 
        ['name' => 'Lenda', 'threshold' => 255000],
    ];
    
    $final_levels_map = [];
    $level_counter = 1;
    foreach ($level_categories as $index => $category) {
        $next_threshold = isset($level_categories[$index + 1]) 
            ? $level_categories[$index + 1]['threshold'] 
            : ($category['threshold'] + ($category['threshold'] - ($level_categories[$index - 1]['threshold'] ?? 0)));
        $points_in_category = $next_threshold - $category['threshold'];
        $points_per_sublevel = $points_in_category > 0 ? $points_in_category / 10 : 0;
        for ($i = 0; $i < 10; $i++) {
            $final_levels_map[$level_counter] = [
                'name' => $category['name'] . ' ' . toRoman($i + 1),
                'points_required' => $category['threshold'] + ($i * $points_per_sublevel)
            ];
            $level_counter++;
        }
    }
    
    function calculate_user_progress($points, $levels_map) {
        $current_level_num = 1;
        $points_at_current_level_start = 0;
        $points_for_next_level = 0;
        $is_max_level = false;
        foreach ($levels_map as $level_num => $level_data) {
            if ($points >= $level_data['points_required']) {
                $current_level_num = $level_num;
            } else {
                break;
            }
        }
        $points_at_current_level_start = $levels_map[$current_level_num]['points_required'];
        if (!isset($levels_map[$current_level_num + 1])) {
            $is_max_level = true;
            $points_for_next_level = $points_at_current_level_start;
        } else {
            $points_for_next_level = $levels_map[$current_level_num + 1]['points_required'];
        }
        $level_name = $levels_map[$current_level_num]['name'];
        $level_progress_points = $points - $points_at_current_level_start;
        $total_points_for_this_level = $points_for_next_level - $points_at_current_level_start;
        if ($is_max_level || $total_points_for_this_level <= 0) {
            $progress_percentage = 100;
            $points_remaining = 0;
        } else {
            $progress_percentage = round(($level_progress_points / $total_points_for_this_level) * 100);
            $points_remaining = $total_points_for_this_level - $level_progress_points;
        }
        return [
            'name' => $level_name, 
            'progress_percentage' => $progress_percentage, 
            'points_remaining' => $points_remaining, 
            'is_max_level' => $is_max_level
        ];
    }
    
    $level_details = calculate_user_progress($user_points, $final_levels_map);
    
    // Buscar log de pontos
    $stmt_log = $conn->prepare("
        SELECT points_awarded, action_key, action_context_id, timestamp 
        FROM sf_user_points_log 
        WHERE user_id = ? AND date_awarded BETWEEN ? AND ? 
        ORDER BY timestamp DESC
    ");
    $stmt_log->bind_param("iss", $user_id, $start_date, $end_date);
    $stmt_log->execute();
    $log_result = $stmt_log->get_result();
    $points_log = [];
    while ($row = $log_result->fetch_assoc()) {
        $points_log[] = $row;
    }
    $stmt_log->close();
    
    // Função para obter detalhes da ação
    function getActionDetails($conn, $key, $context_id) {
        if ($key === 'ROUTINE_COMPLETE') {
            $text = "Tarefa concluída";
            if (is_numeric($context_id)) {
                $stmt = $conn->prepare("SELECT title FROM sf_routine_items WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("i", $context_id);
                    $stmt->execute();
                    $result = $stmt->get_result()->fetch_assoc();
                    if ($result) {
                        $text = htmlspecialchars($result['title']);
                    }
                    $stmt->close();
                }
            } else {
                $text = "Meta: " . htmlspecialchars($context_id);
            }
            return ['icon' => 'fa-check-circle', 'text' => $text, 'color' => '#4caf50'];
        }
        
        $action_map = [
            'MEAL_LOGGED' => ['icon' => 'fa-utensils', 'text' => 'Refeição registrada', 'color' => '#FF6B00'],
            'WATER_LOGGED' => ['icon' => 'fa-tint', 'text' => 'Água registrada', 'color' => '#2196F3'],
            'WEIGHT_LOGGED' => ['icon' => 'fa-weight', 'text' => 'Peso registrado', 'color' => '#9C27B0'],
            'EXERCISE_COMPLETE' => ['icon' => 'fa-dumbbell', 'text' => 'Exercício concluído', 'color' => '#F44336'],
            'CHECKIN_COMPLETE' => ['icon' => 'fa-comments', 'text' => 'Check-in realizado', 'color' => '#FF9800'],
        ];
        
        return $action_map[$key] ?? ['icon' => 'fa-question-circle', 'text' => 'Ação registrada', 'color' => '#A0A0A0'];
    }
    
    // Processar log agrupado por data com detalhes
    $grouped_log = [];
    foreach ($points_log as $entry) {
        $date = date('Y-m-d', strtotime($entry['timestamp']));
        if (!isset($grouped_log[$date])) {
            $grouped_log[$date] = [
                'date' => $date,
                'total_points' => 0,
                'entries' => []
            ];
        }
        $grouped_log[$date]['total_points'] += $entry['points_awarded'];
        $details = getActionDetails($conn, $entry['action_key'], $entry['action_context_id']);
        $grouped_log[$date]['entries'][] = [
            'points_awarded' => $entry['points_awarded'],
            'action_key' => $entry['action_key'],
            'action_context_id' => $entry['action_context_id'],
            'timestamp' => $entry['timestamp'],
            'details' => $details
        ];
    }
    
    // Converter para array indexado
    $grouped_log = array_values($grouped_log);
    
    // Buscar meses disponíveis
    $available_months = [];
    $stmt_months = $conn->prepare("
        SELECT DISTINCT DATE_FORMAT(date_awarded, '%Y-%m') as month_key 
        FROM sf_user_points_log 
        WHERE user_id = ? 
        ORDER BY month_key DESC
    ");
    $stmt_months->bind_param("i", $user_id);
    $stmt_months->execute();
    $months_result = $stmt_months->get_result();
    while($row = $months_result->fetch_assoc()) {
        $dateObj = DateTime::createFromFormat('!Y-m', $row['month_key']);
        $row['month_display'] = ucfirst(strftime('%B de %Y', $dateObj->getTimestamp()));
        $available_months[] = $row;
    }
    $stmt_months->close();
    
    echo json_encode([
        'success' => true,
        'data' => [
            'user_points' => $user_points,
            'user_rank' => $user_rank,
            'level' => $level_details,
            'points_log' => $grouped_log,
            'available_months' => $available_months,
            'filter_month' => $filter_month_str,
            'base_url' => BASE_APP_URL
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $e->getMessage()]);
}

$conn->close();
?>

