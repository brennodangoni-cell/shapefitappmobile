# CORREÇÃO DE CORS PARA BUSCA DE ALIMENTOS

## Problema
O endpoint `ajax_search_food.php` está bloqueado por CORS quando acessado do app Capacitor com origem `https://app.shapefit.local`.

## Solução 1: Adicionar no .htaccess (RECOMENDADO)

Adicione no arquivo `.htaccess` na pasta `/api/` do servidor:

```apache
# Permitir CORS para app Capacitor
<IfModule mod_headers.c>
    # Permitir origem do app Capacitor
    Header set Access-Control-Allow-Origin "https://app.shapefit.local"
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header set Access-Control-Allow-Headers "Authorization, Content-Type"
    Header set Access-Control-Allow-Credentials "true"
    
    # Para requisições OPTIONS (preflight), retornar imediatamente
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=200,L]
</IfModule>
```

## Solução 2: Adicionar no PHP (ajax_search_food.php)

Adicione no INÍCIO do arquivo `ajax_search_food.php` (antes de qualquer output):

```php
<?php
// CORS Headers para app Capacitor
header('Access-Control-Allow-Origin: https://app.shapefit.local');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Credentials: true');

// Responder imediatamente para requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ... resto do código do arquivo ...
```

## Solução 3: Permitir múltiplas origens (SE NÃO SOUBER A ORIGEM EXATA)

Se você quiser permitir tanto localhost quanto o app Capacitor:

```php
<?php
$allowed_origins = [
    'https://localhost',
    'https://app.shapefit.local',
    'https://appshapefit.com'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
```

## IMPORTANTE
- Aplique a mesma correção em TODOS os endpoints da API que precisam ser acessados do app
- Teste após aplicar para garantir que funciona
- Se usar .htaccess, certifique-se de que o módulo `mod_headers` está habilitado no Apache

