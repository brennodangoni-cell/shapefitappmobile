# 📦 RESUMO: O que MANTER e o que APAGAR

## ✅ MANTER (NÃO APAGAR NUNCA)

```
public_html/
├── api/              ✅ MANTER TUDO
├── includes/         ✅ MANTER TUDO
├── admin/            ✅ MANTER TUDO (se existir)
├── whitelabel/       ✅ MANTER TUDO
├── uploads/          ✅ MANTER TUDO (fotos de usuários!)
├── actions/          ✅ MANTER TUDO (se existir)
├── nutrifity/        ✅ MANTER TUDO
├── nutritop/         ✅ MANTER TUDO
└── data_import/      ✅ MANTER TUDO
```

---

## 🗑️ PODE APAGAR (após testar que tudo funciona)

### Páginas antigas na raiz:
- ❌ `*.html` (exceto `index.html`, `offline.html`, `suporte.html`, `privacidade.html`)
- ❌ `*.php` (exceto `index.php` se for usado)

### Exemplos específicos:
- ❌ `dashboard.html`, `dashboard.php`
- ❌ `diary.html`, `diary.php`
- ❌ `main_app.html`, `main_app.php`
- ❌ `auth/login.html`, `auth/login.php`
- ❌ `onboarding/*.html`, `onboarding/*.php`
- ❌ `process_*.php` (se APIs já fazem o trabalho)

**⚠️ IMPORTANTE:** Fazer backup antes de apagar!

---

## 📝 O QUE FAZER

### 1. Upload da pasta `web/`
```
web/ → public_html/
```

### 2. Substituir `.htaccess`
- Usar o arquivo `.htaccess.MERGED` que está na pasta `web/`
- Ele combina regras antigas + novas do SPA

### 3. Testar
- ✅ `https://appshapefit.com/`
- ✅ `https://appshapefit.com/diary`
- ✅ `https://appshapefit.com/api/verify_token.php`

### 4. Limpar (opcional)
- Apagar páginas antigas listadas acima
- **SÓ DEPOIS de confirmar que tudo funciona!**

---

## ⚠️ ATENÇÃO

- **NUNCA** apagar `api/`, `includes/`, `uploads/`
- **SEMPRE** fazer backup antes de mudanças
- **TESTAR** tudo antes de apagar arquivos antigos
