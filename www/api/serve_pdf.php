<?php
/**
 * API para servir PDFs com link temporário (sem autenticação no navegador)
 * 
 * Uso:
 * - Com token de autenticação: gera link temporário
 * - Com token temporário: serve o PDF sem autenticação
 */

// Limpar qualquer output buffer
while (ob_get_level()) {
    ob_end_clean();
}

// Headers CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

try {
    require_once '../includes/config.php';
    $conn = require '../includes/db.php';
    require_once '../includes/auth.php';
} catch (Exception $e) {
    error_log("Erro ao carregar includes em serve_pdf.php: " . $e->getMessage());
    http_response_code(500);
    die('Erro ao inicializar servidor.');
}

// Verificar se a conexão foi estabelecida
if (!$conn || !($conn instanceof mysqli)) {
    error_log("Erro: Conexão com banco de dados não estabelecida em serve_pdf.php");
    http_response_code(500);
    die('Erro de conexão com o banco de dados.');
}

// Obter parâmetros
$file_id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$content_id = isset($_GET['content_id']) ? intval($_GET['content_id']) : 0;
$temp_token = isset($_GET['token']) ? $_GET['token'] : null;

// Se tem token temporário, servir o PDF sem autenticação
if ($temp_token) {
    // Validar token temporário
    $stmt = $conn->prepare("SELECT file_path, file_name, mime_type, expires_at FROM sf_pdf_temp_tokens WHERE token = ? AND expires_at > NOW()");
    $stmt->bind_param("s", $temp_token);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(403);
        die('Token inválido ou expirado.');
    }
    
    $token_data = $result->fetch_assoc();
    $file_path = $token_data['file_path'];
    $file_name = $token_data['file_name'];
    $mime_type = $token_data['mime_type'] ?? 'application/pdf';
    
    $stmt->close();
    
    // Servir o arquivo
    serveFile($file_path, $file_name, $mime_type);
    exit;
}

// Se não tem token temporário, precisa estar autenticado para gerar um
$user_id = requireLoginWithOptionalToken($conn);

if (!$user_id) {
    http_response_code(401);
    die('Acesso negado. Faça login para acessar este arquivo.');
}

if ($file_id <= 0 && $content_id <= 0) {
    http_response_code(400);
    die('Parâmetros inválidos. Especifique id ou content_id.');
}

