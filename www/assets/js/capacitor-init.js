// www/assets/js/capacitor-init.js
// Inicialização do Capacitor para iOS/Android
// Otimizado para evitar flash de conteúdo vazio

(function() {
    'use strict';
    
    // Marcar que estamos em ambiente nativo IMEDIATAMENTE
    window._isNativeApp = typeof window.Capacitor !== 'undefined';
    
    // Só executar se estiver no Capacitor
    if (!window._isNativeApp) {
        // ✅ Log removido para performance
        return;
    }

    // ✅ Log removido para performance
    
    // Cor de fundo do app (deve combinar com o CSS)
    const APP_BG_COLOR = '#121212';
    
    // Detectar plataforma
    const isIOS = window.Capacitor.getPlatform() === 'ios';
    const isAndroid = window.Capacitor.getPlatform() === 'android';
    
    // Adicionar classe ao body para estilos específicos IMEDIATAMENTE
    // Isso permite que o CSS ajuste transições antes do primeiro render
    if (isAndroid) {
        document.body.classList.add('android-mobile');
        document.documentElement.classList.add('native-app');
    } else if (isIOS) {
        document.body.classList.add('ios-mobile');
        document.documentElement.classList.add('native-app');
    }
    
    // === OTIMIZAÇÃO: Esconder container até dados carregarem ===
    // No ambiente nativo, o splash screen já cobre o app
    // Então podemos carregar dados ANTES de mostrar o conteúdo
    window._nativeAppReady = false;

    // ============================================
    // STATUS BAR
    // ============================================
    async function setupStatusBar() {
        try {
            const { StatusBar } = window.Capacitor.Plugins;
            if (!StatusBar) {
                // ✅ Log removido para performance
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
            
            // ✅ Log removido para performance
        } catch (error) {
            console.error('❌ [Capacitor] Erro StatusBar:', error);
        }
    }

    // ============================================
    // SPLASH SCREEN - OTIMIZADO
    // ============================================
    async function hideSplash() {
        try {
            const { SplashScreen } = window.Capacitor.Plugins;
            if (!SplashScreen) return;
            
            // Aguardar até que o conteúdo esteja realmente pronto
            // Isso evita o flash de página vazia no iOS
            await waitForContentReady();
            
            // Fade out suave do splash
            await SplashScreen.hide({ fadeOutDuration: 250 });
            
            window._nativeAppReady = true;
            // ✅ Log removido para performance
        } catch (error) {
            console.error('❌ [Capacitor] Erro SplashScreen:', error);
            // Forçar esconder mesmo com erro após timeout
            try {
                const { SplashScreen } = window.Capacitor.Plugins;
                await SplashScreen.hide({ fadeOutDuration: 100 });
            } catch (e) {}
        }
    }
    
    // Esperar até que o conteúdo da página esteja visível
    function waitForContentReady() {
        return new Promise((resolve) => {
            // Timeout máximo de 2 segundos
            const maxTimeout = setTimeout(resolve, 2000);
            
            // Verificar se o container já tem conteúdo
            function checkContent() {
                const container = document.getElementById('app-container');
                const hasContent = container && container.innerHTML.trim().length > 100;
                const hasVisibleContent = container && !container.classList.contains('page-loading');
                
                if (hasContent && hasVisibleContent) {
                    clearTimeout(maxTimeout);
                    // Pequeno delay extra para garantir render completo
                    setTimeout(resolve, 100);
                    return true;
                }
                return false;
            }
            
            // Verificar imediatamente
            if (checkContent()) return;
            
            // Ouvir evento de página carregada do router
            window.addEventListener('pageLoaded', () => {
                clearTimeout(maxTimeout);
                // Aguardar um frame para o render
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            }, { once: true });
            
            // Fallback: verificar periodicamente
            const interval = setInterval(() => {
                if (checkContent()) {
                    clearInterval(interval);
                }
            }, 50);
            
            // Limpar interval no timeout
            setTimeout(() => clearInterval(interval), 2000);
        });
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
            
            // ✅ Log removido para performance
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
                // ✅ Log removido para performance
            });

            // App retomado (voltou do background)
            App.addListener('resume', () => {
                // ✅ Log removido para performance
                // Re-configurar status bar ao voltar (fix iOS)
                setupStatusBar();
            });
            
            // ✅ Log removido para performance
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

    // ✅ Log removido para performance
})();
