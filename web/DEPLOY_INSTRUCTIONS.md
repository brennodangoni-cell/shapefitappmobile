# 📋 Instruções de Deploy - Versão WEB ShapeFit

## ⚠️ IMPORTANTE: O que MANTER no servidor

### ✅ MANTER (CRÍTICO - NÃO APAGAR)

#### 1. **Pasta `api/`** (TODA)
```
api/
├── add_entire_meal.php
├── authenticate_with_token.php
├── challenge_rooms.php
├── checkin.php
├── get_dashboard_data.php
├── get_diary_data.php
├── login.php
├── register.php
├── verify_token.php
└── ... (TODOS os arquivos)
```
**Motivo:** APIs são usadas pelo app. Sem elas, nada funciona.

---

#### 2. **Pasta `includes/`** (TODA)
```
includes/
├── config.php
├── db.php
├── functions.php
├── layout_header.php
├── layout_footer.php
└── ... (TODOS os arquivos)
```
**Motivo:** Configurações de banco de dados e funções compartilhadas.

---

#### 3. **Pasta `admin/`** (se existir)
```
admin/
└── ... (TODOS os arquivos)
```
**Motivo:** Painel administrativo do nutricionista.

---

#### 4. **Pasta `whitelabel/`** (TODA)
```
whitelabel/
├── admin/
├── api/
├── includes/
└── ... (TODOS os arquivos)
```
**Motivo:** Sistema multi-tenant (white label).

---

#### 5. **Pasta `uploads/`** (TODA)
```
uploads/
├── measurements/
└── ... (TODOS os arquivos)
```
**Motivo:** Fotos de usuários e medições. **NÃO APAGAR!**

---

#### 6. **Pasta `actions/`** (se existir)
```
actions/
└── ... (TODOS os arquivos)
```
**Motivo:** Scripts de processamento.

---

#### 7. **Outras pastas importantes:**
- `nutrifity/` - Manter
- `nutritop/` - Manter
- `data_import/` - Manter (dados do TACO)

---

## 🗑️ O que PODE SER REMOVIDO (substituído pela versão SPA)

### ❌ PÁGINAS ANTIGAS (HTML/PHP na raiz)

Estas páginas são da versão antiga e serão substituídas pela versão SPA:

```
❌ add_food_to_diary.html
❌ add_food_to_diary.php
❌ dashboard.html
❌ dashboard.php
❌ diary.html
❌ diary.php
❌ edit_exercises.html
❌ edit_meal.html
❌ edit_meal.php
❌ edit_profile.html
❌ edit_profile.php
❌ explore_recipes.html
❌ explore_recipes.php
❌ favorite_recipes.html
❌ favorite_recipes.php
❌ main_app.html
❌ main_app.php
❌ measurements_progress.html
❌ measurements_progress.php
❌ points_history.html
❌ points_history.php
❌ progress.html
❌ progress.php
❌ ranking.html
❌ ranking.php
❌ routine.html
❌ view_content.html
❌ view_content.php
❌ view_recipe.html
❌ view_recipe.php
❌ weekly_checkin.php
❌ account_deleted.php
❌ delete_account.php
❌ meal_types_overview.php
❌ profile_overview.php
❌ tutorial.php
❌ privacidade.html
❌ privacy.php
❌ suporte.html
```

**⚠️ ATENÇÃO:** Antes de apagar, **FAÇA BACKUP** ou teste primeiro!

---

### ❌ PROCESSADORES ANTIGOS (se não forem usados)

Estes podem ser removidos se as APIs já fazem o mesmo trabalho:

```
❌ process_add_entire_meal.php
❌ process_delete_meal.php
❌ process_edit_meal.php
❌ process_log_meal.php
❌ process_save_custom_food.php
❌ get_view_content_data.php
❌ register_content_view.php
```

**⚠️ VERIFICAR:** Se alguma API ou código ainda usa esses arquivos antes de apagar.

---

### ❌ AUTH ANTIGO (se não for usado)

```
❌ auth/login.html
❌ auth/login.php
❌ auth/logout.php
❌ auth/register.html
❌ auth/register.php
❌ auth/reset_password.html
```

**⚠️ VERIFICAR:** A versão SPA usa `/fragments/auth_login.html`, mas pode haver links antigos.

