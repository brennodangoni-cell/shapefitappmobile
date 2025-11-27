// banner-carousel.js (VERSÃO CORRIGIDA PARA SPA)
(function() {

// Variáveis globais do carrossel (precisam ser acessíveis para cleanup)
let carouselInterval = null;
let loadedAnimations = [];
let currentCarouselElement = null;

// Função para limpar carrossel anterior (IMPORTANTE para SPA)
function cleanupCarousel() {
  console.log('[Banner Carousel] Limpando carrossel anterior...');
  
  // Parar intervalo
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
  
  // Destruir animações Lottie
  loadedAnimations.forEach(anim => {
    if (anim && typeof anim.destroy === 'function') {
      try {
        anim.destroy();
      } catch (e) {
        console.warn('[Banner Carousel] Erro ao destruir animação:', e);
      }
    }
  });
  loadedAnimations = [];
  
  // Remover flag de inicializado do elemento antigo
  if (currentCarouselElement) {
    currentCarouselElement.dataset.initialized = 'false';
  }
  currentCarouselElement = null;
}

// Função para carregar banners da API
async function loadBannersFromAPI() {
  try {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiUrl = isDev 
      ? 'https://appshapefit.com/api/get_banners.php'
      : '/api/get_banners.php';
    
    console.log('[Banner Carousel] Carregando banners de:', apiUrl);
    
    const response = await fetch(apiUrl);
    const result = await response.json();
    
    if (result.success && result.banners && result.banners.length > 0) {
      console.log('[Banner Carousel] Banners carregados:', result.banners.length);
      
      if (isDev) {
        return result.banners.map(b => ({
          ...b,
          json_path: b.json_path.startsWith('http') 
            ? b.json_path 
            : `https://appshapefit.com${b.json_path}`
        }));
      }
      
      return result.banners;
    } else {
      console.warn('[Banner Carousel] API vazia, usando fallback');
      return getFallbackBanners();
    }
  } catch (error) {
    console.error('[Banner Carousel] Erro API:', error);
    return getFallbackBanners();
  }
}

function getFallbackBanners() {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isDev ? 'https://appshapefit.com' : '';
  
  return [
    { json_path: `${baseUrl}/assets/banners/banner_receitas.json`, link_url: '/explorar' },
    { json_path: `${baseUrl}/assets/banners/banner2.json`, link_url: null },
    { json_path: `${baseUrl}/assets/banners/banner3.json`, link_url: null },
    { json_path: `${baseUrl}/assets/banners/banner4.json`, link_url: null }
  ];
}

async function initLottieCarousel() {
  // Primeiro, limpar qualquer carrossel anterior
  cleanupCarousel();
  
  console.log('[Banner Carousel] Inicializando...');
  
  if (typeof lottie === 'undefined') {
    console.error('[Banner Carousel] Lottie não carregado!');
    return;
  }
  
  const carousel = document.querySelector('.main-carousel');
  if (!carousel) {
    console.log('[Banner Carousel] Container não encontrado nesta página.');
    return;
  }
  
  // Verificar se JÁ foi inicializado (evitar duplicação)
  if (carousel.dataset.initialized === 'true') {
    console.log('[Banner Carousel] Já inicializado, pulando...');
    return;
  }
  
  // Marcar como inicializado
  carousel.dataset.initialized = 'true';
  currentCarouselElement = carousel;
  
  const track = carousel.querySelector('.carousel-track');
  const paginationContainer = carousel.querySelector('.pagination-container');
  
  if (!track) {
    console.error('[Banner Carousel] .carousel-track não encontrado!');
    return;
  }
  
  // Carregar banners da API
  const bannerData = await loadBannersFromAPI();
  
  if (bannerData.length === 0) {
    console.log('[Banner Carousel] Nenhum banner disponível.');
    carousel.style.display = 'none';
    return;
  }
  
  // Limpar e criar slides
  track.innerHTML = '';
  bannerData.forEach((banner, index) => {
    const slide = document.createElement('div');
    slide.className = 'lottie-slide';
    slide.dataset.link = banner.link_url || '#';
    slide.innerHTML = '<div class="lottie-animation-container"></div>';
    track.appendChild(slide);
  });
  
  const slides = Array.from(carousel.querySelectorAll('.lottie-slide'));
  const slidesCount = slides.length;
  
  // Se só tem 1 slide, não precisa de carrossel
  if (slidesCount <= 1) {
    if (slidesCount === 1 && bannerData[0]) {
      const container = slides[0].querySelector('.lottie-animation-container');
      if (container) {
        const anim = lottie.loadAnimation({ 
          container, 
          renderer: 'svg', 
          loop: true, 
          autoplay: true, 
          path: bannerData[0].json_path 
        });
        loadedAnimations.push(anim);
      }
    }
    if (paginationContainer) paginationContainer.style.display = 'none';
    console.log('[Banner Carousel] Apenas 1 slide, carrossel desabilitado.');
    return;
  }

  // Variáveis de estado
  let currentIndex = 0;
  const DURATION = 7000;
  
  // Limpar paginação e criar nova
  if (paginationContainer) {
    paginationContainer.innerHTML = '';
  }
  
  const progressFills = [];
  slides.forEach(() => {
    const item = document.createElement('div');
    item.className = 'pagination-item';
    const fill = document.createElement('div');
    fill.className = 'pagination-fill';
    fill.style.width = '0%';
    fill.style.transition = 'none';
    item.appendChild(fill);
    if (paginationContainer) paginationContainer.appendChild(item);
    progressFills.push(fill);
  });

  // Funções de controle
  function goToSlide(index, withAnimation = true, startTimer = true) {
    currentIndex = ((index % slidesCount) + slidesCount) % slidesCount;

    if (!withAnimation) {
      track.classList.add('no-transition');
    }

    const slideWidth = slides[0].offsetWidth;
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    
    if (!withAnimation) {
      track.offsetHeight;
      track.classList.remove('no-transition');
    }

    // Controlar animações Lottie
    loadedAnimations.forEach((anim, i) => {
      if (anim) {
        if (i === currentIndex) {
          anim.play();
        } else {
          anim.stop();
        }
      }
    });

    // Atualizar paginação
    updatePagination();
    
    if (startTimer) {
      restartCarouselTimer();
    }
  }
  
  function nextSlide() {
    goToSlide(currentIndex + 1); 
  }

  function prevSlide() {
    goToSlide(currentIndex - 1); 
  }

  function updatePagination() {
    progressFills.forEach((fill, i) => {
      // Reset todas as barras
      fill.style.transition = 'none';
      fill.style.width = '0%';
      
      if (i === currentIndex) {
        // Usar requestAnimationFrame para garantir reset antes de animar
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fill.style.transition = `width ${DURATION}ms linear`;
            fill.style.width = '100%';
          });
        });
      }
    });
  }
  
  // Sistema de swipe
  let isDragging = false;
  let startX = 0;
  let startTranslate = 0;
  let currentTranslate = 0;

  function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
  }

  function handleStart(e) {
    isDragging = true;
    startX = getPositionX(e);
    stopCarouselTimer();
    carousel.classList.add('is-dragging');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    const transformMatrix = new WebKitCSSMatrix(window.getComputedStyle(track).transform);
    startTranslate = transformMatrix.m41;
    currentTranslate = startTranslate;
  }

  function handleMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const currentX = getPositionX(e);
    const diffX = currentX - startX;
    let newTranslate = startTranslate + diffX;
    
    const slideWidth = slides[0].offsetWidth;
    const minTranslate = -(slidesCount - 1) * slideWidth;
    const maxTranslate = 0;
    
    if (currentIndex === 0 && newTranslate > maxTranslate) {
      newTranslate = maxTranslate;
    }
    if (currentIndex === slidesCount - 1 && newTranslate < minTranslate) {
      newTranslate = minTranslate;
    }
    
    currentTranslate = newTranslate;
    track.style.transform = `translateX(${currentTranslate}px)`;
  }

  function handleEnd() {
    if (!isDragging) return;
    isDragging = false;
    carousel.classList.remove('is-dragging');
    document.body.style.overflow = '';
    document.body.style.touchAction = '';

    const movedBy = currentTranslate - startTranslate;
    const threshold = slides[0].offsetWidth * 0.2;

    if (movedBy < -threshold) {
      nextSlide();
    } else if (movedBy > threshold) {
      prevSlide();
    } else {
      goToSlide(currentIndex);
    }
  }

  // Timer
  function startCarouselTimer() {
    stopCarouselTimer();
    carouselInterval = setInterval(nextSlide, DURATION);
  }
  
  function stopCarouselTimer() { 
    if (carouselInterval) {
      clearInterval(carouselInterval);
      carouselInterval = null;
    }
  }
  
  function restartCarouselTimer() { 
    startCarouselTimer(); 
  }

  // Event Listeners
  carousel.addEventListener('mousedown', handleStart);
  carousel.addEventListener('mousemove', handleMove);
  carousel.addEventListener('mouseup', handleEnd);
  carousel.addEventListener('mouseleave', handleEnd);
  carousel.addEventListener('touchstart', handleStart, { passive: false });
  carousel.addEventListener('touchmove', handleMove, { passive: false });
  carousel.addEventListener('touchend', handleEnd, { passive: false });
  
  window.addEventListener('resize', () => goToSlide(currentIndex, false, false));
  
  // Click handler
  carousel.addEventListener('click', (e) => {
    const movedBy = Math.abs(currentTranslate - startTranslate);
    if (isDragging || movedBy > 10) return;

    const link = bannerData[currentIndex]?.link_url;
    if (link && link !== '#' && link !== null) {
      if (window.SPARouter) {
        window.SPARouter.navigate(link);
      } else {
        window.location.href = link;
      }
    }
  });

  // Carregar animações Lottie
  slides.forEach((slide, index) => {
    const container = slide.querySelector('.lottie-animation-container');
    if (!container) return;
    
    const bannerPath = bannerData[index]?.json_path;
    if (!bannerPath) return;
    
    console.log(`[Banner Carousel] Carregando animação ${index}`);
    
    const anim = lottie.loadAnimation({
      container, 
      renderer: 'svg', 
      loop: true, 
      autoplay: (index === 0),
      path: bannerPath
    });
    
    loadedAnimations[index] = anim;
    
    anim.addEventListener('DOMLoaded', () => {
      console.log(`[Banner Carousel] Animação ${index} carregada.`);
      if (index === 0 && currentIndex === 0) {
        anim.play();
      }
    });
  });

  // Iniciar no primeiro slide
  goToSlide(0, false, false);
  
  // Aguardar um pouco e iniciar timer
  setTimeout(() => {
    // Garantir barras em 0%
    progressFills.forEach(fill => {
      fill.style.transition = 'none';
      fill.style.width = '0%';
    });
    
    // Iniciar
    startCarouselTimer();
    updatePagination();
  }, 100);
}

