<?php
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, X-API-Key");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once '../includes/config.php';
require_once '../includes/db.php';

// Aceita a API key de várias formas (header em diferentes cases, query param, ou POST)
$api_key = '';
// No PHP, headers HTTP são convertidos para $_SERVER como HTTP_HEADER_NAME
// Exemplo: X-API-Key → HTTP_X_API_KEY, x-api-key → HTTP_X_API_KEY
// Tenta a forma padrão primeiro
if (isset($_SERVER['HTTP_X_API_KEY'])) {
    $api_key = $_SERVER['HTTP_X_API_KEY'];
} else {
    // Busca case-insensitive em todos os headers HTTP
    foreach ($_SERVER as $key => $value) {
        if (stripos($key, 'HTTP_') === 0) {
            // Normaliza: remove HTTP_, converte para maiúsculo, remove hífens/underscores
            $normalized = strtoupper(str_replace(['_', '-'], '', substr($key, 5)));
            if ($normalized === 'XAPIKEY') {
                $api_key = $value;
                break;
            }
        }
    }
}
// Se não encontrou no header, tenta query param ou POST
if (empty($api_key)) {
    $api_key = $_GET['api_key'] ?? $_POST['api_key'] ?? '';
}

if (defined('WHATSAPP_BOT_API_KEY') && !empty(WHATSAPP_BOT_API_KEY)) {
    $valid_api_key = WHATSAPP_BOT_API_KEY;
} else {
    $valid_api_key = getenv('WHATSAPP_BOT_API_KEY') ?: 'SHAPEFIT_API_KEY_2024_' . md5('shapefit_whatsapp_bot_secure_' . DB_NAME);
}

if (empty($api_key) || $api_key !== $valid_api_key) {
    http_response_code(401);
    $debug_info = [];
    // Debug: verifica se o header foi recebido (sem expor o valor)
    foreach ($_SERVER as $key => $value) {
        if (stripos($key, 'HTTP_X_API_KEY') !== false || stripos($key, 'X_API_KEY') !== false) {
            $debug_info['header_found'] = true;
            $debug_info['header_name'] = $key;
            $debug_info['header_length'] = strlen($value);
            break;
        }
    }
    if (empty($debug_info)) {
        $debug_info['header_found'] = false;
        $debug_info['available_headers'] = array_filter(array_keys($_SERVER), function($k) {
            return strpos($k, 'HTTP_') === 0;
        });
    }
    
    echo json_encode([
        'success' => false,
        'message' => 'API Key inválida ou não fornecida.',
        'error' => 'UNAUTHORIZED',
        'debug' => $debug_info,
        'hint' => 'Verifique se o header está sendo enviado como "X-API-Key" (pode ser minúsculo ou maiúsculo) ou use o parâmetro "api_key" na URL'
    ], JSON_PRETTY_PRINT);
    exit();
}

function normalizeBrazilianPhone($phone_input) {
    if (empty($phone_input)) {
        return ['ddd' => '', 'number' => ''];
    }
    
    $phone_clean = preg_replace('/\D/', '', $phone_input);
    
    if (empty($phone_clean)) {
        return ['ddd' => '', 'number' => ''];
    }
    
    $length = strlen($phone_clean);
    
    if ($length < 10 || $length > 13) {
        return ['ddd' => '', 'number' => ''];
    }
    
    if ($length >= 12) {
        if (substr($phone_clean, 0, 2) === '55') {
            $phone_clean = substr($phone_clean, 2);
            $length = strlen($phone_clean);
        } elseif (substr($phone_clean, 0, 3) === '055') {
            $phone_clean = substr($phone_clean, 3);
            $length = strlen($phone_clean);
        }
    }
    
    if ($length === 10 || $length === 11) {
        $ddd = substr($phone_clean, 0, 2);
        $number = substr($phone_clean, 2);
        
        if (strlen($ddd) === 2 && strlen($number) >= 8 && strlen($number) <= 9) {
            return ['ddd' => $ddd, 'number' => $number];
        }
    }
    
    return ['ddd' => '', 'number' => ''];
}

