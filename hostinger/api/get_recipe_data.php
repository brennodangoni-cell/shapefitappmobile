<?php
// api/get_recipe_data.php - API para buscar dados de uma receita

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

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

$user_id = $user['id'];
$recipe_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$recipe_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID da receita inválido.']);
    exit();
}

$response = ['success' => false, 'data' => []];

try {
    // Buscar receita
    $stmt_recipe = $conn->prepare("SELECT * FROM sf_recipes WHERE id = ? AND is_public = TRUE");
    $stmt_recipe->bind_param("i", $recipe_id);
    $stmt_recipe->execute();
    $result_recipe = $stmt_recipe->get_result();
    $recipe = $result_recipe->fetch_assoc();
    $stmt_recipe->close();

    if (!$recipe) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Receita não encontrada ou não está disponível.']);
        exit();
    }

    // Verificar se está favoritada
    $is_favorited_by_user = false;
    $stmt_check_fav = $conn->prepare("SELECT recipe_id FROM sf_user_favorite_recipes WHERE user_id = ? AND recipe_id = ?");
    $stmt_check_fav->bind_param("ii", $user_id, $recipe_id);
    $stmt_check_fav->execute();
    if ($stmt_check_fav->get_result()->num_rows > 0) {
        $is_favorited_by_user = true;
    }
    $stmt_check_fav->close();

    // Buscar ingredientes
    $ingredients = [];
    $stmt_ingredients = $conn->prepare("SELECT ingredient_description, quantity_value, quantity_unit FROM sf_recipe_ingredients WHERE recipe_id = ? ORDER BY id ASC");
    $stmt_ingredients->bind_param("i", $recipe_id);
    $stmt_ingredients->execute();
    $result_ingredients = $stmt_ingredients->get_result();
    while($row = $result_ingredients->fetch_assoc()) {
        $ingredient_text = $row['ingredient_description'];
        if (!empty($row['quantity_value']) && !empty($row['quantity_unit'])) {
            $ingredient_text = $row['quantity_value'] . ' ' . $row['quantity_unit'] . ' de ' . $ingredient_text;
        }
        $ingredients[] = $ingredient_text;
    }
    $stmt_ingredients->close();

    // Buscar categorias
    $categories = [];
    $stmt_categories = $conn->prepare("SELECT c.id, c.name FROM sf_categories c JOIN sf_recipe_has_categories rhc ON c.id = rhc.category_id WHERE rhc.recipe_id = ? ORDER BY c.name ASC");
    $stmt_categories->bind_param("i", $recipe_id);
    $stmt_categories->execute();
    $result_categories = $stmt_categories->get_result();
    while($row = $result_categories->fetch_assoc()) {
        $categories[] = $row;
    }
    $stmt_categories->close();

    // Determinar tipo de refeição padrão baseado na hora
    $current_hour = (int)date('G');
    $default_meal_type = 'lunch';
    if ($current_hour >= 5 && $current_hour < 10) $default_meal_type = 'breakfast';
    elseif ($current_hour >= 10 && $current_hour < 12) $default_meal_type = 'morning_snack';
    elseif ($current_hour >= 12 && $current_hour < 15) $default_meal_type = 'lunch';
    elseif ($current_hour >= 15 && $current_hour < 18) $default_meal_type = 'afternoon_snack';
    elseif ($current_hour >= 18 && $current_hour < 21) $default_meal_type = 'dinner';
    else $default_meal_type = 'supper';

    $meal_type_options = [
        'breakfast' => 'Café da Manhã',
        'morning_snack' => 'Lanche da Manhã',
        'lunch' => 'Almoço',
        'afternoon_snack' => 'Lanche da Tarde',
        'dinner' => 'Jantar',
        'supper' => 'Ceia'
    ];

    // Adicionar URL completa da imagem
    if (!empty($recipe['image_filename'])) {
        $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/' . $recipe['image_filename'];
    } else {
        $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/placeholder_food.jpg';
    }
    
    $response['success'] = true;
    $response['data'] = [
        'recipe' => $recipe,
        'ingredients' => $ingredients,
        'categories' => $categories,
        'is_favorited' => $is_favorited_by_user,
        'default_meal_type' => $default_meal_type,
        'meal_type_options' => $meal_type_options,
        'base_url' => BASE_APP_URL
    ];

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = "Erro no servidor: " . $e->getMessage();
    error_log("Erro em get_recipe_data.php para recipe_id {$recipe_id}: " . $e->getMessage());
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
$conn->close();
?>

