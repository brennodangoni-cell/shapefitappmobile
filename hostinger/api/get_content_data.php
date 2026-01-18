<?php
// api/get_content_data.php

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
    error_log("Erro: Conexão com banco de dados não estabelecida em get_content_data.php");
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

function sendJsonResponse($success, $data = null, $message = null, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit();
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
    
    // Buscar conteúdos disponíveis
    $user_contents = [];
    try {
        $check_content_table = $conn->query("SHOW TABLES LIKE 'sf_member_content'");
        if ($check_content_table && $check_content_table->num_rows > 0) {
            $where_conditions = [];
            $params = [];
            $types = '';
            
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
            
            // Verificar se a tabela de arquivos existe
            $check_files_table = $conn->query("SHOW TABLES LIKE 'sf_content_files'");
            $has_files_table = ($check_files_table && $check_files_table->num_rows > 0);
            
            if ($has_files_table) {
                $content_query = "SELECT DISTINCT mc.*, a.full_name as author_name, a.profile_image_filename 
                                  FROM sf_member_content mc 
                                  LEFT JOIN sf_admins a ON mc.admin_id = a.id
                                  INNER JOIN sf_content_files cf ON mc.id = cf.content_id";
                if (!empty($where_conditions)) {
                    $content_query .= " WHERE " . implode(" AND ", $where_conditions);
                } else {
                    $content_query .= " WHERE 1=1";
                }
            } else {
                $content_query = "SELECT mc.*, a.full_name as author_name, a.profile_image_filename 
                                  FROM sf_member_content mc 
                                  LEFT JOIN sf_admins a ON mc.admin_id = a.id";
                if (!empty($where_conditions)) {
                    $content_query .= " WHERE " . implode(" AND ", $where_conditions);
                } else {
                    $content_query .= " WHERE ";
                }
                if (!empty($where_conditions)) {
                    $content_query .= " AND mc.file_path IS NOT NULL AND mc.file_path != ''";
                } else {
                    $content_query .= " mc.file_path IS NOT NULL AND mc.file_path != ''";
                }
            }
            $content_query .= " ORDER BY mc.created_at DESC";
            
            $stmt_content = $conn->prepare($content_query);
            if ($stmt_content) {
                if (!empty($params) && !empty($types)) {
                    $stmt_content->bind_param($types, ...$params);
                }
                $stmt_content->execute();
                $content_result = $stmt_content->get_result();
                while ($row = $content_result->fetch_assoc()) {
                    // Se estamos usando a tabela de arquivos, buscar o primeiro arquivo para thumbnail
                    if ($has_files_table) {
                        $stmt_file = $conn->prepare("SELECT * FROM sf_content_files WHERE content_id = ? ORDER BY display_order ASC, created_at ASC LIMIT 1");
                        $stmt_file->bind_param("i", $row['id']);
                        $stmt_file->execute();
                        $file_result = $stmt_file->get_result();
                        if ($file_row = $file_result->fetch_assoc()) {
                            $row['thumbnail_url'] = $file_row['thumbnail_url'];
                            $row['file_path'] = $file_row['file_path'];
                            $row['mime_type'] = $file_row['mime_type'];
                            if (empty($row['content_type']) && !empty($file_row['mime_type'])) {
                                if (strpos($file_row['mime_type'], 'video/') === 0) {
                                    $row['content_type'] = 'videos';
                                } elseif ($file_row['mime_type'] === 'application/pdf') {
                                    $row['content_type'] = 'pdf';
                                }
                            }
                        }
                        $stmt_file->close();
                    }
                    
                    // Adicionar URL completa para imagens
                    if (!empty($row['profile_image_filename'])) {
                        $row['author_image_url'] = BASE_APP_URL . '/assets/images/users/' . $row['profile_image_filename'];
                    }
                    
                    $user_contents[] = $row;
                }
                $stmt_content->close();
            }
        }
    } catch (Exception $e) {
        error_log("Erro ao buscar conteúdos: " . $e->getMessage());
        $user_contents = [];
    }
    
    sendJsonResponse(true, [
        'contents' => $user_contents
    ]);
    
} catch (Exception $e) {
    $user_id_str = isset($user_id) ? $user_id : 'unknown';
    error_log("Erro em get_content_data.php para user {$user_id_str}: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    sendJsonResponse(false, null, 'Erro ao carregar conteúdos.', 500);
} catch (Error $e) {
    error_log("Erro fatal em get_content_data.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    sendJsonResponse(false, null, 'Erro fatal ao carregar conteúdos.', 500);
}
?>

