
/**
 * Script Inline Protegido - inline_0
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        function setRealViewportHeight() { 
            const vh = window.innerHeight * 0.01; 
            document.documentElement.style.setProperty('--vh', `${vh}px`); 
        }
        setRealViewportHeight();
        window.addEventListener('resize', setRealViewportHeight);
        window.addEventListener('orientationchange', function() {
            setTimeout(setRealViewportHeight, 100);
        });
        
        document.addEventListener('touchmove', function(event) {
            // Só processar se estiver na página explore_recipes
            const isExploreRecipesPage = document.querySelector('.explore-recipes-container, .recipes-grid');
            if (!isExploreRecipesPage) return;
            
            const scrollable = event.target.closest('.app-container, .container');
            if (!scrollable) {
                event.preventDefault();
            }
        }, { passive: false });
    
})();
