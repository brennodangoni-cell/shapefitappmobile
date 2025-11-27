# 📦 Opções de Plugins para Scanner de Código de Barras

## ✅ Opção 1: `phonegap-plugin-barcodescanner` (RECOMENDADO)

**Por que escolher:**
- ✅ Plugin mais popular e testado (milhares de downloads)
- ✅ Funciona perfeitamente com Capacitor
- ✅ Suporte nativo iOS e Android
- ✅ Interface simples e confiável
- ✅ Muito estável

**Instalação:**
```bash
npm install phonegap-plugin-barcodescanner
npx cap sync
```

**Uso:**
```javascript
cordova.plugins.barcodeScanner.scan(
  function (result) {
    // result.text = código escaneado
    // result.format = formato (EAN_13, etc)
  },
  function (error) {
    // erro
  },
  {
    preferFrontCamera: false,
    showFlipCameraButton: true,
    showTorchButton: true,
    formats: "EAN_13,EAN_8,CODE_128,CODE_39,CODE_93,CODABAR,QR_CODE"
  }
);
```

---

## ✅ Opção 2: `@capacitor-community/barcode-scanner`

**Por que escolher:**
- ✅ Plugin da comunidade Capacitor
- ✅ Feito especificamente para Capacitor (não Cordova)
- ✅ API moderna e TypeScript

**Instalação:**
```bash
npm install @capacitor-community/barcode-scanner
npx cap sync
```

**Uso:**
```javascript
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';

const result = await BarcodeScanner.startScan({
  targetedFormats: ['EAN_13', 'EAN_8', 'CODE_128']
});
```

---

## ✅ Opção 3: `cordova-plugin-mlkit-barcode-scanner`

**Por que escolher:**
- ✅ Usa Google ML Kit (mesma base do atual, mas implementação diferente)
- ✅ Rápido e eficiente
- ✅ Suporta muitos formatos

**Instalação:**
```bash
npm install cordova-plugin-mlkit-barcode-scanner
npx cap sync
```

**Uso:**
```javascript
window.MLKitBarcodeScanner.scan(
  {
    formats: ['EAN_13', 'EAN_8', 'CODE_128'],
    beepOnSuccess: true
  },
  function(result) {
    // result.text = código escaneado
  },
  function(error) {
    // erro
  }
);
```

---

## 🎯 RECOMENDAÇÃO: Testar `phonegap-plugin-barcodescanner` PRIMEIRO

É o mais confiável e tem melhor compatibilidade com Capacitor. Se não funcionar, testamos as outras opções.

