<?php
// api/process_onboarding.php - API para processar o onboarding completo

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

// Autenticação via token
// O token pode ser de um usuário existente (sf_users) ou de um registro pendente (sf_pending_registrations)
$user_id = null;
$token = null;
$pending_registration = null;
$is_pending_registration = false;

if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
        $token = $matches[1];
    }
}

if ($token) {
    // Primeiro, verificar se é um token de registro pendente
    $stmt_pending = $conn->prepare("SELECT id, name, email, password_hash FROM sf_pending_registrations WHERE registration_token = ? AND expires_at > NOW()");
    if ($stmt_pending) {
        $stmt_pending->bind_param("s", $token);
        $stmt_pending->execute();
        $result_pending = $stmt_pending->get_result();
        if ($pending_data = $result_pending->fetch_assoc()) {
            $pending_registration = $pending_data;
            $is_pending_registration = true;
        }
        $stmt_pending->close();
    }
    
    // Se não for registro pendente, verificar se é token de usuário existente
    if (!$is_pending_registration) {
        $stmt_token = $conn->prepare("SELECT id, onboarding_complete FROM sf_users WHERE auth_token = ? AND auth_token_expires_at > NOW()");
        if ($stmt_token) {
            $stmt_token->bind_param("s", $token);
            $stmt_token->execute();
            $result_token = $stmt_token->get_result();
            if ($user_data = $result_token->fetch_assoc()) {
                $user_id = $user_data['id'];
            }
            $stmt_token->close();
        }
    }
}

if (!$user_id && !$is_pending_registration) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autenticado ou token expirado.']);
    exit();
}

$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados inválidos.']);
    exit();
}

// Processar exercícios
$cleaned_exercises_string = null;
$exercise_durations = [];
// Processa exercícios APENAS se NÃO marcou "Nenhuma / Não pratico"
// JS envia '1' quando marcou nenhuma, '' quando selecionou exercícios
$user_selected_none = isset($data['exercise_type_none']) && $data['exercise_type_none'] === '1';
if (!$user_selected_none) {
    $selected_exercises = isset($data['exercise_types']) && is_array($data['exercise_types']) ? $data['exercise_types'] : [];
    $custom_activities_raw = trim($data['custom_activities'] ?? '');
    $custom_activities_array = [];
    if (!empty($custom_activities_raw)) {
        $custom_activities_array = preg_split('/,\s*/', $custom_activities_raw, -1, PREG_SPLIT_NO_EMPTY);
    }
    $all_exercises = array_merge($selected_exercises, $custom_activities_array);
    $final_exercises = array_unique(array_filter($all_exercises));
    if (!empty($final_exercises)) {
        $cleaned_exercises_string = implode(', ', $final_exercises);
        
        // Processar durações dos exercícios
        if (isset($data['exercise_duration']) && is_array($data['exercise_duration'])) {
            foreach ($data['exercise_duration'] as $exercise => $duration) {
                $duration_minutes = filter_var($duration, FILTER_VALIDATE_INT);
                if ($duration_minutes && $duration_minutes >= 15 && $duration_minutes <= 300) {
                    $exercise_durations[$exercise] = $duration_minutes;
                }
            }
        }
    }
}

$objective = $data['objective'] ?? '';
$weight_kg_str = str_replace(',', '.', trim($data['weight_kg'] ?? '0'));
$weight_kg = filter_var($weight_kg_str, FILTER_VALIDATE_FLOAT);
$height_cm = filter_var($data['height_cm'] ?? 0, FILTER_VALIDATE_INT);

// Validação de exercícios e frequência
// Usa a variável já definida acima ($user_selected_none)
$exercise_type_none = $user_selected_none;
$has_exercises = !empty($cleaned_exercises_string) && trim($cleaned_exercises_string) !== '';
$exercise_frequency_raw = $data['exercise_frequency'] ?? '';

$valid_frequencies = ['1_2x_week', '3_4x_week', '5_6x_week', '6_7x_week', '7plus_week'];

