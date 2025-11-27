# Como Adicionar Ícone no App Store Connect

## 📍 Onde você está agora:
Você está na página **"Informações do app"** (App Information). Para adicionar o ícone, você precisa ir para outra seção.

## 🎯 Passo a Passo:

### 1. **Ir para a seção onde adiciona o ícone:**
   - Na barra lateral esquerda, clique em **"1.0 Preparar para envio"** (embaixo de "App para iOS")
   - Isso vai abrir a página de preparação para envio

### 2. **Adicionar o ícone do app:**
   - Na página de preparação, procure pela seção **"Ícone do app"** ou **"App Icon"**
   - Clique em **"Escolher arquivo"** ou **"Choose File"**
   - Selecione uma imagem PNG de **1024x1024 pixels**
   - O ícone deve:
     - ✅ Ser quadrado (1024x1024px)
     - ✅ Ser PNG
     - ✅ Não ter transparência (fundo sólido)
     - ✅ Não ter cantos arredondados (a Apple arredonda automaticamente)
     - ✅ Não ter texto ou números (exceto se for parte do design)

### 3. **Ver o build enviado:**
   - Na mesma página "1.0 Preparar para envio"
   - Procure pela seção **"Build"** 
   - Você verá: **"Build #17"** disponível
   - Selecione esse build

## 📸 Você tem ícone no projeto?
Verifique se você tem um arquivo de ícone em:
- `resources/icon.png`
- `www/assets/images/icon-512x512.png`

Se não tiver, você pode:
1. Usar o logo do ShapeFit que você tem (`www/assets/images/SHAPE-FIT-LOGO.png`)
2. Criar um ícone 1024x1024 baseado nesse logo
3. Ou usar qualquer design de ícone que represente o app

## ⚠️ Importante:
- O ícone é **obrigatório** para publicar na App Store
- Você precisa fazer upload do ícone antes de enviar para revisão
- O ícone que você adiciona aqui aparece na App Store, não o que está no código (esse aparece no dispositivo)

