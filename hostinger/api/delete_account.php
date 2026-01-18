<?php
/**
 * API para deletar conta do usuário permanentemente
 * Deleta todos os dados relacionados ao usuário
 * 
 * Requisitos da Apple:
 * - Deve deletar permanentemente (não apenas desativar)
 * - Deve remover todos os dados do usuário
 * - Deve funcionar diretamente no app (sem necessidade de website)
 */

// Ativar log de erros
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Criar pasta de logs se não existir
$logs_dir = __DIR__ . '/../logs';
if (!file_exists($logs_dir)) {
    @mkdir($logs_dir, 0755, true);
}

// Configurar log de erros (fallback para error_log padrão se não conseguir criar pasta)
$log_file = $logs_dir . '/php_errors.log';
if (is_writable(dirname($log_file)) || is_writable($log_file)) {
    ini_set('error_log', $log_file);
} else {
    // Usar log padrão do PHP se não conseguir criar arquivo customizado
    error_log("Aviso: Não foi possível criar arquivo de log em: " . $log_file);
}

// Função para retornar JSON de erro de forma segura (deve vir primeiro)
function returnJsonError($message, $code = 500, $debug = null) {
    // Limpar qualquer output anterior
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Content-Type: application/json; charset=UTF-8");
    http_response_code($code);
    
    $response = [
        'success' => false,
        'message' => $message
    ];
    
    if ($debug !== null) {
        $response['debug'] = $debug;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// Função para log detalhado
function logDeleteAccount($message, $data = null) {
    $logMessage = "[DELETE_ACCOUNT] " . date('Y-m-d H:i:s') . " - " . $message;
    if ($data !== null) {
        $logMessage .= " | Data: " . json_encode($data);
    }
    error_log($logMessage);
}

// Handler de erros fatais (registrado após funções estarem disponíveis)
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE])) {
        if (function_exists('logDeleteAccount')) {
            logDeleteAccount("ERRO FATAL CAPTURADO", $error);
        }
        if (function_exists('returnJsonError')) {
            returnJsonError(
                'Erro fatal no servidor',
                500,
                [
                    'type' => $error['type'],
                    'message' => $error['message'],
                    'file' => basename($error['file']),
                    'line' => $error['line']
                ]
            );
        }
    }
});

// Limpar output buffer
while (ob_get_level()) {
    ob_end_clean();
}

// Headers CORS (deve ser antes de qualquer output)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Inicializar resposta
$response = [
    'success' => false,
    'message' => '',
    'debug' => []
];

logDeleteAccount("Iniciando requisição de deleção de conta");

