<?php
// api/toggle_favorite.php - API para favoritar/desfavoritar receita

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

// Ler dados do POST
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

if (!$data) {
    $data = $_POST;
}

$recipe_id = filter_var($data['recipe_id'] ?? 0, FILTER_VALIDATE_INT);

if (!$recipe_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID da receita inválido.']);
    exit();
}

try {
    // Verificar se já está favoritada
    $stmt_check = $conn->prepare("SELECT recipe_id FROM sf_user_favorite_recipes WHERE user_id = ? AND recipe_id = ?");
    $stmt_check->bind_param("ii", $user_id, $recipe_id);
    $stmt_check->execute();
    $is_favorited = $stmt_check->get_result()->num_rows > 0;
    $stmt_check->close();

    if ($is_favorited) {
        // Remover dos favoritos
        $stmt_remove = $conn->prepare("DELETE FROM sf_user_favorite_recipes WHERE user_id = ? AND recipe_id = ?");
        $stmt_remove->bind_param("ii", $user_id, $recipe_id);
        $stmt_remove->execute();
        $stmt_remove->close();
        
        echo json_encode([
            'success' => true,
            'is_favorited' => false,
            'message' => 'Receita removida dos favoritos.'
        ]);
    } else {
        // Adicionar aos favoritos
        $stmt_add = $conn->prepare("INSERT INTO sf_user_favorite_recipes (user_id, recipe_id) VALUES (?, ?)");
        $stmt_add->bind_param("ii", $user_id, $recipe_id);
        $stmt_add->execute();
        $stmt_add->close();
        
        echo json_encode([
            'success' => true,
            'is_favorited' => true,
            'message' => 'Receita adicionada aos favoritos!'
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em api/toggle_favorite.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao atualizar favoritos: ' . $e->getMessage()]);
}

$conn->close();
?>

