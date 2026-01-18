<?php
/**
 * API para servir arquivos de conteúdo com autenticação
 * Garante que apenas usuários autenticados possam baixar arquivos
 */

// Limpar qualquer output buffer ANTES de qualquer output
while (ob_get_level()) {
    ob_end_clean();
}

// Desabilitar exibição de erros para não quebrar o download
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Headers CORS e de resposta
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
    error_log("Erro ao carregar includes em serve_content_file.php: " . $e->getMessage());
    http_response_code(500);
    die('Erro ao inicializar servidor.');
} catch (Error $e) {
    error_log("Erro fatal ao carregar includes em serve_content_file.php: " . $e->getMessage());
    http_response_code(500);
    die('Erro fatal ao inicializar servidor.');
}

// Verificar se a conexão foi estabelecida
if (!$conn || !($conn instanceof mysqli)) {
    error_log("Erro: Conexão com banco de dados não estabelecida em serve_content_file.php");
    http_response_code(500);
    die('Erro de conexão com o banco de dados.');
}

// Verificar autenticação
$user_id = requireLoginWithOptionalToken($conn);

if (!$user_id) {
    http_response_code(401);
    die('Acesso negado. Faça login para acessar este arquivo.');
}

// Obter parâmetros
$file_id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$content_id = isset($_GET['content_id']) ? intval($_GET['content_id']) : 0;

if ($file_id <= 0 && $content_id <= 0) {
    http_response_code(400);
    die('Parâmetros inválidos. Especifique id ou content_id.');
}