try {
    $file_path = null;
    $file_name = null;
    $mime_type = null;
    
    // Buscar arquivo PDF
    $check_files_table = $conn->query("SHOW TABLES LIKE 'sf_content_files'");
    if ($check_files_table && $check_files_table->num_rows > 0) {
        if ($file_id > 0) {
            $stmt = $conn->prepare("SELECT cf.*, mc.id as content_id FROM sf_content_files cf 
                                    INNER JOIN sf_member_content mc ON cf.content_id = mc.id 
                                    WHERE cf.id = ? AND (cf.mime_type = 'application/pdf' OR cf.file_path LIKE '%.pdf')");
            $stmt->bind_param("i", $file_id);
        } else {
            $stmt = $conn->prepare("SELECT cf.*, mc.id as content_id FROM sf_content_files cf 
                                    INNER JOIN sf_member_content mc ON cf.content_id = mc.id 
                                    WHERE cf.content_id = ? AND (cf.mime_type = 'application/pdf' OR cf.file_path LIKE '%.pdf')
                                    ORDER BY cf.display_order ASC, cf.created_at ASC 
                                    LIMIT 1");
            $stmt->bind_param("i", $content_id);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $file_data = $result->fetch_assoc();
            $file_path = $file_data['file_path'];
            $file_name = $file_data['file_name'] ?? basename($file_path);
            $mime_type = $file_data['mime_type'] ?? 'application/pdf';
            $content_id = $file_data['content_id'];
        }
        $stmt->close();
    }
    
    // Se não encontrou na tabela sf_content_files, tentar sf_member_content
    if (!$file_path && $content_id > 0) {
        $stmt = $conn->prepare("SELECT file_path, file_name, mime_type FROM sf_member_content WHERE id = ? AND (mime_type = 'application/pdf' OR file_path LIKE '%.pdf')");
        $stmt->bind_param("i", $content_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $content_data = $result->fetch_assoc();
            if (!empty($content_data['file_path'])) {
                $file_path = $content_data['file_path'];
                $file_name = $content_data['file_name'] ?? basename($file_path);
                $mime_type = $content_data['mime_type'] ?? 'application/pdf';
            }
        }
        $stmt->close();
    }
    
    if (!$file_path) {
        http_response_code(404);
        die('Arquivo PDF não encontrado.');
    }
    
    // Criar tabela de tokens temporários se não existir
    $conn->query("CREATE TABLE IF NOT EXISTS sf_pdf_temp_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        file_path TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        INDEX idx_token (token),
        INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    // Gerar token temporário (válido por 5 minutos)
    $token = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', time() + 300); // 5 minutos
    
    $stmt = $conn->prepare("INSERT INTO sf_pdf_temp_tokens (token, file_path, file_name, mime_type, user_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssis", $token, $file_path, $file_name, $mime_type, $user_id, $expires_at);
    $stmt->execute();
    $stmt->close();
    
    // Limpar tokens expirados (manutenção)
    $conn->query("DELETE FROM sf_pdf_temp_tokens WHERE expires_at < NOW()");
    
    // Retornar URL temporária
    $base_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://" . $_SERVER['HTTP_HOST'];
    $temp_url = $base_url . '/api/serve_pdf.php?token=' . urlencode($token);
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'temp_url' => $temp_url,
        'expires_in' => 300
    ]);
    
} catch (Exception $e) {
    error_log("Erro em serve_pdf.php: " . $e->getMessage());
    http_response_code(500);
    die('Erro ao processar requisição.');
}

/**
 * Função para servir o arquivo PDF
 */
function serveFile($file_path, $file_name, $mime_type) {
    // Se for URL externa, redirecionar
    if (preg_match('/^https?:\/\//', $file_path)) {
        header('Location: ' . $file_path);
        exit;
    }
    
    // Limpar caminho
    $file_path_clean = ltrim($file_path, '/');
    
    // Possíveis caminhos do arquivo
    $possible_paths = [];
    
    // 1. APP_ROOT_PATH + file_path_clean
    if (defined('APP_ROOT_PATH')) {
        $possible_paths[] = APP_ROOT_PATH . '/' . $file_path_clean;
        if ($file_path[0] === '/') {
            $possible_paths[] = APP_ROOT_PATH . $file_path;
        }
    }
    
    // 2. DOCUMENT_ROOT + file_path_clean
    if (isset($_SERVER['DOCUMENT_ROOT'])) {
        $possible_paths[] = $_SERVER['DOCUMENT_ROOT'] . '/' . $file_path_clean;
    }
    
    // 3. file_path direto (se for absoluto)
    if (file_exists($file_path) && is_file($file_path)) {
        $possible_paths[] = $file_path;
    }
    
    // 4. __DIR__ (diretório do script) + ../ + file_path_clean
    $possible_paths[] = dirname(__DIR__) . '/' . $file_path_clean;
    
    // Tentar encontrar o arquivo
    $actual_path = null;
    foreach ($possible_paths as $path) {
        if (file_exists($path) && is_file($path)) {
            $actual_path = $path;
            break;
        }
    }
    
    if (!$actual_path) {
        error_log("serve_pdf.php: Arquivo não encontrado. file_path: {$file_path}");
        http_response_code(404);
        die('Arquivo não encontrado no servidor.');
    }
    
    // Servir o arquivo
    $fileSize = filesize($actual_path);
    
    header('Content-Type: ' . $mime_type);
    header('Content-Disposition: inline; filename="' . addslashes($file_name) . '"');
    header('Content-Length: ' . $fileSize);
    header('Cache-Control: private, max-age=300'); // Cache por 5 minutos
    header('Pragma: cache');
    
    // Ler e enviar arquivo
    readfile($actual_path);
    exit;
}

