<?php
// api/checkin.php - API endpoint para check-in do usuário

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

// Autenticação por token (prioridade) ou sessão (fallback)
$user_id = null;

// Tentar autenticação por token primeiro
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
$token = $auth_header ? str_replace('Bearer ', '', $auth_header) : null;

if ($token) {
    $user = getUserByAuthToken($conn, $token);
    if ($user) {
        $user_id = $user['id'];
    }
}

// Se não autenticou por token, tentar por sessão
if (!$user_id) {
    if (session_status() == PHP_SESSION_NONE) {
        session_start();
    }
    requireLogin();
    $user_id = $_SESSION['user_id'] ?? null;
}

if (!$user_id) {
    echo json_encode(['success' => false, 'message' => 'Usuário não autenticado']);
    exit;
}

// Função para parsear multipart/form-data manualmente
function parseMultipartFormData($input, $boundary) {
    $data = [];
    
    // Dividir por boundary (incluindo o -- no final)
    $parts = preg_split('/' . preg_quote($boundary, '/') . '/', $input);
    
    foreach ($parts as $part) {
        // Pular partes vazias
        $part = trim($part);
        if (empty($part)) {
            continue;
        }
        
        // Procurar por Content-Disposition: form-data; name="..."
        if (preg_match('/Content-Disposition:\s*form-data;\s*name="([^"]+)"/', $part, $nameMatch)) {
            $name = trim($nameMatch[1]);
            
            // O valor vem depois de duas quebras de linha (\r\n\r\n ou \n\n)
            // e termina antes do próximo boundary ou fim da string
            $valuePattern = '/Content-Disposition:[^\r\n]+\r?\n\r?\n(.*?)(?=\r?\n------|$)/s';
            if (preg_match($valuePattern, $part, $valueMatch)) {
                $value = $valueMatch[1];
                // Remover quebras de linha finais
                $value = rtrim($value, "\r\n");
                $data[$name] = $value;
            } else {
                // Tentar padrão alternativo mais simples
                $lines = explode("\n", $part);
                $foundName = false;
                $valueLines = [];
                foreach ($lines as $line) {
                    if ($foundName) {
                        // Se encontrou um novo Content-Disposition, parar
                        if (strpos($line, 'Content-Disposition:') !== false) {
                            break;
                        }
                        // Se encontrou o boundary, parar
                        if (strpos($line, '------') !== false) {
                            break;
                        }
                        $valueLines[] = $line;
                    } elseif (strpos($line, 'Content-Disposition:') !== false && strpos($line, 'name="' . $name . '"') !== false) {
                        $foundName = true;
                    }
                }
                if (!empty($valueLines)) {
                    $value = implode("\n", $valueLines);
                    $value = rtrim($value, "\r\n");
                    $data[$name] = $value;
                }
            }
        }
    }
    
    return $data;
}

// Ler dados: FormData vem em $_POST, JSON vem em php://input
$data = null;

// Verificar Content-Type para determinar como ler os dados
$content_type = $_SERVER['CONTENT_TYPE'] ?? '';
$input_raw = @file_get_contents('php://input');

// Se $_POST está populado (FormData foi processado pelo PHP), usar ele
if (!empty($_POST)) {
    $data = $_POST;
} 
// Se não, verificar se o input raw contém multipart/form-data (mesmo que Content-Type esteja errado)
elseif ($input_raw && (strpos($input_raw, 'Content-Disposition: form-data') !== false || strpos($input_raw, 'WebKitFormBoundary') !== false)) {
    // É FormData, mas PHP não processou. Processar manualmente
    // Extrair boundary
    $boundary = '';
    if (preg_match('/boundary=([^;]+)/i', $content_type, $matches)) {
        $boundary = '--' . trim($matches[1]);
    } elseif (preg_match('/WebKitFormBoundary(\w+)/', $input_raw, $matches)) {
        $boundary = '------WebKitFormBoundary' . $matches[1];
    }
    
    if ($boundary) {
        $data = parseMultipartFormData($input_raw, $boundary);
    }
}
// Se não é FormData, tentar ler JSON
elseif ($input_raw) {
    $decoded = json_decode($input_raw, true);
    if (json_last_error() === JSON_ERROR_NONE && $decoded !== null) {
        $data = $decoded;
    }
}

