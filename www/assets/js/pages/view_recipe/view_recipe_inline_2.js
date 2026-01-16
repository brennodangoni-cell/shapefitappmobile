
/**
 * Script Inline Protegido - inline_2
 * Envolvido em IIFE para evitar conflitos de variáveis globais.
 */
(function() {

        if (typeof getLocalDateString !== 'function') {
            window.getLocalDateString = function(date = null) {
                const d = date ? new Date(date) : new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
        }
        if (typeof addDaysLocal !== 'function') {
            window.addDaysLocal = function(dateStr, days) {
                const d = new Date(dateStr + 'T00:00:00');
                d.setDate(d.getDate() + days);
                return getLocalDateString(d);
            };
        }
    
})();
