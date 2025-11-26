// www/assets/js/capacitor-init.js
// Inicialização do Capacitor para iOS/Android

(function() {
    'use strict';
    
    // Só executar se estiver no Capacitor
    if (typeof window.Capacitor === 'undefined') {
        console.log('📱 [Capacitor] Não está em ambiente nativo, pulando inicialização');
        return;
    }

    console.log('📱 [Capacitor] Inicializando plugins nativos...');
    
    // Cor de fundo do app (deve combinar com o CSS)
    const APP_BG_COLOR = '#121212';
    
    // Detectar plataforma
    const isIOS = window.Capacitor.getPlatform() === 'ios';
    const isAndroid = window.Capacitor.getPlatform() === 'android';
    
    // Adicionar classe ao body para estilos específicos
    if (isAndroid) {
        document.body.classList.add('android-mobile');
    } else if (isIOS) {
        document.body.classList.add('ios-mobile');
    }

    // ============================================
    // STATUS BAR
    // ============================================
    async function setupStatusBar() {
        try {
            const { StatusBar } = window.Capacitor.Plugins;
            if (!StatusBar) {
                console.log('⚠️ [Capacitor] StatusBar plugin não disponível');
                return;
            }
            
            // Estilo: Dark = texto branco (para fundo escuro)
            await StatusBar.setStyle({ style: 'Dark' });
            
            // Cor de fundo (principalmente para Android)
            if (isAndroid) {
                await StatusBar.setBackgroundColor({ color: APP_BG_COLOR });
            }
            
            // iOS: WebView deve aparecer por baixo da status bar (tela cheia)
            await StatusBar.setOverlaysWebView({ overlay: true });
            
            console.log('✅ [Capacitor] StatusBar configurado');
        } catch (error) {
            console.error('❌ [Capacitor] Erro StatusBar:', error);
        }
    }

    // ============================================
    // SPLASH SCREEN
    // ============================================
    async function hideSplash() {
        try {
            const { SplashScreen } = window.Capacitor.Plugins;
            if (!SplashScreen) return;
            
            // Aguardar um pouco para o app carregar
            await new Promise(resolve => setTimeout(resolve, 300));
            await SplashScreen.hide({ fadeOutDuration: 300 });
            
            console.log('✅ [Capacitor] SplashScreen ocultado');
        } catch (error) {
            console.error('❌ [Capacitor] Erro SplashScreen:', error);
        }
    }

    // ============================================
    // KEYBOARD (iOS)
    // ============================================
    async function setupKeyboard() {
        try {
            const { Keyboard } = window.Capacitor.Plugins;
            if (!Keyboard) return;
            
            // iOS: Ajustar scroll quando teclado aparecer
            Keyboard.addListener('keyboardWillShow', (info) => {
                document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
                document.body.classList.add('keyboard-visible');
            });
            
            Keyboard.addListener('keyboardWillHide', () => {
                document.body.style.setProperty('--keyboard-height', '0px');
                document.body.classList.remove('keyboard-visible');
            });
            
            console.log('✅ [Capacitor] Keyboard listeners configurados');
        } catch (error) {
            // Plugin não instalado, ignorar
        }
    }

    // ============================================
    // APP LIFECYCLE
    // ============================================
    function setupAppListeners() {
        try {
            const { App } = window.Capacitor.Plugins;
            if (!App) return;
            
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
            
            console.log('✅ [Capacitor] App listeners configurados');
        } catch (error) {
            console.error('❌ [Capacitor] Erro App listeners:', error);
        }
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    // Configurar StatusBar imediatamente
    setupStatusBar();
    
    // Configurar listeners
    setupAppListeners();
    setupKeyboard();

    // Aguardar DOM e esconder splash
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideSplash);
    } else {
        hideSplash();
    }

    console.log(`📱 [Capacitor] Plataforma: ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Web'}`);
})();
