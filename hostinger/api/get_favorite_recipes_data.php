<?php
// api/get_favorite_recipes_data.php - API para buscar receitas favoritas

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

// Autenticação via sessão ou token
$user = requireLoginWithOptionalToken($conn);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

$user_id = $user['id'];

// Parâmetros de filtro
$search_query = trim($_GET['q'] ?? '');
$sort_by_param = trim($_GET['sort'] ?? '');
$filter_categories_str = trim($_GET['categories'] ?? '');
$filter_categories = !empty($filter_categories_str) ? explode(',', $filter_categories_str) : [];

$response = ['success' => false, 'data' => []];

try {
    // Buscar todas as categorias para filtro
    $all_categories_for_filter = $conn->query("SELECT id, name FROM sf_categories ORDER BY display_order ASC, name ASC")->fetch_all(MYSQLI_ASSOC);
    
    // Query base
    $sql_base = "
        SELECT DISTINCT r.id, r.name, r.image_filename, r.kcal_per_serving, 
        r.prep_time_minutes, r.cook_time_minutes, r.protein_g_per_serving
        FROM sf_recipes r
        JOIN sf_user_favorite_recipes f ON r.id = f.recipe_id
    ";
    $sql_joins = "";
    $sql_conditions = ["f.user_id = ?"];
    $params = [$user_id];
    $types = "i";
    
    // Filtros
    if (!empty($filter_categories)) {
        $sql_joins .= " JOIN sf_recipe_has_categories rhc ON r.id = rhc.recipe_id";
        $placeholders = implode(',', array_fill(0, count($filter_categories), '?'));
        $sql_conditions[] = "rhc.category_id IN ($placeholders)";
        foreach ($filter_categories as $cat_id) { 
            $params[] = (int)$cat_id; 
        }
        $types .= str_repeat('i', count($filter_categories));
    }
    if (!empty($search_query)) {
        $sql_conditions[] = "(r.name LIKE ?)";
        $params[] = "%" . $search_query . "%";
        $types .= "s";
    }
    
    $sql_query = $sql_base . $sql_joins . " WHERE " . implode(" AND ", $sql_conditions);
    
    if (count($filter_categories) > 1) {
        $sql_query .= " GROUP BY r.id HAVING COUNT(DISTINCT rhc.category_id) = " . count($filter_categories);
    }
    
    // Ordenação
    $sort_by = $sort_by_param ?: 'favorited_at_desc';
    $order_by_clause = " ORDER BY ";
    switch ($sort_by) {
        case 'kcal_asc': $order_by_clause .= "r.kcal_per_serving ASC, r.name ASC"; break;
        case 'protein_desc': $order_by_clause .= "r.protein_g_per_serving DESC, r.name ASC"; break;
        case 'time_asc': $order_by_clause .= "(r.prep_time_minutes + r.cook_time_minutes) ASC, r.name ASC"; break;
        case 'name_asc': $order_by_clause .= "r.name ASC"; break;
        default: $order_by_clause .= "f.favorited_at DESC"; break;
    }
    $sql_query .= $order_by_clause;
    
    // Executar query
    $favorite_recipes = [];
    $stmt = $conn->prepare($sql_query);
    if ($stmt) {
        if (!empty($params)) { 
            $stmt->bind_param($types, ...$params); 
        }
        $stmt->execute();
        $result = $stmt->get_result();
        while ($recipe = $result->fetch_assoc()) {
            $favorite_recipes[] = $recipe;
        }
        $stmt->close();
    }
    
    // Adicionar URLs completas das imagens para cada receita
    foreach ($favorite_recipes as &$recipe) {
        if (!empty($recipe['image_filename'])) {
            $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/' . $recipe['image_filename'];
        } else {
            $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/placeholder_food.jpg';
        }
    }
    unset($recipe);

    $response['success'] = true;
    $response['data'] = [
        'recipes' => $favorite_recipes,
        'all_categories' => $all_categories_for_filter,
        'base_url' => BASE_APP_URL
    ];

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = "Erro no servidor: " . $e->getMessage();
    error_log("Erro em get_favorite_recipes_data.php para user_id {$user_id}: " . $e->getMessage());
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
$conn->close();
?>