$phone_ddd = trim($_GET['ddd'] ?? $_POST['ddd'] ?? '');
$phone_number = trim($_GET['phone'] ?? $_POST['phone'] ?? $_GET['phone_number'] ?? $_POST['phone_number'] ?? '');
$phone_full = trim($_GET['phone_full'] ?? $_POST['phone_full'] ?? $_GET['phone'] ?? $_POST['phone'] ?? '');

if (!empty($phone_full)) {
    $normalized = normalizeBrazilianPhone($phone_full);
    if (!empty($normalized['ddd']) && !empty($normalized['number'])) {
        $phone_ddd = $normalized['ddd'];
        $phone_number = $normalized['number'];
    }
} elseif (!empty($phone_ddd) && !empty($phone_number)) {
    $phone_number_clean = preg_replace('/\D/', '', $phone_number);
    if (strlen($phone_number_clean) > 9) {
        $normalized = normalizeBrazilianPhone($phone_ddd . $phone_number_clean);
        if (!empty($normalized['ddd']) && !empty($normalized['number'])) {
            $phone_ddd = $normalized['ddd'];
            $phone_number = $normalized['number'];
        }
    }
} elseif (!empty($phone_number)) {
    $normalized = normalizeBrazilianPhone($phone_number);
    if (!empty($normalized['ddd']) && !empty($normalized['number'])) {
        $phone_ddd = $normalized['ddd'];
        $phone_number = $normalized['number'];
    }
}

if (empty($phone_ddd) || empty($phone_number)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'DDD e número de telefone são obrigatórios.',
        'error' => 'MISSING_PARAMS',
        'example' => [
            'method1' => 'GET /api/get_client_by_phone.php?ddd=34&phone=992410029&api_key=YOUR_KEY',
            'method2' => 'GET /api/get_client_by_phone.php?phone_full=34992410029&api_key=YOUR_KEY',
            'method3' => 'POST com JSON: {"ddd": "34", "phone": "992410029", "api_key": "YOUR_KEY"}'
        ]
    ]);
    exit();
}

if (!preg_match('/^\d{2}$/', $phone_ddd) || !preg_match('/^\d{8,9}$/', $phone_number)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Formato de telefone inválido. DDD deve ter 2 dígitos e número 8-9 dígitos.',
        'error' => 'INVALID_FORMAT'
    ]);
    exit();
}

$date_from = trim($_GET['date_from'] ?? $_POST['date_from'] ?? '');
$date_to = trim($_GET['date_to'] ?? $_POST['date_to'] ?? '');
$days_back = isset($_GET['days']) ? (int)$_GET['days'] : (isset($_POST['days']) ? (int)$_POST['days'] : null);
$specific_date = trim($_GET['date'] ?? $_POST['date'] ?? '');

$today_date = date('Y-m-d');
$yesterday_date = date('Y-m-d', strtotime('-1 day'));

if (!empty($specific_date)) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $specific_date)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Formato de data inválido. Use YYYY-MM-DD (ex: 2025-11-18).',
            'error' => 'INVALID_DATE_FORMAT'
        ]);
        exit();
    }
    $date_from = $specific_date;
    $date_to = $specific_date;
} elseif ($days_back !== null && $days_back > 0) {
    $date_to = $today_date;
    $date_from = date('Y-m-d', strtotime("-{$days_back} days"));
} elseif (!empty($date_from) || !empty($date_to)) {
    if (empty($date_from)) {
        $date_from = date('Y-m-d', strtotime('-30 days'));
    }
    if (empty($date_to)) {
        $date_to = $today_date;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_to)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Formato de data inválido. Use YYYY-MM-DD (ex: 2025-11-18).',
            'error' => 'INVALID_DATE_FORMAT'
        ]);
        exit();
    }
    if (strtotime($date_from) > strtotime($date_to)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Data inicial não pode ser maior que data final.',
            'error' => 'INVALID_DATE_RANGE'
        ]);
        exit();
    }
} else {
    $date_from = $today_date;
    $date_to = $today_date;
}

