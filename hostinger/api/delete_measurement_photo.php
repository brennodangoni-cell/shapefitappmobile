<?php
// api/delete_measurement_photo.php - API para deletar foto de medição
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

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

$user_id = $user['id'];

// Ler dados do POST (pode ser JSON ou form-data)
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);
if (!$data) {
    $data = $_POST;
}

$measurement_id = filter_var($data['measurement_id'] ?? 0, FILTER_VALIDATE_INT);
$photo_type = trim($data['photo_type'] ?? '');

// Validações básicas
if (!$measurement_id || empty($photo_type)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados inválidos. ID da medição e tipo de foto são obrigatórios.']);
    exit();
}

// Normalizar tipo de foto (aceita "front" ou "photo_front")
$photo_type = str_replace('photo_', '', $photo_type);

// Validar tipo de foto
$valid_types = ['front', 'side', 'back'];
if (!in_array($photo_type, $valid_types)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Tipo de foto inválido: ' . $photo_type]);
    exit();
}

$photo_column = 'photo_' . $photo_type;

$conn->begin_transaction();

try {
    // Buscar dados atuais da medição
    $stmt = $conn->prepare("SELECT * FROM sf_user_measurements WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $measurement_id, $user_id);
    $stmt->execute();
    $measurement = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$measurement) {
        throw new Exception("Medição não encontrada.");
    }

    $current_photo = $measurement[$photo_column] ?? '';

    if (empty($current_photo)) {
        throw new Exception("Nenhuma foto encontrada para remover.");
    }

    // Remover arquivo físico se existir
    $photo_path = '../uploads/measurements/' . $current_photo;
    if (file_exists($photo_path)) {
        unlink($photo_path);
    }

    // Atualizar banco removendo a referência da foto
    $stmt_update = $conn->prepare("UPDATE sf_user_measurements SET {$photo_column} = NULL WHERE id = ? AND user_id = ?");
    $stmt_update->bind_param("ii", $measurement_id, $user_id);
    $stmt_update->execute();
    $stmt_update->close();

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Foto removida com sucesso!'
    ]);

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    error_log("Erro em api/delete_measurement_photo.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao remover foto: ' . $e->getMessage()]);
}

$conn->close();
?>

