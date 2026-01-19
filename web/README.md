# ShapeFit - Versão WEB

Esta é a versão WEB do app ShapeFit, adaptada para funcionar em navegadores.

## 📂 Estrutura

```
web/
├── .htaccess          # Configuração Apache para SPA
├── index.html         # Página principal
├── assets/            # CSS, JS, imagens
├── fragments/         # Páginas do SPA
└── manifest.json      # PWA manifest
```

## 🚀 Como fazer Deploy

### 1. Upload para o servidor

Faça upload de **TODO o conteúdo desta pasta `web/`** para o domínio `appshapefit.com`.

**Estrutura no servidor deve ficar:**
```
public_html/
├── .htaccess          # ✅ IMPORTANTE!
├── index.html
├── assets/
├── fragments/
├── manifest.json
├── api/               # APIs já existentes (não mexer)
├── admin/             # Painel admin (não mexer)
└── includes/          # Arquivos PHP (não mexer)
```

### 2. Verificar .htaccess

O arquivo `.htaccess` é **ESSENCIAL** para o SPA funcionar. Ele:
- Redireciona HTTP para HTTPS
- Faz todas as URLs apontarem para `index.html`
- Habilita cache para arquivos estáticos
- Adiciona headers de segurança

**IMPORTANTE:** O `.htaccess` já está configurado na raiz da pasta `web/`.

### 3. Testar

Após o upload, acesse:
- `https://appshapefit.com/` → Deve carregar o app
- `https://appshapefit.com/diary` → Deve funcionar (sem 404)
- `https://appshapefit.com/main_app.html` → Deve funcionar

## 🔧 Diferenças da versão iOS

- ✅ Sem Capacitor (código comentado)
- ✅ `.htaccess` para routing do SPA
- ✅ Funciona em qualquer navegador
- ✅ URLs diretas funcionam (ex: `/diary`)
- ✅ APIs continuam apontando para `appshapefit.com/api`

## 📱 PWA (Progressive Web App)

O app pode ser instalado como PWA:
- ✅ `manifest.json` configurado
- ✅ Service Worker (`sw.js`)
- ✅ Ícones em vários tamanhos
- ✅ Funciona offline (parcial)

## ⚠️ Troubleshooting

### URLs dando 404
- Verifique se o `.htaccess` foi enviado para o servidor
- Alguns FTPs ignoram arquivos começando com `.` (ative "mostrar arquivos ocultos")

### APIs não funcionando
- Verifique se a pasta `api/` está no mesmo nível do `index.html`
- URLs devem estar corretas: `https://appshapefit.com/api/...`

### Banners não carregando
- Verifique se a pasta `assets/banners/` existe no servidor
- O `.htaccess` dentro dela permite acesso aos arquivos

## 🔗 URLs Importantes

- **App Web:** https://appshapefit.com/
- **Login:** https://appshapefit.com/auth/login.html
- **Dashboard:** https://appshapefit.com/main_app.html
- **Diário:** https://appshapefit.com/diary

---

**Nota:** Esta pasta `web/` é INDEPENDENTE da pasta `www/` (que é para iOS). Mudanças aqui não afetam o app iOS.
