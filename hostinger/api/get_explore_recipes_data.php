<?php
// Arquivo: api/get_explore_recipes_data.php - API para buscar dados da página de explorar receitas

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

// Configuração de timezone
date_default_timezone_set('America/Sao_Paulo');

// Lógica de filtros e busca
$search_query = trim($_GET['q'] ?? '');
$sort_by_param = trim($_GET['sort'] ?? '');
$filter_categories_str = trim($_GET['categories'] ?? '');
$filter_categories = !empty($filter_categories_str) ? explode(',', $filter_categories_str) : [];
$is_filtered_view = !empty($search_query) || !empty($filter_categories) || !empty($sort_by_param);

$response = ['success' => false, 'data' => []];

try {
    // Buscar categorias para filtro
    $all_categories_for_filter = $conn->query("SELECT id, name FROM sf_categories ORDER BY display_order ASC, name ASC")->fetch_all(MYSQLI_ASSOC);
    $active_filter_names = [];

    if ($is_filtered_view) {
        // Construir nomes dos filtros ativos
        if (!empty($filter_categories)) {
            $category_map = array_column($all_categories_for_filter, 'name', 'id');
            foreach ($filter_categories as $cat_id) {
                if (isset($category_map[$cat_id])) {
                    $active_filter_names[] = $category_map[$cat_id];
                }
            }
        }
        if (!empty($search_query)) {
            $active_filter_names[] = '"' . htmlspecialchars($search_query) . '"';
        }
        
        // Construir query SQL
        $sort_by = $sort_by_param ?: 'name_asc';
        $recipes = [];
        $sql_base = "SELECT DISTINCT r.id, r.name, r.image_filename, r.kcal_per_serving, r.description, r.prep_time_minutes, r.cook_time_minutes, r.protein_g_per_serving, r.servings FROM sf_recipes r";
        $sql_joins = "";
        $sql_conditions = ["r.is_public = 1"];
        $params = [];
        $types = "";
        
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
            $sql_conditions[] = "(r.name LIKE ? OR r.description LIKE ?)";
            $params[] = "%" . $search_query . "%";
            $params[] = "%" . $search_query . "%";
            $types .= "ss";
        }
        
        $sql_query = $sql_base . $sql_joins . " WHERE " . implode(" AND ", $sql_conditions);
        
        if (count($filter_categories) > 1) {
            $sql_query .= " GROUP BY r.id HAVING COUNT(DISTINCT rhc.category_id) = " . count($filter_categories);
        }
        
        // Ordenação
        $order_by_clause = " ORDER BY ";
        switch ($sort_by) {
            case 'kcal_asc':
                $order_by_clause .= "r.kcal_per_serving ASC, r.name ASC";
                break;
            case 'protein_desc':
                $order_by_clause .= "r.protein_g_per_serving DESC, r.name ASC";
                break;
            case 'time_asc':
                $order_by_clause .= "(r.prep_time_minutes + r.cook_time_minutes) ASC, r.name ASC";
                break;
            default:
                $order_by_clause .= "r.name ASC";
                break;
        }
        $sql_query .= $order_by_clause;
        
        $stmt = $conn->prepare($sql_query);
        if ($stmt) {
            if (!empty($params)) {
                $stmt->bind_param($types, ...$params);
            }
            $stmt->execute();
            $recipes = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
        }
        
        // Adicionar URLs completas das imagens para cada receita
        foreach ($recipes as &$recipe) {
            if (!empty($recipe['image_filename'])) {
                $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/' . $recipe['image_filename'];
            } else {
                $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/placeholder_food.jpg';
            }
        }
        unset($recipe);
        
        $response['success'] = true;
        $response['data'] = [
            'is_filtered_view' => true,
            'recipes' => $recipes,
            'active_filter_names' => $active_filter_names,
            'search_query' => $search_query,
            'sort_by' => $sort_by,
            'filter_categories' => $filter_categories,
            'all_categories' => $all_categories_for_filter,
            'base_url' => BASE_APP_URL
        ];
    } else {
        // Modo carrossel - buscar receitas por categoria
        $sections_with_recipes = [];
        foreach ($all_categories_for_filter as $category) {
            $stmt = $conn->prepare("SELECT r.id, r.name, r.image_filename, r.kcal_per_serving FROM sf_recipes r JOIN sf_recipe_has_categories rhc ON r.id = rhc.recipe_id WHERE r.is_public = 1 AND rhc.category_id = ? ORDER BY RAND() LIMIT 6");
            $stmt->bind_param("i", $category['id']);
            $stmt->execute();
            $recipes_in_section = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
            
            // Adicionar URLs completas das imagens para cada receita
            foreach ($recipes_in_section as &$recipe) {
                if (!empty($recipe['image_filename'])) {
                    $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/' . $recipe['image_filename'];
                } else {
                    $recipe['image_url'] = BASE_APP_URL . '/assets/images/recipes/placeholder_food.jpg';
                }
            }
            unset($recipe);
            
            if (!empty($recipes_in_section)) {
                $sections_with_recipes[] = [
                    'title' => $category['name'],
                    'recipes' => $recipes_in_section,
                    'link_params' => http_build_query(['categories' => $category['id']])
                ];
            }
        }
        
        $response['success'] = true;
        $response['data'] = [
            'is_filtered_view' => false,
            'sections' => $sections_with_recipes,
            'all_categories' => $all_categories_for_filter,
            'base_url' => BASE_APP_URL
        ];
    }

} catch (Exception $e) {
    http_response_code(500);
    $response['message'] = "Erro no servidor: " . $e->getMessage();
    error_log("Erro em get_explore_recipes_data.php: " . $e->getMessage());
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
$conn->close();
?>

