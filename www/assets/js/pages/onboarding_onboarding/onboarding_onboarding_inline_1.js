
/**
 * Script Inline Protegido - inline_1
 * Compatível com SPA - executa imediatamente
 */
(function() {
        // Evitar execução dupla
        if (window._onboardingLoaded) return;
        window._onboardingLoaded = true;

        // Carregar estados (UF) da API do IBGE
        async function loadStates() {
            try {
                const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
                const estados = await response.json();
                const ufSelect = document.getElementById('uf-select');
                if (!ufSelect) return;
                estados.forEach(uf => {
                    const option = document.createElement('option');
                    option.value = uf.sigla;
                    option.textContent = uf.sigla;
                    ufSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Erro ao carregar estados:', error);
            }
        }

        // Lista antiga removida - usando lista completa abaixo

        // Função para converter código ISO2 para emoji de bandeira
        function getCountryFlagEmoji(countryCode) {
            try {
                const codePoints = countryCode
                    .toUpperCase()
                    .split('')
                    .map(char => 127397 + char.charCodeAt());
                const emoji = String.fromCodePoint(...codePoints);
                if (emoji && emoji.length > 0) {
                    return emoji;
                }
            } catch (e) {
                console.warn('Erro ao gerar emoji de bandeira:', e);
            }
            return countryCode.toUpperCase();
        }

        // Função para converter formato de string (ex: "(##) #####-####") para função de formatação
        function createFormatFunction(formatPattern) {
            return (v) => {
                const clean = v.replace(/\D/g, '');
                if (!clean) return '';
                
                let result = '';
                let digitIndex = 0;
                
                for (let i = 0; i < formatPattern.length && digitIndex < clean.length; i++) {
                    const char = formatPattern[i];
                    if (char === '#') {
                        result += clean[digitIndex];
                        digitIndex++;
                    } else {
                        result += char;
                    }
                }
                
                // Adicionar dígitos restantes se houver
                if (digitIndex < clean.length) {
                    result += clean.substring(digitIndex);
                }
                
                return result;
            };
        }

        // Função para gerar placeholder baseado no formato
        function generatePlaceholder(formatPattern) {
            return formatPattern.replace(/#/g, '0');
        }

        // Lista completa de países (mesma do admin)
        const countriesListRaw = [
            { code: 'BR', name: 'Brasil', dialCode: '55', format: '(##) #####-####' },
            { code: 'US', name: 'Estados Unidos', dialCode: '1', format: '(###) ###-####' },
            { code: 'CA', name: 'Canadá', dialCode: '1', format: '(###) ###-####' },
            { code: 'AR', name: 'Argentina', dialCode: '54', format: '(##) ####-####' },
            { code: 'PT', name: 'Portugal', dialCode: '351', format: '### ### ###' },
            { code: 'ES', name: 'Espanha', dialCode: '34', format: '### ### ###' },
            { code: 'MX', name: 'México', dialCode: '52', format: '## #### ####' },
            { code: 'CL', name: 'Chile', dialCode: '56', format: '# #### ####' },
            { code: 'CO', name: 'Colômbia', dialCode: '57', format: '### ### ####' },
            { code: 'PE', name: 'Peru', dialCode: '51', format: '### ### ###' },
            { code: 'UY', name: 'Uruguai', dialCode: '598', format: '#### ####' },
            { code: 'PY', name: 'Paraguai', dialCode: '595', format: '#### ######' },
            { code: 'BO', name: 'Bolívia', dialCode: '591', format: '# #### ####' },
            { code: 'VE', name: 'Venezuela', dialCode: '58', format: '####-#######' },
            { code: 'EC', name: 'Equador', dialCode: '593', format: '## ### ####' },
            { code: 'GB', name: 'Reino Unido', dialCode: '44', format: '#### ######' },
            { code: 'FR', name: 'França', dialCode: '33', format: '# ## ## ## ##' },
            { code: 'DE', name: 'Alemanha', dialCode: '49', format: '#### ########' },
            { code: 'IT', name: 'Itália', dialCode: '39', format: '### ### ####' },
            { code: 'AU', name: 'Austrália', dialCode: '61', format: '# #### ####' },
            { code: 'JP', name: 'Japão', dialCode: '81', format: '##-####-####' },
            { code: 'CN', name: 'China', dialCode: '86', format: '### #### ####' },
            { code: 'IN', name: 'Índia', dialCode: '91', format: '##### #####' },
            { code: 'RU', name: 'Rússia', dialCode: '7', format: '(###) ###-##-##' },
            { code: 'KR', name: 'Coreia do Sul', dialCode: '82', format: '##-####-####' },
            { code: 'ZA', name: 'África do Sul', dialCode: '27', format: '## ### ####' },
            { code: 'AE', name: 'Emirados Árabes', dialCode: '971', format: '# ### ####' },
            { code: 'SA', name: 'Arábia Saudita', dialCode: '966', format: '# ### ####' },
            { code: 'EG', name: 'Egito', dialCode: '20', format: '### ### ####' },
            { code: 'NG', name: 'Nigéria', dialCode: '234', format: '### ### ####' },
            { code: 'NL', name: 'Holanda', dialCode: '31', format: '# #### ####' },
            { code: 'BE', name: 'Bélgica', dialCode: '32', format: '### ## ## ##' },
            { code: 'CH', name: 'Suíça', dialCode: '41', format: '## ### ## ##' },
            { code: 'AT', name: 'Áustria', dialCode: '43', format: '#### ########' },
            { code: 'SE', name: 'Suécia', dialCode: '46', format: '##-### ## ##' },
            { code: 'NO', name: 'Noruega', dialCode: '47', format: '### ## ###' },
            { code: 'DK', name: 'Dinamarca', dialCode: '45', format: '## ## ## ##' },
            { code: 'FI', name: 'Finlândia', dialCode: '358', format: '## ### ####' },
            { code: 'PL', name: 'Polônia', dialCode: '48', format: '### ### ###' },
            { code: 'GR', name: 'Grécia', dialCode: '30', format: '### ### ####' },
            { code: 'TR', name: 'Turquia', dialCode: '90', format: '(###) ### ## ##' },
            { code: 'IL', name: 'Israel', dialCode: '972', format: '#-###-####' },
            { code: 'NZ', name: 'Nova Zelândia', dialCode: '64', format: '### ### ####' },
            { code: 'SG', name: 'Singapura', dialCode: '65', format: '#### ####' },
            { code: 'MY', name: 'Malásia', dialCode: '60', format: '#-### ####' },
            { code: 'TH', name: 'Tailândia', dialCode: '66', format: '## ### ####' },
            { code: 'PH', name: 'Filipinas', dialCode: '63', format: '### ### ####' },
            { code: 'ID', name: 'Indonésia', dialCode: '62', format: '###-###-####' },
            { code: 'VN', name: 'Vietnã', dialCode: '84', format: '### #### ###' },
            { code: 'IE', name: 'Irlanda', dialCode: '353', format: '## ### ####' },
            { code: 'CZ', name: 'República Tcheca', dialCode: '420', format: '### ### ###' },
            { code: 'HU', name: 'Hungria', dialCode: '36', format: '## ### ####' },
            { code: 'RO', name: 'Romênia', dialCode: '40', format: '### ### ###' },
            { code: 'BG', name: 'Bulgária', dialCode: '359', format: '### ### ###' },
            { code: 'HR', name: 'Croácia', dialCode: '385', format: '## ### ####' },
            { code: 'RS', name: 'Sérvia', dialCode: '381', format: '## ### ####' },
            { code: 'UA', name: 'Ucrânia', dialCode: '380', format: '(##) ###-##-##' },
            { code: 'BY', name: 'Bielorrússia', dialCode: '375', format: '(##) ###-##-##' },
            { code: 'KZ', name: 'Cazaquistão', dialCode: '7', format: '(###) ###-##-##' },
            { code: 'PK', name: 'Paquistão', dialCode: '92', format: '### #######' },
            { code: 'BD', name: 'Bangladesh', dialCode: '880', format: '####-######' },
            { code: 'LK', name: 'Sri Lanka', dialCode: '94', format: '## ### ####' },
            { code: 'MM', name: 'Myanmar', dialCode: '95', format: '# ### ####' },
            { code: 'KH', name: 'Camboja', dialCode: '855', format: '## ### ###' },
            { code: 'LA', name: 'Laos', dialCode: '856', format: '## ## ### ###' },
            { code: 'MN', name: 'Mongólia', dialCode: '976', format: '#### ####' },
            { code: 'TW', name: 'Taiwan', dialCode: '886', format: '# #### ####' },
            { code: 'HK', name: 'Hong Kong', dialCode: '852', format: '#### ####' },
            { code: 'MO', name: 'Macau', dialCode: '853', format: '#### ####' },
            { code: 'BN', name: 'Brunei', dialCode: '673', format: '### ####' },
            { code: 'FJ', name: 'Fiji', dialCode: '679', format: '### ####' },
            { code: 'PG', name: 'Papua Nova Guiné', dialCode: '675', format: '### ####' },
            { code: 'NC', name: 'Nova Caledônia', dialCode: '687', format: '##.##.##' },
            { code: 'PF', name: 'Polinésia Francesa', dialCode: '689', format: '##.##.##' },
            { code: 'GU', name: 'Guam', dialCode: '1', format: '(###) ###-####' },
            { code: 'AS', name: 'Samoa Americana', dialCode: '1', format: '(###) ###-####' },
            { code: 'MP', name: 'Ilhas Marianas', dialCode: '1', format: '(###) ###-####' },
            { code: 'VI', name: 'Ilhas Virgens', dialCode: '1', format: '(###) ###-####' },
            { code: 'PR', name: 'Porto Rico', dialCode: '1', format: '(###) ###-####' },
            { code: 'DO', name: 'República Dominicana', dialCode: '1', format: '(###) ###-####' },
            { code: 'HT', name: 'Haiti', dialCode: '509', format: '####-####' },
            { code: 'JM', name: 'Jamaica', dialCode: '1', format: '(###) ###-####' },
            { code: 'TT', name: 'Trinidad e Tobago', dialCode: '1', format: '(###) ###-####' },
            { code: 'BB', name: 'Barbados', dialCode: '1', format: '(###) ###-####' },
            { code: 'BS', name: 'Bahamas', dialCode: '1', format: '(###) ###-####' },
            { code: 'BZ', name: 'Belize', dialCode: '501', format: '###-####' },
            { code: 'CR', name: 'Costa Rica', dialCode: '506', format: '#### ####' },
            { code: 'PA', name: 'Panamá', dialCode: '507', format: '####-####' },
            { code: 'GT', name: 'Guatemala', dialCode: '502', format: '#### ####' },
            { code: 'HN', name: 'Honduras', dialCode: '504', format: '####-####' },
            { code: 'NI', name: 'Nicarágua', dialCode: '505', format: '#### ####' },
            { code: 'SV', name: 'El Salvador', dialCode: '503', format: '#### ####' },
            { code: 'CU', name: 'Cuba', dialCode: '53', format: '# ### ####' },
            { code: 'GY', name: 'Guiana', dialCode: '592', format: '### ####' },
            { code: 'SR', name: 'Suriname', dialCode: '597', format: '###-####' },
            { code: 'GF', name: 'Guiana Francesa', dialCode: '594', format: '#### ## ##' },
            { code: 'FK', name: 'Ilhas Falkland', dialCode: '500', format: '#####' },
            { code: 'GS', name: 'Geórgia do Sul', dialCode: '500', format: '#####' },
            { code: 'AQ', name: 'Antártida', dialCode: '672', format: '### ###' },
            { code: 'TF', name: 'Territórios Franceses', dialCode: '262', format: '#### ## ##' },
            { code: 'RE', name: 'Reunião', dialCode: '262', format: '#### ## ##' },
            { code: 'YT', name: 'Mayotte', dialCode: '262', format: '#### ## ##' },
            { code: 'PM', name: 'Saint Pierre', dialCode: '508', format: '## ## ##' },
            { code: 'BL', name: 'Saint Barthélemy', dialCode: '590', format: '#### ## ##' },
            { code: 'MF', name: 'Saint Martin', dialCode: '590', format: '#### ## ##' },
            { code: 'GP', name: 'Guadalupe', dialCode: '590', format: '#### ## ##' },
            { code: 'MQ', name: 'Martinica', dialCode: '596', format: '#### ## ##' },
            { code: 'DM', name: 'Dominica', dialCode: '1', format: '(###) ###-####' },
            { code: 'GD', name: 'Granada', dialCode: '1', format: '(###) ###-####' },
            { code: 'LC', name: 'Santa Lúcia', dialCode: '1', format: '(###) ###-####' },
            { code: 'VC', name: 'São Vicente', dialCode: '1', format: '(###) ###-####' },
            { code: 'AG', name: 'Antígua', dialCode: '1', format: '(###) ###-####' },
            { code: 'KN', name: 'São Cristóvão', dialCode: '1', format: '(###) ###-####' },
            { code: 'AW', name: 'Aruba', dialCode: '297', format: '### ####' },
            { code: 'CW', name: 'Curaçao', dialCode: '599', format: '### ####' },
            { code: 'SX', name: 'Sint Maarten', dialCode: '1', format: '(###) ###-####' },
            { code: 'BQ', name: 'Caribe Holandês', dialCode: '599', format: '### ####' },
            { code: 'AI', name: 'Anguilla', dialCode: '1', format: '(###) ###-####' },
            { code: 'VG', name: 'Ilhas Virgens Britânicas', dialCode: '1', format: '(###) ###-####' },
            { code: 'KY', name: 'Ilhas Cayman', dialCode: '1', format: '(###) ###-####' },
            { code: 'BM', name: 'Bermudas', dialCode: '1', format: '(###) ###-####' },
            { code: 'TC', name: 'Turks e Caicos', dialCode: '1', format: '(###) ###-####' },
            { code: 'MS', name: 'Montserrat', dialCode: '1', format: '(###) ###-####' },
            { code: 'GL', name: 'Groenlândia', dialCode: '299', format: '## ## ##' },
            { code: 'IS', name: 'Islândia', dialCode: '354', format: '### ####' },
            { code: 'FO', name: 'Ilhas Faroe', dialCode: '298', format: '######' },
            { code: 'SJ', name: 'Svalbard', dialCode: '47', format: '### ## ###' },
            { code: 'AX', name: 'Ilhas Åland', dialCode: '358', format: '## ### ####' },
            { code: 'EE', name: 'Estônia', dialCode: '372', format: '#### ####' },
            { code: 'LV', name: 'Letônia', dialCode: '371', format: '#### ####' },
            { code: 'LT', name: 'Lituânia', dialCode: '370', format: '(###) #####' },
            { code: 'MD', name: 'Moldávia', dialCode: '373', format: '#### ####' },
            { code: 'SK', name: 'Eslováquia', dialCode: '421', format: '### ### ###' },
            { code: 'SI', name: 'Eslovênia', dialCode: '386', format: '## ### ###' },
            { code: 'BA', name: 'Bósnia', dialCode: '387', format: '## ### ###' },
            { code: 'MK', name: 'Macedônia', dialCode: '389', format: '## ### ###' },
            { code: 'AL', name: 'Albânia', dialCode: '355', format: '## ### ####' },
            { code: 'ME', name: 'Montenegro', dialCode: '382', format: '## ### ###' },
            { code: 'XK', name: 'Kosovo', dialCode: '383', format: '## ### ###' },
            { code: 'AD', name: 'Andorra', dialCode: '376', format: '### ###' },
            { code: 'LI', name: 'Liechtenstein', dialCode: '423', format: '### ## ##' },
            { code: 'MC', name: 'Mônaco', dialCode: '377', format: '## ## ## ##' },
            { code: 'SM', name: 'San Marino', dialCode: '378', format: '#### ######' },
            { code: 'VA', name: 'Vaticano', dialCode: '39', format: '### ### ####' },
            { code: 'MT', name: 'Malta', dialCode: '356', format: '#### ####' },
            { code: 'CY', name: 'Chipre', dialCode: '357', format: '## ### ###' },
            { code: 'LU', name: 'Luxemburgo', dialCode: '352', format: '### ### ###' },
            { code: 'GI', name: 'Gibraltar', dialCode: '350', format: '#### ####' },
            { code: 'IM', name: 'Ilha de Man', dialCode: '44', format: '#### ######' },
            { code: 'JE', name: 'Jersey', dialCode: '44', format: '#### ######' },
            { code: 'GG', name: 'Guernsey', dialCode: '44', format: '#### ######' },
            { code: 'IO', name: 'Território Britânico', dialCode: '246', format: '### ####' },
            { code: 'SH', name: 'Santa Helena', dialCode: '290', format: '####' },
            { code: 'AC', name: 'Ilha de Ascensão', dialCode: '247', format: '####' },
            { code: 'TA', name: 'Tristão da Cunha', dialCode: '290', format: '####' },
            { code: 'EH', name: 'Saara Ocidental', dialCode: '212', format: '####-######' },
            { code: 'MA', name: 'Marrocos', dialCode: '212', format: '####-######' },
            { code: 'DZ', name: 'Argélia', dialCode: '213', format: '### ## ## ##' },
            { code: 'TN', name: 'Tunísia', dialCode: '216', format: '## ### ###' },
            { code: 'LY', name: 'Líbia', dialCode: '218', format: '##-###-####' },
            { code: 'SD', name: 'Sudão', dialCode: '249', format: '### ### ###' },
            { code: 'SS', name: 'Sudão do Sul', dialCode: '211', format: '### ### ###' },
            { code: 'ET', name: 'Etiópia', dialCode: '251', format: '### ### ####' },
            { code: 'ER', name: 'Eritreia', dialCode: '291', format: '# ### ###' },
            { code: 'DJ', name: 'Djibuti', dialCode: '253', format: '## ## ## ##' },
            { code: 'SO', name: 'Somália', dialCode: '252', format: '# ### ####' },
            { code: 'KE', name: 'Quênia', dialCode: '254', format: '### ######' },
            { code: 'UG', name: 'Uganda', dialCode: '256', format: '### ### ###' },
            { code: 'TZ', name: 'Tanzânia', dialCode: '255', format: '### ### ###' },
            { code: 'RW', name: 'Ruanda', dialCode: '250', format: '### ### ###' },
            { code: 'BI', name: 'Burundi', dialCode: '257', format: '## ## ## ##' },
            { code: 'MW', name: 'Malawi', dialCode: '265', format: '# #### ####' },
            { code: 'ZM', name: 'Zâmbia', dialCode: '260', format: '### ### ###' },
            { code: 'ZW', name: 'Zimbábue', dialCode: '263', format: '# ### ####' },
            { code: 'BW', name: 'Botsuana', dialCode: '267', format: '## ### ###' },
            { code: 'NA', name: 'Namíbia', dialCode: '264', format: '## ### ####' },
            { code: 'LS', name: 'Lesoto', dialCode: '266', format: '# #### ####' },
            { code: 'SZ', name: 'Essuatíni', dialCode: '268', format: '# #### ####' },
            { code: 'MZ', name: 'Moçambique', dialCode: '258', format: '## ### ####' },
            { code: 'MG', name: 'Madagascar', dialCode: '261', format: '## ## ### ##' },
            { code: 'MU', name: 'Maurício', dialCode: '230', format: '#### ####' },
            { code: 'SC', name: 'Seicheles', dialCode: '248', format: '# ### ###' },
            { code: 'KM', name: 'Comores', dialCode: '269', format: '### ## ##' },
            { code: 'CV', name: 'Cabo Verde', dialCode: '238', format: '### ## ##' },
            { code: 'ST', name: 'São Tomé', dialCode: '239', format: '### ####' },
            { code: 'GW', name: 'Guiné-Bissau', dialCode: '245', format: '#### ####' },
            { code: 'GN', name: 'Guiné', dialCode: '224', format: '### ## ## ##' },
            { code: 'SL', name: 'Serra Leoa', dialCode: '232', format: '## ######' },
            { code: 'LR', name: 'Libéria', dialCode: '231', format: '## ### ####' },
            { code: 'CI', name: 'Costa do Marfim', dialCode: '225', format: '## ## ## ## ##' },
            { code: 'GH', name: 'Gana', dialCode: '233', format: '### ### ####' },
            { code: 'TG', name: 'Togo', dialCode: '228', format: '## ## ## ##' },
            { code: 'BJ', name: 'Benin', dialCode: '229', format: '## ## ## ##' },
            { code: 'BF', name: 'Burkina Faso', dialCode: '226', format: '## ## ## ##' },
            { code: 'ML', name: 'Mali', dialCode: '223', format: '## ## ## ##' },
            { code: 'NE', name: 'Níger', dialCode: '227', format: '## ## ## ##' },
            { code: 'TD', name: 'Chade', dialCode: '235', format: '## ## ## ##' },
            { code: 'CF', name: 'República Centro-Africana', dialCode: '236', format: '## ## ## ##' },
            { code: 'CM', name: 'Camarões', dialCode: '237', format: '#### ## ## ##' },
            { code: 'GQ', name: 'Guiné Equatorial', dialCode: '240', format: '### ### ###' },
            { code: 'GA', name: 'Gabão', dialCode: '241', format: '# ## ## ##' },
            { code: 'CG', name: 'Congo', dialCode: '242', format: '## ### ####' },
            { code: 'CD', name: 'Congo (DRC)', dialCode: '243', format: '### ### ###' },
            { code: 'AO', name: 'Angola', dialCode: '244', format: '### ### ###' },
            { code: 'ZM', name: 'Zâmbia', dialCode: '260', format: '### ### ###' },
            { code: 'MW', name: 'Malawi', dialCode: '265', format: '# #### ####' },
            { code: 'MZ', name: 'Moçambique', dialCode: '258', format: '## ### ####' },
            { code: 'ZW', name: 'Zimbábue', dialCode: '263', format: '# ### ####' },
            { code: 'BW', name: 'Botsuana', dialCode: '267', format: '## ### ###' },
            { code: 'NA', name: 'Namíbia', dialCode: '264', format: '## ### ####' },
            { code: 'LS', name: 'Lesoto', dialCode: '266', format: '# #### ####' },
            { code: 'SZ', name: 'Essuatíni', dialCode: '268', format: '# #### ####' },
            { code: 'ZA', name: 'África do Sul', dialCode: '27', format: '## ### ####' },
            { code: 'MG', name: 'Madagascar', dialCode: '261', format: '## ## ### ##' },
            { code: 'MU', name: 'Maurício', dialCode: '230', format: '#### ####' },
            { code: 'SC', name: 'Seicheles', dialCode: '248', format: '# ### ###' },
            { code: 'KM', name: 'Comores', dialCode: '269', format: '### ## ##' },
            { code: 'YT', name: 'Mayotte', dialCode: '262', format: '#### ## ##' },
            { code: 'RE', name: 'Reunião', dialCode: '262', format: '#### ## ##' },
            { code: 'IO', name: 'Território Britânico', dialCode: '246', format: '### ####' },
            { code: 'SH', name: 'Santa Helena', dialCode: '290', format: '####' },
            { code: 'AC', name: 'Ilha de Ascensão', dialCode: '247', format: '####' },
            { code: 'TA', name: 'Tristão da Cunha', dialCode: '290', format: '####' },
            { code: 'EH', name: 'Saara Ocidental', dialCode: '212', format: '####-######' },
            { code: 'MA', name: 'Marrocos', dialCode: '212', format: '####-######' },
            { code: 'DZ', name: 'Argélia', dialCode: '213', format: '### ## ## ##' },
            { code: 'TN', name: 'Tunísia', dialCode: '216', format: '## ### ###' },
            { code: 'LY', name: 'Líbia', dialCode: '218', format: '##-###-####' },
            { code: 'SD', name: 'Sudão', dialCode: '249', format: '### ### ###' },
            { code: 'SS', name: 'Sudão do Sul', dialCode: '211', format: '### ### ###' },
            { code: 'ET', name: 'Etiópia', dialCode: '251', format: '### ### ####' },
            { code: 'ER', name: 'Eritreia', dialCode: '291', format: '# ### ###' },
            { code: 'DJ', name: 'Djibuti', dialCode: '253', format: '## ## ## ##' },
            { code: 'SO', name: 'Somália', dialCode: '252', format: '# ### ####' },
            { code: 'KE', name: 'Quênia', dialCode: '254', format: '### ######' },
            { code: 'UG', name: 'Uganda', dialCode: '256', format: '### ### ###' },
            { code: 'TZ', name: 'Tanzânia', dialCode: '255', format: '### ### ###' },
            { code: 'RW', name: 'Ruanda', dialCode: '250', format: '### ### ###' },
            { code: 'BI', name: 'Burundi', dialCode: '257', format: '## ## ## ##' }
        ];

        // Converter para o formato usado no web/www (com emoji e função de formatação)
        const countriesListMap = countriesListRaw.reduce((acc, country) => {
            if (!acc[country.code]) {
                acc[country.code] = {
                    code: country.code,
                    name: country.name,
                    dial: '+' + country.dialCode,
                    flag: getCountryFlagEmoji(country.code),
                    format: createFormatFunction(country.format)
                };
            }
            return acc;
        }, {});
        
        const countriesList = Object.values(countriesListMap)
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log(`✅ Total de países carregados: ${countriesList.length}`);

        let selectedCountry = countriesList.find(c => c.dial === '+55') || countriesList[0];
        let phoneModalInitialized = false;

        // Inicializar modal de países
        function initPhoneMasks() {
            const trigger = document.getElementById('phone-country-trigger');
            const overlay = document.getElementById('phone-country-modal-overlay');
            const closeBtn = document.getElementById('phone-country-modal-close');
            const searchInput = document.getElementById('phone-country-search-input');
            const listContainer = document.getElementById('phone-country-modal-list');
            const phoneInput = document.getElementById('phone-input');
            const flagDisplay = document.getElementById('phone-country-flag');

            if (!trigger || !overlay || !listContainer) {
                console.warn('Elementos do modal de telefone não encontrados');
                return;
            }
            
            // Garantir que a bandeira inicial está sendo exibida
            if (flagDisplay && selectedCountry) {
                flagDisplay.textContent = selectedCountry.flag;
                console.log('✅ Bandeira inicial definida:', selectedCountry.flag, selectedCountry.name);
            }
            
            // Definir placeholder inicial baseado no país selecionado
            if (phoneInput && selectedCountry) {
                const countryRaw = countriesListRaw.find(c => c.code === selectedCountry.code);
                if (countryRaw) {
                    phoneInput.placeholder = generatePlaceholder(countryRaw.format);
                }
            }

            // Evitar inicialização duplicada
            if (phoneModalInitialized) {
                return;
            }
            phoneModalInitialized = true;

            // Popular lista de países
            function renderCountries(filter = '') {
                if (!listContainer) {
                    console.error('❌ listContainer não encontrado!');
                    return;
                }
                
                if (!countriesList || countriesList.length === 0) {
                    console.error('❌ countriesList não está disponível ou está vazia!', countriesList);
                    listContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Erro ao carregar países</div>';
                    return;
                }
                
                listContainer.innerHTML = '';
                
                const search = filter.toLowerCase();
                const filtered = countriesList.filter(country => {
                    if (!search) return true; // Se não há filtro, mostrar todos
                    return country.name.toLowerCase().includes(search) ||
                           country.dial.toLowerCase().includes(search) ||
                           country.code.toLowerCase().includes(search);
                });

                console.log(`📋 Renderizando ${filtered.length} países (total disponível: ${countriesList.length}, filtro: "${filter}")`);

                filtered.forEach(country => {
                    const item = document.createElement('div');
                    item.className = `country-item ${selectedCountry && selectedCountry.code === country.code ? 'selected' : ''}`;
                    item.innerHTML = `
                        <span class="country-item-flag">${country.flag}</span>
                        <span class="country-item-name">${country.name}</span>
                        <span class="country-item-code">${country.dial}</span>
                    `;
                    item.addEventListener('click', () => selectCountry(country));
                    listContainer.appendChild(item);
                });
                
                if (filtered.length === 0) {
                    listContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum país encontrado</div>';
                }
            }

            // Selecionar país
            function selectCountry(country) {
                selectedCountry = country;
                document.getElementById('phone-country-code').value = country.dial;
                document.getElementById('phone-country-code-display').textContent = country.dial;
                document.getElementById('phone-country-flag').textContent = country.flag;
                
                // Atualizar placeholder e formatar número existente
                if (phoneInput) {
                    const currentValue = phoneInput.value.replace(/\D/g, '');
                    // Gerar placeholder baseado no formato do país
                    const countryRaw = countriesListRaw.find(c => c.code === country.code);
                    const placeholder = countryRaw ? generatePlaceholder(countryRaw.format) : 'Número completo';
                    phoneInput.placeholder = placeholder;
                    if (currentValue) {
                        phoneInput.value = country.format(currentValue);
                    }
                }
                
                closeModal();
                renderCountries(searchInput?.value || '');
            }

            // Abrir modal
            function openModal() {
                if (!overlay || !trigger) {
                    console.error('❌ Elementos do modal não encontrados!', { overlay: !!overlay, trigger: !!trigger });
                    return;
                }
                console.log('🟢 openModal() chamado!');
                overlay.classList.add('active');
                    trigger.classList.add('open');
                document.body.style.overflow = 'hidden';
                setTimeout(() => searchInput?.focus(), 100);
                renderCountries();
                console.log('✅ Modal aberto!', overlay.classList.toString());
            }

            // Fechar modal
            function closeModal() {
                if (!overlay || !trigger) return;
                overlay.classList.remove('active');
                    trigger.classList.remove('open');
                document.body.style.overflow = '';
                if (searchInput) searchInput.value = '';
            }

            // Event listeners
            // Função handler para o click
            const handleClick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Trigger clicado!', e);
                openModal();
            };
            
            // Adicionar listener
            trigger.addEventListener('click', handleClick);
            
            // Também adicionar como onclick para garantir
            trigger.onclick = handleClick;
            
            closeBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                }
            });

            // Busca
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    renderCountries(e.target.value);
                });
            }

            // Máscara para número de telefone com formatação dinâmica
            if (phoneInput) {
            phoneInput.addEventListener('input', function(e) {
                    const clean = e.target.value.replace(/\D/g, '');
                    if (selectedCountry && selectedCountry.format) {
                        e.target.value = selectedCountry.format(clean);
                } else {
                        e.target.value = clean;
                }
            });
            }

            // Renderizar inicialmente
            console.log('📋 Iniciando renderização de países...');
            console.log('📋 Total de países na lista:', countriesList.length);
            renderCountries();
            console.log('📋 Países renderizados no DOM:', listContainer.children.length);
        }

        // Placeholder pra futuro: carregar nome
        async function loadUserName() {
            // Pode ser ajustado depois com base no token/localStorage
        }

        function initOnboarding() {
            loadStates();
            initPhoneMasks();
            loadUserName();

            // Valores padrão para inputs de horário
            const sleepBedInput = document.querySelector('input[name="sleep_time_bed"]');
            const sleepWakeInput = document.querySelector('input[name="sleep_time_wake"]');
            const dobInput = document.querySelector('input[name="dob"]');
            const dobErrorEl = document.getElementById('dob-error');
            
            if (sleepBedInput) sleepBedInput.value = "00:00";
            if (sleepWakeInput) sleepWakeInput.value = "00:00";

            // Data de nascimento: não preencher automático para evitar idade 0.
            // Limitar para garantir idade mínima de 12 anos (sem idade máxima).
            const todayDate = new Date();
            const twelveYearsAgo = new Date(todayDate.getFullYear() - 12, todayDate.getMonth(), todayDate.getDate());
            const maxDob = twelveYearsAgo.toISOString().split("T")[0]; // hoje - 12 anos
            if (dobInput) {
                dobInput.setAttribute('max', maxDob);
                dobInput.removeAttribute('min'); // sem idade máxima
            }

            const form = document.getElementById('onboarding-form');
            if (!form) {
                console.error('[Onboarding] Formulário não encontrado!');
                return;
            }
            
            const steps = Array.from(form.querySelectorAll('.form-step'));
            const actionBtn = document.getElementById('action-btn');
            const backBtn = document.getElementById('back-btn');
            const exitBtn = document.getElementById('exit-btn');
            const headerNav = document.querySelector('.header-nav');
            const progressBarFill = document.getElementById('progress-bar-fill');
            const stepIndicatorText = document.getElementById('step-indicator-text');
            // Verificar se usuário já completou onboarding antes (para mostrar botão de sair)
            async function checkIfUserCompletedOnboarding() {
                try {
                    const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
                    if (!token) {
                        return false;
                    }

                    const response = await fetch(`${window.API_BASE_URL}/get_user_info.php`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.user && result.user.onboarding_complete) {
                            return true;
                        }
                    }
                } catch (error) {
                    console.error('[Onboarding] Erro ao verificar onboarding:', error);
                }
                return false;
            }

            // Verificar se é refazer (via URL ou se já completou antes)
            const urlParams = new URLSearchParams(window.location.search);
            const isRefazerUrl = urlParams.get('refazer') === 'true';
            let isRefazer = isRefazerUrl; // Já começar como true se veio da URL
            // Se veio com ?refazer=true, mostrar botão de sair imediatamente
            if (isRefazerUrl && exitBtn) {
                exitBtn.classList.add('show');
                console.log('[Onboarding] Botão de sair mostrado (via URL)');
            }
            
            // Verificar se já completou onboarding e esconder steps desnecessários
            checkIfUserCompletedOnboarding().then(hasCompleted => {
                isRefazer = isRefazerUrl || hasCompleted;
                if (isRefazer && exitBtn) {
                    exitBtn.classList.add('show');
                }
                
                // Esconder steps que não são necessários ao refazer
                if (isRefazer) {
                    const stepsToHide = ['location', 'phone', 'dob_gender'];
                    stepsToHide.forEach(stepId => {
                        const step = form.querySelector(`[data-step-id="${stepId}"]`);
                        if (step) {
                            step.style.display = 'none';
                            console.log(`Step ${stepId} escondido (refazer onboarding)`);
                        }
                    });
                    
                    // Buscar e aplicar restrição de peso
                    getWeightEditInfo().then(weightInfo => {
                        if (weightInfo) {
                            const weightInput = document.getElementById('weight-input');
                            const weightMessage = document.getElementById('weight-restriction-message');
                            const daysRemaining = document.getElementById('days-remaining');
                            const daysText = document.getElementById('days-text');
                            
                            if (weightInput && weightMessage && daysRemaining && daysText) {
                                if (!weightInfo.can_edit) {
                                    // Buscar peso atual do usuário
                                    fetch(`${window.API_BASE_URL}/get_dashboard_data.php`, {
                                        method: 'GET',
                                        headers: {
                                            'Authorization': `Bearer ${getAuthToken()}`
                                        }
                                    })
                                    .then(res => res.json())
                                    .then(result => {
                                        if (result.success && result.data && result.data.weight_banner) {
                                            // Extrair o peso do formato "XX.Xkg"
                                            const currentWeight = result.data.weight_banner.current_weight;
                                            if (currentWeight) {
                                                const weightValue = currentWeight.replace('kg', '').trim();
                                                weightInput.value = weightValue.replace(',', '.');
                                            }
                                        }
                                    })
                                    .catch(err => console.error('Erro ao buscar peso atual:', err));
                                    
                                    weightInput.readOnly = true;
                                    weightInput.style.opacity = '0.6';
                                    weightInput.required = false;
                                    weightMessage.style.display = 'block';
                                    daysRemaining.textContent = weightInfo.days_remaining;
                                    daysText.textContent = weightInfo.days_remaining === 1 ? 'dia' : 'dias';
                                }
                            }
                        }
                    });
                }
            });

            // Buscar informações de peso (verificação de 7 dias)
            async function getWeightEditInfo() {
                try {
                    const token = getAuthToken();
                    if (!token) return null;

                    const response = await fetch(`${window.API_BASE_URL}/get_dashboard_data.php`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                            // Verificar se tem weight_banner
                            if (result.data.weight_banner) {
                                return {
                                    can_edit: result.data.weight_banner.show_edit_button !== false,
                                    days_remaining: result.data.weight_banner.days_until_update || 0
                                };
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao buscar info de peso:', error);
                }
                return null;
            }

            const otherActivityBtn = document.getElementById('other-activity-btn');
            const modal = document.getElementById('custom-activity-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const closeModalIcon = document.getElementById('close-modal-icon');
            const addActivityBtn = document.getElementById('add-activity-btn');
            const activityInput = document.getElementById('custom-activity-input');
            const activityList = document.getElementById('custom-activities-list');
            const hiddenInput = document.getElementById('custom-activities-hidden-input');
            const noneCheckbox = document.getElementById('ex-none');
            const exerciseOptionsWrapper = document.getElementById('exercise-options-wrapper');
            const frequencyWrapper = document.getElementById('frequency-wrapper');
            const allExerciseCheckboxes = exerciseOptionsWrapper ? exerciseOptionsWrapper.querySelectorAll('input[type="checkbox"]') : [];

            let stepHistory = [0];
            let customActivities = [];

            // Filtrar steps visíveis (não escondidos)
            function getVisibleSteps() {
                return steps.filter(step => step.style.display !== 'none');
            }

            function getVisibleStepIndex(originalIndex) {
                const visibleSteps = getVisibleSteps();
                let visibleIndex = 0;
                for (let i = 0; i <= originalIndex; i++) {
                    if (steps[i].style.display !== 'none') {
                        visibleIndex++;
                    }
                }
                return visibleIndex;
            }

            const visibleSteps = getVisibleSteps();
            const totalSteps = visibleSteps.length;

            function updateProgress(stepIndex) {
                // Contar apenas steps visíveis até o atual
                const visibleCount = getVisibleStepIndex(stepIndex);
                const percent = (visibleCount / totalSteps) * 100;
                progressBarFill.style.width = percent + '%';
                stepIndicatorText.textContent = `Passo ${visibleCount} de ${totalSteps}`;
            }

            function renderTags() {
                const currentActivityList = document.getElementById('custom-activities-list');
                const currentHiddenInput = document.getElementById('custom-activities-hidden-input');
                const currentOtherActivityBtn = document.getElementById('other-activity-btn');
                
                if (currentActivityList) {
                    currentActivityList.innerHTML = '';
                    customActivities.forEach(activity => {
                        const tag = document.createElement('div');
                        tag.className = 'activity-tag';
                        const tagText = document.createTextNode(activity);
                        tag.appendChild(tagText);
                        const removeBtn = document.createElement('button');
                        removeBtn.className = 'remove-tag';
                        removeBtn.innerHTML = '&times;';
                        removeBtn.onclick = () => {
                            customActivities = customActivities.filter(item => item !== activity);
                            renderTags();
                            updateButtonState();
                        };
                        tag.appendChild(removeBtn);
                        currentActivityList.appendChild(tag);
                    });
                }
                if (currentHiddenInput) {
                    currentHiddenInput.value = customActivities.join(',');
                }
                if (currentOtherActivityBtn) {
                    currentOtherActivityBtn.classList.toggle('active', customActivities.length > 0);
                }

                // Se tiver atividade customizada e não estiver marcado "Nenhuma", selecionar frequência mínima por padrão
                if (customActivities.length > 0 && frequencyWrapper && !noneCheckbox.checked) {
                    const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                    const hasFrequencySelected = Array.from(freqRadios).some(radio => radio.checked);
                    if (!hasFrequencySelected) {
                        const minFreqRadio = document.getElementById('freq1');
                        if (minFreqRadio) {
                            minFreqRadio.checked = true;
                        }
                    }
                }

                updateButtonState();
            }

            function addActivity() {
                const currentActivityInput = document.getElementById('custom-activity-input');
                if (!currentActivityInput) return;
                
                const newActivity = currentActivityInput.value.trim();
                if (newActivity && !customActivities.includes(newActivity)) {
                    customActivities.push(newActivity);
                    currentActivityInput.value = '';
                    renderTags();
                }
                currentActivityInput.focus();
            }

            // ========== MODAL DE ATIVIDADES CUSTOMIZADAS ==========
            
            // Variáveis do modal
            let modalInitialized = false;
            
            // Função para abrir modal
            function openModal() {
                const modal = document.getElementById('custom-activity-modal');
                if (!modal) {
                    console.error('[Onboarding] Modal não encontrado!');
                    return;
                }
                
                // Garantir que modal está no body
                if (modal.parentElement !== document.body) {
                    document.body.appendChild(modal);
                }
                
                // Inicializar listeners apenas uma vez
                if (!modalInitialized) {
                    initModalListeners();
                    modalInitialized = true;
                }
                
                // Remover estilo inline que pode estar bloqueando
                modal.removeAttribute('style');
                
                // Mostrar modal - FORÇAR COM !important via inline
                modal.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: rgba(0, 0, 0, 0.6) !important;
                    backdrop-filter: blur(8px) !important;
                    -webkit-backdrop-filter: blur(8px) !important;
                    z-index: 999999 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 20px !important;
                    box-sizing: border-box !important;
                    pointer-events: auto !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                `;
                modal.classList.add('active');
                document.body.classList.add('modal-open');
                
                // Focar no input
                setTimeout(() => {
                    const input = document.getElementById('custom-activity-input');
                    if (input) input.focus();
                }, 100);
            }
            
            // Função para fechar modal
            function closeModal() {
                const modal = document.getElementById('custom-activity-modal');
                if (modal) {
                    modal.classList.remove('active');
                    modal.style.cssText = 'display: none !important;';
                    document.body.classList.remove('modal-open');
                }
            }
            
            // Inicializar listeners do modal (apenas uma vez)
            function initModalListeners() {
                const modal = document.getElementById('custom-activity-modal');
                const closeBtn = document.getElementById('close-modal-btn');
                const closeIcon = document.getElementById('close-modal-icon');
                const addBtn = document.getElementById('add-activity-btn');
                const input = document.getElementById('custom-activity-input');
                
                // Botão Concluir
                if (closeBtn) {
                    closeBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeModal();
                        return false;
                    };
                }
                
                // Botão X
                if (closeIcon) {
                    closeIcon.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        closeModal();
                        return false;
                    };
                }
                
                // Clicar no overlay (fora do conteúdo) fecha o modal
                if (modal) {
                    modal.onclick = function(e) {
                        if (e.target === modal) {
                            e.preventDefault();
                            e.stopPropagation();
                            closeModal();
                        }
                    };
                }
                
                // Botão adicionar atividade
                if (addBtn) {
                    addBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        addActivity();
                        return false;
                    };
                }
                
                // Enter no input adiciona atividade
                if (input) {
                    input.onkeypress = function(e) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addActivity();
                            return false;
                        }
                    };
                }
            }
            
            // Expor função globalmente
            window.closeOnboardingModal = closeModal;
            
            // Botão "Outro" - abrir modal
            if (otherActivityBtn) {
                otherActivityBtn.style.pointerEvents = 'auto';
                otherActivityBtn.disabled = false;
                
                otherActivityBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Se "Nenhum" estiver marcado, desmarcar primeiro
                    if (noneCheckbox && noneCheckbox.checked) {
                        noneCheckbox.checked = false;
                        
                        // Reabilitar todos os exercícios
                        allExerciseCheckboxes.forEach(cb => {
                            if (cb.id !== 'ex-none') {
                                cb.disabled = false;
                                cb.checked = false;
                            }
                        });

                        // Limpar atividades custom
                        customActivities = [];
                        renderTags();

                        // Reabilitar frequência
                        if (frequencyWrapper) {
                            const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                            freqRadios.forEach(radio => {
                                radio.disabled = false;
                                radio.checked = false;
                            });
                        }

                        // Reabilitar botão "Outro"
                        otherActivityBtn.disabled = false;
                        otherActivityBtn.style.opacity = '1';
                        otherActivityBtn.style.pointerEvents = 'auto';

                        // Remover classe disabled
                        if (exerciseOptionsWrapper) {
                            exerciseOptionsWrapper.classList.remove('disabled');
                        }
                        if (frequencyWrapper) {
                            frequencyWrapper.classList.remove('disabled');
                        }
                    }
                    
                    // Abrir modal
                    openModal();
                    return false;
                };
            }
            
            // Inicializar listeners do modal imediatamente
            initModalListeners();

            // Lógica "Nenhum"
            if (noneCheckbox) {
                noneCheckbox.addEventListener('change', function() {
                const isChecked = this.checked;

                if (isChecked) {
                    // Desmarcar todos os outros exercícios
                    allExerciseCheckboxes.forEach(cb => {
                        if (cb.id !== 'ex-none') {
                            cb.checked = false;
                            cb.disabled = true;
                        }
                    });

                    // Limpar atividades customizadas
                    customActivities = [];
                    renderTags();

                    // Desabilitar frequência
                    if (frequencyWrapper) {
                        const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                        freqRadios.forEach(radio => {
                            radio.checked = false;
                            radio.disabled = true;
                        });
                    }

                    // NÃO desabilitar botão "Outro" - ele deve sempre abrir o modal
                    // O botão vai desmarcar "Nenhum" automaticamente ao abrir o modal
                    if (otherActivityBtn) {
                        otherActivityBtn.disabled = false;
                        otherActivityBtn.style.opacity = '1';
                        otherActivityBtn.style.pointerEvents = 'auto';
                    }

                    // Adicionar classe disabled (apenas para desabilitar inputs, não visual)
                    if (exerciseOptionsWrapper) {
                        exerciseOptionsWrapper.classList.add('disabled');
                    }
                    if (frequencyWrapper) {
                        frequencyWrapper.classList.add('disabled');
                    }
                } else {
                    // Reabilitar todos os exercícios
                    allExerciseCheckboxes.forEach(cb => {
                        if (cb.id !== 'ex-none') {
                            cb.disabled = false;
                            cb.checked = false;
                        }
                    });

                    // Reabilitar frequência
                    if (frequencyWrapper) {
                        const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                        freqRadios.forEach(radio => {
                            radio.disabled = false;
                            radio.checked = false;
                        });
                    }

                    // Reabilitar botão "Outro"
                    if (otherActivityBtn) {
                        otherActivityBtn.disabled = false;
                        otherActivityBtn.style.opacity = '1';
                        otherActivityBtn.style.pointerEvents = 'auto';
                    }

                    // Remover classe disabled
                    if (exerciseOptionsWrapper) {
                        exerciseOptionsWrapper.classList.remove('disabled');
                    }
                    if (frequencyWrapper) {
                        frequencyWrapper.classList.remove('disabled');
                    }
                }

                updateButtonState();
                });
            }

            // Reagir a cliques no wrapper para "cancelar" o Nenhum automaticamente
            if (exerciseOptionsWrapper) {
                exerciseOptionsWrapper.addEventListener('click', function(e) {
                const clickedElement = e.target.closest('label, .option-button, button');
                
                // Se clicou no botão "Outro", não fazer nada aqui (deixar o event listener do botão tratar)
                if (clickedElement && clickedElement.id === 'other-activity-btn') {
                    return; // Deixa o event listener do botão tratar
                }
                
                if (noneCheckbox && noneCheckbox.checked) {
                    const noneLabel = noneCheckbox.closest('label');

                    // Se clicou em qualquer exercício (exceto o próprio "Nenhum"), desmarcar "Nenhum"
                    if (clickedElement && clickedElement !== noneLabel) {
                        // Verificar se é um label de exercício
                        const isExerciseLabel = clickedElement.tagName === 'LABEL' && clickedElement.getAttribute('for') && clickedElement.getAttribute('for') !== 'ex-none';
                        
                        if (isExerciseLabel) {
                            e.preventDefault();
                            e.stopPropagation();

                            // Desmarcar "Nenhum"
                            noneCheckbox.checked = false;
                            
                            // Reabilitar todos os exercícios
                            allExerciseCheckboxes.forEach(cb => {
                                if (cb.id !== 'ex-none') {
                                    cb.disabled = false;
                                    cb.checked = false;
                                }
                            });

                            // Limpar atividades custom
                            customActivities = [];
                            renderTags();

                            // Reabilitar frequência
                            if (frequencyWrapper) {
                                const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                                freqRadios.forEach(radio => {
                                    radio.disabled = false;
                                    radio.checked = false;
                                });
                            }

                            // Reabilitar botão "Outro"
                            if (otherActivityBtn) {
                                otherActivityBtn.disabled = false;
                                otherActivityBtn.style.opacity = '1';
                                otherActivityBtn.style.pointerEvents = 'auto';
                            }

                            // Remover classe disabled
                            if (exerciseOptionsWrapper) {
                                exerciseOptionsWrapper.classList.remove('disabled');
                            }
                            if (frequencyWrapper) {
                                frequencyWrapper.classList.remove('disabled');
                            }

                            updateButtonState();
                        }
                    }
                }
                });
            }

            allExerciseCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    if (this.id !== 'ex-none') {
                        if (this.checked && frequencyWrapper) {
                            const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                            const hasFrequencySelected = Array.from(freqRadios).some(radio => radio.checked);

                            if (!hasFrequencySelected) {
                                const minFreqRadio = document.getElementById('freq1');
                                if (minFreqRadio) {
                                    minFreqRadio.checked = true;
                                }
                            }
                        }

                        if (!this.checked && frequencyWrapper) {
                            const anyExerciseSelected = Array.from(allExerciseCheckboxes).some(cb => cb.checked && cb.id !== 'ex-none') || customActivities.length > 0;
                            if (!anyExerciseSelected) {
                                const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                                freqRadios.forEach(radio => radio.checked = false);
                            }
                        }

                        if (this.checked && noneCheckbox) {
                            noneCheckbox.checked = false;
                            allExerciseCheckboxes.forEach(cb => cb.disabled = false);
                            if (frequencyWrapper) {
                                const freqRadios = frequencyWrapper.querySelectorAll('input[type="radio"]');
                                freqRadios.forEach(radio => radio.disabled = false);
                            }
                            if (otherActivityBtn) {
                                otherActivityBtn.disabled = false;
                                otherActivityBtn.style.opacity = '1';
                                otherActivityBtn.style.pointerEvents = 'auto';
                            }
                            if (exerciseOptionsWrapper) {
                                exerciseOptionsWrapper.classList.remove('disabled');
                            }
                            if (frequencyWrapper) {
                                frequencyWrapper.classList.remove('disabled');
                            }
                        }

                        updateButtonState();
                    }
                });
            });

            const updateButtonState = () => {
                const currentStepIndex = stepHistory[stepHistory.length - 1];
                const currentStepDiv = steps[currentStepIndex];
                if (!currentStepDiv) {
                    return;
                }

                const stepId = currentStepDiv.dataset.stepId;
                let isStepValid = false;
                if (stepId === 'exercise_types') {
                    if (noneCheckbox && noneCheckbox.checked) {
                        isStepValid = true;
                    } else {
                        const anyExerciseSelected = currentStepDiv.querySelector('input[name="exercise_types[]"]:checked') || customActivities.length > 0;
                        isStepValid = !!anyExerciseSelected;
                    }
                } else if (stepId === 'exercise_frequency') {
                    // Se "Nenhuma / Não pratico", esse step será pulado
                    if (noneCheckbox && noneCheckbox.checked) {
                        isStepValid = true;
                    } else {
                        const freqSelected = currentStepDiv.querySelector('input[name="exercise_frequency"]:checked');
                        isStepValid = !!freqSelected;
                    }
                } else if (stepId === 'meat') {
                    const selected = form.querySelector('input[name="meat_consumption"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'gluten') {
                    const selected = form.querySelector('input[name="gluten_intolerance"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'lactose') {
                    const selected = form.querySelector('input[name="lactose_intolerance"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'vegetarian') {
                    const selected = form.querySelector('input[name="vegetarian_type"]:checked');
                    isStepValid = !!selected;
                } else if (stepId === 'weight') {
                    // Se o input de peso estiver readonly (restrição de 7 dias), sempre válido
                    const weightInput = document.getElementById('weight-input');
                    if (weightInput && weightInput.readOnly) {
                        isStepValid = true;
                    } else {
                        const weightValue = weightInput ? weightInput.value.trim() : '';
                        isStepValid = weightValue !== '' && weightInput.checkValidity();
                    }
                } else if (stepId === 'dob_gender') {
                    // Validar data de nascimento (idade mínima 12 anos) e gênero explicitamente
                    const dobInput = form.querySelector('input[name="dob"]');
                    const genderSelect = form.querySelector('select[name="gender"]');
                    const today = new Date();

                    let isDobValid = false;
                    let errorMessage = '';

                    if (dobInput && dobInput.value) {
                        const dobDate = new Date(dobInput.value + 'T00:00:00');
                        const ageDiffMs = today - dobDate;
                        const ageDate = new Date(ageDiffMs);
                        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

                        if (isNaN(age)) {
                            errorMessage = 'Data de nascimento inválida. Confira o dia, mês e ano.';
                        } else if (dobDate > today) {
                            errorMessage = 'A data de nascimento não pode ser no futuro.';
                        } else if (age < 12) {
                            errorMessage = 'Você precisa ter pelo menos 12 anos para usar o ShapeFit.';
                        } else {
                            isDobValid = dobInput.checkValidity();
                        }
                    } else {
                        errorMessage = 'Preencha sua data de nascimento.';
                    }

                    if (dobInput) {
                        dobInput.setCustomValidity(errorMessage || '');
                    }
                    if (dobErrorEl) {
                        if (errorMessage) {
                            dobErrorEl.textContent = errorMessage;
                            dobErrorEl.style.display = 'block';
                        } else {
                            dobErrorEl.textContent = '';
                            dobErrorEl.style.display = 'none';
                        }
                    }

                    const isGenderValid = !!(genderSelect && genderSelect.value);
                    isStepValid = isDobValid && isGenderValid;
                } else {
                    const inputs = currentStepDiv.querySelectorAll('input[required], select[required]');
                    isStepValid = Array.from(inputs).every(input => {
                        if (input.type === 'radio' || input.type === 'checkbox') {
                            const checked = form.querySelector(`input[name="${input.name}"]:checked`);
                            return checked !== null;
                        }
                        if (input.tagName === 'SELECT') {
                            return input.value !== '';
                        }
                        return input.value.trim() !== '' && input.checkValidity();
                    });
                }
                actionBtn.disabled = !isStepValid;
            };

            const showStep = (stepIndex) => {
                steps.forEach((step, index) => {
                    step.classList.toggle('active', index === stepIndex);
                });

                headerNav.style.visibility = (stepIndex > 0) ? 'visible' : 'hidden';
                
                // Mover o botão para dentro do step-content ativo
                const currentStep = steps[stepIndex];
                const stepContent = currentStep.querySelector('.step-content');
                if (stepContent) {
                    // Verificar se já existe um wrapper .step-actions
                    let stepActions = stepContent.querySelector('.step-actions');
                    if (!stepActions) {
                        // Criar o wrapper se não existir
                        stepActions = document.createElement('div');
                        stepActions.className = 'step-actions';
                        stepContent.appendChild(stepActions);
                    }
                    // Mover o botão para dentro do wrapper
                    if (actionBtn.parentNode !== stepActions) {
                        stepActions.appendChild(actionBtn);
                    }
                }
                
                // Inicializar modal de telefone quando o step de telefone se tornar ativo
                const currentStepId = currentStep?.dataset?.stepId;
                if (currentStepId === 'phone') {
                    // Aguardar um pouco para garantir que o DOM está pronto
                    setTimeout(() => {
                        initPhoneMasks();
                    }, 100);
                }
                
                // Verificar se este é o último step visível
                let isLastVisibleStep = (stepIndex === steps.length - 1);
                if (!isLastVisibleStep) {
                    // Verificar se todos os próximos steps estão escondidos
                    let hasVisibleNextStep = false;
                    for (let i = stepIndex + 1; i < steps.length; i++) {
                        if (steps[i].style.display !== 'none') {
                            hasVisibleNextStep = true;
                            break;
                        }
                    }
                    isLastVisibleStep = !hasVisibleNextStep;
                }
                
                actionBtn.textContent = isLastVisibleStep ? 'Finalizar e criar plano' : 'Continuar';
                updateProgress(stepIndex);
                updateButtonState();
            };

            actionBtn.addEventListener('click', async () => {
                if (actionBtn.disabled) {
                    return;
                }

                let currentStepIndex = stepHistory[stepHistory.length - 1];
                const currentStepDiv = steps[currentStepIndex];
                const currentStepId = currentStepDiv.dataset.stepId;
                // Último passo -> enviar
                if (currentStepIndex === steps.length - 1) {
                    actionBtn.disabled = true;
                    actionBtn.textContent = 'Processando...';

                    const formData = new FormData(form);
                    const data = {};

                    for (let [key, value] of formData.entries()) {
                        if (key === 'exercise_types[]') {
                            if (!data['exercise_types']) data['exercise_types'] = [];
                            data['exercise_types'].push(value);
                        } else {
                            data[key] = value;
                        }
                    }

                    // Processar telefone
                    const phone = data.phone_number || '';
                    let phoneClean = phone.replace(/\D/g, '');
                    const phone_country_code = data.phone_country_code || '+55';
                    const countryDialCode = phone_country_code.replace('+', '');
                    
                    // Remover código do país se estiver presente no número
                    if (phoneClean.startsWith(countryDialCode)) {
                        phoneClean = phoneClean.substring(countryDialCode.length);
                    }
                    
                    // Para Brasil, manter formato DDD + número
                    if (phone_country_code === '+55') {
                        if (phoneClean.length >= 10) {
                        data.phone_ddd = phoneClean.substring(0, 2);
                        data.phone_number = phoneClean.substring(2);
                        } else {
                            // Fallback se não tiver 10 dígitos
                            data.phone_ddd = phoneClean.length >= 2 ? phoneClean.substring(0, 2) : '00';
                            data.phone_number = phoneClean.length >= 2 ? phoneClean.substring(2) : phoneClean;
                        }
                    } else {
                        // Para outros países, salvar número completo sem código do país
                        data.phone_ddd = '00'; // Placeholder para DDD quando não é Brasil
                        data.phone_number = phoneClean;
                    }
                    data.phone_country_code = phone_country_code;
                    delete data.phone; // Remover campo phone original se existir

                    // Atividades customizadas
                    data.custom_activities = customActivities.join(',');
                    // Checkbox "não pratico"
                    data.exercise_type_none = noneCheckbox.checked ? '1' : '';

                    try {
                        const token = getAuthToken();
                        const response = await fetch(`${window.API_BASE_URL}/process_onboarding.php`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.success) {
                            // Verificar se a conta requer aprovação
                            if (result.requires_approval) {
                                // Limpar qualquer token existente (usuário não deve estar logado ainda)
                                if (typeof clearAuthToken === 'function') {
                                    clearAuthToken();
                                }

                                // Criar tela de confirmação no estilo do app
                                (function showApprovalScreen() {
                                    const appContainer = document.querySelector('.app-container') || document.body;

                                    // Limpar conteúdo atual do onboarding
                                    const pageRoot = document.querySelector('.page-root');
                                    if (pageRoot && pageRoot !== appContainer) {
                                        pageRoot.innerHTML = '';
                                    } else {
                                        appContainer.innerHTML = '';
                                    }

                                    // Estilos específicos da tela de aprovação (escopo limitado por classe)
                                    const style = document.createElement('style');
                                    style.textContent = `
                                        .approval-screen-root {
                                            width: 100%;
                                            max-width: 480px;
                                            height: 100vh;
                                            height: 100dvh;
                                            margin: 0 auto;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            padding: 24px;
                                            background: #0a0a0a;
                                            font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
                                            color: #F5F5F5;
                                        }
                                        .approval-card {
                                            width: 100%;
                                            border-radius: 20px;
                                            padding: 32px 24px;
                                            background: #151515;
                                            border: 1px solid rgba(255, 255, 255, 0.06);
                                            text-align: center;
                                            animation: approvalFadeIn 0.4s ease-out;
                                        }
                                        .approval-icon {
                                            width: 56px;
                                            height: 56px;
                                            border-radius: 50%;
                                            margin: 0 auto 20px;
                                            background: linear-gradient(135deg, #FFAE00, #F83600);
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                        }
                                        .approval-icon i {
                                            font-size: 1.5rem;
                                            color: #fff;
                                        }
                                        .approval-title {
                                            font-size: 1.5rem;
                                            font-weight: 700;
                                            margin-bottom: 12px;
                                            color: #fff;
                                        }
                                        .approval-subtitle {
                                            font-size: 0.95rem;
                                            color: #999;
                                            margin-bottom: 24px;
                                            line-height: 1.5;
                                        }
                                        .approval-info-card {
                                            margin-bottom: 24px;
                                            padding: 16px;
                                            border-radius: 12px;
                                            background: rgba(255, 255, 255, 0.03);
                                            border: 1px solid rgba(255, 255, 255, 0.05);
                                            font-size: 0.9rem;
                                            color: #aaa;
                                            text-align: center;
                                            display: flex;
                                            gap: 12px;
                                            align-items: center;
                                            justify-content: center;
                                        }
                                        .approval-info-card i {
                                            color: #FFAE00;
                                            font-size: 1.2rem;
                                        }
                                        .approval-button {
                                            width: 100%;
                                            border: none;
                                            border-radius: 12px;
                                            padding: 14px 20px;
                                            font-size: 1rem;
                                            font-weight: 600;
                                            cursor: pointer;
                                            background: linear-gradient(135deg, #FFAE00, #F83600);
                                            color: #fff;
                                            transition: transform 0.2s ease, opacity 0.2s ease;
                                        }
                                        .approval-button:active {
                                            transform: scale(0.98);
                                            opacity: 0.9;
                                        }
                                        @keyframes approvalFadeIn {
                                            from { opacity: 0; transform: translateY(10px); }
                                            to { opacity: 1; transform: translateY(0); }
                                        }
                                    `;
                                    document.head.appendChild(style);

                                    const wrapper = document.createElement('div');
                                    wrapper.className = 'approval-screen-root';
                                    wrapper.innerHTML = `
                                        <div class="approval-card">
                                            <div class="approval-icon">
                                                <i class="fas fa-user-check"></i>
                                            </div>
                                            <h1 class="approval-title">Conta criada!</h1>
                                            <p class="approval-subtitle">
                                                Aguarde a aprovação do seu nutricionista.
                                            </p>
                                            <div class="approval-info-card">
                                                <i class="fas fa-envelope-open-text"></i>
                                                <div>
                                                    <span>Você receberá um e-mail quando sua conta for liberada.</span>
                                                </div>
                                            </div>
                                            <button type="button" class="approval-button" id="go-to-login-btn">
                                                Voltar para o login
                                            </button>
                                        </div>
                                    `;

                                    // Garantir fundo correto
                                    document.body.style.background = '#0a0a0a';
                                    document.body.style.backgroundColor = '#0a0a0a';

                                    if (pageRoot && pageRoot !== appContainer) {
                                        pageRoot.appendChild(wrapper);
                                    } else {
                                        appContainer.appendChild(wrapper);
                                    }

                                    const goToLoginBtn = wrapper.querySelector('#go-to-login-btn');
                                    if (goToLoginBtn) {
                                        goToLoginBtn.addEventListener('click', function() {
                                            if (window.SPARouter && window.SPARouter.navigate) {
                                                window.SPARouter.navigate('/fragments/auth_login.html', true);
                                            } else {
                                                window.location.href = (result.redirect_url || '/auth/login.html');
                                            }
                                        });
                                    }
                                })();

                                return;
                            }
                            
                            // Se um novo token foi retornado (usuário foi criado e aprovado), atualizar o token armazenado
                            if (result.token) {
                                setAuthToken(result.token);
                            }
                            
                            // ✅ Usar router SPA se disponível, senão redirecionar normalmente
                            if (window.SPARouter && window.SPARouter.navigate) {
                                window.SPARouter.navigate('/fragments/main_app.html', true);
                            } else {
                                const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                                const redirectUrl = isDev ? '/fragments/main_app.html' : (result.redirect_url || '/fragments/main_app.html');
                                window.location.href = redirectUrl;
                            }
                        } else {
                            alert(result.message || 'Erro ao processar onboarding. Tente novamente.');
                            actionBtn.disabled = false;
                            actionBtn.textContent = 'Finalizar e criar plano';
                        }
                    } catch (error) {
                        console.error('Erro ao processar onboarding:', error);
                        alert('Erro ao conectar com o servidor. Tente novamente.');
                        actionBtn.disabled = false;
                        actionBtn.textContent = 'Finalizar e criar plano';
                    }
                    return;
                }

                // Navegação normal + pulos de step
                let nextStepIndex = currentStepIndex + 1;

                // Se estiver saindo do step de exercícios e marcou "Nenhuma", pula frequência
                if (currentStepId === 'exercise_types' && noneCheckbox.checked) {
                    const freqIndex = steps.findIndex(step => step.dataset.stepId === 'exercise_frequency');
                    if (freqIndex > currentStepIndex) {
                        nextStepIndex = freqIndex + 1;
                    }
                }

                // Se estiver saindo do step de carne e marcou "Sim", pula vegetariano
                if (currentStepId === 'meat') {
                    const meatSelected = form.querySelector('input[name="meat_consumption"]:checked');
                    if (meatSelected && meatSelected.value === '1') {
                        const vegIndex = steps.findIndex(step => step.dataset.stepId === 'vegetarian');
                        if (vegIndex > currentStepIndex) {
                            nextStepIndex = vegIndex + 1;
                        }
                    }
                }

                // Pular steps escondidos (quando refazer)
                while (nextStepIndex < steps.length && steps[nextStepIndex].style.display === 'none') {
                    nextStepIndex++;
                }

                // Se todos os próximos steps estão escondidos, este é o último step visível
                // Nesse caso, devemos enviar o formulário
                if (nextStepIndex >= steps.length || nextStepIndex <= currentStepIndex) {
                    // Mudar texto do botão e enviar
                    actionBtn.disabled = true;
                    actionBtn.textContent = 'Processando...';

                    const formData = new FormData(form);
                    const data = {};

                    for (let [key, value] of formData.entries()) {
                        if (key === 'exercise_types[]') {
                            if (!data['exercise_types']) data['exercise_types'] = [];
                            data['exercise_types'].push(value);
                        } else {
                            data[key] = value;
                        }
                    }

                    // Atividades customizadas
                    data.custom_activities = customActivities.join(',');
                    // Checkbox "não pratico"
                    data.exercise_type_none = (noneCheckbox && noneCheckbox.checked) ? '1' : '';
                    // Indicar que é refazer (não precisa dos campos de localização/telefone)
                    data.is_refazer = true;

                    try {
                        const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
                        const response = await fetch(`${window.API_BASE_URL}/process_onboarding.php`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.success) {
                            if (result.token) {
                                setAuthToken(result.token);
                            }
                            // ✅ Usar router SPA se disponível, senão redirecionar normalmente
                            if (window.SPARouter && window.SPARouter.navigate) {
                                window.SPARouter.navigate('/fragments/main_app.html', true);
                            } else {
                                const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                                const redirectUrl = isDev ? '/fragments/main_app.html' : (result.redirect_url || '/fragments/main_app.html');
                                window.location.href = redirectUrl;
                            }
                        } else {
                            alert(result.message || 'Erro ao processar. Tente novamente.');
                            actionBtn.disabled = false;
                            actionBtn.textContent = 'Finalizar';
                        }
                    } catch (error) {
                        console.error('Erro ao processar:', error);
                        alert('Erro ao conectar com o servidor. Tente novamente.');
                        actionBtn.disabled = false;
                        actionBtn.textContent = 'Finalizar';
                    }
                    return;
                }

                stepHistory.push(nextStepIndex);
                showStep(nextStepIndex);
            });

            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    if (backBtn.disabled) return;
                    backBtn.disabled = true;

                    if (stepHistory.length > 1) {
                        stepHistory.pop();
                        showStep(stepHistory[stepHistory.length - 1]);
                    }

                    setTimeout(() => {
                        backBtn.disabled = false;
                    }, 250);
                });
            }

            // Botão de sair (só aparece quando é refazer)
            if (exitBtn) {
                exitBtn.addEventListener('click', () => {
                    // ✅ Usar router SPA se disponível, senão redirecionar normalmente
                    if (window.SPARouter && window.SPARouter.navigate) {
                        window.SPARouter.navigate('/fragments/main_app.html', true);
                    } else {
                        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                        const redirectUrl = isDev ? '/fragments/main_app.html' : '/fragments/main_app.html';
                        window.location.href = redirectUrl;
                    }
                });
            }

            form.addEventListener('input', updateButtonState);
            form.addEventListener('change', updateButtonState);
            
            // Garantir que radio buttons e checkboxes disparem updateButtonState
            form.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                input.addEventListener('change', () => {
                    updateButtonState();
                });
            });
            
            // Também adicionar listener nos labels (para garantir)
            form.querySelectorAll('.option-card, .exercise-option label').forEach(label => {
                label.addEventListener('click', () => {
                    console.log('[Onboarding] Label clicado:', label.getAttribute('for'));
                    setTimeout(updateButtonState, 50);
                });
            });

            showStep(stepHistory[0]);
        }
        
        // Executar imediatamente (SPA) ou aguardar DOM se necessário
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initOnboarding);
        } else {
            initOnboarding();
        }
    
})();
