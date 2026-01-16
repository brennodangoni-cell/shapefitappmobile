// www/assets/js/toast-helper.js
// Versão Híbrida: Funciona na Web e no App

const ToastHelper = {
  show: async (options) => {
      const message = options.text || options;
      
      // Verifica se está rodando no ambiente nativo (Capacitor)
      if (window.Capacitor && window.Capacitor.isNative) {
          try {
              // Tenta carregar o plugin nativo dinamicamente
              const { Toast } = await import('https://cdn.jsdelivr.net/npm/@capacitor/toast@latest/dist/toast.js'); 
              // Nota: Em produção nativa, o import acima falharia sem bundler, 
              // mas no nativo o plugin já estaria injetado.
              // Para simplificar o teste local, vamos usar um fallback visual:
              console.log('📱 [Toast Nativo]:', message);
          } catch (e) {
              console.log('📱 [Toast Simulado]:', message);
              showWebToast(message);
          }
      } else {
          // Versão Web (PC)
          showWebToast(message);
      }
  }
};

// Função auxiliar para criar um toast visual bonito no PC
function showWebToast(message) {
  const div = document.createElement('div');
  div.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: white; padding: 12px 24px;
      border-radius: 25px; font-family: sans-serif; z-index: 9999;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.3s;
  `;
  div.textContent = message;
  document.body.appendChild(div);
  
  // Animação
  setTimeout(() => div.style.opacity = '1', 10);
  setTimeout(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 300);
  }, 3000);
}

// Exporta para quem usa module
export default ToastHelper;

// Exporta globalmente para scripts legados
window.ToastHelper = ToastHelper;