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
    const client = await getSupabaseClient();
    const { data: projects, error } = await client
      .from('projects')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;

    // Clear skeletons
    grid.innerHTML = '';

    if (!projects || projects.length === 0) {
      // Fallback: show demo cards if Supabase has no data yet
      renderFallbackProjects(grid);
      return;
    }

    projects.forEach((project, i) => {
      const card = createProjectCard(project, i);
      grid.appendChild(card);
    });

  } catch (err) {
    console.warn('Supabase not configured or error fetching projects:', err.message);
    // Show fallback demo cards so the page still looks good
    const grid = document.getElementById('projectsGrid');
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

    this.cards = [];
    this.dimCache = new Map();
    this.io = this.makeObserver();
    this.initAsync();
  }

  async initAsync() {
    // Try to load from Supabase, fallback to rehenrik.design images
    try {
      const client = await getSupabaseClient();
      const { data, error } = await client
        .from('carousel_images')
        .select('image_url, label')
        .eq('active', true)
        .order('order', { ascending: true });

      if (!error && data && data.length > 0) {
        this.cards = data.map(r => ({ src: r.image_url, label: r.label || '' }));
      } else {
        this.cards = this.fallbackCards();
      }
    } catch (e) {
      this.cards = this.fallbackCards();
    }
    this.init();
  }

  fallbackCards() {
    const BASE = 'https://rehenrik.design/wp-content/uploads';
    return [
      { src: `${BASE}/2025/08/Bubble-thumb.webp`,              label: 'Bubble' },
      { src: `${BASE}/2025/08/Cosmos-Control-Deck-thumb.webp`, label: 'Cosmos Control Deck' },
      { src: `${BASE}/2025/08/MG4-thumb.webp`,                 label: 'MG4' },
      { src: `${BASE}/2025/08/nodes-thumb.webp`,               label: 'Nodes' },
      { src: `${BASE}/2025/08/EasyTax-thumb-.webp`,            label: 'EasyTax' },
      { src: `${BASE}/2025/08/design-thumb-1.webp`,            label: 'Design' },
      { src: `${BASE}/2025/08/elevate-thumb.webp`,             label: 'Elevate' },
      { src: `${BASE}/2025/08/cards-thumb-1.webp`,             label: 'Cards' },
      { src: `${BASE}/2025/08/powerhouse-thumb.webp`,          label: 'Powerhouse' },
      { src: `${BASE}/2025/08/Beneath-the-surface-thumb.webp`, label: 'Beneath the Surface' },
      { src: `${BASE}/2025/08/finance-thumb.webp`,             label: 'Finance' },
      { src: `${BASE}/2025/09/floratil.webp`,                  label: 'Floratil' }
    ];
  }

  // Returns an optimised thumbnail URL for Supabase Storage images
  thumbUrl(src) {
    if (src && src.includes('/storage/v1/object/public/')) {
      return src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
        + '?width=700&quality=55&format=webp';
    }
    return src; // external/fallback URLs — use as-is
  }

  makeObserver() {
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        const src  = card.dataset.bg;
        if (!src) { this.io.unobserve(card); return; }

        // Use thumbnail for carousel display
        const thumb = this.thumbUrl(src);
        card.style.setProperty('--bg', `url("${thumb}")`);

        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          const w = img.naturalWidth  || 1600;
          const h = img.naturalHeight || 1000;
          this.dimCache.set(src, { w, h });
          this.applyWidthFromRatio(card, w, h);
        };
        img.onerror = () => {
          card.style.setProperty('--bg', this.placeholderBG());
          this.applyWidthFromRatio(card, 1600, 1000);
        };
        img.src = thumb;
        this.io.unobserve(card);
      });
    }, { root: this.container, rootMargin: '200px' });
  }

  init() {
    this.populate();
    this.updateCardWidths();
    this.setupEventListeners();
    this.animate();
  }

  populate() {
    this.cardLine.innerHTML = "";
    for (let i = 0; i < 30; i++) {
      const item = this.cards[i % this.cards.length];
      this.cardLine.appendChild(this.createCard(item));
    }
  }

  createCard(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "img");
    if (item.label) card.setAttribute("aria-label", item.label);
    card.style.setProperty('--bg', this.placeholderBG());
    card.dataset.bg = item.src;
    this.io.observe(card);
    wrapper.appendChild(card);
    return wrapper;
  }

  updateCardWidths() {
    this.cardLine.querySelectorAll(".card-wrapper").forEach(wrap => {
      const card  = wrap.firstElementChild;
      const h     = parseFloat(getComputedStyle(wrap).height) || 240;
      const bg    = card.dataset.bg || '';
      const meta  = this.dimCache.get(bg);
      const ratio = meta ? (meta.w / meta.h) : (16 / 10);
      const width = Math.max(140, Math.round(h * ratio));
      card.style.setProperty("--card-w", width + "px");
    });
  }

  applyWidthFromRatio(card, w, h) {
    const wrap  = card.parentElement;
    const hh    = parseFloat(getComputedStyle(wrap).height) || 240;
    const width = Math.max(140, Math.round(hh * (w / h)));
    card.style.setProperty("--card-w", width + "px");
  }

  placeholderBG() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 20;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 32, 20);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 20);
    return `url("${c.toDataURL()}")`;
  }

  setupEventListeners() {
    const updateGap = () => {
      const g = getComputedStyle(this.cardLine).gap || "40px";
      this.gapPx = parseFloat(g) || 40;
    };
    updateGap();

    let resizeRaf = null;
    window.addEventListener("resize", () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => this.updateCardWidths());
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
    this.modalOpen  = true;
    this.modalIdx   = idx;
    this.wasAnimating = this.isAnimating;
    this.isAnimating  = false; // pause carousel

    const modal = document.getElementById('carouselModal');
    modal?.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.loadModalImage(idx);
  }

  closeModal() {
    this.modalOpen = false;
    const modal = document.getElementById('carouselModal');
    modal?.classList.remove('open');
    document.body.style.overflow = '';
    this.isAnimating = true; // resume carousel
    this.lastTime    = performance.now();
  }

  modalNav(dir) {
    const total = this.cards.length;
    this.modalIdx = (this.modalIdx + dir + total) % total;
    this.loadModalImage(this.modalIdx);
  }

  loadModalImage(idx) {
    const card    = this.cards[idx];
    const img     = document.getElementById('carouselModalImg');
    const spinner = document.getElementById('carouselModalSpinner');
    const counter = document.getElementById('carouselModalCounter');
    if (!img || !card) return;

    // Counter
    if (counter) counter.textContent = `${idx + 1} / ${this.cards.length}`;

    // Show spinner, hide current image
    img.classList.remove('loaded');
    spinner?.classList.add('visible');

    // Load full-quality image
    const fullImg = new Image();
    fullImg.decoding = 'async';
    fullImg.onload = () => {
      img.src = card.src;
      img.alt = card.label || '';
      img.classList.add('loaded');
      spinner?.classList.remove('visible');
    };
    fullImg.onerror = () => {
      img.src = card.src;
      img.classList.add('loaded');
      spinner?.classList.remove('visible');
    };
    fullImg.src = card.src;
  }

  animate() {
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
