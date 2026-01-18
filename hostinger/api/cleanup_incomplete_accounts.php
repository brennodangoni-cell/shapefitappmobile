<?php
// api/cleanup_incomplete_accounts.php - Limpa contas incompletas antigas (não completaram onboarding em 7 dias)

require_once '../includes/config.php';
require_once '../includes/db.php';

// Executar limpeza apenas se for chamado via cron ou manualmente com chave de segurança
$cleanup_key = $_GET['key'] ?? '';
$expected_key = 'cleanup_' . md5('shapefit_cleanup_2024');

if ($cleanup_key !== $expected_key) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acesso negado.']);
    exit();
}

$conn->begin_transaction();

try {
    // Buscar contas incompletas criadas há mais de 7 dias
    $cutoff_date = date('Y-m-d H:i:s', strtotime('-7 days'));
    
    $stmt_find_incomplete = $conn->prepare("
        SELECT id, email, name 
        FROM sf_users 
        WHERE onboarding_complete = FALSE 
        AND created_at < ? 
        AND created_at IS NOT NULL
    ");
    
    if (!$stmt_find_incomplete) {
        throw new Exception("Erro ao preparar consulta: " . $conn->error);
    }
    
    $stmt_find_incomplete->bind_param("s", $cutoff_date);
    $stmt_find_incomplete->execute();
    $result = $stmt_find_incomplete->get_result();
    
    $deleted_users = [];
    $deleted_count = 0;
    
    while ($user = $result->fetch_assoc()) {
        $user_id = $user['id'];
        
        // Deletar dados relacionados (em ordem de dependência)
        $tables_to_clean = [
            'sf_user_meal_log',
            'sf_user_daily_tracking',
            'sf_user_weight_history',
            'sf_user_measurements',
            'sf_user_exercise_durations',
            'sf_user_routine_log',
            'sf_user_points_log',
            'sf_user_routine_items',
            'sf_user_goals',
            'sf_user_favorites',
            'sf_user_favorite_recipes',
            'sf_user_selected_restrictions',
            'sf_user_challenge_members',
            'sf_user_group_members',
            'sf_user_certificates',
            'sf_user_module_progress',
            'sf_user_onboarding_completion',
            'sf_user_profiles'
        ];
        
        foreach ($tables_to_clean as $table) {
            $stmt_delete = $conn->prepare("DELETE FROM {$table} WHERE user_id = ?");
            if ($stmt_delete) {
                $stmt_delete->bind_param("i", $user_id);
                $stmt_delete->execute();
                $stmt_delete->close();
            }
        }
        
        // Deletar o usuário
        $stmt_delete_user = $conn->prepare("DELETE FROM sf_users WHERE id = ?");
        $stmt_delete_user->bind_param("i", $user_id);
        $stmt_delete_user->execute();
        $stmt_delete_user->close();
        
        $deleted_users[] = ['id' => $user_id, 'email' => $user['email'], 'name' => $user['name']];
        $deleted_count++;
    }
    
    $stmt_find_incomplete->close();
    
    $conn->commit();
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => "Limpeza concluída. {$deleted_count} conta(s) incompleta(s) removida(s).",
        'deleted_count' => $deleted_count,
        'deleted_users' => $deleted_users
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("Erro ao limpar contas incompletas: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao limpar contas incompletas.']);
}
?>