if ($exercise_type_none) {
    $exercise_frequency = 'sedentary';
    $cleaned_exercises_string = null;
} else {
    if ($has_exercises) {
        if (empty($exercise_frequency_raw) || trim($exercise_frequency_raw) === '' || !in_array($exercise_frequency_raw, $valid_frequencies)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Por favor, selecione a frequência de treino. Se você pratica exercícios, é necessário informar com que frequência.']);
            exit();
        }
        $exercise_frequency = $exercise_frequency_raw;
    } else {
        $exercise_frequency = 'sedentary';
    }
}

$water_intake = $data['water_intake_liters'] ?? '1_2l';
$sleep_bed = $data['sleep_time_bed'] ?? null;
$sleep_wake = $data['sleep_time_wake'] ?? null;
$eats_meat = ($data['meat_consumption'] ?? '1') === '1';
$vegetarian_type = !$eats_meat ? ($data['vegetarian_type'] ?? 'not_like') : null;
$lactose_intolerance = ($data['lactose_intolerance'] ?? '0') === '1';
$gluten_intolerance = ($data['gluten_intolerance'] ?? '0') === '1';
// Se for registro pendente, usar o name do registro pendente
// Caso contrário, tentar obter do formulário ou do banco
$name = '';
if ($is_pending_registration && $pending_registration) {
    $name = trim($pending_registration['name'] ?? '');
} else {
    $name = trim($data['name'] ?? '');
    // Se não veio do formulário e temos user_id, buscar do banco
    if (empty($name) && $user_id) {
        $stmt_get_name = $conn->prepare("SELECT name FROM sf_users WHERE id = ?");
        $stmt_get_name->bind_param("i", $user_id);
        $stmt_get_name->execute();
        $result_name = $stmt_get_name->get_result();
        if ($name_data = $result_name->fetch_assoc()) {
            $name = trim($name_data['name'] ?? '');
        }
        $stmt_get_name->close();
    }
}

$uf = trim($data['uf'] ?? '');
$city = trim($data['city'] ?? '');
$phone_ddd = trim($data['phone_ddd'] ?? '');
$phone_number = trim($data['phone_number'] ?? '');
$dob = $data['dob'] ?? null;
$gender = $data['gender'] ?? 'not_informed';

// Verificar se é refazer onboarding (não precisa dos campos de localização/telefone/etc)
// Aceita tanto boolean true quanto string 'true'
$is_refazer = isset($data['is_refazer']) && ($data['is_refazer'] === true || $data['is_refazer'] === 'true');

// Se for refazer, buscar dados existentes do banco
if ($is_refazer && $user_id) {
    // Buscar dob e gender de sf_user_profiles
    $stmt_existing = $conn->prepare("SELECT dob, gender FROM sf_user_profiles WHERE user_id = ?");
    $stmt_existing->bind_param("i", $user_id);
    $stmt_existing->execute();
    $result_existing = $stmt_existing->get_result();
    if ($existing_data = $result_existing->fetch_assoc()) {
        if (empty($dob)) $dob = $existing_data['dob'];
        if (empty($gender) || $gender === 'not_informed') $gender = $existing_data['gender'];
    }
    $stmt_existing->close();
    
    // Buscar uf, city, phone_ddd, phone_number de sf_users
    $stmt_existing_user = $conn->prepare("SELECT uf, city, phone_ddd, phone_number FROM sf_users WHERE id = ?");
    $stmt_existing_user->bind_param("i", $user_id);
    $stmt_existing_user->execute();
    $result_existing_user = $stmt_existing_user->get_result();
    if ($existing_user_data = $result_existing_user->fetch_assoc()) {
        if (empty($uf)) $uf = $existing_user_data['uf'];
        if (empty($city)) $city = $existing_user_data['city'];
        if (empty($phone_ddd)) $phone_ddd = $existing_user_data['phone_ddd'];
        if (empty($phone_number)) $phone_number = $existing_user_data['phone_number'];
    }
    $stmt_existing_user->close();
}

