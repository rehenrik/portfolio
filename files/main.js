// ============================================================
// MAIN.JS – Portfolio logic
// ============================================================

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

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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
