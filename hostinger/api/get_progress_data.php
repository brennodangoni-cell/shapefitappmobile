<?php
// api/get_progress_data.php - Dados para a página de progresso

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
$today = date('Y-m-d');
$week_start = date('Y-m-d', strtotime('monday this week'));
$week_end = date('Y-m-d', strtotime('sunday this week'));
$month_start = date('Y-m-01');
$month_end = date('Y-m-t');

/**
 * Fonte da verdade:
 * - Alimentação: sf_user_meal_log (evita depender de tracking sincronizado)
 * - Treino/Cardio (duração): sf_user_routine_log + itens (evita depender de trigger/atualização no tracking)
 * - Água/Sono/Passos: sf_user_daily_tracking
 */
function fetchNutritionTotalsFromMealLog(mysqli $conn, int $user_id, string $start_date, string $end_date): array {
    $stmt = $conn->prepare("
        SELECT
            COALESCE(SUM(kcal_consumed), 0) AS total_kcal,
            COALESCE(SUM(protein_consumed_g), 0) AS total_protein,
            COALESCE(SUM(carbs_consumed_g), 0) AS total_carbs,
            COALESCE(SUM(fat_consumed_g), 0) AS total_fat
        FROM sf_user_meal_log
        WHERE user_id = ? AND date_consumed BETWEEN ? AND ?
    ");
    if (!$stmt) {
        throw new Exception("Erro ao preparar soma de refeições: " . $conn->error);
    }
    $stmt->bind_param("iss", $user_id, $start_date, $end_date);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc() ?: [];
    $stmt->close();

    return [
        'kcal' => (float)($row['total_kcal'] ?? 0),
        'protein_g' => (float)($row['total_protein'] ?? 0),
        'carbs_g' => (float)($row['total_carbs'] ?? 0),
        'fat_g' => (float)($row['total_fat'] ?? 0),
    ];
}

function normalizeExerciseCategory(?string $rawType, string $title): string {
    $type = strtolower(trim((string)($rawType ?? '')));
    $t = strtolower(trim($title));

    // 1) Se já vier do banco como cardio/workout, respeitar
    if ($type === 'cardio') return 'cardio';
    if ($type === 'workout') return 'workout';

    // 2) Regra de negócio definida:
    //    - Se for Musculação ou Crossfit -> TREINO
    //    - Qualquer outra coisa -> CARDIO
    if (str_contains($t, 'muscula') || str_contains($t, 'musculação') || str_contains($t, 'musculacao')) {
        return 'workout';
    }
    if (str_contains($t, 'crossfit')) {
        return 'workout';
    }

    // 3) Default: tudo que não for musculação/crossfit é cardio
    return 'cardio';
}

function defaultExerciseDurationMinutes(string $category): int {
    return ($category === 'cardio') ? 30 : 45;
}

function fetchExerciseTotalsHoursFromUserSources(mysqli $conn, int $user_id, string $start_date, string $end_date): array {
    $cardioMinutes = 0.0;
    $workoutMinutes = 0.0;

    // 1) Exercícios em missões personalizadas (sf_user_routine_items)
    // A duração normalmente vem de sf_user_exercise_durations (colada no title),
    // e o log só marca como completo.
    $stmt_user_items = $conn->prepare("
        SELECT
            uri.title,
            uri.exercise_type,
            ued.duration_minutes
        FROM sf_user_routine_log l
        INNER JOIN sf_user_routine_items uri
            ON uri.id = l.routine_item_id AND uri.user_id = l.user_id
        LEFT JOIN sf_user_exercise_durations ued
            ON ued.user_id = l.user_id
            AND ued.exercise_name COLLATE utf8mb4_unicode_ci = uri.title COLLATE utf8mb4_unicode_ci
        WHERE
            l.user_id = ?
            AND l.date BETWEEN ? AND ?
            AND l.is_completed = 1
            AND (
                uri.is_exercise = 1
                OR uri.exercise_type IN ('duration', 'cardio', 'workout', 'other')
            )
            AND (uri.exercise_type IS NULL OR uri.exercise_type <> 'sleep')
    ");
    if (!$stmt_user_items) {
        throw new Exception("Erro ao preparar soma de exercícios (missões personalizadas): " . $conn->error);
    }
    $stmt_user_items->bind_param("iss", $user_id, $start_date, $end_date);
    $stmt_user_items->execute();
    $res_user_items = $stmt_user_items->get_result();
    while ($row = $res_user_items->fetch_assoc()) {
        $title = (string)($row['title'] ?? '');
        $rawType = $row['exercise_type'] ?? null;
        $category = normalizeExerciseCategory($rawType, $title);
        $minutes = (int)($row['duration_minutes'] ?? 0);
        if ($minutes <= 0) $minutes = defaultExerciseDurationMinutes($category);

        if ($category === 'cardio') $cardioMinutes += $minutes;
        else $workoutMinutes += $minutes;
    }
    $stmt_user_items->close();

    // 2) Exercícios em missões globais (sf_routine_items) com duração no próprio log
    $stmt_global = $conn->prepare("
        SELECT
            sri.title,
            sri.exercise_type,
            l.exercise_duration_minutes
        FROM sf_user_routine_log l
        INNER JOIN sf_routine_items sri
            ON sri.id = l.routine_item_id
        WHERE
            l.user_id = ?
            AND l.date BETWEEN ? AND ?
            AND l.is_completed = 1
            AND sri.is_exercise = 1
    ");
    if (!$stmt_global) {
        throw new Exception("Erro ao preparar soma de exercícios (missões globais): " . $conn->error);
    }
    $stmt_global->bind_param("iss", $user_id, $start_date, $end_date);
    $stmt_global->execute();
    $res_global = $stmt_global->get_result();
    while ($row = $res_global->fetch_assoc()) {
        $title = (string)($row['title'] ?? '');
        $rawType = $row['exercise_type'] ?? null;
        $category = normalizeExerciseCategory($rawType, $title);
        $minutes = (int)($row['exercise_duration_minutes'] ?? 0);
        if ($minutes <= 0) $minutes = defaultExerciseDurationMinutes($category);

        if ($category === 'cardio') $cardioMinutes += $minutes;
        else $workoutMinutes += $minutes;
    }
    $stmt_global->close();

    // 3) Atividades do onboarding (sf_user_onboarding_completion)
    // Essas não vão para sf_user_routine_log; a duração vem de sf_user_exercise_durations.
    $stmt_onboarding = $conn->prepare("
        SELECT
            oc.activity_name,
            ued.duration_minutes
        FROM sf_user_onboarding_completion oc
        LEFT JOIN sf_user_exercise_durations ued
            ON ued.user_id = oc.user_id
            AND ued.exercise_name COLLATE utf8mb4_unicode_ci = oc.activity_name COLLATE utf8mb4_unicode_ci
        WHERE
            oc.user_id = ?
            AND oc.completion_date BETWEEN ? AND ?
    ");
    if (!$stmt_onboarding) {
        throw new Exception("Erro ao preparar soma de exercícios (onboarding): " . $conn->error);
    }
    $stmt_onboarding->bind_param("iss", $user_id, $start_date, $end_date);
    $stmt_onboarding->execute();
    $res_onboarding = $stmt_onboarding->get_result();
    while ($row = $res_onboarding->fetch_assoc()) {
        $title = (string)($row['activity_name'] ?? '');
        $category = normalizeExerciseCategory(null, $title);
        $minutes = (int)($row['duration_minutes'] ?? 0);
        if ($minutes <= 0) $minutes = defaultExerciseDurationMinutes($category);

        if ($category === 'cardio') $cardioMinutes += $minutes;
        else $workoutMinutes += $minutes;
    }
    $stmt_onboarding->close();

    return [
        'cardio_hours' => $cardioMinutes / 60.0,
        'workout_hours' => $workoutMinutes / 60.0,
        'cardio_minutes' => $cardioMinutes,
        'workout_minutes' => $workoutMinutes,
    ];
}

try {
    // Buscar dados do usuário
    $user_profile_data = getUserProfileData($conn, $user_id);
    
    // Buscar metas
    $stmt_goals = $conn->prepare("SELECT * FROM sf_user_goals WHERE user_id = ? AND goal_type = 'nutrition'");
    $stmt_goals->bind_param("i", $user_id);
    $stmt_goals->execute();
    $user_goals = $stmt_goals->get_result()->fetch_assoc();
    $stmt_goals->close();
    
    // Se não tem metas, criar baseadas no perfil
    if (!$user_goals) {
        $age_years = calculateAge($user_profile_data['dob']);
        $calculated_calories = calculateTargetDailyCalories(
            $user_profile_data['gender'], 
            $user_profile_data['weight_kg'], 
            $user_profile_data['height_cm'], 
            $age_years, 
            $user_profile_data['exercise_frequency'], 
            $user_profile_data['objective']
        );
        $calculated_macros = calculateMacronutrients($calculated_calories, $user_profile_data['objective']);
        $calculated_water = getWaterIntakeSuggestion($user_profile_data['weight_kg']);
        
        // Calcular horas de treino baseado na frequência
        $workout_hours_weekly = 0;
        $cardio_hours_weekly = 0;
        switch ($user_profile_data['exercise_frequency']) {
            case '1_2x_week':
                $workout_hours_weekly = 2.0;
                $cardio_hours_weekly = 1.5;
                break;
            case '3_4x_week':
                $workout_hours_weekly = 4.0;
                $cardio_hours_weekly = 2.5;
                break;
            case '5_6x_week':
                $workout_hours_weekly = 6.0;
                $cardio_hours_weekly = 3.5;
                break;
            case '6_7x_week':
                $workout_hours_weekly = 8.0;
                $cardio_hours_weekly = 4.0;
                break;
            case '7plus_week':
                $workout_hours_weekly = 10.0;
                $cardio_hours_weekly = 5.0;
                break;
        }
        
        $step_length = ($user_profile_data['gender'] == 'male') ? 76.0 : 66.0;
        $target_steps_daily = 10000;
        $target_steps_weekly = 70000;
        $workout_hours_monthly = $workout_hours_weekly * 4;
        $cardio_hours_monthly = $cardio_hours_weekly * 4;
        $sleep_hours = 8.0;
        
        $stmt_insert = $conn->prepare("
            INSERT INTO sf_user_goals (
                user_id, goal_type, target_kcal, target_protein_g, target_carbs_g, target_fat_g,
                target_water_cups, target_steps_daily, target_steps_weekly,
                target_workout_hours_weekly, target_workout_hours_monthly,
                target_cardio_hours_weekly, target_cardio_hours_monthly,
                target_sleep_hours, user_gender, step_length_cm
            ) VALUES (?, 'nutrition', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt_insert->bind_param("idddiiidddddssd", 
            $user_id,
            $calculated_calories, 
            $calculated_macros['protein_g'], 
            $calculated_macros['carbs_g'], 
            $calculated_macros['fat_g'],
            $calculated_water['cups'], 
            $target_steps_daily, 
            $target_steps_weekly,
            $workout_hours_weekly, 
            $workout_hours_monthly,
            $cardio_hours_weekly, 
            $cardio_hours_monthly,
            $sleep_hours, 
            $user_profile_data['gender'], 
            $step_length
        );
        
        $stmt_insert->execute();
        $stmt_insert->close();
        
        // Buscar novamente
        $stmt_goals = $conn->prepare("SELECT * FROM sf_user_goals WHERE user_id = ? AND goal_type = 'nutrition'");
        $stmt_goals->bind_param("i", $user_id);
        $stmt_goals->execute();
        $user_goals = $stmt_goals->get_result()->fetch_assoc();
        $stmt_goals->close();
    }
    
    // Dados de hoje
    $stmt_today = $conn->prepare("SELECT * FROM sf_user_daily_tracking WHERE user_id = ? AND date = ?");
    $stmt_today->bind_param("is", $user_id, $today);
    $stmt_today->execute();
    $today_data = $stmt_today->get_result()->fetch_assoc();
    $stmt_today->close();
    
    if (!$today_data) {
        $today_data = [
            'kcal_consumed' => 0, 'protein_consumed_g' => 0, 'carbs_consumed_g' => 0, 
            'fat_consumed_g' => 0, 'water_consumed_cups' => 0,
            'steps_daily' => 0, 'sleep_hours' => 0, 'workout_hours' => 0, 'cardio_hours' => 0
        ];
    }
    $today_data['water_consumed_ml'] = ($today_data['water_consumed_cups'] ?? 0) * 250;

    // Alimentação de hoje: somar direto do meal_log (mais confiável)
    $today_nutrition = fetchNutritionTotalsFromMealLog($conn, $user_id, $today, $today);
    $today_data['kcal_consumed'] = (int)round($today_nutrition['kcal']);
    $today_data['protein_consumed_g'] = round($today_nutrition['protein_g'], 1);
    $today_data['carbs_consumed_g'] = round($today_nutrition['carbs_g'], 1);
    $today_data['fat_consumed_g'] = round($today_nutrition['fat_g'], 1);

    // Treino/Cardio de hoje: somar direto do routine_log (evita depender de trigger no tracking)
    $today_exercises = fetchExerciseTotalsHoursFromUserSources($conn, $user_id, $today, $today);
    $today_data['workout_hours'] = round((float)$today_exercises['workout_hours'], 2);
    $today_data['cardio_hours'] = round((float)$today_exercises['cardio_hours'], 2);
    
    // Dados da semana
    $stmt_week = $conn->prepare("
        SELECT 
            SUM(kcal_consumed) as total_kcal,
            SUM(protein_consumed_g) as total_protein,
            SUM(carbs_consumed_g) as total_carbs,
            SUM(fat_consumed_g) as total_fat,
            SUM(water_consumed_cups) as total_water,
            SUM(steps_daily) as total_steps,
            AVG(sleep_hours) as avg_sleep,
            SUM(COALESCE(workout_hours, 0)) as total_workout_hours,
            SUM(COALESCE(cardio_hours, 0)) as total_cardio_hours,
            COUNT(*) as days_tracked
        FROM sf_user_daily_tracking 
        WHERE user_id = ? AND date BETWEEN ? AND ?
    ");
    $stmt_week->bind_param("iss", $user_id, $week_start, $week_end);
    $stmt_week->execute();
    $week_data = $stmt_week->get_result()->fetch_assoc();
    $stmt_week->close();

    // Alimentação da semana: somar direto do meal_log (mais confiável)
    $week_nutrition = fetchNutritionTotalsFromMealLog($conn, $user_id, $week_start, $week_end);
    $week_data['total_kcal'] = (int)round($week_nutrition['kcal']);
    $week_data['total_protein'] = round($week_nutrition['protein_g'], 1);
    $week_data['total_carbs'] = round($week_nutrition['carbs_g'], 1);
    $week_data['total_fat'] = round($week_nutrition['fat_g'], 1);

    // Treino/Cardio da semana: somar direto do routine_log
    $week_exercises = fetchExerciseTotalsHoursFromUserSources($conn, $user_id, $week_start, $week_end);
    $week_data['total_workout_hours'] = round((float)$week_exercises['workout_hours'], 2);
    $week_data['total_cardio_hours'] = round((float)$week_exercises['cardio_hours'], 2);
    
    // Dados do mês
    $stmt_month = $conn->prepare("
        SELECT 
            SUM(kcal_consumed) as total_kcal,
            SUM(protein_consumed_g) as total_protein,
            SUM(carbs_consumed_g) as total_carbs,
            SUM(fat_consumed_g) as total_fat,
            SUM(water_consumed_cups) as total_water,
            SUM(steps_daily) as total_steps,
            AVG(sleep_hours) as avg_sleep,
            SUM(COALESCE(workout_hours, 0)) as total_workout_hours,
            SUM(COALESCE(cardio_hours, 0)) as total_cardio_hours,
            COUNT(*) as days_tracked
        FROM sf_user_daily_tracking 
        WHERE user_id = ? AND date BETWEEN ? AND ?
    ");
    $stmt_month->bind_param("iss", $user_id, $month_start, $month_end);
    $stmt_month->execute();
    $month_data = $stmt_month->get_result()->fetch_assoc();
    $stmt_month->close();

    // Alimentação do mês: somar direto do meal_log (mais confiável)
    $month_nutrition = fetchNutritionTotalsFromMealLog($conn, $user_id, $month_start, $month_end);
    $month_data['total_kcal'] = (int)round($month_nutrition['kcal']);
    $month_data['total_protein'] = round($month_nutrition['protein_g'], 1);
    $month_data['total_carbs'] = round($month_nutrition['carbs_g'], 1);
    $month_data['total_fat'] = round($month_nutrition['fat_g'], 1);

    // Treino/Cardio do mês: somar direto do routine_log
    $month_exercises = fetchExerciseTotalsHoursFromUserSources($conn, $user_id, $month_start, $month_end);
    $month_data['total_workout_hours'] = round((float)$month_exercises['workout_hours'], 2);
    $month_data['total_cardio_hours'] = round((float)$month_exercises['cardio_hours'], 2);
    
    // Verificar se usuário tem exercícios:
    // - se perfil indica que pratica (exercise_frequency != sedentary e exercise_type preenchido)
    // - ou se houve qualquer registro de exercício nas fontes (hoje/semana/mês)
    $profile_has_exercises = !empty($user_profile_data['exercise_type']) && ($user_profile_data['exercise_frequency'] ?? 'sedentary') !== 'sedentary';
    $logged_any_exercise =
        ((float)$today_data['workout_hours'] > 0) || ((float)$today_data['cardio_hours'] > 0) ||
        ((float)($week_data['total_workout_hours'] ?? 0) > 0) || ((float)($week_data['total_cardio_hours'] ?? 0) > 0) ||
        ((float)($month_data['total_workout_hours'] ?? 0) > 0) || ((float)($month_data['total_cardio_hours'] ?? 0) > 0);
    $user_has_exercises = $profile_has_exercises || $logged_any_exercise;
    
    // Contar rotinas completadas hoje
    $completed_routines_today = 0;
    if ($user_has_exercises) {
        $stmt_routines = $conn->prepare("
            SELECT COUNT(*) as count FROM sf_user_routine_log 
            WHERE user_id = ? AND date = ? AND is_completed = 1
        ");
        $stmt_routines->bind_param("is", $user_id, $today);
        $stmt_routines->execute();
        $routines_result = $stmt_routines->get_result()->fetch_assoc();
        $completed_routines_today = $routines_result['count'] ?? 0;
        $stmt_routines->close();
    }
    
    // Histórico de peso (30 dias)
    $weight_history = [];
    $stmt_weight = $conn->prepare("
        SELECT date_recorded, weight_kg 
        FROM sf_user_weight_history 
        WHERE user_id = ? AND date_recorded >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
        ORDER BY date_recorded ASC
    ");
    $stmt_weight->bind_param("i", $user_id);
    $stmt_weight->execute();
    $result_weight = $stmt_weight->get_result();
    while ($row = $result_weight->fetch_assoc()) {
        $weight_history[] = $row;
    }
    $stmt_weight->close();
    
    // Calcular mudança de peso
    $weight_change = 0;
    if (count($weight_history) >= 2) {
        $first_weight = $weight_history[0]['weight_kg'];
        $last_weight = $weight_history[count($weight_history) - 1]['weight_kg'];
        $weight_change = $last_weight - $first_weight;
    }
    
    // Calcular meta de água (priorizar customizada se existir)
    if (!empty($user_profile_data['custom_water_goal_ml'])) {
        $water_goal_ml = (int)$user_profile_data['custom_water_goal_ml'];
    } else {
        $water_goal_data = getWaterIntakeSuggestion($user_profile_data['weight_kg']);
        $water_goal_ml = $water_goal_data['total_ml'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'goals' => $user_goals,
            'today' => $today_data,
            'week' => $week_data,
            'month' => $month_data,
            'user_has_exercises' => $user_has_exercises,
            'completed_routines_today' => $completed_routines_today,
            'weight_history' => $weight_history,
            'weight_change' => $weight_change,
            'current_weight' => $user_profile_data['weight_kg'],
            'water_goal_ml' => $water_goal_ml,
            'base_url' => BASE_APP_URL
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $e->getMessage()]);
}

$conn->close();
?>

