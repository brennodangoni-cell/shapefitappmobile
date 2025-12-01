<?php
/**
 * API para redefinir senha usando token
 * Valida token e atualiza senha do usuário
 */

// Headers CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Limpar output buffer
while (ob_get_level()) {
    ob_end_clean();
}

// Resposta padrão
$response = ['success' => false, 'message' => ''];

try {
    // Carregar includes
    require_once '../includes/config.php';
    $conn = require '../includes/db.php';
    
    if (!$conn || !($conn instanceof mysqli)) {
        throw new Exception('Erro de conexão com o banco de dados');
    }
    
    // Obter dados da requisição
    $raw_input = file_get_contents('php://input');
    $input = json_decode($raw_input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON inválido');
    }
    
    // Validar campos obrigatórios
    if (!isset($input['token']) || empty($input['token'])) {
        http_response_code(400);
        $response['message'] = 'Token é obrigatório';
        echo json_encode($response);
        exit;
    }
    
    if (!isset($input['password']) || empty($input['password'])) {
        http_response_code(400);
        $response['message'] = 'Nova senha é obrigatória';
        echo json_encode($response);
        exit;
    }
    
    $token = trim($input['token']);
    $password = $input['password'];
    
    // Validar tamanho mínimo da senha
    if (strlen($password) < 6) {
        http_response_code(400);
        $response['message'] = 'A senha deve ter no mínimo 6 caracteres';
        echo json_encode($response);
        exit;
    }
    
    // Verificar se a tabela de password_resets existe
    $check_table = $conn->query("SHOW TABLES LIKE 'sf_password_resets'");
    if (!$check_table || $check_table->num_rows == 0) {
        throw new Exception('Sistema de recuperação não configurado');
    }
    
    // Buscar token válido
    $stmt = $conn->prepare("
        SELECT pr.id, pr.user_id, pr.email, pr.expires_at, pr.used
        FROM sf_password_resets pr
        WHERE pr.token = ? 
        AND pr.used = 0 
        AND pr.expires_at > NOW()
        LIMIT 1
    ");
    
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . $conn->error);
    }
    
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    $reset_request = $result->fetch_assoc();
    $stmt->close();
    
    if (!$reset_request) {
        http_response_code(400);
        $response['message'] = 'Token inválido ou expirado. Solicite um novo link de recuperação.';
        echo json_encode($response);
        exit;
    }
    
    // Descobrir nome da tabela de usuários
    $user_table = null;
    $possible_tables = ['sf_users', 'users', 'shapefit_users', 'app_users'];
    foreach ($possible_tables as $table) {
        $check = $conn->query("SHOW TABLES LIKE '{$table}'");
        if ($check && $check->num_rows > 0) {
            $user_table = $table;
            break;
        }
    }
    
    if (!$user_table) {
        throw new Exception('Tabela de usuários não encontrada');
    }
    
    // Verificar se a coluna de senha existe e qual é o nome
    $password_column = null;
    $possible_columns = ['password', 'senha', 'user_password', 'pwd'];
    foreach ($possible_columns as $col) {
        $check_col = $conn->query("SHOW COLUMNS FROM {$user_table} LIKE '{$col}'");
        if ($check_col && $check_col->num_rows > 0) {
            $password_column = $col;
            break;
        }
    }
    
    if (!$password_column) {
        // Tentar descobrir pelo DESCRIBE
        $describe_result = $conn->query("DESCRIBE {$user_table}");
        while ($row = $describe_result->fetch_assoc()) {
            if (stripos($row['Field'], 'pass') !== false) {
                $password_column = $row['Field'];
                break;
            }
        }
    }
    
    if (!$password_column) {
        throw new Exception('Coluna de senha não encontrada na tabela de usuários');
    }
    
    // Hash da nova senha
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    
    if (!$password_hash) {
        throw new Exception('Erro ao criptografar senha');
    }
    
    // Iniciar transação
    $conn->autocommit(false);
    
    try {
        // Atualizar senha do usuário
        $stmt = $conn->prepare("UPDATE {$user_table} SET {$password_column} = ? WHERE id = ?");
        if (!$stmt) {
            throw new Exception('Erro ao preparar atualização: ' . $conn->error);
        }
        
        $stmt->bind_param("si", $password_hash, $reset_request['user_id']);
        
        if (!$stmt->execute()) {
            $stmt->close();
            throw new Exception('Erro ao atualizar senha: ' . $conn->error);
        }
        
        $affected_rows = $stmt->affected_rows;
        $stmt->close();
        
        if ($affected_rows == 0) {
            throw new Exception('Usuário não encontrado');
        }
        
        // Marcar token como usado
        $stmt = $conn->prepare("UPDATE sf_password_resets SET used = 1 WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $reset_request['id']);
            $stmt->execute();
            $stmt->close();
        }
        
        // Invalidar todos os outros tokens ativos deste usuário
        $stmt = $conn->prepare("UPDATE sf_password_resets SET used = 1 WHERE user_id = ? AND used = 0 AND id != ?");
        if ($stmt) {
            $stmt->bind_param("ii", $reset_request['user_id'], $reset_request['id']);
            $stmt->execute();
            $stmt->close();
        }
        
        // Confirmar transação
        $conn->commit();
        
        // Sucesso
        http_response_code(200);
        $response['success'] = true;
        $response['message'] = 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.';
        
    } catch (Exception $e) {
        // Reverter transação em caso de erro
        $conn->rollback();
        throw $e;
    } finally {
        $conn->autocommit(true);
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Erro em reset_password.php: " . $e->getMessage());
    http_response_code(500);
    $response['message'] = 'Erro ao redefinir senha. Tente novamente.';
    echo json_encode($response);
}

