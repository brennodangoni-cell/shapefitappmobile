const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 8100;
const WWW_DIR = path.join(__dirname, 'www');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
    try {
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return false;
        }
        
        const content = fs.readFileSync(filePath);
        const mimeType = getMimeType(filePath);
        
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache' // Ideal para dev, remover em prod
        });
        res.end(content);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao ler arquivo ${filePath}:`, error.message);
        return false;
    }
}

const server = http.createServer((req, res) => {
    // Log simples
    const time = new Date().toLocaleTimeString();
    console.log(`\n[${time}] ${req.method} ${req.url}`);
    
    try {
        // Remove query string e hash
        let urlPath = req.url.split('?')[0].split('#')[0];
        
        // PROXY PARA API: Redirecionar requisições /api/* para appshapefit.com/api/*
        if (urlPath.startsWith('/api/')) {
            console.log(`✅ [Server] Requisição /api/ detectada: ${urlPath}`);
            
            // Verificar se a API existe localmente primeiro
            const localApiPath = path.join(WWW_DIR, urlPath);
            if (fs.existsSync(localApiPath)) {
                console.log(`📁 [Server] API local encontrada: ${localApiPath}`);
                console.log(`⚠️ [Server] APIs PHP não podem ser executadas localmente. Encaminhando para servidor remoto.`);
            }
            
            const apiPath = urlPath.replace('/api', '');
            const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
            const targetUrl = `https://appshapefit.com/api${apiPath}${queryString}`;
            
            console.log(`\n🔀 ========== PROXY INTERCEPTADO ==========`);
            console.log(`🔀 [Proxy] ${req.method} ${urlPath} -> ${targetUrl}`);
            console.log(`🔀 [Proxy] Query: ${queryString || '(nenhuma)'}`);
            console.log(`🔀 [Proxy] Content-Type: ${req.headers['content-type'] || '(nenhum)'}`);
            console.log(`🔀 ==========================================\n`);
            
            const url = new URL(targetUrl);
            
            // Função para fazer a requisição proxy
            const makeProxyRequest = (bodyData = null) => {
                // Copiar headers, mas ajustar alguns
                const headers = {};
                // Copiar apenas headers relevantes
                if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
                if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
                if (req.headers['accept']) headers['accept'] = req.headers['accept'];
                if (req.headers['user-agent']) headers['user-agent'] = req.headers['user-agent'];
                
                headers.host = url.hostname;
                headers['X-Forwarded-For'] = req.socket.remoteAddress || '127.0.0.1';
                headers['X-Forwarded-Proto'] = 'https';
                
                // Log dos headers sendo enviados
                console.log(`\n🔀 ========== PROXY REQUEST ==========`);
                console.log(`🔀 [Proxy] URL: ${targetUrl}`);
                console.log(`🔀 [Proxy] Method: ${req.method}`);
                console.log(`🔀 [Proxy] Headers enviados:`, JSON.stringify(headers, null, 2));
                console.log(`🔀 [Proxy] Authorization presente: ${headers['authorization'] ? 'SIM (' + headers['authorization'].substring(0, 30) + '...)' : 'NÃO'}`);
                
                // Se houver body, adicionar content-length
                if (bodyData) {
                    headers['content-length'] = Buffer.isBuffer(bodyData) ? bodyData.length : Buffer.byteLength(bodyData);
                    // Log sem mostrar conteúdo binário completo
                    const isMultipart = (headers['content-type'] || '').includes('multipart');
                    if (isMultipart) {
                        console.log(`🔀 [Proxy] Body (${headers['content-length']} bytes): [multipart/form-data - binary]`);
                    } else {
                        console.log(`🔀 [Proxy] Body (${headers['content-length']} bytes):`, bodyData.toString().substring(0, 500));
                    }
                }
                console.log(`🔀 =====================================\n`);
                
                const options = {
                    hostname: url.hostname,
                    port: url.port || 443,
                    path: url.pathname + url.search,
                    method: req.method,
                    headers: headers
                };
                
                const proxyReq = https.request(options, (proxyRes) => {
                    // Log da resposta
                    console.log(`\n🔀 ========== RESPOSTA DO SERVIDOR ==========`);
                    console.log(`🔀 [Proxy] Status: ${proxyRes.statusCode} ${urlPath}`);
                    console.log(`🔀 [Proxy] Headers resposta:`, JSON.stringify(proxyRes.headers, null, 2));
                    console.log(`🔀 ===========================================\n`);
                    
                    // Copiar headers da resposta (exceto alguns que podem causar problemas)
                    const responseHeaders = { ...proxyRes.headers };
                    delete responseHeaders['connection'];
                    delete responseHeaders['transfer-encoding'];
                    delete responseHeaders['content-encoding']; // Pode causar problemas
                    
                    // Adicionar CORS headers se necessário
                    responseHeaders['Access-Control-Allow-Origin'] = '*';
                    responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
                    responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
                    
                    res.writeHead(proxyRes.statusCode, responseHeaders);
                    
                    // Pipe da resposta
                    proxyRes.pipe(res);
                });
                
                proxyReq.on('error', (error) => {
                    console.error(`🔀 [Proxy] Erro ao conectar:`, error.message);
                    console.error(`🔀 [Proxy] URL tentada: ${targetUrl}`);
                    if (!res.headersSent) {
                        res.writeHead(502, { 
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({ 
                            success: false, 
                            message: 'Erro ao conectar com o servidor da API',
                            error: error.message 
                        }));
                    }
                });
                
                // Enviar body se houver
                if (bodyData) {
                    proxyReq.write(bodyData);
                }
                proxyReq.end();
            };
            
            // Para requisições com body, coletar primeiro
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                console.log(`📦 [Server] Coletando body da requisição POST...`);
                const chunks = [];
                req.on('data', chunk => {
                    chunks.push(chunk);
                });
                req.on('end', () => {
                    // Manter como Buffer para preservar dados binários (uploads)
                    const bodyBuffer = Buffer.concat(chunks);
                    console.log(`📦 [Server] Body coletado (${bodyBuffer.length} bytes)`);
                    makeProxyRequest(bodyBuffer.length > 0 ? bodyBuffer : null);
                });
            } else {
                makeProxyRequest();
            }
            
            return; // IMPORTANTE: retornar aqui para não processar como arquivo estático
        } else {
            console.log(`❌ [Server] NÃO é requisição /api/, continuando processamento normal: ${urlPath}`);
        }
        
        // Normalização de segurança
        const sanitizedPath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
        let filePath = path.join(WWW_DIR, sanitizedPath);

        // 1. Se for raiz, serve index.html
        if (urlPath === '/') {
            filePath = path.join(WWW_DIR, 'index.html');
        }

        // 2. Tenta servir o arquivo estático exato
        if (serveFile(filePath, res)) {
            return;
        }

        // 3. LÓGICA SPA (Single Page Application)
        // Se o arquivo não existe, verificamos se devemos entregar o index.html
        const ext = path.extname(urlPath);
        
        // IMPORTANTE: Para rotas que começam com /auth/, /dashboard/, etc (páginas do app),
        // sempre servir index.html para que o router SPA gerencie
        // Isso garante que /auth/login.html seja interceptado pelo router
        const isAppRoute = urlPath.startsWith('/auth/') || 
                          urlPath.startsWith('/dashboard/') ||
                          urlPath.startsWith('/onboarding/') ||
                          urlPath.startsWith('/diary/') ||
                          urlPath.startsWith('/progress/') ||
                          urlPath.startsWith('/explore_') ||
                          urlPath.startsWith('/view_') ||
                          urlPath.startsWith('/edit_') ||
                          urlPath.startsWith('/add_') ||
                          urlPath.startsWith('/create_') ||
                          urlPath.startsWith('/scan_') ||
                          urlPath.startsWith('/routine') ||
                          urlPath.startsWith('/more_') ||
                          urlPath.startsWith('/content') ||
                          urlPath.startsWith('/favorite_') ||
                          urlPath.startsWith('/points_') ||
                          urlPath.startsWith('/measurements_') ||
                          urlPath.startsWith('/ranking') ||
                          (urlPath.endsWith('.html') && !urlPath.startsWith('/assets/') && !urlPath.startsWith('/fragments/'));
        
        // Só faz fallback para index.html se:
        // - Não tiver extensão (rota limpa)
        // - For .html E for uma rota do app (não assets/fragments)
        // Isso evita que imagens/scripts quebrados retornem o HTML do site
        if (!ext || (ext === '.html' && isAppRoute)) {
            console.log(`⚠️  Rota do app, servindo index.html (SPA): ${urlPath}`);
            const indexPath = path.join(WWW_DIR, 'index.html');
            if (serveFile(indexPath, res)) {
                return;
            }
        }
        
        // 4. 404 Real (para assets faltando)
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`404 - Arquivo não encontrado: ${urlPath}`);
        }

    } catch (error) {
        console.error('🔥 Erro crítico:', error);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Erro interno do servidor');
        }
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR SPA INICIADO`);
    console.log(`👉 URL: http://localhost:${PORT}`);
    console.log(`📁 Raiz: ${WWW_DIR}`);
    console.log(`⌨️  Ctrl+C para parar\n`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ A porta ${PORT} já está em uso!`);
    } else {
        console.error('❌ Erro ao iniciar servidor:', error.message);
    }
    process.exit(1);
});