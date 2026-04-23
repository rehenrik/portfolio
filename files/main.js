// ============================================================
// MAIN.JS – Portfolio logic
// ============================================================

// ── Theme toggle ─────────────────────────────────────────────
(function () {
  var KEY = 'site-theme';

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    document.documentElement.classList.add('theme-changing');
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(KEY, theme); } catch (e) {}
    }
    requestAnimationFrame(function () {
      document.documentElement.classList.remove('theme-changing');
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#themeToggle');
    if (!btn) return;
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark', true);
  });

  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) applyTheme(e.newValue, false);
  });
})();

// ── Year in footer ──────────────────────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── Mobile menu ─────────────────────────────────────────────
const menuBtn = document.querySelector('.nav-menu-btn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileClose = document.getElementById('mobileClose');
const mobileOverlay = document.getElementById('mobileOverlay');

function openMenu() {
  mobileMenu?.classList.add('open');
  mobileOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  mobileMenu?.classList.remove('open');
  mobileOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

menuBtn?.addEventListener('click', openMenu);
mobileClose?.addEventListener('click', closeMenu);
mobileOverlay?.addEventListener('click', closeMenu);

// ── Scroll fade-up animation ─────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// ── Load projects from Supabase ──────────────────────────────
async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  try {
    const projects = await getProjectsData();

    grid.innerHTML = '';

    if (!projects || projects.length === 0) {
      renderFallbackProjects(grid);
      return;
    }

    projects.forEach((project, i) => {
      const card = createProjectCard(project, i);
      grid.appendChild(card);
    });

  } catch (err) {
    console.warn('Error fetching projects:', err.message);
    if (grid) renderFallbackProjects(grid);
  }

  initScrollAnimations();
}

function createProjectCard(project, index) {
  const card = document.createElement('a');
  card.className = 'project-card fade-up';
  card.href = project.url || '#';
  card.style.transitionDelay = `${index * 0.1}s`;

  const tags = Array.isArray(project.tags)
    ? project.tags
    : (project.tags || '').split(',').map(t => t.trim()).filter(Boolean);

  card.innerHTML = `
    <div class="project-card-info">
      <div>
        <p class="project-year">${project.year || ''}</p>
        <h3 class="project-title">${project.title}</h3>
        <p class="project-desc">${project.description || ''}</p>
      </div>
      <div class="project-tags">
        ${tags.map(tag => `<span class="project-tag">${tag}</span>`).join('')}
      </div>
    </div>
    <div class="project-card-img">
      ${project.image_url
        ? `<img src="${project.image_url}" alt="${project.title}" loading="lazy" />`
        : ''
      }
    </div>
  `;

  return card;
}

function renderFallbackProjects(grid) {
  const demos = [
    {
      title: 'Project Name',
      year: '2024 – 2025',
      description: 'Created the experience and applied a Design System for consistency',
      tags: ['UX/UI Design', 'Design System', 'Prototyping', 'Handoff'],
      url: '#',
      image_url: ''
    },
    {
      title: 'Another Project',
      year: '2023 – Present',
      description: 'Scalable design system with core elements',
      tags: ['Design System', 'Documentation', 'Foundations'],
      url: '#',
      image_url: ''
    },
    {
      title: 'Client Redesign',
      year: '2022',
      description: 'Redesign to make the experience more intuitive and easy to navigate',
      tags: ['UI Design', 'Visual Design', 'Prototyping'],
      url: '#',
      image_url: ''
    }
  ];

  grid.innerHTML = '';
  demos.forEach((project, i) => {
    const card = createProjectCard(project, i);
    grid.appendChild(card);
  });
}

// ── Card Stream ──────────────────────────────────────────────
class CardStreamController {
  constructor() {
    this.container = document.getElementById("cardStream");
    this.cardLine  = document.getElementById("cardLine");
    if (!this.container || !this.cardLine) return;

    this.position = 0;
    this.velocity = 120;
    this.direction = -1;
    this.isAnimating = true;
    this.isDragging  = false;
    this.lastTime = performance.now();
    this.lastPointerX = 0;
    this.mouseVelocity = 0;
    this.friction = 0.95;
    this.minVelocity = 30;
    this.gapPx = 40;

    this.cards            = [];
    this.modalOpen        = false;
    this.modalIdx         = 0;
    this.containerVisible = true;
    this.rafActive        = false;
    this.loadedCount      = 0;
    this.fadedIn          = false;

    this.io           = this.makeLazyObserver();
    this.playObserver = this.makePlayObserver();
    this.initAsync();
  }

  async initAsync() {
    try {
      const data = await getCarouselData();
      if (Array.isArray(data) && data.length > 0) {
        this.cards = data.map(r => ({
          src:   r.image_url,
          label: r.label || '',
          type:  (r.mime_type || '').startsWith('video/')
                   || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(r.image_url || '')
                   ? 'video' : 'image'
        }));
      }
    } catch (e) {
      this.cards = [];
    }
    this.init();
  }

  // Returns an optimised thumbnail URL for Supabase Storage images
  thumbUrl(src) {
    if (src && src.includes('/storage/v1/object/public/')) {
      return src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
        + '?width=1200&resize=contain&quality=70&format=webp';
    }
    return src; // external/fallback URLs — use as-is
  }

  makeLazyObserver() {
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        if ((card.dataset.type || 'image') === 'video') {
          this.io.unobserve(card);
          this.markCardLoaded(); // gradient placeholder is enough to count as ready
          return; // videos are handled in createCard directly
        }

        const src = card.dataset.bg;
        const img = card.querySelector('img');
        if (!src || !img) { this.io.unobserve(card); return; }

        img.onload = () => {
          card.style.setProperty('--ratio', `${img.naturalWidth} / ${img.naturalHeight}`);
          this.markCardLoaded();
        };
        img.onerror = () => this.markCardLoaded();
        img.src = this.thumbUrl(src);
        this.io.unobserve(card);
      });
    }, { root: this.container, rootMargin: '200px' });
  }

  makePlayObserver() {
    // root: null = viewport — works reliably with CSS-transform carousels
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.1 });
  }

  init() {
    this.populate();
    this.setupEventListeners();
    this.observeContainerVisibility();
    this.startRaf();

    if (!this.cards.length) {
      this.fadeIn();
      return;
    }

    // Wait for the cards likely to be visible on first paint to load,
    // so the whole row appears together instead of popping in one-by-one.
    const vw = window.innerWidth;
    const expectedVisible = vw < 600 ? 2 : (vw < 1200 ? 4 : 6);
    this.expectedLoad = Math.min(this.cardLine.children.length, expectedVisible);

    // Safety net: reveal even if some images stall on the network
    setTimeout(() => this.fadeIn(), 1800);
  }

  markCardLoaded() {
    this.loadedCount++;
    if (this.loadedCount >= this.expectedLoad) this.fadeIn();
  }

  fadeIn() {
    if (this.fadedIn) return;
    this.fadedIn = true;
    this.container.classList.add('loaded');
  }

  observeContainerVisibility() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([entry]) => {
      this.containerVisible = entry.isIntersecting;
      if (this.containerVisible) this.startRaf();
    }, { rootMargin: '200px' });
    obs.observe(this.container);
  }

  startRaf() {
    if (this.rafActive) return;
    this.rafActive = true;
    this.lastTime  = performance.now();
    requestAnimationFrame(() => this.animate());
  }

  populate() {
    this.cardLine.innerHTML = "";
    if (!this.cards.length) return;
    // 12 covers ~2.5x viewport width; cap at 24 to avoid wasting initial work
    const count = Math.min(24, Math.max(12, this.cards.length));
    for (let i = 0; i < count; i++) {
      const item = this.cards[i % this.cards.length];
      this.cardLine.appendChild(this.createCard(item));
    }
  }

  createCard(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";
    const card = document.createElement("div");
    card.className = "card";
    if (item.label) card.setAttribute("aria-label", item.label);
    card.dataset.bg   = item.src;
    card.dataset.type = item.type || 'image';

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.loop    = true;
      video.muted   = true;
      video.setAttribute('playsinline', '');
      video.preload = 'none'; // ratio defaults to 16/10; updated on loadedmetadata when play() fires
      video.src     = item.src;
      video.addEventListener('loadedmetadata', () => {
        const w = video.videoWidth, h = video.videoHeight;
        if (w && h) card.style.setProperty('--ratio', `${w} / ${h}`);
      }, { once: true });
      card.appendChild(video);
      this.playObserver.observe(video);
    } else {
      const img = document.createElement('img');
      img.alt       = item.label || '';
      img.decoding  = 'async';
      img.draggable = false;
      // src is set lazily by the IntersectionObserver
      card.appendChild(img);
    }

    this.io.observe(card);
    wrapper.appendChild(card);
    return wrapper;
  }

  setupEventListeners() {
    const updateGap = () => {
      const g = getComputedStyle(this.cardLine).gap || "40px";
      this.gapPx = parseFloat(g) || 40;
    };
    updateGap();

    window.addEventListener("resize", () => {
      updateGap();
    });

    this.cardLine.addEventListener("mousedown",  (e) => this.startDrag(e), { passive: false });
    document.addEventListener("mousemove",       (e) => this.onDrag(e),    { passive: false });
    document.addEventListener("mouseup",         (e) => this.endDrag(e));
    this.cardLine.addEventListener("touchstart", (e) => this.startDrag(e), { passive: false });
    document.addEventListener("touchmove",       (e) => this.onDrag(e),    { passive: false });
    document.addEventListener("touchend",        (e) => this.endDrag(e));
    document.addEventListener("touchcancel",     (e) => this.endDrag(e));

    // Modal controls
    document.getElementById('carouselModalClose')?.addEventListener('click', () => this.closeModal());
    document.getElementById('carouselModalPrev')?.addEventListener('click',  () => this.modalNav(-1));
    document.getElementById('carouselModalNext')?.addEventListener('click',  () => this.modalNav(1));
    document.getElementById('carouselModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.modalOpen) return;
      if (e.key === 'Escape')     this.closeModal();
      if (e.key === 'ArrowLeft')  this.modalNav(-1);
      if (e.key === 'ArrowRight') this.modalNav(1);
    });

    // Pause carousel videos when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.cardLine.querySelectorAll('video').forEach(v => v.pause());
      }
    });
  }

  getClientX(evt) {
    if (evt.touches && evt.touches.length)               return evt.touches[0].clientX;
    if (evt.changedTouches && evt.changedTouches.length) return evt.changedTouches[0].clientX;
    return evt.clientX;
  }

  startDrag(e) {
    e.preventDefault();
    this.isDragging    = true;
    this.isAnimating   = true;
    this.dragStartX    = this.getClientX(e);
    this.dragMoved     = false;
    this.dragTarget    = e.target.closest('.card');
    this.cardLine.classList.add("dragging", "working");
    this.lastPointerX  = this.dragStartX;
    this.mouseVelocity = 0;
    const t = getComputedStyle(this.cardLine).transform;
    if (t !== "none") this.position = new DOMMatrix(t).m41;
  }

  onDrag(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const x  = this.getClientX(e);
    const dx = x - this.lastPointerX;
    if (Math.abs(x - this.dragStartX) > 6) this.dragMoved = true;
    this.lastPointerX  = x;
    this.position     += dx;
    this.mouseVelocity = dx * 60;
    this.applyTransform();
    this.recycleIfNeeded();
  }

  endDrag(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.cardLine.classList.remove("dragging");

    // Genuine click (no significant movement)
    if (!this.dragMoved && this.dragTarget) {
      const src = this.dragTarget.dataset.bg;
      if (src) {
        const idx = this.cards.findIndex(c => c.src === src);
        this.openModal(idx >= 0 ? idx : 0);
        return;
      }
    }

    const speed    = Math.abs(this.mouseVelocity);
    this.velocity  = speed > 0 ? Math.max(this.minVelocity, speed) : this.minVelocity;
    this.direction = this.mouseVelocity > 0 ? 1 : -1;
    if (this.velocity <= this.minVelocity) this.cardLine.classList.remove("working");
  }

  // ── MODAL ────────────────────────────────────────────────────
  openModal(idx) {
    this.modalOpen    = true;
    this.modalIdx     = idx;
    this.wasAnimating = this.isAnimating;
    this.isAnimating  = false; // pause carousel

    const card        = this.cards[idx];
    const sourceEl    = this.dragTarget; // .card div clicked
    const sourceMedia = sourceEl?.querySelector('img, video');
    const modal       = document.getElementById('carouselModal');
    const modalImg    = document.getElementById('carouselModalImg');
    const modalVid    = document.getElementById('carouselModalVideo');
    const counter     = document.getElementById('carouselModalCounter');
    if (!card || !modal) return;

    if (counter) counter.textContent = `${idx + 1} / ${this.cards.length}`;
    document.body.style.overflow = 'hidden';
    modal.classList.add('open');

    if (card.type === 'video') {
      modalImg.style.display = 'none';
      modalVid.style.display = '';
      // Hint intrinsic dims so layout resolves before metadata arrives
      if (sourceMedia?.videoWidth)  modalVid.width  = sourceMedia.videoWidth;
      if (sourceMedia?.videoHeight) modalVid.height = sourceMedia.videoHeight;
      modalVid.src = card.src;
      modalVid.load();
      modalVid.play().catch(() => {});
    } else {
      modalVid.style.display = 'none';
      modalImg.style.display = '';
      // Hint dims from the already-loaded carousel img so layout is correct on first frame
      if (sourceMedia?.naturalWidth)  modalImg.width  = sourceMedia.naturalWidth;
      if (sourceMedia?.naturalHeight) modalImg.height = sourceMedia.naturalHeight;
      // Same URL as the carousel thumb → browser serves from cache, no second download
      modalImg.src = sourceMedia?.src || this.thumbUrl(card.src);
      modalImg.alt = card.label || '';
    }

    if (sourceEl) sourceEl.style.visibility = 'hidden';
    this.activeSourceEl = sourceEl;

    // FLIP after layout settles
    const target = card.type === 'video' ? modalVid : modalImg;
    requestAnimationFrame(() => this.flipMedia(sourceMedia, target, 'open'));
  }

  closeModal() {
    if (!this.modalOpen) return;
    this.modalOpen = false;

    const modal      = document.getElementById('carouselModal');
    const modalImg   = document.getElementById('carouselModalImg');
    const modalVid   = document.getElementById('carouselModalVideo');
    const sourceEl   = this.activeSourceEl;
    const sourceMedia = sourceEl?.querySelector('img, video');
    const isVideo    = this.cards[this.modalIdx]?.type === 'video';
    const target     = isVideo ? modalVid : modalImg;

    const finish = () => {
      modal?.classList.remove('open');
      document.body.style.overflow = '';
      if (sourceEl) sourceEl.style.visibility = '';
      if (modalVid) { modalVid.pause(); modalVid.removeAttribute('src'); modalVid.load(); }
      this.isAnimating = true;
      this.lastTime    = performance.now();
      this.activeSourceEl = null;
    };

    const anim = this.flipMedia(sourceMedia, target, 'close');
    if (anim) anim.onfinish = finish; else finish();
  }

  // FLIP animation between a carousel card and the modal media element.
  // direction: 'open' (card → modal) or 'close' (modal → card).
  flipMedia(sourceMedia, targetMedia, direction) {
    if (!sourceMedia || !targetMedia) return null;
    const sourceRect = sourceMedia.getBoundingClientRect();
    const targetRect = targetMedia.getBoundingClientRect();
    if (!sourceRect.width || !targetRect.width) return null;

    const dx = sourceRect.left - targetRect.left + (sourceRect.width  - targetRect.width)  / 2;
    const dy = sourceRect.top  - targetRect.top  + (sourceRect.height - targetRect.height) / 2;
    const sx = sourceRect.width  / targetRect.width;
    const sy = sourceRect.height / targetRect.height;

    const fromCard = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    const atModal  = 'translate(0, 0) scale(1, 1)';
    const keyframes = direction === 'open'
      ? [{ transform: fromCard }, { transform: atModal }]
      : [{ transform: atModal }, { transform: fromCard }];

    return targetMedia.animate(keyframes, {
      duration: direction === 'open' ? 380 : 320,
      easing: direction === 'open'
        ? 'cubic-bezier(0.22, 1, 0.36, 1)'  // ease-out for opening
        : 'cubic-bezier(0.32, 0, 0.67, 0)', // ease-in for closing
      fill: 'both'
    });
  }

  modalNav(dir) {
    const total = this.cards.length;
    this.modalIdx = (this.modalIdx + dir + total) % total;
    this.swapModalMedia(this.modalIdx);
  }

  swapModalMedia(idx) {
    const card     = this.cards[idx];
    const modalImg = document.getElementById('carouselModalImg');
    const modalVid = document.getElementById('carouselModalVideo');
    const counter  = document.getElementById('carouselModalCounter');
    if (!card) return;
    if (counter) counter.textContent = `${idx + 1} / ${this.cards.length}`;

    // Restore previous source card visibility, then point activeSourceEl at the
    // new card so close-animation lands on the right place.
    if (this.activeSourceEl) this.activeSourceEl.style.visibility = '';
    const wrappers = this.cardLine.querySelectorAll('.card-wrapper');
    for (const w of wrappers) {
      const c = w.firstElementChild;
      if (c && c.dataset.bg === card.src) { this.activeSourceEl = c; break; }
    }
    if (this.activeSourceEl) this.activeSourceEl.style.visibility = 'hidden';

    const newSourceMedia = this.activeSourceEl?.querySelector('img, video');

    if (card.type === 'video') {
      modalImg.style.display = 'none';
      modalVid.style.display = '';
      if (newSourceMedia?.videoWidth)  modalVid.width  = newSourceMedia.videoWidth;
      if (newSourceMedia?.videoHeight) modalVid.height = newSourceMedia.videoHeight;
      modalVid.src = card.src;
      modalVid.load();
      modalVid.play().catch(() => {});
    } else {
      modalVid.pause();
      modalVid.removeAttribute('src');
      modalVid.load();
      modalVid.style.display = 'none';
      modalImg.style.display = '';
      if (newSourceMedia?.naturalWidth)  modalImg.width  = newSourceMedia.naturalWidth;
      if (newSourceMedia?.naturalHeight) modalImg.height = newSourceMedia.naturalHeight;
      modalImg.src = newSourceMedia?.src || this.thumbUrl(card.src);
      modalImg.alt = card.label || '';
    }
  }

  animate() {
    if (!this.containerVisible) {
      this.rafActive = false;
      return; // resumed by observeContainerVisibility when scrolled back
    }

    const now = performance.now();
    const dt  = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.isAnimating && !this.isDragging) {
      if (this.velocity > this.minVelocity) {
        this.velocity *= this.friction;
      } else {
        this.velocity = Math.max(this.minVelocity, this.velocity);
        this.cardLine.classList.remove("working");
      }
      this.position += this.velocity * this.direction * dt;
      this.applyTransform();
      this.recycleIfNeeded();
    }
    requestAnimationFrame(() => this.animate());
  }

  applyTransform() {
    this.cardLine.style.transform = `translate3d(${this.position}px,0,0)`;
  }

  recycleIfNeeded() {
    const c = this.container.getBoundingClientRect();

    let first = this.cardLine.firstElementChild;
    while (first) {
      const r = first.getBoundingClientRect();
      if (r.right < c.left) {
        const compensate = r.width + this.gapPx;
        this.cardLine.appendChild(first);
        this.position += compensate;
        this.applyTransform();
        first = this.cardLine.firstElementChild;
      } else break;
    }

    let last = this.cardLine.lastElementChild;
    while (last) {
      const r = last.getBoundingClientRect();
      if (r.left > c.right) {
        const compensate = r.width + this.gapPx;
        this.cardLine.prepend(last);
        this.position -= compensate;
        this.applyTransform();
        last = this.cardLine.lastElementChild;
      } else break;
    }
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new CardStreamController();
  loadProjects();

  // Animate hero elements
  document.querySelectorAll('.hero > *').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  });

  // Add fade-up to sections
  document.querySelectorAll('.section-header, .about-text-col, .about-images-col, .skills-section h2, .skills-grid, .contact-section > *').forEach(el => {
    el.classList.add('fade-up');
  });

  initScrollAnimations();
});
