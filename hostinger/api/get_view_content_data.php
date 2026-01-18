<?php
// api/get_view_content_data.php

// Limpar qualquer output buffer ANTES de qualquer output
while (ob_get_level()) {
    ob_end_clean();
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Desabilitar exibição de erros para não quebrar o JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../includes/config.php';
$conn = require '../includes/db.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

// Verificar se a conexão foi estabelecida
if (!$conn || !($conn instanceof mysqli)) {
    error_log("Erro: Conexão com banco de dados não estabelecida em get_view_content_data.php");
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro de conexão com o banco de dados.']);
    exit();
}

// Autenticação
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
$token = $auth_header ? str_replace('Bearer ', '', $auth_header) : null;

$user = getUserByAuthToken($conn, $token);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Token inválido ou expirado.']);
    exit();
}

$user_id = $user['id'];
$content_id = (int)($_GET['id'] ?? 0);

function sendJsonResponse($success, $data = null, $message = null, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($content_id <= 0) {
    sendJsonResponse(false, null, 'ID do conteúdo inválido.', 400);
}

try {
    // Verificar se usuário completou onboarding
    $user_profile_data = getUserProfileData($conn, $user_id);
    if (!$user_profile_data || !$user_profile_data['onboarding_complete']) {
        sendJsonResponse(false, null, 'Onboarding não completo.', 403);
    }
    
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
    
    // Verificar se as colunas existem
    $has_target_type = false;
    $has_target_id = false;
    $has_status = false;
    
    try {
        $check_content_table = $conn->query("SHOW TABLES LIKE 'sf_member_content'");
        if ($check_content_table && $check_content_table->num_rows > 0) {
            $check_target_type = $conn->query("SHOW COLUMNS FROM sf_member_content LIKE 'target_type'");
            if ($check_target_type && $check_target_type->num_rows > 0) {
                $has_target_type = true;
            }
            $check_target_id = $conn->query("SHOW COLUMNS FROM sf_member_content LIKE 'target_id'");
            if ($check_target_id && $check_target_id->num_rows > 0) {
                $has_target_id = true;
            }
            $check_status = $conn->query("SHOW COLUMNS FROM sf_member_content LIKE 'status'");
            if ($check_status && $check_status->num_rows > 0) {
                $has_status = true;
            }
        }
    } catch (Exception $e) {
        // Ignorar
    }
    
    // Buscar conteúdo
    $content = null;
    try {
        $check_content_table = $conn->query("SHOW TABLES LIKE 'sf_member_content'");
        if ($check_content_table && $check_content_table->num_rows > 0) {
            $where_conditions = ["mc.id = ?"];
            $params = [$content_id];
            $types = 'i';
            
            // Status
            if ($has_status) {
                $where_conditions[] = "mc.status = 'active'";
            } else {
                $check_is_active = $conn->query("SHOW COLUMNS FROM sf_member_content LIKE 'is_active'");
                if ($check_is_active && $check_is_active->num_rows > 0) {
                    $where_conditions[] = "mc.is_active = 1";
                }
            }
            
            // Target type e target_id
            if ($has_target_type && $has_target_id) {
                $target_conditions = ["mc.target_type = 'all'"];
                if (!empty($user_group_ids)) {
                    $placeholders = implode(',', array_fill(0, count($user_group_ids), '?'));
                    $target_conditions[] = "(mc.target_type = 'user' AND mc.target_id = ?)";
                    $target_conditions[] = "(mc.target_type = 'group' AND mc.target_id IN ($placeholders))";
                    $params = array_merge($params, [$user_id], $user_group_ids);
                    $types .= str_repeat('i', count($user_group_ids) + 1);
                } else {
                    $target_conditions[] = "(mc.target_type = 'user' AND mc.target_id = ?)";
                    $params[] = $user_id;
                    $types .= 'i';
                }
                $where_conditions[] = "(" . implode(" OR ", $target_conditions) . ")";
            }
            
            $content_query = "SELECT mc.* FROM sf_member_content mc";
            if (!empty($where_conditions)) {
                $content_query .= " WHERE " . implode(" AND ", $where_conditions);
            }
            
            $stmt_content = $conn->prepare($content_query);
            if ($stmt_content) {
                if (!empty($params) && !empty($types)) {
                    $stmt_content->bind_param($types, ...$params);
                }
                $stmt_content->execute();
                $content_result = $stmt_content->get_result();
                if ($content_result->num_rows > 0) {
                    $content = $content_result->fetch_assoc();
                }
                $stmt_content->close();
            }
        }
    } catch (Exception $e) {
        error_log("Erro ao buscar conteúdo: " . $e->getMessage());
    }
    
    if (!$content) {
        sendJsonResponse(false, null, 'Conteúdo não encontrado ou sem permissão.', 404);
    }
    
    // Buscar arquivos da tabela sf_content_files se existir
    $content_files = [];
    try {
        $check_files_table = $conn->query("SHOW TABLES LIKE 'sf_content_files'");
        if ($check_files_table && $check_files_table->num_rows > 0) {
            // Buscar todos os arquivos
            $stmt_files = $conn->prepare("SELECT * FROM sf_content_files WHERE content_id = ? ORDER BY display_order ASC, created_at ASC");
            $stmt_files->bind_param("i", $content_id);
            $stmt_files->execute();
            $files_result = $stmt_files->get_result();
            $all_files = [];
            while ($file_row = $files_result->fetch_assoc()) {
                $all_files[] = $file_row;
            }
            $stmt_files->close();
            
            // Separar vídeos e PDFs, ordenando: vídeos primeiro, PDFs por último
            $videos = [];
            $pdfs = [];
            foreach ($all_files as $file) {
                $is_pdf = false;
                if (!empty($file['mime_type'])) {
                    $is_pdf = $file['mime_type'] === 'application/pdf';
                } else {
                    $ext = strtolower(pathinfo($file['file_path'], PATHINFO_EXTENSION));
                    $is_pdf = $ext === 'pdf';
                }
                
                if ($is_pdf) {
                    $pdfs[] = $file;
                } else {
                    $videos[] = $file;
                }
            }
            
            // Combinar: vídeos primeiro, depois PDFs
            $content_files = array_merge($videos, $pdfs);
        }
        
        // Se não há arquivos na tabela, usar campos antigos do sf_member_content (compatibilidade)
        if (empty($content_files)) {
            if (!empty($content['file_path'])) {
                $content_files[] = [
                    'id' => null,
                    'file_path' => $content['file_path'],
                    'file_name' => $content['file_name'] ?? null,
                    'file_size' => $content['file_size'] ?? null,
                    'mime_type' => $content['mime_type'] ?? null,
                    'thumbnail_url' => $content['thumbnail_url'] ?? null,
                    'video_title' => $content['video_title'] ?? null,
                    'display_order' => 0
                ];
            }
        }
    } catch (Exception $e) {
        // Erro ao buscar arquivos - usar método antigo
        if (!empty($content['file_path'])) {
            $content_files[] = [
                'id' => null,
                'file_path' => $content['file_path'],
                'file_name' => $content['file_name'] ?? null,
                'mime_type' => $content['mime_type'] ?? null,
                'thumbnail_url' => $content['thumbnail_url'] ?? null,
                'video_title' => $content['video_title'] ?? null,
            ];
        }
    }
    
    // Construir URLs completas para todos os arquivos
    // Usar endpoint de download autenticado ao invés de acesso direto
    foreach ($content_files as &$file) {
        if (!empty($file['file_path'])) {
            $file_path_raw = $file['file_path'];
            
            // Se já começa com http:// ou https:// e NÃO é do nosso domínio, usar como file_url (URL externa)
            if (preg_match('/^https?:\/\//', $file_path_raw)) {
                // Verificar se é URL externa (não do nosso domínio)
                $is_external = !preg_match('/^https?:\/\/' . preg_quote(parse_url(BASE_APP_URL, PHP_URL_HOST), '/') . '/', $file_path_raw);
                if ($is_external) {
                    $file['file_url'] = $file_path_raw;
                } else {
                    // É URL do nosso domínio, mas queremos usar o endpoint
                    // Extrair o caminho relativo se possível, ou usar content_id
                    if (!empty($file['id'])) {
                        $file['file_url'] = BASE_APP_URL . '/api/serve_content_file.php?id=' . intval($file['id']);
                    } else {
                        $file['file_url'] = BASE_APP_URL . '/api/serve_content_file.php?content_id=' . intval($content_id);
                    }
                }
            } else {
                // Caminho relativo - usar endpoint de download autenticado
                if (!empty($file['id'])) {
                    // Arquivo da tabela sf_content_files - usar ID do arquivo
                    $file['file_url'] = BASE_APP_URL . '/api/serve_content_file.php?id=' . intval($file['id']);
                } else {
                    // Arquivo do sf_member_content - usar content_id
                    $file['file_url'] = BASE_APP_URL . '/api/serve_content_file.php?content_id=' . intval($content_id);
                }
            }
        }
        
        // Construir URL completa para thumbnail se existir
        if (!empty($file['thumbnail_url'])) {
            if (!preg_match('/^https?:\/\//', $file['thumbnail_url'])) {
                $thumb_path = $file['thumbnail_url'];
                if (!preg_match('/^\//', $thumb_path)) {
                    $thumb_path = '/' . $thumb_path;
                }
                $file['thumbnail_url'] = BASE_APP_URL . $thumb_path;
            }
        }
    }
    unset($file); // Liberar referência
    
    sendJsonResponse(true, [
        'content' => $content,
        'files' => $content_files
    ]);
    
} catch (Exception $e) {
    $user_id_str = isset($user_id) ? $user_id : 'unknown';
    error_log("Erro em get_view_content_data.php para user {$user_id_str}: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    sendJsonResponse(false, null, 'Erro ao carregar conteúdo.', 500);
} catch (Error $e) {
    error_log("Erro fatal em get_view_content_data.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    sendJsonResponse(false, null, 'Erro fatal ao carregar conteúdo.', 500);
}
?>

