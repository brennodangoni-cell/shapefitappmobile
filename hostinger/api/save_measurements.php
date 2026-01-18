<?php
// api/save_measurements.php - Salvar medidas e fotos

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

$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado.']);
    exit();
}

$user_id = $user['id'];

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método não permitido');
    }
    
    // Debug: verificar Content-Type
    error_log("DEBUG save_measurements - Content-Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'N/A'));
    error_log("DEBUG save_measurements - REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
    
    // Processar FormData (multipart/form-data)
    $date_recorded = $_POST['date_recorded'] ?? date('Y-m-d');
    
    // VALIDAÇÃO 1: Verificar se a data não é futura
    $today = new DateTime('today');
    $recorded_date = new DateTime($date_recorded);
    if ($recorded_date > $today) {
        throw new Exception('Não é possível registrar fotos com data futura. Por favor, selecione uma data válida.');
    }
    
    // VALIDAÇÃO 2: Verificar se pelo menos uma foto foi enviada
    $has_photo = false;
    $photo_types = ['front', 'side', 'back'];
    
    // Debug: log dos arquivos recebidos
    error_log("DEBUG save_measurements - FILES recebidos: " . print_r($_FILES, true));
    error_log("DEBUG save_measurements - POST recebido: " . print_r($_POST, true));
    
    foreach ($photo_types as $type) {
        $file_key = "photo_$type";
        if (isset($_FILES[$file_key])) {
            error_log("DEBUG save_measurements - Verificando $file_key: error=" . ($_FILES[$file_key]['error'] ?? 'N/A') . ", size=" . ($_FILES[$file_key]['size'] ?? 'N/A'));
            
            // Verificar se o arquivo foi enviado e tem tamanho maior que 0
            if ($_FILES[$file_key]['error'] === UPLOAD_ERR_OK && isset($_FILES[$file_key]['size']) && $_FILES[$file_key]['size'] > 0) {
                $has_photo = true;
                error_log("DEBUG save_measurements - Foto válida encontrada em: $file_key");
                break;
            }
        }
    }
    
    if (!$has_photo) {
        error_log("DEBUG save_measurements - ERRO: Nenhuma foto válida encontrada!");
        throw new Exception('Por favor, envie pelo menos uma foto antes de salvar.');
    }
    
    // Buscar dados do usuário para pegar o peso
    $user_profile_data = getUserProfileData($conn, $user_id);
    $weight_kg = null;
    if ($user_profile_data && isset($user_profile_data['weight_kg']) && $user_profile_data['weight_kg'] > 0) {
        $weight_kg = floatval($user_profile_data['weight_kg']);
    }
    
    // Coletar medidas corporais (opcionais)
    $neck = !empty($_POST['neck']) && $_POST['neck'] !== '' ? floatval($_POST['neck']) : null;
    $chest = !empty($_POST['chest']) && $_POST['chest'] !== '' ? floatval($_POST['chest']) : null;
    $waist = !empty($_POST['waist']) && $_POST['waist'] !== '' ? floatval($_POST['waist']) : null;
    $abdomen = !empty($_POST['abdomen']) && $_POST['abdomen'] !== '' ? floatval($_POST['abdomen']) : null;
    $hips = !empty($_POST['hips']) && $_POST['hips'] !== '' ? floatval($_POST['hips']) : null;
    
    // Processar upload de fotos
    $photo_front = null;
    $photo_side = null;
    $photo_back = null;
    
    $upload_dir = APP_ROOT_PATH . '/uploads/measurements/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }
    
    // Sempre criar um novo registro para cada sessão de fotos
    $current_time = date('Y-m-d H:i:s');
    $stmt = $conn->prepare("INSERT INTO sf_user_measurements (user_id, date_recorded, weight_kg, neck, chest, waist, abdomen, hips, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . $conn->error);
    }
    
    $stmt->bind_param("isdddddds", $user_id, $date_recorded, $weight_kg, $neck, $chest, $waist, $abdomen, $hips, $current_time);
    
    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        throw new Exception('Erro ao executar query: ' . $error);
    }
    
    $measurement_id = $conn->insert_id;
    $stmt->close();
    
    // Processar upload das fotos
    $uploaded_photos = [];
    
    foreach ($photo_types as $type) {
        if (isset($_FILES["photo_$type"]) && $_FILES["photo_$type"]['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES["photo_$type"];
            $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $new_filename = "user_{$user_id}_measurement_{$measurement_id}_{$type}." . $file_extension;
            $upload_path = $upload_dir . $new_filename;
            
            if (move_uploaded_file($file['tmp_name'], $upload_path)) {
                $uploaded_photos[$type] = $new_filename;
            }
        }
    }
    
    // Atualizar registro com nomes das fotos
    if (!empty($uploaded_photos)) {
        $photo_front = $uploaded_photos['front'] ?? null;
        $photo_side = $uploaded_photos['side'] ?? null;
        $photo_back = $uploaded_photos['back'] ?? null;
        
        $stmt = $conn->prepare("UPDATE sf_user_measurements SET photo_front = ?, photo_side = ?, photo_back = ? WHERE id = ?");
        
        if (!$stmt) {
            throw new Exception('Erro ao preparar UPDATE: ' . $conn->error);
        }
        
        $stmt->bind_param("sssi", $photo_front, $photo_side, $photo_back, $measurement_id);
        
        if (!$stmt->execute()) {
            $error = $stmt->error;
            $stmt->close();
            throw new Exception('Erro ao atualizar fotos: ' . $error);
        }
        
        $stmt->close();
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Medidas salvas com sucesso!'
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $e->getMessage()]);
}

$conn->close();
?>