try {
    logDeleteAccount("Carregando includes...");
    
    // Carregar configurações e conexão com banco
    if (!file_exists('../includes/config.php')) {
        throw new Exception('Arquivo config.php não encontrado');
    }
    require_once '../includes/config.php';
    
    if (!file_exists('../includes/db.php')) {
        throw new Exception('Arquivo db.php não encontrado');
    }
    $conn = require '../includes/db.php';
    
    if (!file_exists('../includes/auth.php')) {
        throw new Exception('Arquivo auth.php não encontrado');
    }
    require_once '../includes/auth.php';
    
    logDeleteAccount("Includes carregados com sucesso");
    
    // Verificar conexão
    if (!$conn || !($conn instanceof mysqli)) {
        throw new Exception('Erro de conexão com o banco de dados');
    }
    
    logDeleteAccount("Conexão com banco verificada");
    
    // Verificar autenticação - usar mesmo padrão das outras APIs que funcionam
    logDeleteAccount("Verificando autenticação...");
    logDeleteAccount("Ponto 1: Após log de verificação");
    
    // Usar requireLoginWithOptionalToken como as outras APIs (serve_video.php, serve_pdf.php)
    // Mas vamos validar que autenticação é obrigatória depois
    logDeleteAccount("Ponto 2: Antes de chamar requireLoginWithOptionalToken");
    
    // Verificar se a função existe
    if (!function_exists('requireLoginWithOptionalToken')) {
        logDeleteAccount("ERRO: Função requireLoginWithOptionalToken não existe!");
        throw new Exception('Função requireLoginWithOptionalToken não encontrada');
    }
    
    logDeleteAccount("Ponto 3: Função existe, chamando agora...");
    
    try {
        $user_id = requireLoginWithOptionalToken($conn);
        logDeleteAccount("requireLoginWithOptionalToken() retornou", ['user_id' => $user_id ? $user_id : 'null/false']);
    } catch (Exception $e) {
        logDeleteAccount("Exception em requireLoginWithOptionalToken", ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
        returnJsonError('Erro ao verificar autenticação: ' . $e->getMessage(), 500, ['exception' => true]);
    } catch (Error $e) {
        logDeleteAccount("Error em requireLoginWithOptionalToken", ['error' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()]);
        returnJsonError('Erro fatal ao verificar autenticação: ' . $e->getMessage(), 500, ['error' => true]);
    } catch (Throwable $e) {
        logDeleteAccount("Throwable em requireLoginWithOptionalToken", ['error' => $e->getMessage(), 'class' => get_class($e)]);
        returnJsonError('Erro ao verificar autenticação: ' . $e->getMessage(), 500, ['throwable' => true]);
    }
    
    // Para deletar conta, autenticação é OBRIGATÓRIA
    if (!$user_id) {
        logDeleteAccount("Autenticação falhou - user_id não fornecido");
        http_response_code(401);
        $response['message'] = 'Autenticação necessária para deletar conta';
        echo json_encode($response);
        exit;
    }
    
    // Se user_id é um objeto/array, extrair o ID
    $original_user_id = $user_id;
    if (is_array($user_id) || is_object($user_id)) {
        $user_id_array = (array)$user_id;
        $extracted_id = isset($user_id_array['id']) ? $user_id_array['id'] : (isset($user_id_array[0]) ? $user_id_array[0] : null);
        logDeleteAccount("user_id extraído do objeto", ['original' => $user_id_array, 'extracted_id' => $extracted_id]);
        $user_id = $extracted_id;
    }
    
    if (!$user_id || !is_numeric($user_id)) {
        logDeleteAccount("user_id inválido após extração", ['user_id' => $user_id]);
        http_response_code(401);
        $response['message'] = 'ID de usuário inválido';
        echo json_encode($response);
        exit;
    }
    
    // Converter para inteiro
    $user_id = (int)$user_id;
    
    logDeleteAccount("Usuário autenticado com sucesso", ['user_id' => $user_id]);
    
    // Verificar se a confirmação foi enviada
    $raw_input = file_get_contents('php://input');
    logDeleteAccount("Input recebido", ['raw_length' => strlen($raw_input)]);
    
    $input = json_decode($raw_input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        logDeleteAccount("Erro ao decodificar JSON", ['error' => json_last_error_msg(), 'input' => substr($raw_input, 0, 200)]);
        http_response_code(400);
        $response['message'] = 'JSON inválido: ' . json_last_error_msg();
        echo json_encode($response);
        exit;
    }
    
    logDeleteAccount("JSON decodificado", ['input' => $input]);
    
    if (!isset($input['confirm']) || $input['confirm'] !== true) {
        logDeleteAccount("Confirmação não fornecida ou inválida", ['input' => $input]);
        http_response_code(400);
        $response['message'] = 'Confirmação necessária para deletar conta';
        echo json_encode($response);
        exit;
    }
    
    logDeleteAccount("Confirmação recebida");
    
    // Iniciar transação para garantir consistência
    $conn->autocommit(false);
    
    try {
        // ============================================
        // DELETAR DADOS RELACIONADOS AO USUÁRIO
        // ============================================
        // IMPORTANTE: Ajuste os nomes das tabelas conforme seu banco de dados
        
        // Lista de tabelas que podem conter dados do usuário
        // Ajuste conforme sua estrutura de banco de dados
        
        // 1. Diário alimentar (meals, diary, food_diary, etc)
        $tables_to_clean = [
            'sf_meals' => 'user_id',           // Ajuste o nome da tabela
            'sf_diary' => 'user_id',           // Ajuste o nome da tabela
            'sf_food_diary' => 'user_id',      // Ajuste o nome da tabela
            'sf_favorite_recipes' => 'user_id', // Receitas favoritas
            'sf_user_measurements' => 'user_id', // Medidas e fotos
            'sf_user_progress' => 'user_id',    // Progresso
            'sf_user_points' => 'user_id',      // Pontos/ranking
            'sf_user_tokens' => 'user_id',      // Tokens de autenticação
            'sf_user_sessions' => 'user_id',    // Sessões
            'sf_user_content_access' => 'user_id', // Acesso a conteúdos
            // Adicione outras tabelas relacionadas aqui
        ];
        
        // Deletar dados de cada tabela
        foreach ($tables_to_clean as $table => $column) {
            // Verificar se a tabela existe antes de tentar deletar
            $check_table = $conn->query("SHOW TABLES LIKE '{$table}'");
            if ($check_table && $check_table->num_rows > 0) {
                $stmt = $conn->prepare("DELETE FROM {$table} WHERE {$column} = ?");
                if ($stmt) {
                    $stmt->bind_param("i", $user_id);
                    if (!$stmt->execute()) {
                        error_log("Erro ao deletar dados da tabela {$table}: " . $stmt->error);
                    }
                    $stmt->close();
                }
            }
        }
        
        // 2. Deletar foto de perfil se existir (opcional - só se a coluna existir)
        $photo_path = null;
        
        // Primeiro descobrir o nome da tabela de usuários
        $user_table = null;
        $possible_tables = ['sf_users', 'users', 'shapefit_users', 'app_users'];
        foreach ($possible_tables as $table) {
            $check = $conn->query("SHOW TABLES LIKE '{$table}'");
            if ($check && $check->num_rows > 0) {
                $user_table = $table;
                break;
            }
        }
        
        if ($user_table) {
            // Verificar se a coluna de foto existe antes de tentar buscar
            $check_columns = $conn->query("SHOW COLUMNS FROM {$user_table} LIKE 'profile_image'");
            if ($check_columns && $check_columns->num_rows > 0) {
                logDeleteAccount("Coluna profile_image existe, buscando foto...");
                $stmt_photo = $conn->prepare("SELECT profile_image FROM {$user_table} WHERE id = ?");
                if ($stmt_photo) {
                    $stmt_photo->bind_param("i", $user_id);
                    if ($stmt_photo->execute()) {
                        $result_photo = $stmt_photo->get_result();
                        if ($row_photo = $result_photo->fetch_assoc()) {
                            $photo_path = $row_photo['profile_image'];
                            logDeleteAccount("Foto de perfil encontrada", ['path' => $photo_path]);
                        }
                    }
                    $stmt_photo->close();
                }
            } else {
                logDeleteAccount("Coluna profile_image não existe na tabela, pulando busca de foto");
            }
        }
        
        // 3. Deletar arquivos de fotos do usuário (medidas, etc) - opcional
        $photo_files = [];
        
        // Verificar se a tabela de medidas existe
        $check_measurements_table = $conn->query("SHOW TABLES LIKE 'sf_user_measurements'");
        if ($check_measurements_table && $check_measurements_table->num_rows > 0) {
            // Verificar se a coluna photo_path existe
            $check_photo_column = $conn->query("SHOW COLUMNS FROM sf_user_measurements LIKE 'photo_path'");
            if ($check_photo_column && $check_photo_column->num_rows > 0) {
                logDeleteAccount("Tabela e coluna de fotos de medidas existem, buscando...");
                $photos_stmt = $conn->prepare("SELECT photo_path FROM sf_user_measurements WHERE user_id = ? AND photo_path IS NOT NULL AND photo_path != ''");
                if ($photos_stmt) {
                    $photos_stmt->bind_param("i", $user_id);
                    if ($photos_stmt->execute()) {
                        $photos_result = $photos_stmt->get_result();
                        while ($photo_row = $photos_result->fetch_assoc()) {
                            if (!empty($photo_row['photo_path'])) {
                                $photo_files[] = $photo_row['photo_path'];
                            }
                        }
                        logDeleteAccount("Fotos de medidas encontradas", ['count' => count($photo_files)]);
                    }
                    $photos_stmt->close();
                }
            } else {
                logDeleteAccount("Coluna photo_path não existe na tabela sf_user_measurements, pulando");
            }
        } else {
            logDeleteAccount("Tabela sf_user_measurements não existe, pulando busca de fotos");
        }
        
        // 4. Deletar a conta do usuário da tabela principal
        // IMPORTANTE: Ajuste 'sf_users' para o nome real da sua tabela de usuários
        logDeleteAccount("Preparando para deletar usuário da tabela principal");
        
        // Primeiro, verificar qual é o nome da tabela de usuários
        // Tentar algumas variações comuns
        $user_table = null;
        $possible_tables = ['sf_users', 'users', 'shapefit_users', 'app_users'];
        
        foreach ($possible_tables as $table) {
            $check = $conn->query("SHOW TABLES LIKE '{$table}'");
            if ($check && $check->num_rows > 0) {
                $user_table = $table;
                logDeleteAccount("Tabela de usuários encontrada: " . $table);
                break;
            }
        }
        
        if (!$user_table) {
            throw new Exception('Tabela de usuários não encontrada. Verifique o nome da tabela no código.');
        }
        
        $stmt_delete_user = $conn->prepare("DELETE FROM {$user_table} WHERE id = ?");
        if (!$stmt_delete_user) {
            logDeleteAccount("Erro ao preparar query", ['error' => $conn->error]);
            throw new Exception('Erro ao preparar query de deleção: ' . $conn->error);
        }
        
        $stmt_delete_user->bind_param("i", $user_id);
        
        logDeleteAccount("Executando deleção do usuário");
        
        if (!$stmt_delete_user->execute()) {
            logDeleteAccount("Erro ao executar deleção", ['error' => $stmt_delete_user->error]);
            throw new Exception('Erro ao deletar conta do usuário: ' . $stmt_delete_user->error);
        }
        
        $affected_rows = $stmt_delete_user->affected_rows;
        $stmt_delete_user->close();
        
        logDeleteAccount("Deleção executada", ['affected_rows' => $affected_rows]);
        
        if ($affected_rows == 0) {
            logDeleteAccount("Usuário não encontrado na tabela");
            throw new Exception('Usuário não encontrado');
        }
        
        // 5. Deletar arquivos físicos (fotos) após sucesso no banco
        // Deletar foto de perfil
        if ($photo_path && file_exists('../' . $photo_path)) {
            @unlink('../' . $photo_path);
        }
        
        // Deletar fotos de medidas
        foreach ($photo_files as $file_path) {
            if ($file_path && file_exists('../' . $file_path)) {
                @unlink('../' . $file_path);
            }
        }
        
        // Confirmar transação
        logDeleteAccount("Confirmando transação");
        $conn->commit();
        
        logDeleteAccount("Conta deletada com sucesso", ['user_id' => $user_id]);
        
        // Sucesso
        $response['success'] = true;
        $response['message'] = 'Conta deletada permanentemente com sucesso';
        
        http_response_code(200);
        
    } catch (Exception $e) {
        // Reverter transação em caso de erro
        logDeleteAccount("Erro na transação, revertendo", ['error' => $e->getMessage()]);
        if ($conn) {
            $conn->rollback();
        }
        throw $e;
    } finally {
        // Restaurar autocommit
        if ($conn) {
            $conn->autocommit(true);
        }
    }
    
} catch (Exception $e) {
    $error_msg = $e->getMessage();
    $error_trace = $e->getTraceAsString();
    
    logDeleteAccount("EXCEÇÃO CAPTURADA", [
        'message' => $error_msg,
        'trace' => $error_trace,
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    
    http_response_code(500);
    $response['message'] = 'Erro ao deletar conta. Verifique os logs do servidor.';
    $response['debug']['error'] = $error_msg;
    $response['debug']['file'] = basename($e->getFile());
    $response['debug']['line'] = $e->getLine();
    
    // Sempre incluir debug em desenvolvimento
    $response['debug']['trace'] = $error_trace;
    
} catch (Error $e) {
    $error_msg = $e->getMessage();
    
    logDeleteAccount("ERRO FATAL", [
        'message' => $error_msg,
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    
    http_response_code(500);
    $response['message'] = 'Erro fatal ao deletar conta.';
    $response['debug']['error'] = $error_msg;
    $response['debug']['file'] = basename($e->getFile());
    $response['debug']['line'] = $e->getLine();
    
} catch (Throwable $e) {
    $error_msg = $e->getMessage();
    
    logDeleteAccount("THROWABLE CAPTURADO", [
        'message' => $error_msg,
        'class' => get_class($e),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    
    http_response_code(500);
    $response['message'] = 'Erro inesperado ao deletar conta.';
    $response['debug']['error'] = $error_msg;
    $response['debug']['class'] = get_class($e);
}

// Garantir que sempre retorna JSON válido
logDeleteAccount("Preparando resposta final", $response);

// Retornar resposta JSON
$json_output = json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);

if ($json_output === false) {
    // Se falhar ao gerar JSON, retornar erro simples
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao processar resposta',
        'json_error' => json_last_error_msg()
    ]);
} else {
    echo $json_output;
}

logDeleteAccount("Resposta enviada");
exit;

