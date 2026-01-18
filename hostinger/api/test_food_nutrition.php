<?php
// Script de teste para verificar valores nutricionais do alimento
require_once '../includes/config.php';
require_once APP_ROOT_PATH . '/includes/db.php';

$food_id = 685;

$sql = "SELECT 
    id,
    name_pt,
    energy_kcal_100g,
    protein_g_100g,
    carbohydrate_g_100g,
    fat_g_100g
FROM sf_food_items 
WHERE id = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $food_id);
$stmt->execute();
$result = $stmt->get_result();

if ($food = $result->fetch_assoc()) {
    echo "Alimento encontrado:\n";
    echo "ID: " . $food['id'] . "\n";
    echo "Nome: " . $food['name_pt'] . "\n";
    echo "Kcal/100g: " . ($food['energy_kcal_100g'] ?? 'NULL') . "\n";
    echo "Proteína/100g: " . ($food['protein_g_100g'] ?? 'NULL') . "\n";
    echo "Carboidrato/100g: " . ($food['carbohydrate_g_100g'] ?? 'NULL') . "\n";
    echo "Gordura/100g: " . ($food['fat_g_100g'] ?? 'NULL') . "\n";
} else {
    echo "Alimento não encontrado!\n";
}

$stmt->close();
$conn->close();
?>

