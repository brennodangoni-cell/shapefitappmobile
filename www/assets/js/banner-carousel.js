// banner-carousel.js (VERSÃO CORRIGIDA PARA SPA)
(function() {

// Variáveis globais do carrossel (precisam ser acessíveis para cleanup)
let carouselInterval = null;
let loadedAnimations = [];
let currentCarouselElement = null;

// Função para limpar carrossel anterior (IMPORTANTE para SPA)
function cleanupCarousel() {
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
    const isMobile = typeof window.Capacitor !== 'undefined';
    
    // Sempre usar API_BASE_URL para garantir que vai para o servidor remoto
    const apiUrl = `${window.API_BASE_URL || 'https://appshapefit.com/api'}/get_banners.php`;
    
    // ✅ Log removido para performance
    
    const response = await fetch(apiUrl);
    const result = await response.json();
    
    if (result.success && result.banners && result.banners.length > 0) {
      // ✅ OTIMIZADO: Ordenar banners - mais leves primeiro, receitas por último
      let banners = result.banners;
      
      // Ordenar: receitas por último, resto mantém ordem
      banners.sort((a, b) => {
        const aIsReceitas = a.json_path && a.json_path.includes('receitas');
        const bIsReceitas = b.json_path && b.json_path.includes('receitas');
        
        if (aIsReceitas && !bIsReceitas) return 1; // receitas vai pro final
        if (!aIsReceitas && bIsReceitas) return -1; // receitas vai pro final
        return 0; // mantém ordem original
      });
      
      // ✅ SEMPRE garantir URLs completas no mobile ou dev
      if (isDev || isMobile) {
        return banners.map(b => {
          let jsonPath = b.json_path;
          // Se já é URL completa, usar direto
          if (jsonPath.startsWith('http://') || jsonPath.startsWith('https://')) {
            return { ...b, json_path: jsonPath };
          }
          // Se começa com /, adicionar domínio
          if (jsonPath.startsWith('/')) {
            return { ...b, json_path: `https://appshapefit.com${jsonPath}` };
          }
          // Caso contrário, adicionar / antes
          return { ...b, json_path: `https://appshapefit.com/${jsonPath}` };
        });
      }
      
      return banners;
    } else {
      return getFallbackBanners();
    }
  } catch (error) {
    console.error('[Banner Carousel] Erro API:', error);
    return getFallbackBanners();
  }
}

function getFallbackBanners() {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isMobile = typeof window.Capacitor !== 'undefined';
  // ✅ SEMPRE usar URL completa no mobile ou dev
  const baseUrl = (isDev || isMobile) ? 'https://appshapefit.com' : '';
  
  // ✅ OTIMIZADO: Receitas por último (mais pesado)
  return [
    { json_path: `${baseUrl}/assets/banners/banner2.json`, link_url: null },
    { json_path: `${baseUrl}/assets/banners/banner3.json`, link_url: null },
    { json_path: `${baseUrl}/assets/banners/banner4.json`, link_url: null },
    { json_path: `${baseUrl}/assets/banners/banner_receitas.json`, link_url: '/explorar' } // Por último
  ];
}

// ✅ CARREGAR LOTTIE APENAS QUANDO NECESSÁRIO (lazy load)
async function loadLottieIfNeeded() {
    if (typeof lottie !== 'undefined') {
        return true; // Já carregado
    }
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => {
            console.error('[Banner Carousel] Erro ao carregar Lottie');
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

async function initLottieCarousel() {
  // Primeiro, limpar qualquer carrossel anterior
  cleanupCarousel();
  
  // ✅ CARREGAR LOTTIE APENAS SE NECESSÁRIO
  const lottieLoaded = await loadLottieIfNeeded();
  if (!lottieLoaded) {
    return;
  }
  
  const carousel = document.querySelector('.main-carousel');
  if (!carousel) {
    // ✅ Log removido para performance
    return;
  }
  
  // Verificar se JÁ foi inicializado (evitar duplicação)
  if (carousel.dataset.initialized === 'true') {
    // ✅ Log removido para performance
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
    carousel.style.display = 'none';
    return;
  }
  
  // Limpar e criar slides
  track.innerHTML = '';
  
  bannerData.forEach((banner, index) => {
    const slide = document.createElement('div');
    slide.className = 'lottie-slide';
    slide.dataset.link = banner.link_url || '#';
    // ✅ LARGURA RELATIVA (não absoluta) - CSS já define 100%
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
  const paginationItems = [];
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
    paginationItems.push(item);
  });

  // ✅ Função para carregar slides visíveis (lazy load) - DEFINIR ANTES DE goToSlide
  function loadVisibleSlides() {
    const toLoad = [currentIndex];
    if (currentIndex + 1 < slides.length) toLoad.push(currentIndex + 1);
    if (currentIndex + 2 < slides.length) toLoad.push(currentIndex + 2);
    
    toLoad.forEach(index => {
      if (!loadedAnimations[index]) {
        loadLottieForSlide(index);
      }
    });
  }

  // Funções de controle
  function goToSlide(index, withAnimation = true, startTimer = true) {
    currentIndex = ((index % slidesCount) + slidesCount) % slidesCount;

    if (!withAnimation) {
      track.classList.add('no-transition');
    }

    // ✅ LARGURA RELATIVA - slide sempre 100% do container
    const slideWidth = carousel.offsetWidth;
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    
    if (!withAnimation) {
      track.offsetHeight;
      track.classList.remove('no-transition');
    }

    // ✅ OTIMIZADO: Carregar Lottie lazy quando mudar de slide
    loadVisibleSlides();

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
      
      // Remover classe active de todos os itens
      if (paginationItems[i]) {
        paginationItems[i].classList.remove('active');
      }
      
      if (i === currentIndex) {
        // Adicionar classe active apenas no item atual
        if (paginationItems[i]) {
          paginationItems[i].classList.add('active');
        }
        
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
  
  // ✅ Recalcular posição no resize (largura é relativa, não precisa recalcular)
  window.addEventListener('resize', () => {
    goToSlide(currentIndex, false, false);
  });
  
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

  // ✅ OTIMIZADO: Carregar Lottie apenas quando slide estiver visível (lazy load)
  // Carregar apenas o primeiro slide imediatamente
  function loadLottieForSlide(index) {
    if (loadedAnimations[index]) return; // Já carregado
    
    const slide = slides[index];
    if (!slide) return;
    
    const container = slide.querySelector('.lottie-animation-container');
    if (!container) return;
    
    const bannerPath = bannerData[index]?.json_path;
    if (!bannerPath) return;
    
    // ✅ OTIMIZADO: Usar renderer mais leve e reduzir qualidade
    const anim = lottie.loadAnimation({
      container, 
      renderer: 'svg', // SVG é mais leve que canvas para animações simples
      loop: true, 
      autoplay: false, // ✅ Não autoplay - controlar manualmente
      path: bannerPath,
      // ✅ OTIMIZAÇÕES DE PERFORMANCE
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
        clearCanvas: true,
        progressiveLoad: true, // ✅ Carregar progressivamente
        hideOnTransparent: true
      }
    });
    
    loadedAnimations[index] = anim;
    
    anim.addEventListener('DOMLoaded', () => {
      // ✅ Só tocar se for o slide atual
      if (index === currentIndex) {
        anim.play();
      }
    });
  }
  
  // ✅ OTIMIZADO: Carregar banners apenas quando visíveis (IntersectionObserver)
  const observerOptions = {
    root: null,
    rootMargin: '50px', // Começar a carregar 50px antes de ficar visível
    threshold: 0.1
  };
  
  const bannerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const slideIndex = slides.indexOf(entry.target);
        if (slideIndex !== -1 && !loadedAnimations[slideIndex]) {
          loadLottieForSlide(slideIndex);
        }
      }
    });
  }, observerOptions);
  
  // Observar todos os slides
  slides.forEach(slide => {
    bannerObserver.observe(slide);
  });
  
  // ✅ Carregar primeiro banner após delay (só se ainda não carregou)
  setTimeout(() => {
    if (!loadedAnimations[0]) {
      loadLottieForSlide(0);
    }
  }, 2000); // ✅ Delay de 2s para não travar página inicial
  
  // ✅ Carregar quando mudar de slide
  const originalGoToSlide = goToSlide;
  goToSlide = function(index, smooth, updateTimer) {
    originalGoToSlide(index, smooth, updateTimer);
    loadVisibleSlides();
  };

  // Iniciar no primeiro slide
  goToSlide(0, false, false);
  
  // Aguardar um pouco e iniciar timer
  setTimeout(() => {
    // Garantir barras em 0%
    progressFills.forEach((fill, i) => {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      // Remover active de todos
      if (paginationItems[i]) {
        paginationItems[i].classList.remove('active');
      }
    });
    
    // Adicionar active no primeiro item
    if (paginationItems[0]) {
      paginationItems[0].classList.add('active');
    }
    
    // Iniciar
    startCarouselTimer();
    updatePagination();
  }, 100);
}

