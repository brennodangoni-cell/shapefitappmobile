<?php
// api/update_profile.php - API para atualizar perfil do usuário

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

$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    sendJsonResponse(['success' => false, 'message' => 'Não autorizado.'], 401);
}

$user_id = $user['id'];

// Validação CSRF apenas se for sessão (não token)
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

$full_name = trim($data['full_name'] ?? '');
$dob = trim($data['dob'] ?? '');
$gender = trim($data['gender'] ?? 'other');
$height_cm = filter_var($data['height_cm'] ?? null, FILTER_VALIDATE_INT);
$weight_kg = filter_var($data['weight_kg'] ?? null, FILTER_VALIDATE_FLOAT);
$objective = trim($data['objective'] ?? '');
$exercise_type = trim($data['exercise_type'] ?? '');
$exercise_frequency = trim($data['exercise_frequency'] ?? 'sedentary');
$restrictions = $data['restrictions'] ?? [];

// Se não há exercícios selecionados, definir como null
if (empty($exercise_type) || $exercise_type === '0' || trim($exercise_type) === '') {
    $exercise_type = null;
    // Se não há exercícios, garantir que a frequência seja sedentary
    if ($exercise_frequency !== 'sedentary') {
        $exercise_frequency = 'sedentary';
    }
}

if (empty($full_name) || empty($dob) || empty($height_cm) || empty($weight_kg)) {
    sendJsonResponse(['success' => false, 'message' => 'Por favor, preencha todos os campos obrigatórios.'], 400);
}

$conn->begin_transaction();
try {
    // Atualizar nome
    $stmt1 = $conn->prepare("UPDATE sf_users SET name = ? WHERE id = ?");
    $stmt1->bind_param("si", $full_name, $user_id);
    $stmt1->execute();
    $stmt1->close();
    
    // Verificar se o peso realmente mudou antes de registrar no histórico
    // Buscar peso atual no perfil
    $stmt_current_weight = $conn->prepare("SELECT weight_kg FROM sf_user_profiles WHERE user_id = ?");
    $stmt_current_weight->bind_param("i", $user_id);
    $stmt_current_weight->execute();
    $result_current = $stmt_current_weight->get_result();
    $current_profile = $result_current->fetch_assoc();
    $stmt_current_weight->close();
    
    $current_weight_kg = $current_profile ? (float)($current_profile['weight_kg'] ?? 0) : 0;
    
    // Só registrar no histórico se o peso realmente mudou (diferença maior que 0.1kg)
    if ($weight_kg !== null && $weight_kg > 0 && abs($weight_kg - $current_weight_kg) > 0.1) {
        $current_date_str = date('Y-m-d');
        $stmt_log_weight = $conn->prepare(
            "INSERT INTO sf_user_weight_history (user_id, weight_kg, date_recorded) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE weight_kg = VALUES(weight_kg)"
        );
        if ($stmt_log_weight) {
            $stmt_log_weight->bind_param("ids", $user_id, $weight_kg, $current_date_str);
            $stmt_log_weight->execute();
            $stmt_log_weight->close();
        }
    }
    
    // Atualizar perfil (incluindo exercise_type)
    $has_restrictions = !empty($restrictions) ? 1 : 0;
    $stmt2 = $conn->prepare("UPDATE sf_user_profiles SET dob = ?, gender = ?, height_cm = ?, weight_kg = ?, objective = ?, exercise_type = ?, exercise_frequency = ?, has_dietary_restrictions = ? WHERE user_id = ?");
    $stmt2->bind_param("ssidsssii", $dob, $gender, $height_cm, $weight_kg, $objective, $exercise_type, $exercise_frequency, $has_restrictions, $user_id);
    $stmt2->execute();
    $stmt2->close();
    
    // Atualizar restrições
    $stmt3_del = $conn->prepare("DELETE FROM sf_user_selected_restrictions WHERE user_id = ?");
    $stmt3_del->bind_param("i", $user_id);
    $stmt3_del->execute();
    $stmt3_del->close();
    
    if ($has_restrictions) {
        $stmt3_ins = $conn->prepare("INSERT INTO sf_user_selected_restrictions (user_id, restriction_id) VALUES (?, ?)");
        foreach ($restrictions as $restriction_id) {
            $stmt3_ins->bind_param("ii", $user_id, $restriction_id);
            $stmt3_ins->execute();
        }
        $stmt3_ins->close();
    }
    
    $conn->commit();
    
    if (isLoggedIn() && !$hasToken) {
        $_SESSION['user_name'] = $full_name;
    }
    
    sendJsonResponse([
        'success' => true,
        'message' => 'Perfil atualizado!'
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("Erro em api/update_profile.php para user_id {$user_id}: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'Ocorreu um erro ao salvar o perfil.'], 500);
}

$conn->close();
?>