// Validar data de nascimento: mínimo 12 anos (sem idade máxima)
if (!empty($dob)) {
    $dobDt = DateTime::createFromFormat('Y-m-d', $dob);
    $dobErrors = DateTime::getLastErrors();
    if (!$dobDt || !empty($dobErrors['warning_count']) || !empty($dobErrors['error_count'])) {
        $validation_errors[] = 'Data de nascimento inválida.';
    } else {
        $today = new DateTime('today');
        if ($dobDt > $today) {
            $validation_errors[] = 'A data de nascimento não pode ser no futuro.';
        } else {
            $ageYears = (int)$dobDt->diff($today)->y;
            if ($ageYears < 12) {
                $validation_errors[] = 'Você precisa ter pelo menos 12 anos para usar o ShapeFit.';
            }
        }
    }
}

// VALIDAÇÃO COMPLETA - Todos os campos obrigatórios devem estar preenchidos
$validation_errors = [];

// Validar objetivo
if (empty($objective) || !in_array($objective, ['lose_fat', 'maintain_weight', 'gain_muscle'])) {
    $validation_errors[] = 'Objetivo principal é obrigatório.';
}

// Validar peso e altura
if (empty($weight_kg) || $weight_kg <= 0 || $weight_kg > 500) {
    $validation_errors[] = 'Peso válido é obrigatório.';
}
if (empty($height_cm) || $height_cm < 50 || $height_cm > 300) {
    $validation_errors[] = 'Altura válida é obrigatória.';
}

// Validar exercícios e frequência
if (!$exercise_type_none && !$has_exercises) {
    $validation_errors[] = 'Selecione pelo menos um exercício ou marque "Nenhuma / Não pratico".';
}
if (!$exercise_type_none && $has_exercises && (empty($exercise_frequency_raw) || !in_array($exercise_frequency_raw, $valid_frequencies))) {
    $validation_errors[] = 'Frequência de treino é obrigatória quando você pratica exercícios.';
}

// Validar água
if (empty($water_intake) || !in_array($water_intake, ['_1l', '1_2l', '2_3l', '3plus_l'])) {
    $validation_errors[] = 'Consumo de água é obrigatório.';
}

// Validar sono
if (empty($sleep_bed) || empty($sleep_wake)) {
    $validation_errors[] = 'Horários de sono são obrigatórios.';
}

// Validar consumo de carne
if (!isset($data['meat_consumption']) || !in_array($data['meat_consumption'], ['0', '1'])) {
    $validation_errors[] = 'Informação sobre consumo de carne é obrigatória.';
}

// Se não come carne, validar tipo vegetariano
if (!$eats_meat) {
    if (empty($vegetarian_type) || !in_array($vegetarian_type, ['strict_vegetarian', 'ovolacto', 'vegan', 'not_like'])) {
        $validation_errors[] = 'Tipo de vegetarianismo é obrigatório quando você não consome carne.';
    }
}

// Validar intolerâncias
if (!isset($data['lactose_intolerance']) || !in_array($data['lactose_intolerance'], ['0', '1'])) {
    $validation_errors[] = 'Informação sobre intolerância à lactose é obrigatória.';
}
if (!isset($data['gluten_intolerance']) || !in_array($data['gluten_intolerance'], ['0', '1'])) {
    $validation_errors[] = 'Informação sobre restrição ao glúten é obrigatória.';
}

