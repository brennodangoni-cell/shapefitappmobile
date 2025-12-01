<?php
/**
 * API para solicitar recuperação de senha
 * Gera token seguro e envia email com link de recuperação
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
    
    if (!isset($input['email']) || empty($input['email'])) {
        http_response_code(400);
        $response['message'] = 'Email é obrigatório';
        echo json_encode($response);
        exit;
    }
    
    $email = filter_var(trim($input['email']), FILTER_SANITIZE_EMAIL);
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        $response['message'] = 'Email inválido';
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
    
    // Verificar se o email existe
    $stmt = $conn->prepare("SELECT id, name, email FROM {$user_table} WHERE email = ? LIMIT 1");
    if (!$stmt) {
        throw new Exception('Erro ao preparar query: ' . $conn->error);
    }
    
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Sempre retornar sucesso (não revelar se email existe ou não por segurança)
    if (!$user) {
        // Email não existe, mas retornamos sucesso por segurança
        http_response_code(200);
        $response['success'] = true;
        $response['message'] = 'Se o email existir, você receberá um link de recuperação em breve.';
        echo json_encode($response);
        exit;
    }
    
    // Gerar token seguro
    $token = bin2hex(random_bytes(32)); // 64 caracteres hexadecimais
    $expires_at = date('Y-m-d H:i:s', strtotime('+1 hour')); // Válido por 1 hora
    
    // Criar tabela de password_resets se não existir
    $create_table_sql = "
    CREATE TABLE IF NOT EXISTS sf_password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(128) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_email (email),
        INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    
    if (!$conn->query($create_table_sql)) {
        error_log("Erro ao criar tabela sf_password_resets: " . $conn->error);
    }
    
    // Invalidar tokens anteriores do mesmo usuário
    $stmt = $conn->prepare("UPDATE sf_password_resets SET used = 1 WHERE user_id = ? AND used = 0");
    if ($stmt) {
        $stmt->bind_param("i", $user['id']);
        $stmt->execute();
        $stmt->close();
    }
    
    // Limpar tokens expirados (manutenção)
    $conn->query("DELETE FROM sf_password_resets WHERE expires_at < NOW() OR (used = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY))");
    
    // Inserir novo token
    $stmt = $conn->prepare("INSERT INTO sf_password_resets (user_id, email, token, expires_at) VALUES (?, ?, ?, ?)");
    if (!$stmt) {
        throw new Exception('Erro ao preparar inserção: ' . $conn->error);
    }
    
    $stmt->bind_param("isss", $user['id'], $email, $token, $expires_at);
    
    if (!$stmt->execute()) {
        $stmt->close();
        throw new Exception('Erro ao salvar token: ' . $conn->error);
    }
    
    $stmt->close();
    
    // Construir URL de recuperação (página standalone)
    $base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'];
    $reset_url = $base_url . '/auth/reset_password.html?token=' . urlencode($token);
    
    // Enviar email
    $email_sent = sendPasswordResetEmail($user['email'], $user['name'], $reset_url);
    
    // Log detalhado do envio
    $log_message = "Tentativa de envio de email para: {$email} | User ID: {$user['id']} | Token: " . substr($token, 0, 10) . "...";
    error_log($log_message);
    
    if ($email_sent) {
        error_log("Email enviado com SUCESSO para: {$email}");
        http_response_code(200);
        $response['success'] = true;
        $response['message'] = 'Email enviado com sucesso! Verifique sua caixa de entrada e a pasta de spam.';
    } else {
        error_log("ERRO ao enviar email para: {$email} | Verifique configuração do servidor");
        // Ainda retornamos sucesso para não revelar problema de segurança
        $response['success'] = true;
        $response['message'] = 'Se o email existir, você receberá um link de recuperação em breve. Verifique também a pasta de spam.';
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Erro em forgot_password.php: " . $e->getMessage());
    http_response_code(500);
    $response['message'] = 'Erro ao processar solicitação. Tente novamente.';
    echo json_encode($response);
}

/**
 * Função para enviar email de recuperação de senha
 */
function sendPasswordResetEmail($to_email, $user_name, $reset_url) {
    $subject = 'Recuperar Senha - ShapeFIT';
    
    // Nome do usuário ou fallback
    $display_name = !empty($user_name) ? $user_name : 'Usuário';
    
    // HTML do email com design bonito
    $html_content = '
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperar Senha - ShapeFIT</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <!-- Header com gradiente -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #FFAE00 0%, #F83600 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">ShapeFIT</h1>
                        </td>
                    </tr>
                    
                    <!-- Conteúdo -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">Olá, ' . htmlspecialchars($display_name) . '!</h2>
                            
                            <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                                Recebemos uma solicitação para redefinir a senha da sua conta ShapeFIT.
                            </p>
                            
                            <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                                Clique no botão abaixo para criar uma nova senha:
                            </p>
                            
                            <!-- Botão -->
                            <table role="presentation" style="margin: 0 auto 30px;">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #FFAE00 0%, #F83600 100%); border-radius: 12px; padding: 0;">
                                        <a href="' . htmlspecialchars($reset_url) . '" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">Redefinir Senha</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Link alternativo -->
                            <p style="margin: 0 0 20px 0; color: #999999; font-size: 14px; line-height: 1.6;">
                                Ou copie e cole este link no seu navegador:
                            </p>
                            <p style="margin: 0 0 30px 0; word-break: break-all;">
                                <a href="' . htmlspecialchars($reset_url) . '" style="color: #FF6B00; text-decoration: none; font-size: 14px;">' . htmlspecialchars($reset_url) . '</a>
                            </p>
                            
                            <!-- Aviso -->
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 30px;">
                                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                    <strong>Importante:</strong> Este link é válido por apenas <strong>1 hora</strong>. Se você não solicitou esta recuperação, ignore este email.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px;">
                                Este é um email automático, por favor não responda.
                            </p>
                            <p style="margin: 0; color: #999999; font-size: 12px;">
                                © ' . date('Y') . ' ShapeFIT. Todos os direitos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    ';
    
    // Versão texto simples
    $text_content = "Olá, {$display_name}!\n\n";
    $text_content .= "Recebemos uma solicitação para redefinir a senha da sua conta ShapeFIT.\n\n";
    $text_content .= "Acesse este link para criar uma nova senha:\n";
    $text_content .= $reset_url . "\n\n";
    $text_content .= "Este link é válido por apenas 1 hora.\n\n";
    $text_content .= "Se você não solicitou esta recuperação, ignore este email.\n\n";
    $text_content .= "© " . date('Y') . " ShapeFIT. Todos os direitos reservados.";
    
    // Headers do email
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: ShapeFIT <noreply@appshapefit.com>\r\n";
    $headers .= "Reply-To: ShapeFIT <noreply@appshapefit.com>\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();
    $headers .= "\r\n";
    
    // Tentar enviar email
    $mail_result = @mail($to_email, $subject, $html_content, $headers);
    
    // Log detalhado
    if ($mail_result) {
        error_log("mail() retornou TRUE para: {$to_email}");
    } else {
        $last_error = error_get_last();
        error_log("mail() retornou FALSE para: {$to_email} | Erro: " . ($last_error ? $last_error['message'] : 'Desconhecido'));
    }
    
    // Verificar se função mail() está disponível
    if (!function_exists('mail')) {
        error_log("ERRO CRÍTICO: Função mail() não está disponível no PHP!");
        return false;
    }
    
    return $mail_result;
}