---

### ❌ ONBOARDING ANTIGO (se não for usado)

```
❌ onboarding/onboarding.html
❌ onboarding/onboarding.php
❌ onboarding/process_onboarding.php
```

**⚠️ VERIFICAR:** Se o SPA já tem onboarding próprio.

---

## 📝 Arquivos que PRECISAM SER ATUALIZADOS

### 1. **`.htaccess` na raiz**

O `.htaccess` atual tem regras antigas. **MESCLAR** com o novo `.htaccess` da pasta `web/`:

**Regras ANTIGAS a MANTER:**
```apache
RewriteCond %{HTTP:X-Auth-Token} .
RewriteRule .* - [E=HTTP_X_AUTH_TOKEN:%{HTTP:X-Auth-Token}]

AddType application/zip .lottie

RewriteRule ^suporte/?$ suporte.html [L]
RewriteRule ^privacidade/?$ privacidade.html [L]
```

**Regras NOVAS a ADICIONAR (do `web/.htaccess`):**
```apache
RewriteEngine On
RewriteBase /

# Redirecionar HTTP para HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Permitir acesso a arquivos e diretórios reais
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Redirecionar todas as outras requisições para index.html (SPA)
RewriteRule ^(.*)$ /index.html [L]
```

**⚠️ ORDEM IMPORTANTE:** As regras do SPA devem vir **DEPOIS** das regras específicas (suporte, privacidade).

---

## 🚀 Passo a Passo do Deploy

### 1. **Fazer Backup Completo**
```bash
# Fazer backup de TUDO antes de começar
```

### 2. **Upload da pasta `web/`**
- Fazer upload de **TODO o conteúdo** da pasta `web/` para a raiz do servidor (`public_html/`)
- **NÃO sobrescrever** as pastas `api/`, `includes/`, `admin/`, `whitelabel/`, `uploads/`

### 3. **Atualizar `.htaccess`**
- **MESCLAR** o `.htaccess` antigo com o novo
- Manter regras antigas + adicionar regras do SPA

### 4. **Verificar permissões**
```bash
# Garantir que index.html tem permissão de leitura
chmod 644 index.html

# Garantir que .htaccess tem permissão de leitura
chmod 644 .htaccess
```

### 5. **Testar URLs**
- ✅ `https://appshapefit.com/` → Deve carregar o app
- ✅ `https://appshapefit.com/diary` → Deve funcionar (sem 404)
- ✅ `https://appshapefit.com/main_app.html` → Deve funcionar
- ✅ `https://appshapefit.com/api/verify_token.php` → Deve funcionar (API)

### 6. **Limpar páginas antigas (OPCIONAL)**
- Após confirmar que tudo funciona, pode remover as páginas antigas listadas acima
- **FAZER BACKUP ANTES!**

---

## 🔍 Checklist Final

Antes de considerar o deploy completo, verificar:

- [ ] Backup completo feito
- [ ] Pasta `api/` intacta
- [ ] Pasta `includes/` intacta
- [ ] Pasta `admin/` intacta (se existir)
- [ ] Pasta `whitelabel/` intacta
- [ ] Pasta `uploads/` intacta
- [ ] `.htaccess` mesclado corretamente
- [ ] `index.html` da versão web no lugar
- [ ] Pasta `fragments/` no lugar
- [ ] Pasta `assets/` no lugar
- [ ] Testes de URLs funcionando
- [ ] APIs respondendo corretamente
- [ ] Login funcionando
- [ ] Dashboard carregando

---

## ⚠️ Problemas Comuns

### URLs dando 404
- Verificar se `.htaccess` foi enviado corretamente
- Verificar se `mod_rewrite` está habilitado no Apache
- Verificar permissões do arquivo

### APIs não funcionando
- Verificar se pasta `api/` está no lugar
- Verificar CORS no `.htaccess`
- Verificar se URLs estão corretas no `config.js`

### Banners não carregando
- Verificar se pasta `assets/banners/` existe
- Verificar `.htaccess` dentro de `assets/banners/`

---

## 📞 Suporte

Se algo der errado:
1. Reverter para o backup
2. Verificar logs do servidor
3. Verificar console do navegador (F12)

---

**Última atualização:** 2026-01-19