// Validar dados pessoais finais (apenas se NÃO for refazer)
if (!$is_refazer) {
    // Se for registro pendente, o name já vem do registro e não precisa ser validado aqui
    // Mas vamos validar mesmo assim para garantir
    if (empty($name) || strlen($name) < 2) {
        if ($is_pending_registration) {
            // Se for registro pendente e o name estiver vazio, há um problema no sistema
            $validation_errors[] = 'Erro: Nome não encontrado no registro. Por favor, entre em contato com o suporte.';
        } else {
            $validation_errors[] = 'Nome completo é obrigatório (mínimo 2 caracteres).';
        }
    }
    if (empty($uf) || strlen($uf) !== 2) {
        $validation_errors[] = 'UF é obrigatória.';
    }
    if (empty($city) || strlen($city) < 2) {
        $validation_errors[] = 'Cidade é obrigatória (mínimo 2 caracteres).';
    }
    if (empty($phone_ddd) || !preg_match('/^\d{2}$/', $phone_ddd)) {
        $validation_errors[] = 'DDD é obrigatório.';
    }
    if (empty($phone_number) || !preg_match('/^\d{8,9}$/', $phone_number)) {
        $validation_errors[] = 'Número de telefone é obrigatório.';
    }
    if (empty($dob)) {
        $validation_errors[] = 'Data de nascimento é obrigatória.';
    }
    if (empty($gender) || !in_array($gender, ['female', 'male', 'other', 'not_informed'])) {
        $validation_errors[] = 'Gênero é obrigatório.';
    }
}

// Se houver erros de validação, retornar erro e NÃO completar o onboarding
if (!empty($validation_errors)) {
    http_response_code(400);
    // Mostrar os erros específicos para debug (pode remover depois)
    $error_message = 'Por favor, preencha todos os campos obrigatórios.';
    if (count($validation_errors) > 0) {
        $error_message .= ' Erros: ' . implode('; ', $validation_errors);
    }
    echo json_encode([
        'success' => false, 
        'message' => $error_message,
        'errors' => $validation_errors
    ]);
    exit();
}

$new_token = null; // Inicializar variável para novo token (se usuário for criado)