try {
    $stmt = $conn->prepare("
        SELECT 
            u.id,
            u.name,
            u.email,
            u.phone_ddd,
            u.phone_number,
            u.uf,
            u.city,
            u.created_at,
            u.onboarding_complete,
            u.points,
            u.status,
            p.dob,
            p.gender,
            p.height_cm,
            p.weight_kg,
            p.objective,
            p.exercise_type,
            p.exercise_frequency,
            p.water_intake_liters,
            p.sleep_time_bed,
            p.sleep_time_wake,
            p.meat_consumption,
            p.vegetarian_type,
            p.lactose_intolerance,
            p.gluten_intolerance,
            g.target_kcal,
            g.target_protein_g,
            g.target_carbs_g,
            g.target_fat_g,
            g.target_water_cups,
            g.target_steps_daily,
            g.target_sleep_hours
        FROM sf_users u
        LEFT JOIN sf_user_profiles p ON u.id = p.user_id
        LEFT JOIN sf_user_goals g ON u.id = g.user_id AND g.goal_type = 'nutrition'
        WHERE u.phone_ddd = ? AND u.phone_number = ? AND u.onboarding_complete = 1
        LIMIT 1
    ");
    
    $stmt->bind_param("ss", $phone_ddd, $phone_number);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Cliente não encontrado ou cadastro incompleto.',
            'error' => 'NOT_FOUND',
            'phone_ddd' => $phone_ddd,
            'phone_number' => $phone_number
        ]);
        $stmt->close();
        exit();
    }
    
    $client_data = $result->fetch_assoc();
    $stmt->close();
    
    $stmt_weight = $conn->prepare("
        SELECT weight_kg, date_recorded 
        FROM sf_user_weight_history 
        WHERE user_id = ? 
        ORDER BY date_recorded DESC 
        LIMIT 1
    ");
    $stmt_weight->bind_param("i", $client_data['id']);
    $stmt_weight->execute();
    $result_weight = $stmt_weight->get_result();
    if ($weight_data = $result_weight->fetch_assoc()) {
        $client_data['current_weight_kg'] = $weight_data['weight_kg'];
        $client_data['weight_last_updated'] = $weight_data['date_recorded'];
    }
    $stmt_weight->close();
    
    if (!empty($client_data['dob'])) {
        $dob = new DateTime($client_data['dob']);
        $today = new DateTime();
        $age = $today->diff($dob)->y;
        $client_data['age'] = $age;
    }
    
    $stmt_period_meals = $conn->prepare("
        SELECT 
            DATE(log.date_consumed) as date,
            COALESCE(log.custom_meal_name, recipe.name, 'Alimento Registrado') as meal_name,
            log.meal_type,
            TIME(log.logged_at) as meal_time,
            SUM(log.kcal_consumed) as total_kcal,
            SUM(log.protein_consumed_g) as total_protein,
            SUM(log.carbs_consumed_g) as total_carbs,
            SUM(log.fat_consumed_g) as total_fat
        FROM sf_user_meal_log log
        LEFT JOIN sf_recipes recipe ON log.recipe_id = recipe.id
        WHERE log.user_id = ? AND DATE(log.date_consumed) BETWEEN ? AND ?
        GROUP BY DATE(log.date_consumed), COALESCE(log.custom_meal_name, recipe.name, 'Alimento Registrado'), log.meal_type, TIME(log.logged_at)
        ORDER BY date DESC, meal_time ASC
    ");
    $stmt_period_meals->bind_param("iss", $client_data['id'], $date_from, $date_to);
    $stmt_period_meals->execute();
    $period_meals_result = $stmt_period_meals->get_result();
    $period_meals_by_date = [];
    while ($meal = $period_meals_result->fetch_assoc()) {
        $date = $meal['date'];
        if (!isset($period_meals_by_date[$date])) {
            $period_meals_by_date[$date] = [];
        }
        $period_meals_by_date[$date][] = [
            'meal_name' => $meal['meal_name'],
            'meal_type' => $meal['meal_type'],
            'meal_time' => $meal['meal_time'],
            'kcal' => (float)$meal['total_kcal'],
            'protein_g' => (float)$meal['total_protein'],
            'carbs_g' => (float)$meal['total_carbs'],
            'fat_g' => (float)$meal['total_fat']
        ];
    }
    $stmt_period_meals->close();
    
    $stmt_period_daily = $conn->prepare("
        SELECT 
            DATE(date_consumed) as date,
            SUM(kcal_consumed) as total_kcal,
            SUM(protein_consumed_g) as total_protein,
            SUM(carbs_consumed_g) as total_carbs,
            SUM(fat_consumed_g) as total_fat
        FROM sf_user_meal_log 
        WHERE user_id = ? AND DATE(date_consumed) BETWEEN ? AND ?
        GROUP BY DATE(date_consumed)
        ORDER BY date DESC
    ");
    $stmt_period_daily->bind_param("iss", $client_data['id'], $date_from, $date_to);
    $stmt_period_daily->execute();
    $period_daily_result = $stmt_period_daily->get_result();
    $daily_totals = [];
    while ($day = $period_daily_result->fetch_assoc()) {
        $daily_totals[$day['date']] = [
            'kcal' => (float)$day['total_kcal'],
            'protein_g' => (float)$day['total_protein'],
            'carbs_g' => (float)$day['total_carbs'],
            'fat_g' => (float)$day['total_fat']
        ];
    }
    $stmt_period_daily->close();
    
    $stmt_period_totals = $conn->prepare("
        SELECT 
            SUM(kcal_consumed) as total_kcal,
            SUM(protein_consumed_g) as total_protein,
            SUM(carbs_consumed_g) as total_carbs,
            SUM(fat_consumed_g) as total_fat,
            COUNT(DISTINCT DATE(date_consumed)) as days_with_data
        FROM sf_user_meal_log 
        WHERE user_id = ? AND DATE(date_consumed) BETWEEN ? AND ?
    ");
    $stmt_period_totals->bind_param("iss", $client_data['id'], $date_from, $date_to);
    $stmt_period_totals->execute();
    $period_totals_result = $stmt_period_totals->get_result();
    $period_totals = $period_totals_result->fetch_assoc();
    $stmt_period_totals->close();
    
    $stmt_period_tracking = $conn->prepare("
        SELECT 
            date,
            water_consumed_cups,
            steps_daily,
            sleep_hours
        FROM sf_user_daily_tracking 
        WHERE user_id = ? AND date BETWEEN ? AND ?
        ORDER BY date DESC
    ");
    $stmt_period_tracking->bind_param("iss", $client_data['id'], $date_from, $date_to);
    $stmt_period_tracking->execute();
    $period_tracking_result = $stmt_period_tracking->get_result();
    $period_tracking = [];
    while ($track = $period_tracking_result->fetch_assoc()) {
        $period_tracking[$track['date']] = [
            'water_consumed_cups' => $track['water_consumed_cups'] ? (int)$track['water_consumed_cups'] : 0,
            'steps_daily' => $track['steps_daily'] ? (int)$track['steps_daily'] : 0,
            'sleep_hours' => $track['sleep_hours'] ? (float)$track['sleep_hours'] : null
        ];
    }
    $stmt_period_tracking->close();
    
    $today_date = date('Y-m-d');
    $stmt_today_totals = $conn->prepare("
        SELECT 
            SUM(kcal_consumed) as total_kcal,
            SUM(protein_consumed_g) as total_protein,
            SUM(carbs_consumed_g) as total_carbs,
            SUM(fat_consumed_g) as total_fat
        FROM sf_user_meal_log 
        WHERE user_id = ? AND DATE(date_consumed) = ?
    ");
    $stmt_today_totals->bind_param("is", $client_data['id'], $today_date);
    $stmt_today_totals->execute();
    $today_totals_result = $stmt_today_totals->get_result();
    $today_totals = $today_totals_result->fetch_assoc();
    $stmt_today_totals->close();
    
    $stmt_today_tracking = $conn->prepare("
        SELECT 
            water_consumed_cups,
            steps_daily,
            sleep_hours
        FROM sf_user_daily_tracking 
        WHERE user_id = ? AND date = ?
        LIMIT 1
    ");
    $stmt_today_tracking->bind_param("is", $client_data['id'], $today_date);
    $stmt_today_tracking->execute();
    $today_tracking_result = $stmt_today_tracking->get_result();
    $today_tracking = $today_tracking_result->fetch_assoc();
    $stmt_today_tracking->close();
    
    $yesterday_date = date('Y-m-d', strtotime('-1 day'));
    $stmt_yesterday_totals = $conn->prepare("
        SELECT 
            SUM(kcal_consumed) as total_kcal,
            SUM(protein_consumed_g) as total_protein,
            SUM(carbs_consumed_g) as total_carbs,
            SUM(fat_consumed_g) as total_fat
        FROM sf_user_meal_log 
        WHERE user_id = ? AND DATE(date_consumed) = ?
    ");
    $stmt_yesterday_totals->bind_param("is", $client_data['id'], $yesterday_date);
    $stmt_yesterday_totals->execute();
    $yesterday_totals_result = $stmt_yesterday_totals->get_result();
    $yesterday_totals = $yesterday_totals_result->fetch_assoc();
    $stmt_yesterday_totals->close();
    
    $days_in_period = max(1, (strtotime($date_to) - strtotime($date_from)) / 86400 + 1);
    $days_with_data = (int)($period_totals['days_with_data'] ?? 0);
    $avg_kcal = $days_with_data > 0 ? ($period_totals['total_kcal'] ?? 0) / $days_with_data : 0;
    $avg_protein = $days_with_data > 0 ? ($period_totals['total_protein'] ?? 0) / $days_with_data : 0;
    $avg_carbs = $days_with_data > 0 ? ($period_totals['total_carbs'] ?? 0) / $days_with_data : 0;
    $avg_fat = $days_with_data > 0 ? ($period_totals['total_fat'] ?? 0) / $days_with_data : 0;
    
    $formatted_response = [
        'success' => true,
        'found' => true,
        'client' => [
            'id' => (int)$client_data['id'],
            'name' => $client_data['name'],
            'email' => $client_data['email'],
            'phone' => [
                'ddd' => $client_data['phone_ddd'],
                'number' => $client_data['phone_number'],
                'full' => $client_data['phone_ddd'] . $client_data['phone_number']
            ],
            'location' => [
                'uf' => $client_data['uf'],
                'city' => $client_data['city']
            ],
            'personal' => [
                'dob' => $client_data['dob'],
                'age' => $client_data['age'] ?? null,
                'gender' => $client_data['gender']
            ],
            'physical' => [
                'height_cm' => $client_data['height_cm'] ? (int)$client_data['height_cm'] : null,
                'weight_kg' => $client_data['weight_kg'] ? (float)$client_data['weight_kg'] : null,
                'current_weight_kg' => isset($client_data['current_weight_kg']) ? (float)$client_data['current_weight_kg'] : null,
                'weight_last_updated' => $client_data['weight_last_updated'] ?? null
            ],
            'goals' => [
                'objective' => $client_data['objective'],
                'target_calories' => $client_data['target_kcal'] ? (int)$client_data['target_kcal'] : null,
                'target_protein_g' => $client_data['target_protein_g'] ? (float)$client_data['target_protein_g'] : null,
                'target_carbs_g' => $client_data['target_carbs_g'] ? (float)$client_data['target_carbs_g'] : null,
                'target_fat_g' => $client_data['target_fat_g'] ? (float)$client_data['target_fat_g'] : null,
                'target_water_cups' => $client_data['target_water_cups'] ? (int)$client_data['target_water_cups'] : null,
                'target_steps_daily' => $client_data['target_steps_daily'] ? (int)$client_data['target_steps_daily'] : null,
                'target_sleep_hours' => $client_data['target_sleep_hours'] ? (float)$client_data['target_sleep_hours'] : null
            ],
            'lifestyle' => [
                'exercise_type' => $client_data['exercise_type'],
                'exercise_frequency' => $client_data['exercise_frequency'],
                'water_intake_liters' => $client_data['water_intake_liters'],
                'sleep_time_bed' => $client_data['sleep_time_bed'],
                'sleep_time_wake' => $client_data['sleep_time_wake']
            ],
            'dietary' => [
                'meat_consumption' => (bool)$client_data['meat_consumption'],
                'vegetarian_type' => $client_data['vegetarian_type'],
                'lactose_intolerance' => (bool)$client_data['lactose_intolerance'],
                'gluten_intolerance' => (bool)$client_data['gluten_intolerance']
            ],
            'account' => [
                'created_at' => $client_data['created_at'],
                'onboarding_complete' => (bool)$client_data['onboarding_complete'],
                'points' => (float)$client_data['points'],
                'status' => $client_data['status']
            ],
            'current_status' => [
                'period_requested' => [
                    'date_from' => $date_from,
                    'date_to' => $date_to,
                    'days_in_period' => (int)$days_in_period,
                    'days_with_data' => $days_with_data
                ],
                'period_data' => [
                    'meals_by_date' => $period_meals_by_date,
                    'daily_totals' => $daily_totals,
                    'tracking_by_date' => $period_tracking,
                    'period_summary' => [
                        'total_kcal' => (float)($period_totals['total_kcal'] ?? 0),
                        'total_protein_g' => (float)($period_totals['total_protein'] ?? 0),
                        'total_carbs_g' => (float)($period_totals['total_carbs'] ?? 0),
                        'total_fat_g' => (float)($period_totals['total_fat'] ?? 0),
                        'avg_kcal_per_day' => round($avg_kcal, 1),
                        'avg_protein_g_per_day' => round($avg_protein, 1),
                        'avg_carbs_g_per_day' => round($avg_carbs, 1),
                        'avg_fat_g_per_day' => round($avg_fat, 1)
                    ]
                ],
                'today' => [
                    'date' => $today_date,
                    'meals' => $period_meals_by_date[$today_date] ?? [],
                    'nutrition' => [
                        'kcal_consumed' => $today_totals['total_kcal'] ? (float)$today_totals['total_kcal'] : 0,
                        'protein_consumed_g' => $today_totals['total_protein'] ? (float)$today_totals['total_protein'] : 0,
                        'carbs_consumed_g' => $today_totals['total_carbs'] ? (float)$today_totals['total_carbs'] : 0,
                        'fat_consumed_g' => $today_totals['total_fat'] ? (float)$today_totals['total_fat'] : 0,
                        'kcal_remaining' => $client_data['target_kcal'] ? max(0, (float)$client_data['target_kcal'] - (float)($today_totals['total_kcal'] ?? 0)) : null,
                        'protein_remaining_g' => $client_data['target_protein_g'] ? max(0, (float)$client_data['target_protein_g'] - (float)($today_totals['total_protein'] ?? 0)) : null,
                        'carbs_remaining_g' => $client_data['target_carbs_g'] ? max(0, (float)$client_data['target_carbs_g'] - (float)($today_totals['total_carbs'] ?? 0)) : null,
                        'fat_remaining_g' => $client_data['target_fat_g'] ? max(0, (float)$client_data['target_fat_g'] - (float)($today_totals['total_fat'] ?? 0)) : null,
                        'kcal_percentage' => $client_data['target_kcal'] ? min(100, round(((float)($today_totals['total_kcal'] ?? 0) / (float)$client_data['target_kcal']) * 100, 1)) : null
                    ],
                    'hydration' => [
                        'cups_consumed' => $today_tracking['water_consumed_cups'] ? (int)$today_tracking['water_consumed_cups'] : 0,
                        'target_cups' => $client_data['target_water_cups'] ? (int)$client_data['target_water_cups'] : null,
                        'remaining_cups' => $client_data['target_water_cups'] ? max(0, (int)$client_data['target_water_cups'] - (int)($today_tracking['water_consumed_cups'] ?? 0)) : null,
                        'percentage' => $client_data['target_water_cups'] ? min(100, round(((int)($today_tracking['water_consumed_cups'] ?? 0) / (int)$client_data['target_water_cups']) * 100, 1)) : null
                    ],
                    'activity' => [
                        'steps_today' => $today_tracking['steps_daily'] ? (int)$today_tracking['steps_daily'] : 0,
                        'target_steps' => $client_data['target_steps_daily'] ? (int)$client_data['target_steps_daily'] : null,
                        'steps_remaining' => $client_data['target_steps_daily'] ? max(0, (int)$client_data['target_steps_daily'] - (int)($today_tracking['steps_daily'] ?? 0)) : null,
                        'steps_percentage' => $client_data['target_steps_daily'] ? min(100, round(((int)($today_tracking['steps_daily'] ?? 0) / (int)$client_data['target_steps_daily']) * 100, 1)) : null
                    ],
                    'sleep' => [
                        'hours_last_night' => $today_tracking['sleep_hours'] ? (float)$today_tracking['sleep_hours'] : null,
                        'target_hours' => $client_data['target_sleep_hours'] ? (float)$client_data['target_sleep_hours'] : null
                    ]
                ],
                'yesterday' => [
                    'date' => $yesterday_date,
                    'nutrition' => [
                        'kcal_consumed' => $yesterday_totals['total_kcal'] ? (float)$yesterday_totals['total_kcal'] : 0,
                        'protein_consumed_g' => $yesterday_totals['total_protein'] ? (float)$yesterday_totals['total_protein'] : 0,
                        'carbs_consumed_g' => $yesterday_totals['total_carbs'] ? (float)$yesterday_totals['total_carbs'] : 0,
                        'fat_consumed_g' => $yesterday_totals['total_fat'] ? (float)$yesterday_totals['total_fat'] : 0
                    ]
                ],
                'weekly_average' => [
                    'period' => 'last_7_days',
                    'avg_kcal' => $days_with_data > 0 ? round($avg_kcal, 1) : 0,
                    'avg_protein_g' => $days_with_data > 0 ? round($avg_protein, 1) : 0,
                    'avg_carbs_g' => $days_with_data > 0 ? round($avg_carbs, 1) : 0,
                    'avg_fat_g' => $days_with_data > 0 ? round($avg_fat, 1) : 0
                ]
            ]
        ],
        'timestamp' => date('Y-m-d H:i:s'),
        'query' => [
            'phone_ddd' => $phone_ddd,
            'phone_number' => $phone_number,
            'date_from' => $date_from,
            'date_to' => $date_to,
            'days_requested' => $days_back
        ]
    ];
    
    http_response_code(200);
    echo json_encode($formatted_response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    error_log("Erro ao buscar cliente por telefone: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno do servidor.',
        'error' => 'INTERNAL_ERROR'
    ]);
}

$conn->close();
?>
