// www/assets/js/capacitor-init.js
// Inicialização do Capacitor para iOS/Android

(function() {
    // Só executar se estiver no Capacitor
    if (typeof window.Capacitor === 'undefined') {
        console.log('📱 [Capacitor] Não está em ambiente nativo, pulando inicialização');
        return;
    }

    console.log('📱 [Capacitor] Inicializando plugins nativos...');

    // Aguardar o DOM estar pronto
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            // Configurar StatusBar
            if (window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
                const StatusBar = window.Capacitor.Plugins.StatusBar;
                
                // Estilo escuro (texto branco) para combinar com nosso tema
                await StatusBar.setStyle({ style: 'DARK' });
                
                // Fundo transparente para tela cheia
                await StatusBar.setBackgroundColor({ color: '#00000000' });
                
                // Sobrepor o WebView (tela cheia)
                await StatusBar.setOverlaysWebView({ overlay: true });
                
                console.log('✅ [Capacitor] StatusBar configurado');
            }

            // Esconder Splash Screen após carregamento
            if (window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
                const SplashScreen = window.Capacitor.Plugins.SplashScreen;
                await SplashScreen.hide();
                console.log('✅ [Capacitor] SplashScreen ocultado');
            }

        } catch (error) {
            console.error('❌ [Capacitor] Erro na inicialização:', error);
        }
    });

    // Tratar eventos do app (voltar, pausar, etc)
    if (window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const App = window.Capacitor.Plugins.App;
        
        // Botão voltar do Android
        App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                // Opcional: minimizar app ou mostrar confirmação de saída
                App.minimizeApp();
            }
        });

        // App pausado (em background)
        App.addListener('pause', () => {
            console.log('📱 [App] Em background');
        });

        // App retomado (voltou do background)
        App.addListener('resume', () => {
            console.log('📱 [App] Retomado');
        });
    }

})();