$conn->begin_transaction();
try {
    // Se for um registro pendente, criar o usuário em sf_users
    if ($is_pending_registration) {
        // Verificar se a coluna approval_status existe, se não, criar
        $check_approval = $conn->query("SHOW COLUMNS FROM sf_users LIKE 'approval_status'");
        $has_approval_column = $check_approval && $check_approval->num_rows > 0;
        if ($check_approval) $check_approval->free();
        
        if (!$has_approval_column) {
            $conn->query("ALTER TABLE sf_users ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER status");
        }
        
        // Criar usuário definitivo com status de aprovação pendente
        $stmt_create_user = $conn->prepare("INSERT INTO sf_users (name, email, password_hash, uf, city, phone_ddd, phone_number, onboarding_complete, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 'pending')");
        $stmt_create_user->bind_param("sssssss", 
            $pending_registration['name'], 
            $pending_registration['email'], 
            $pending_registration['password_hash'],
            $uf, 
            $city, 
            $phone_ddd, 
            $phone_number
        );
        $stmt_create_user->execute();
        $user_id = $stmt_create_user->insert_id;
        $stmt_create_user->close();
        
        // Deletar registro pendente
        $stmt_delete_pending = $conn->prepare("DELETE FROM sf_pending_registrations WHERE id = ?");
        $stmt_delete_pending->bind_param("i", $pending_registration['id']);
        $stmt_delete_pending->execute();
        $stmt_delete_pending->close();
        
        // Gerar novo token de autenticação para o usuário criado
        $new_token = bin2hex(random_bytes(32));
        $new_token_expires = date('Y-m-d H:i:s', strtotime('+30 days'));
        $stmt_new_token = $conn->prepare("UPDATE sf_users SET auth_token = ?, auth_token_expires_at = ? WHERE id = ?");
        $stmt_new_token->bind_param("ssi", $new_token, $new_token_expires, $user_id);
        $stmt_new_token->execute();
        $stmt_new_token->close();
    } else {
        // Atualizar dados do usuário existente
        if ($is_refazer) {
            // Se for refazer, NÃO atualiza os dados pessoais (já foram preenchidos antes)
            // Apenas garante que onboarding_complete = TRUE
            $stmt_users = $conn->prepare("UPDATE sf_users SET onboarding_complete = TRUE WHERE id = ?");
            $stmt_users->bind_param("i", $user_id);
        } else {
            // Se for onboarding normal, atualiza tudo
            $stmt_users = $conn->prepare("UPDATE sf_users SET name = ?, uf = ?, city = ?, phone_ddd = ?, phone_number = ?, onboarding_complete = TRUE WHERE id = ?");
            $stmt_users->bind_param("sssssi", $name, $uf, $city, $phone_ddd, $phone_number, $user_id);
        }
        $stmt_users->execute();
        $stmt_users->close();
    }
    
    // Atualizar perfil
    $stmt_profile = $conn->prepare(
        "INSERT INTO sf_user_profiles (user_id, dob, gender, height_cm, weight_kg, objective, 
        exercise_type, exercise_frequency, water_intake_liters, sleep_time_bed, sleep_time_wake, 
        meat_consumption, vegetarian_type, lactose_intolerance, gluten_intolerance) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE 
        dob=VALUES(dob), gender=VALUES(gender), height_cm=VALUES(height_cm), weight_kg=VALUES(weight_kg), 
        objective=VALUES(objective), exercise_type=VALUES(exercise_type), exercise_frequency=VALUES(exercise_frequency), 
        water_intake_liters=VALUES(water_intake_liters), sleep_time_bed=VALUES(sleep_time_bed), 
        sleep_time_wake=VALUES(sleep_time_wake), meat_consumption=VALUES(meat_consumption), 
        vegetarian_type=VALUES(vegetarian_type), lactose_intolerance=VALUES(lactose_intolerance), 
        gluten_intolerance=VALUES(gluten_intolerance)"
    );
    
    $stmt_profile->bind_param("issidssssssisii", $user_id, $dob, $gender, $height_cm, $weight_kg, $objective,
        $cleaned_exercises_string, $exercise_frequency, $water_intake, $sleep_bed, $sleep_wake, $eats_meat,
        $vegetarian_type, $lactose_intolerance, $gluten_intolerance
    );
    
    $stmt_profile->execute();
    $stmt_profile->close();
    
    // Logar peso inicial
    if ($weight_kg > 0) {
        $current_date_str = date('Y-m-d');
        $stmt_log_initial_weight = $conn->prepare("INSERT INTO sf_user_weight_history (user_id, weight_kg, date_recorded) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE weight_kg = VALUES(weight_kg)");
        $stmt_log_initial_weight->bind_param("ids", $user_id, $weight_kg, $current_date_str);
        $stmt_log_initial_weight->execute();
        $stmt_log_initial_weight->close();
    }

    // Calcular metas
    $age_years = calculateAge($dob);
    $calculated_calories = calculateTargetDailyCalories($gender, $weight_kg, $height_cm, $age_years, $exercise_frequency, $objective);
    $calculated_macros = calculateMacronutrients($calculated_calories, $objective);
    $calculated_water = getWaterIntakeSuggestion($weight_kg);
    
    // Calcular metas de exercício
    $workout_hours_weekly = 0;
    $cardio_hours_weekly = 0;
    switch ($exercise_frequency) {
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
    
    // Calcular horas de sono
    $sleep_hours = 8.0;
    if ($sleep_bed && $sleep_wake) {
        $bed_time = new DateTime($sleep_bed);
        $wake_time = new DateTime($sleep_wake);
        if ($wake_time < $bed_time) {
            $wake_time->add(new DateInterval('P1D'));
        }
        $sleep_duration = $wake_time->diff($bed_time);
        $sleep_hours = $sleep_duration->h + ($sleep_duration->i / 60);
    }
    
    $water_cups = $calculated_water['cups'];
    $step_length = ($gender == 'male') ? 76.0 : 66.0;
    $target_steps_daily = 10000;
    $target_steps_weekly = 70000;
    $workout_hours_monthly = $workout_hours_weekly * 4;
    $cardio_hours_monthly = $cardio_hours_weekly * 4;
    
    // Inserir ou atualizar metas (ON DUPLICATE KEY UPDATE para quando refaz o onboarding)
    $stmt_goals = $conn->prepare("
        INSERT INTO sf_user_goals (
            user_id, goal_type, target_kcal, target_protein_g, target_carbs_g, target_fat_g,
            target_water_cups, target_steps_daily, target_steps_weekly,
            target_workout_hours_weekly, target_workout_hours_monthly,
            target_cardio_hours_weekly, target_cardio_hours_monthly,
            target_sleep_hours, user_gender, step_length_cm
        ) VALUES (?, 'nutrition', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            target_kcal = VALUES(target_kcal),
            target_protein_g = VALUES(target_protein_g),
            target_carbs_g = VALUES(target_carbs_g),
            target_fat_g = VALUES(target_fat_g),
            target_water_cups = VALUES(target_water_cups),
            target_steps_daily = VALUES(target_steps_daily),
            target_steps_weekly = VALUES(target_steps_weekly),
            target_workout_hours_weekly = VALUES(target_workout_hours_weekly),
            target_workout_hours_monthly = VALUES(target_workout_hours_monthly),
            target_cardio_hours_weekly = VALUES(target_cardio_hours_weekly),
            target_cardio_hours_monthly = VALUES(target_cardio_hours_monthly),
            target_sleep_hours = VALUES(target_sleep_hours),
            user_gender = VALUES(user_gender),
            step_length_cm = VALUES(step_length_cm)
    ");
    
    $stmt_goals->bind_param("idddiiidddddssd", 
        $user_id,
        $calculated_calories, 
        $calculated_macros['protein_g'], 
        $calculated_macros['carbs_g'], 
        $calculated_macros['fat_g'],
        $water_cups, 
        $target_steps_daily, 
        $target_steps_weekly,
        $workout_hours_weekly, 
        $workout_hours_monthly,
        $cardio_hours_weekly, 
        $cardio_hours_monthly,
        $sleep_hours, 
        $gender, 
        $step_length
    );
    
    $stmt_goals->execute();
    $stmt_goals->close();

    // Salvar durações dos exercícios
    if (!empty($exercise_durations)) {
        foreach ($exercise_durations as $exercise_name => $duration_minutes) {
            $stmt_duration = $conn->prepare("
                INSERT INTO sf_user_exercise_durations (user_id, exercise_name, duration_minutes) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE duration_minutes = VALUES(duration_minutes)
            ");
            $stmt_duration->bind_param("isi", $user_id, $exercise_name, $duration_minutes);
            $stmt_duration->execute();
            $stmt_duration->close();
        }
    }

    // Criar missões padrão
    $default_missions = [
        [
            'title' => 'Lembrou de registrar todas as suas refeições?',
            'icon_class' => 'fa-utensils',
            'description' => null,
            'is_exercise' => 0,
            'exercise_type' => ''
        ],
        [
            'title' => 'Seu intestino funcionou hoje?',
            'icon_class' => 'fa-check-circle',
            'description' => null,
            'is_exercise' => 0,
            'exercise_type' => ''
        ],
        [
            'title' => 'Comeu salada hoje?',
            'icon_class' => 'fa-leaf',
            'description' => null,
            'is_exercise' => 0,
            'exercise_type' => ''
        ]
    ];
    
    foreach ($default_missions as $default_mission) {
        $keyword = '';
        if (stripos($default_mission['title'], 'refeições') !== false) {
            $keyword = 'refeições';
        } elseif (stripos($default_mission['title'], 'intestino') !== false) {
            $keyword = 'intestino';
        } elseif (stripos($default_mission['title'], 'salada') !== false) {
            $keyword = 'salada';
        } elseif (stripos($default_mission['title'], 'sono') !== false) {
            $keyword = 'sono';
        }
        
        $exists = false;
        if ($keyword) {
            $check_stmt = $conn->prepare("
                SELECT id FROM sf_user_routine_items 
                WHERE user_id = ? 
                AND LOWER(title) LIKE ?
                LIMIT 1
            ");
            $title_like = '%' . $keyword . '%';
            $check_stmt->bind_param("is", $user_id, $title_like);
            $check_stmt->execute();
            $check_result = $check_stmt->get_result();
            $exists = $check_result->num_rows > 0;
            $check_stmt->close();
        }
        
        if (!$exists) {
            $create_stmt = $conn->prepare("
                INSERT INTO sf_user_routine_items 
                (user_id, title, icon_class, description, is_exercise, exercise_type)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $description = $default_mission['description'] ?? null;
            $create_stmt->bind_param("isssis", 
                $user_id,
                $default_mission['title'],
                $default_mission['icon_class'],
                $description,
                $default_mission['is_exercise'],
                $default_mission['exercise_type']
            );
            $create_stmt->execute();
            $create_stmt->close();
        }
    }
    
    // Garantir missão de sono
    $check_sleep_stmt = $conn->prepare("
        SELECT id FROM sf_user_routine_items 
        WHERE user_id = ? 
        AND (exercise_type = 'sleep' OR LOWER(title) LIKE '%sono%')
        LIMIT 1
    ");
    $check_sleep_stmt->bind_param("i", $user_id);
    $check_sleep_stmt->execute();
    $sleep_result = $check_sleep_stmt->get_result();
    $check_sleep_stmt->close();
    
    if ($sleep_result->num_rows === 0) {
        $create_sleep_stmt = $conn->prepare("
            INSERT INTO sf_user_routine_items 
            (user_id, title, icon_class, description, is_exercise, exercise_type)
            VALUES (?, 'Como foi seu sono esta noite?', 'fa-bed', 'Registre quantas horas você dormiu: hora que deitou e hora que acordou', 1, 'sleep')
        ");
        $create_sleep_stmt->bind_param("i", $user_id);
        $create_sleep_stmt->execute();
        $create_sleep_stmt->close();
    }

    $conn->commit();
    
    // Verificar se o usuário está pendente de aprovação
    $check_approval = $conn->query("SHOW COLUMNS FROM sf_users LIKE 'approval_status'");
    $has_approval_column = $check_approval && $check_approval->num_rows > 0;
    if ($check_approval) $check_approval->free();
    
    $approval_status = 'pending';
    if ($has_approval_column) {
        $stmt_check_approval = $conn->prepare("SELECT COALESCE(approval_status, 'pending') as approval_status FROM sf_users WHERE id = ?");
        $stmt_check_approval->bind_param("i", $user_id);
        $stmt_check_approval->execute();
        $approval_result = $stmt_check_approval->get_result();
        if ($approval_result->num_rows > 0) {
            $approval_data = $approval_result->fetch_assoc();
            $approval_status = $approval_data['approval_status'];
        }
        $stmt_check_approval->close();
    }
    
    // Se foi criado um novo usuário e está aprovado, retornar o token
    // Se estiver pending, não retornar token e mostrar mensagem de aprovação
    if ($approval_status === 'pending') {
        // Limpar token se existir (usuário não pode fazer login até ser aprovado)
        $stmt_clear_token = $conn->prepare("UPDATE sf_users SET auth_token = NULL, auth_token_expires_at = NULL WHERE id = ?");
        $stmt_clear_token->bind_param("i", $user_id);
        $stmt_clear_token->execute();
        $stmt_clear_token->close();
        
        $response_data = [
            'success' => true,
            'message' => 'Sua conta foi criada com sucesso! Aguarde a aprovação do nutricionista para começar a usar o aplicativo.',
            'requires_approval' => true,
            'redirect_url' => BASE_APP_URL . '/auth/login.html'
        ];
    } else {
        $response_data = [
            'success' => true,
            'message' => 'Onboarding concluído com sucesso!',
            'redirect_url' => BASE_APP_URL . '/dashboard.html'
        ];
        
        if ($is_pending_registration && isset($new_token)) {
            $response_data['token'] = $new_token;
        }
    }
    
    http_response_code(200);
    echo json_encode($response_data);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("CRITICAL Onboarding Error for user {$user_id}: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ocorreu um erro ao salvar seus dados. Tente novamente.']);
}
?>

