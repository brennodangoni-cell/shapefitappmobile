// www/assets/js/capacitor-init.js
// Inicialização do Capacitor para iOS/Android

(function() {
    // Só executar se estiver no Capacitor
    if (typeof window.Capacitor === 'undefined') {
        console.log('📱 [Capacitor] Não está em ambiente nativo, pulando inicialização');
        return;
    }

    console.log('📱 [Capacitor] Inicializando plugins nativos...');
    
    // Cor de fundo do app (deve combinar com o CSS)
    const APP_BG_COLOR = '#121212';

    // Função para configurar StatusBar
    async function setupStatusBar() {
        try {
            const { StatusBar } = window.Capacitor.Plugins;
            if (!StatusBar) {
                console.log('⚠️ [Capacitor] StatusBar plugin não disponível');
                return;
            }
            
            // iOS: Status bar com texto branco (Dark = texto claro)
            await StatusBar.setStyle({ style: 'Dark' });
            
            // Cor de fundo igual ao app
            await StatusBar.setBackgroundColor({ color: APP_BG_COLOR });
            
            // CRÍTICO: WebView por baixo da status bar (tela cheia)
            await StatusBar.setOverlaysWebView({ overlay: true });
            
            console.log('✅ [Capacitor] StatusBar configurado');
        } catch (error) {
            console.error('❌ [Capacitor] Erro StatusBar:', error);
        }
    }

    // Função para esconder Splash
    async function hideSplash() {
        try {
            const { SplashScreen } = window.Capacitor.Plugins;
            if (!SplashScreen) return;
            
            await SplashScreen.hide();
            console.log('✅ [Capacitor] SplashScreen ocultado');
        } catch (error) {
            console.error('❌ [Capacitor] Erro SplashScreen:', error);
        }
    }

    // Configurar imediatamente (não esperar DOMContentLoaded)
    setupStatusBar();

    // Aguardar o DOM estar pronto para o resto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideSplash);
    } else {
        hideSplash();
    }

    // Tratar eventos do app (voltar, pausar, etc)
    try {
        const { App } = window.Capacitor.Plugins;
        if (App) {
            // Botão voltar do Android
            App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
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
                // Re-configurar status bar ao voltar (fix iOS)
                setupStatusBar();
            });
        }
    } catch (error) {
        console.error('❌ [Capacitor] Erro App listeners:', error);
    }

})();