// ✅ Função para tentar inicializar - AGUARDA LOTTIE CARREGAR E PÁGINA PRONTA
async function tryInitCarousel() {
  const carousel = document.querySelector('.main-carousel');
  
  if (!carousel) {
    return;
  }
  
  // Se já está inicializado E é o mesmo elemento, não fazer nada
  if (carousel.dataset.initialized === 'true' && carousel === currentCarouselElement) {
    return;
  }
  
  // ✅ ADIAR INICIALIZAÇÃO - Só iniciar após página estar totalmente carregada
  // Aguardar que a página termine de renderizar antes de carregar banners
  await new Promise(resolve => {
    if (document.readyState === 'complete') {
      // Página já carregou, aguardar um pouco mais para garantir
      setTimeout(resolve, 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(resolve, 500);
      }, { once: true });
    }
  });
  
  // ✅ AGUARDAR LOTTIE CARREGAR ANTES DE INICIALIZAR
  const lottieLoaded = await loadLottieIfNeeded();
  if (!lottieLoaded) {
    // Se não conseguiu carregar, tentar novamente depois
    setTimeout(() => {
      tryInitCarousel();
    }, 1000);
    return;
  }
  
  // ✅ LOTTIE CARREGADO - INICIALIZAR (mas banners só carregam depois)
  initLottieCarousel();
}

// Inicialização
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInitCarousel);
} else {
  tryInitCarousel();
}

// ✅ OTIMIZADO: Adiar inicialização em SPA para não travar
window.addEventListener('pageLoaded', (e) => {
  // ✅ Delay maior para não travar durante transição (2s após página carregar)
  setTimeout(tryInitCarousel, 2000);
});

window.addEventListener('fragmentReady', (e) => {
  // ✅ Delay maior para não travar durante transição (2s após fragmento carregar)
  setTimeout(tryInitCarousel, 2000);
});

// Limpar ao sair da página (para navegação tradicional)
window.addEventListener('beforeunload', cleanupCarousel);

})();