// Função para tentar inicializar
function tryInitCarousel() {
  const carousel = document.querySelector('.main-carousel');
  
  if (!carousel) {
    console.log('[Banner Carousel] Container não existe nesta página.');
    return;
  }
  
  // Se já está inicializado E é o mesmo elemento, não fazer nada
  if (carousel.dataset.initialized === 'true' && carousel === currentCarouselElement) {
    console.log('[Banner Carousel] Já inicializado (mesmo elemento).');
    return;
  }
  
  // Se é um novo elemento ou não está inicializado, limpar e reiniciar
  if (typeof lottie !== 'undefined') {
    initLottieCarousel();
  } else {
    console.warn('[Banner Carousel] Lottie não encontrado, tentando em 500ms...');
    setTimeout(() => {
      if (typeof lottie !== 'undefined') {
        initLottieCarousel();
      } else {
        console.error('[Banner Carousel] Lottie não encontrado após delay.');
      }
    }, 500);
  }
}

// Inicialização
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInitCarousel);
} else {
  tryInitCarousel();
}

// Para SPA: limpar e reinicializar quando mudar de página
window.addEventListener('pageLoaded', (e) => {
  // Se a nova página tem carrossel, inicializar
  // Se não tem, apenas limpar o anterior
  setTimeout(tryInitCarousel, 50);
});

window.addEventListener('fragmentReady', (e) => {
  setTimeout(tryInitCarousel, 50);
});

// Limpar ao sair da página (para navegação tradicional)
window.addEventListener('beforeunload', cleanupCarousel);

})();
