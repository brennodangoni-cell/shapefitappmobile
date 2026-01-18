<?php
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/db.php';

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

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
    $user_id = $_SESSION['user_id'] ?? null;
}

if (!$user_id) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGetRooms($conn, $user_id);
            break;
        case 'POST':
            handleCreateRoom($conn, $user_id);
            break;
        case 'PUT':
            handleUpdateRoom($conn, $user_id);
            break;
        case 'DELETE':
            handleDeleteRoom($conn, $user_id);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método não permitido']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function handleGetRooms($conn, $user_id) {
    // Verificar se está buscando um desafio específico
    $challenge_id = $_GET['id'] ?? null;
    
    if ($challenge_id) {
        // Buscar desafio específico
        $stmt = $conn->prepare("
            SELECT 
                cg.*,
                COUNT(DISTINCT cgm.user_id) as total_participants
            FROM sf_challenge_groups cg
            INNER JOIN sf_challenge_group_members cgm ON cg.id = cgm.group_id
            WHERE cg.id = ? AND cgm.user_id = ? AND cg.status != 'inactive'
            GROUP BY cg.id
        ");
        $stmt->bind_param("ii", $challenge_id, $user_id);
        $stmt->execute();
        $challenge = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        if (!$challenge) {
            echo json_encode(['success' => false, 'message' => 'Desafio não encontrado']);
            return;
        }
        
        // Buscar participantes
        $stmt_participants = $conn->prepare("
            SELECT 
                u.id,
                u.name,
                up.profile_image_filename,
                up.gender,
                COALESCE(SUM(cgdp.points_earned), 0) as challenge_points
            FROM sf_challenge_group_members cgm
            INNER JOIN sf_users u ON cgm.user_id = u.id
            LEFT JOIN sf_user_profiles up ON u.id = up.user_id
            LEFT JOIN sf_challenge_group_daily_progress cgdp ON cgdp.user_id = u.id AND cgdp.challenge_group_id = ?
            WHERE cgm.group_id = ?
            GROUP BY u.id, u.name, up.profile_image_filename, up.gender
            ORDER BY challenge_points DESC, u.name ASC
            LIMIT 10
        ");
        $stmt_participants->bind_param("ii", $challenge_id, $challenge_id);
        $stmt_participants->execute();
        $participants = $stmt_participants->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_participants->close();
        
        // Buscar estatísticas do usuário
        $stmt_stats = $conn->prepare("
            SELECT 
                COALESCE(SUM(points_earned), 0) as user_total_points,
                COUNT(*) as days_active
            FROM sf_challenge_group_daily_progress
            WHERE challenge_group_id = ? AND user_id = ?
        ");
        $stmt_stats->bind_param("ii", $challenge_id, $user_id);
        $stmt_stats->execute();
        $stats = $stmt_stats->get_result()->fetch_assoc();
        $stmt_stats->close();
        
        // Adicionar estatísticas ao desafio
        $challenge['user_total_points'] = $stats['user_total_points'] ?? 0;
        $challenge['days_active'] = $stats['days_active'] ?? 0;
        $challenge['user_rank'] = 0; // Calcular depois se necessário
        
        echo json_encode([
            'success' => true,
            'challenge' => $challenge,
            'participants' => $participants
        ]);
    } else {
        // Buscar todos os desafios do usuário
        $stmt = $conn->prepare("
            SELECT 
                cg.*,
                COUNT(DISTINCT cgm.user_id) as total_participants
            FROM sf_challenge_groups cg
            INNER JOIN sf_challenge_group_members cgm ON cg.id = cgm.group_id
            WHERE cgm.user_id = ? AND cg.status != 'inactive'
            GROUP BY cg.id
            ORDER BY cg.start_date DESC, cg.created_at DESC
        ");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $challenges = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        
        echo json_encode([
            'success' => true,
            'challenges' => $challenges
        ]);
    }
}

function handleCreateRoom($conn, $user_id) {
    // Verificar se é admin
    $stmt = $conn->prepare("SELECT id FROM sf_admins WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$admin) {
        http_response_code(403);
        echo json_encode(['error' => 'Apenas administradores podem criar salas']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $start_date = $data['start_date'] ?? '';
    $end_date = $data['end_date'] ?? '';
    $max_participants = $data['max_participants'] ?? 50;
    $goals = json_encode($data['goals'] ?? []);
    
    $stmt = $conn->prepare("
        INSERT INTO sf_challenge_rooms (name, description, admin_id, start_date, end_date, max_participants, goals)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("ssissis", $name, $description, $admin['id'], $start_date, $end_date, $max_participants, $goals);
    
    if ($stmt->execute()) {
        $room_id = $conn->insert_id;
        echo json_encode(['success' => true, 'room_id' => $room_id]);
    } else {
        throw new Exception('Erro ao criar sala');
    }
    $stmt->close();
}

function handleUpdateRoom($conn, $user_id) {
    // Verificar se é admin
    $stmt = $conn->prepare("SELECT id FROM sf_admins WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$admin) {
        http_response_code(403);
        echo json_encode(['error' => 'Apenas administradores podem editar salas']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $room_id = $data['room_id'] ?? null;
    
    if (!$room_id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID da sala é obrigatório']);
        return;
    }
    
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $start_date = $data['start_date'] ?? '';
    $end_date = $data['end_date'] ?? '';
    $max_participants = $data['max_participants'] ?? 50;
    $goals = json_encode($data['goals'] ?? []);
    
    $stmt = $conn->prepare("
        UPDATE sf_challenge_rooms 
        SET name = ?, description = ?, start_date = ?, end_date = ?, max_participants = ?, goals = ?
        WHERE id = ? AND admin_id = ?
    ");
    $stmt->bind_param("sssisiis", $name, $description, $start_date, $end_date, $max_participants, $goals, $room_id, $admin['id']);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Erro ao atualizar sala');
    }
    $stmt->close();
}

function handleDeleteRoom($conn, $user_id) {
    // Verificar se é admin
    $stmt = $conn->prepare("SELECT id FROM sf_admins WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$admin) {
        http_response_code(403);
        echo json_encode(['error' => 'Apenas administradores podem deletar salas']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $room_id = $data['room_id'] ?? null;
    
    if (!$room_id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID da sala é obrigatório']);
        return;
    }
    
    $stmt = $conn->prepare("DELETE FROM sf_challenge_rooms WHERE id = ? AND admin_id = ?");
    $stmt->bind_param("ii", $room_id, $admin['id']);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Erro ao deletar sala');
    }
    $stmt->close();
}
?>