try {
    $file_path = null;
    $file_name = null;
    $mime_type = null;
    
    // Tentar buscar da tabela sf_content_files primeiro
    $check_files_table = $conn->query("SHOW TABLES LIKE 'sf_content_files'");
    if ($check_files_table && $check_files_table->num_rows > 0) {
        if ($file_id > 0) {
            // Buscar por ID do arquivo
            $stmt = $conn->prepare("SELECT cf.*, mc.id as content_id FROM sf_content_files cf 
                                    INNER JOIN sf_member_content mc ON cf.content_id = mc.id 
                                    WHERE cf.id = ?");
            $stmt->bind_param("i", $file_id);
        } else {
            // Buscar por content_id (pegar o primeiro arquivo)
            $stmt = $conn->prepare("SELECT cf.*, mc.id as content_id FROM sf_content_files cf 
                                    INNER JOIN sf_member_content mc ON cf.content_id = mc.id 
                                    WHERE cf.content_id = ? 
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
            $mime_type = $file_data['mime_type'] ?? 'application/octet-stream';
            $content_id = $file_data['content_id'];
        }
        $stmt->close();
    }
    
    // Se não encontrou na tabela, tentar buscar do sf_member_content (compatibilidade)
    if (!$file_path && $content_id > 0) {
        $stmt = $conn->prepare("SELECT file_path, file_name, mime_type FROM sf_member_content WHERE id = ?");
        $stmt->bind_param("i", $content_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $content_data = $result->fetch_assoc();
            if (!empty($content_data['file_path'])) {
                $file_path = $content_data['file_path'];
                $file_name = $content_data['file_name'] ?? basename($file_path);
                $mime_type = $content_data['mime_type'] ?? 'application/octet-stream';
            }
        }
        $stmt->close();
    }
    
    if (!$file_path) {
        error_log("serve_content_file.php: file_path não encontrado para file_id={$file_id}, content_id={$content_id}");
        http_response_code(404);
        die('Arquivo não encontrado no banco de dados.');
    }
    
    error_log("serve_content_file.php: file_path encontrado: {$file_path}, file_name: {$file_name}, content_id: {$content_id}");
    
    // Verificar se o usuário tem permissão para acessar este conteúdo
    // (mesma lógica de get_view_content_data.php)
    $has_permission = false;
    
    // Verificar se as colunas existem
    $has_target_type = false;
    $has_target_id = false;
    $has_status = false;
    
    try {
        $check_content_table = $conn->query("SHOW TABLES LIKE 'sf_member_content'");
        if ($check_content_table && $check_content_table->num_rows > 0) {
            $columns_result = $conn->query("SHOW COLUMNS FROM sf_member_content");
            if ($columns_result) {
                while ($column = $columns_result->fetch_assoc()) {
                    if ($column['Field'] === 'target_type') $has_target_type = true;
                    if ($column['Field'] === 'target_id') $has_target_id = true;
                    if ($column['Field'] === 'status') $has_status = true;
                }
            }
        }
    } catch (Exception $e) {
        // Ignorar erro
    }
    
    $where_conditions = [];
    if ($has_status) {
        $where_conditions[] = "mc.status = 'active'";
    }
    $where_conditions[] = "mc.id = ?";
    
    $content_query = "SELECT mc.* FROM sf_member_content mc";
    if (!empty($where_conditions)) {
        $content_query .= " WHERE " . implode(" AND ", $where_conditions);
    }
    
    $stmt_check = $conn->prepare($content_query);
    $stmt_check->bind_param("i", $content_id);
    $stmt_check->execute();
    $content_result = $stmt_check->get_result();
    
    if ($content_result->num_rows > 0) {
        $content = $content_result->fetch_assoc();
        
        // Se não tem target_type, permitir acesso (compatibilidade com versões antigas)
        if (!$has_target_type || empty($content['target_type']) || $content['target_type'] === 'all') {
            $has_permission = true;
        } else {
            // Buscar grupos do usuário
            $user_group_ids = [];
            try {
                $check_table = $conn->query("SHOW TABLES LIKE 'sf_user_group_members'");
                if ($check_table && $check_table->num_rows > 0) {
                    $user_groups_query = "SELECT group_id FROM sf_user_group_members WHERE user_id = ?";
                    $stmt_user_groups = $conn->prepare($user_groups_query);
                    if ($stmt_user_groups) {
                        $stmt_user_groups->bind_param("i", $user_id);
                        $stmt_user_groups->execute();
                        $user_groups_result = $stmt_user_groups->get_result();
                        while ($row = $user_groups_result->fetch_assoc()) {
                            $user_group_ids[] = $row['group_id'];
                        }
                        $stmt_user_groups->close();
                    }
                }
            } catch (Exception $e) {
                $user_group_ids = [];
            }
            
            if ($content['target_type'] === 'user' && $has_target_id && $content['target_id'] == $user_id) {
                $has_permission = true;
            } elseif ($content['target_type'] === 'group' && $has_target_id && in_array($content['target_id'], $user_group_ids)) {
                $has_permission = true;
            }
        }
    }
    $stmt_check->close();
    
    if (!$has_permission) {
        http_response_code(403);
        die('Você não tem permissão para acessar este arquivo.');
    }
    
    // Construir caminho físico do arquivo
    $physical_path = null;
    
    if (preg_match('/^https?:\/\//', $file_path)) {
        // URL externa - redirecionar
        header('Location: ' . $file_path);
        exit;
    }
    
    // Remover barra inicial se existir
    $file_path_clean = ltrim($file_path, '/');
    
    // Lista de caminhos possíveis para tentar
    $possible_paths = [];
    
    // 1. APP_ROOT_PATH + file_path_clean (mais comum)
    $possible_paths[] = APP_ROOT_PATH . '/' . $file_path_clean;
    
    // 2. APP_ROOT_PATH + file_path (se já tiver barra)
    if ($file_path[0] === '/') {
        $possible_paths[] = APP_ROOT_PATH . $file_path;
    }
    
    // 3. DOCUMENT_ROOT + file_path_clean
    if (isset($_SERVER['DOCUMENT_ROOT'])) {
        $possible_paths[] = $_SERVER['DOCUMENT_ROOT'] . '/' . $file_path_clean;
    }
    
    // 4. file_path direto (se for absoluto)
    if (file_exists($file_path) && is_file($file_path)) {
        $possible_paths[] = $file_path;
    }
    
    // 5. __DIR__ (diretório do script) + ../ + file_path_clean
    $possible_paths[] = dirname(__DIR__) . '/' . $file_path_clean;
    
    // Tentar cada caminho
    $found = false;
    foreach ($possible_paths as $path) {
        if (file_exists($path) && is_file($path)) {
            $physical_path = $path;
            $found = true;
            error_log("Arquivo encontrado em: {$physical_path}");
            break;
        }
    }
    
    if (!$found) {
        $debug_info = "Arquivo não encontrado. Caminhos tentados:\n";
        foreach ($possible_paths as $path) {
            $exists = file_exists($path);
            $is_file = $exists ? is_file($path) : false;
            $debug_info .= "  - {$path} (existe: " . ($exists ? 'sim' : 'não') . ", é arquivo: " . ($is_file ? 'sim' : 'não') . ")\n";
            error_log("  - {$path} (existe: " . ($exists ? 'sim' : 'não') . ", é arquivo: " . ($is_file ? 'sim' : 'não') . ")");
        }
        $debug_info .= "file_path original: {$file_path}\n";
        $debug_info .= "APP_ROOT_PATH: " . APP_ROOT_PATH . "\n";
        $debug_info .= "DOCUMENT_ROOT: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'não definido') . "\n";
        $debug_info .= "file_name: {$file_name}\n";
        
        // Verificar se o diretório existe e listar arquivos
        $content_dir = APP_ROOT_PATH . '/assets/content/';
        if (is_dir($content_dir)) {
            $files_in_dir = scandir($content_dir);
            $files_list = array_filter($files_in_dir, function($file) {
                return $file !== '.' && $file !== '..' && is_file(APP_ROOT_PATH . '/assets/content/' . $file);
            });
            $debug_info .= "\nArquivos encontrados no diretório /assets/content/:\n";
            foreach ($files_list as $file) {
                $debug_info .= "  - {$file}\n";
            }
            error_log("Arquivos no diretório: " . implode(', ', $files_list));
        } else {
            $debug_info .= "\nDiretório /assets/content/ não existe!\n";
            error_log("Diretório /assets/content/ não existe!");
        }
        
        error_log($debug_info);
        
        // Em modo de desenvolvimento, retornar informações de debug
        // Em produção, apenas retornar mensagem genérica
        $is_dev = (strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') !== false || 
                   strpos($_SERVER['HTTP_HOST'] ?? '', '127.0.0.1') !== false);
        
        // Última tentativa: verificar se o arquivo pode ser acessado via URL pública
        // Isso pode funcionar se o arquivo existe mas não está no caminho físico esperado
        $public_url = BASE_APP_URL . $file_path;
        $ch = curl_init($public_url);
        curl_setopt($ch, CURLOPT_NOBODY, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($http_code == 200) {
            // Arquivo existe via URL pública, redirecionar
            error_log("Arquivo encontrado via URL pública: {$public_url}");
            header('Location: ' . $public_url);
            exit;
        }
        
        http_response_code(404);
        if ($is_dev) {
            die('Arquivo não encontrado no servidor.\n\n' . $debug_info);
        } else {
            die('Arquivo não encontrado no servidor.');
        }
    }
    
    // Verificar se é um arquivo válido (não diretório)
    if (!is_file($physical_path)) {
        http_response_code(404);
        die('Caminho não é um arquivo válido.');
    }
    
    // Determinar MIME type se não foi especificado
    if (!$mime_type || $mime_type === 'application/octet-stream') {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detected_mime = finfo_file($finfo, $physical_path);
        finfo_close($finfo);
        
        if ($detected_mime) {
            $mime_type = $detected_mime;
        } else {
            // Fallback baseado na extensão
            $ext = strtolower(pathinfo($physical_path, PATHINFO_EXTENSION));
            $mime_types = [
                'pdf' => 'application/pdf',
                'mp4' => 'video/mp4',
                'mov' => 'video/quicktime',
                'avi' => 'video/x-msvideo',
                'webm' => 'video/webm'
            ];
            $mime_type = $mime_types[$ext] ?? 'application/octet-stream';
        }
    }
    
    // Definir nome do arquivo para download
    $download_name = $file_name ?: basename($physical_path);
    
    // Enviar headers apropriados
    header('Content-Type: ' . $mime_type);
    header('Content-Disposition: attachment; filename="' . addslashes($download_name) . '"');
    header('Content-Length: ' . filesize($physical_path));
    header('Cache-Control: private, max-age=3600');
    header('Pragma: private');
    
    // Limpar qualquer output antes de enviar o arquivo
    if (ob_get_level()) {
        ob_end_clean();
    }
    
    // Enviar o arquivo
    readfile($physical_path);
    exit;
    
} catch (Exception $e) {
    error_log("Erro em serve_content_file.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    die('Erro ao servir arquivo.');
} catch (Error $e) {
    error_log("Erro fatal em serve_content_file.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    die('Erro fatal ao servir arquivo.');
}
?>