// Se ainda não tem dados, tentar $_POST como último recurso
if (!$data || empty($data)) {
    $data = $_POST;
}

$action = $data['action'] ?? '';

// Debug: logar o que foi recebido apenas se action estiver vazio
if (empty($action)) {
    error_log("checkin.php - Action vazio. POST: " . print_r($_POST, true) . " | INPUT (first 500): " . substr($input_raw, 0, 500) . " | CONTENT_TYPE: " . $content_type . " | DATA: " . print_r($data, true));
}

try {
    switch ($action) {
        case 'submit_checkin':
            submitCheckin($data, $user_id);
            break;
        case 'save_progress':
            saveProgress($data, $user_id);
            break;
        case 'load_progress':
            loadProgress($data, $user_id);
            break;
        default:
            echo json_encode(['success' => false, 'message' => 'Ação inválida']);
            exit;
    }
} catch (Exception $e) {
    error_log("Erro em api/checkin.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
}

function submitCheckin($data, $user_id) {
    global $conn;
    
    $config_id = (int)($data['config_id'] ?? 0);
    $responses = json_decode($data['responses'] ?? '{}', true);
    
    if ($config_id <= 0) {
        throw new Exception('ID do check-in inválido');
    }
    
    if (empty($responses) || !is_array($responses)) {
        throw new Exception('Nenhuma resposta fornecida');
    }
    
    // Verificar se o check-in está disponível para o usuário
    $stmt_check = $conn->prepare("SELECT id FROM sf_checkin_configs WHERE id = ? AND is_active = 1");
    $stmt_check->bind_param("i", $config_id);
    $stmt_check->execute();
    $result = $stmt_check->get_result();
    
    if ($result->num_rows === 0) {
        $stmt_check->close();
        throw new Exception('Check-in não encontrado ou inativo');
    }
    $stmt_check->close();
    
    // Verificar se já existem respostas salvas (já foram salvas individualmente)
    $stmt_check = $conn->prepare("SELECT COUNT(*) as count FROM sf_checkin_responses WHERE config_id = ? AND user_id = ?");
    $stmt_check->bind_param("ii", $config_id, $user_id);
    $stmt_check->execute();
    $result = $stmt_check->get_result();
    $count = $result->fetch_assoc()['count'];
    $stmt_check->close();
    
    // Se não há respostas salvas, salvar agora (fallback)
    if ($count == 0) {
        $conn->begin_transaction();
        
        try {
            $stmt = $conn->prepare("INSERT INTO sf_checkin_responses (config_id, user_id, question_id, response_text, response_value, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())");
            
            foreach ($responses as $question_id => $response) {
                $question_id = (int)$question_id;
                $response_text = !empty($response['response_text']) ? $response['response_text'] : null;
                $response_value = !empty($response['response_value']) ? $response['response_value'] : null;
                
                $stmt->bind_param("iiiss", $config_id, $user_id, $question_id, $response_text, $response_value);
                $stmt->execute();
            }
            
            $stmt->close();
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            throw $e;
        }
    }
    
    // Marcar check-in como completo (domingo da semana)
    // Calcular domingo da semana ATUAL (não próxima)
    $today = date('Y-m-d');
    $today_day_of_week = (int)date('w'); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    if ($today_day_of_week == 0) {
        // Hoje é domingo
        $week_start = $today;
    } else {
        // Voltar até o domingo desta semana
        $week_start = date('Y-m-d', strtotime("-{$today_day_of_week} days"));
    }
    
    // Garantir que o registro de disponibilidade existe (criar se não existir)
    $stmt_ensure_avail = $conn->prepare("
        INSERT INTO sf_checkin_availability (config_id, user_id, week_date, is_available, available_at) 
        VALUES (?, ?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE is_available = 1
    ");
    $stmt_ensure_avail->bind_param("iis", $config_id, $user_id, $week_start);
    $stmt_ensure_avail->execute();
    $stmt_ensure_avail->close();
    
    // Verificar se o popup de congratulação já foi mostrado e se já foi completado
    // Usar COALESCE para tratar caso a coluna congrats_shown não exista ainda
    $stmt_check_congrats = $conn->prepare("SELECT COALESCE(congrats_shown, 0) as congrats_shown, is_completed FROM sf_checkin_availability WHERE config_id = ? AND user_id = ? AND week_date = ?");
    $stmt_check_congrats->bind_param("iis", $config_id, $user_id, $week_start);
    $stmt_check_congrats->execute();
    $result_congrats = $stmt_check_congrats->get_result();
    $availability_data = $result_congrats->fetch_assoc();
    $stmt_check_congrats->close();
    
    $points_awarded = 0;
    $congrats_shown = (int)($availability_data['congrats_shown'] ?? 0);
    $is_already_completed = (int)($availability_data['is_completed'] ?? 0);
    
    error_log("Check-in submit: user_id={$user_id}, config_id={$config_id}, week_start={$week_start}, is_completed={$is_already_completed}, congrats_shown={$congrats_shown}");
    
    // Se o check-in ainda não foi completado, adicionar pontos (primeira vez completando)
    if ($is_already_completed == 0) {
        // Verificar se já foi dado pontos antes (congrats_shown = 1 mas is_completed = 0 é um estado inválido, mas vamos verificar)
        if ($congrats_shown == 0) {
            $points_to_add = 10; // Usar inteiro em vez de float
            error_log("Tentando adicionar {$points_to_add} pontos para user {$user_id}");
            $success = addPointsToUser($conn, $user_id, (float)$points_to_add, "Check-in semanal completado - Config ID: {$config_id}");
            
            if ($success) {
                $points_awarded = $points_to_add;
                error_log("Pontos adicionados com sucesso: {$points_awarded}");
                // Marcar check-in como completo e popup como mostrado
                // Tentar atualizar congrats_shown, mas se a coluna não existir, apenas marcar como completo
                try {
                    $stmt_update = $conn->prepare("UPDATE sf_checkin_availability SET is_completed = 1, completed_at = NOW(), congrats_shown = 1 WHERE config_id = ? AND user_id = ? AND week_date = ?");
                    if ($stmt_update) {
                        $stmt_update->bind_param("iis", $config_id, $user_id, $week_start);
                        $stmt_update->execute();
                        $stmt_update->close();
                    } else {
                        // Se falhar (coluna não existe), apenas marcar como completo
                        error_log("Coluna congrats_shown não existe, apenas marcando como completo");
                        $stmt_update = $conn->prepare("UPDATE sf_checkin_availability SET is_completed = 1, completed_at = NOW() WHERE config_id = ? AND user_id = ? AND week_date = ?");
                        $stmt_update->bind_param("iis", $config_id, $user_id, $week_start);
                        $stmt_update->execute();
                        $stmt_update->close();
                    }
                } catch (Exception $e) {
                    // Se der erro (coluna não existe), apenas marcar como completo
                    error_log("Erro ao atualizar congrats_shown (coluna pode não existir): " . $e->getMessage());
                    $stmt_update = $conn->prepare("UPDATE sf_checkin_availability SET is_completed = 1, completed_at = NOW() WHERE config_id = ? AND user_id = ? AND week_date = ?");
                    $stmt_update->bind_param("iis", $config_id, $user_id, $week_start);
                    $stmt_update->execute();
                    $stmt_update->close();
                }
                // Não continuar com o UPDATE abaixo, já foi feito
                goto skip_update;
            } else {
                // Se falhar ao adicionar pontos, ainda marcar como completo, mas sem mostrar popup
                error_log("ERRO: Falha ao adicionar pontos no check-in para user {$user_id}, config {$config_id}");
                $stmt_update = $conn->prepare("UPDATE sf_checkin_availability SET is_completed = 1, completed_at = NOW() WHERE config_id = ? AND user_id = ? AND week_date = ?");
            }
        } else {
            // Já foi dado pontos antes, apenas marcar como completo
            error_log("Pontos já foram dados anteriormente (congrats_shown=1), apenas marcando como completo");
            $stmt_update = $conn->prepare("UPDATE sf_checkin_availability SET is_completed = 1, completed_at = NOW() WHERE config_id = ? AND user_id = ? AND week_date = ?");
        }
    } else {
        // Já foi completado antes, apenas garantir que está marcado como completo (não adicionar pontos novamente)
        error_log("Check-in já foi completado anteriormente, não adicionando pontos");
        $stmt_update = $conn->prepare("UPDATE sf_checkin_availability SET is_completed = 1, completed_at = NOW() WHERE config_id = ? AND user_id = ? AND week_date = ?");
    }
    
    if (isset($stmt_update)) {
        $stmt_update->bind_param("iis", $config_id, $user_id, $week_start);
        $stmt_update->execute();
        $affected_rows = $stmt_update->affected_rows;
        $stmt_update->close();
    } else {
        $affected_rows = 0;
    }
    
    skip_update:
    
    // Log para debug
    error_log("Check-in completado: user_id={$user_id}, config_id={$config_id}, week_start={$week_start}, points_awarded={$points_awarded}, affected_rows={$affected_rows}");
    
    // Buscar pontos atualizados do usuário
    $stmt_points = $conn->prepare("SELECT points FROM sf_users WHERE id = ?");
    $stmt_points->bind_param("i", $user_id);
    $stmt_points->execute();
    $result_points = $stmt_points->get_result();
    $user_data = $result_points->fetch_assoc();
    $stmt_points->close();
    
    // Garantir que os pontos sejam retornados como número inteiro
    // A coluna points é decimal(10,2), então precisa converter para inteiro
    $new_total_points = isset($user_data['points']) ? (int)round((float)$user_data['points']) : 0;
    
    echo json_encode([
        'success' => true,
        'message' => 'Check-in salvo com sucesso!',
        'points_awarded' => $points_awarded,
        'new_total_points' => $new_total_points
    ]);
}

function saveProgress($data, $user_id) {
    global $conn;
    
    $config_id = (int)($data['config_id'] ?? 0);
    $question_id = (int)($data['question_id'] ?? 0);
    $response_text = $data['response_text'] ?? null;
    $response_value = $data['response_value'] ?? null;
    
    if ($config_id <= 0 || $question_id <= 0) {
        throw new Exception('IDs inválidos');
    }
    
    // Verificar se já existe resposta para esta pergunta
    $stmt_check = $conn->prepare("SELECT id FROM sf_checkin_responses WHERE config_id = ? AND user_id = ? AND question_id = ?");
    $stmt_check->bind_param("iii", $config_id, $user_id, $question_id);
    $stmt_check->execute();
    $existing = $stmt_check->get_result()->fetch_assoc();
    $stmt_check->close();
    
    if ($existing) {
        // Atualizar resposta existente
        $stmt = $conn->prepare("UPDATE sf_checkin_responses SET response_text = ?, response_value = ?, submitted_at = NOW() WHERE id = ?");
        $stmt->bind_param("ssi", $response_text, $response_value, $existing['id']);
        $action = 'UPDATE';
    } else {
        // Criar nova resposta
        $stmt = $conn->prepare("INSERT INTO sf_checkin_responses (config_id, user_id, question_id, response_text, response_value, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())");
        $stmt->bind_param("iiiss", $config_id, $user_id, $question_id, $response_text, $response_value);
        $action = 'INSERT';
    }
    
    $stmt->execute();
    $affected_rows = $stmt->affected_rows;
    $stmt->close();
    
    // Log para debug
    error_log("saveProgress: user_id={$user_id}, config_id={$config_id}, question_id={$question_id}, action={$action}, affected_rows={$affected_rows}, response_text=" . substr($response_text ?? '', 0, 50));
    
    echo json_encode([
        'success' => true,
        'message' => 'Progresso salvo'
    ]);
}

function loadProgress($data, $user_id) {
    global $conn;
    
    $config_id = (int)($data['config_id'] ?? 0);
    
    if ($config_id <= 0) {
        throw new Exception('ID do check-in inválido');
    }
    
    // IMPORTANTE: Esta função é APENAS para o USUÁRIO carregar seu progresso
    // O ADMIN busca respostas diretamente do banco em admin/checkin_responses.php
    // e vê TODAS as respostas de TODAS as semanas (histórico completo)
    // Esta função NÃO afeta o histórico do admin de forma alguma
    
    // Calcular o domingo da semana atual (mesma lógica usada no sistema)
    $today = date('Y-m-d');
    $today_day_of_week = (int)date('w'); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    if ($today_day_of_week == 0) {
        // Hoje é domingo
        $week_start = $today;
    } else {
        // Voltar até o domingo desta semana
        $week_start = date('Y-m-d', strtotime("-{$today_day_of_week} days"));
    }
    
    // Verificar se o check-in está completo para esta semana
    $stmt_check = $conn->prepare("SELECT is_completed FROM sf_checkin_availability WHERE config_id = ? AND user_id = ? AND week_date = ?");
    $stmt_check->bind_param("iis", $config_id, $user_id, $week_start);
    $stmt_check->execute();
    $result_check = $stmt_check->get_result();
    $availability = $result_check->fetch_assoc();
    $stmt_check->close();
    
    $is_completed = (int)($availability['is_completed'] ?? 0);
    
    // Se o check-in já está completo, não retornar respostas para esta semana
    // Isso força o usuário a fazer o check-in novamente se foi resetado pelo admin
    // IMPORTANTE: As respostas antigas PERMANECEM no banco para o admin ver no histórico
    if ($is_completed == 1) {
        error_log("loadProgress: Check-in já completo para user_id={$user_id}, config_id={$config_id}, week_start={$week_start}");
        echo json_encode([
            'success' => true,
            'responses' => [],
            'answered_questions' => []
        ]);
        return;
    }
    
    // Buscar TODAS as respostas salvas deste check-in e usuário (mais recentes primeiro)
    // Se o check-in não está completo, deve mostrar todas as respostas salvas
    // Filtrar apenas respostas da semana atual para evitar conflitos com semanas anteriores
    $stmt = $conn->prepare("
        SELECT question_id, response_text, response_value, DATE(submitted_at) as submitted_date, submitted_at
        FROM sf_checkin_responses 
        WHERE config_id = ? 
        AND user_id = ? 
        AND DATE(submitted_at) >= ?
        ORDER BY submitted_at DESC, question_id ASC
    ");
    $stmt->bind_param("iis", $config_id, $user_id, $week_start);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $responses = [];
    $answered_questions = [];
    
    while ($row = $result->fetch_assoc()) {
        $question_id = (int)$row['question_id'];
        // Pegar a resposta mais recente para cada pergunta (primeira ocorrência devido ao ORDER BY DESC)
        if (!isset($responses[$question_id])) {
            $responses[$question_id] = [
                'response_text' => $row['response_text'],
                'response_value' => $row['response_value']
            ];
            $answered_questions[] = $question_id;
        }
    }
    $stmt->close();
    
    // Ordenar answered_questions para manter a ordem das perguntas
    sort($answered_questions);
    
    // Log para debug
    error_log("loadProgress: user_id={$user_id}, config_id={$config_id}, week_start={$week_start}, found_responses=" . count($responses) . ", answered_questions=" . implode(',', $answered_questions));
    
    echo json_encode([
        'success' => true,
        'responses' => $responses,
        'answered_questions' => $answered_questions
    ]);
}

