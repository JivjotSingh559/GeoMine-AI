/* ═══════════════════════════════════════════════
   GeoMine AI — Shared Utilities (shared.js)
   ═══════════════════════════════════════════════ */
'use strict';

/* ── DOM helpers ── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ── API ── */
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API error ${r.status}: ${url}`);
  return r.json();
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${url}`);
  return r.json();
}

/* ── Toast ── */
function toast(msg, type = 'info', duration = 3500) {
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg>',
  };
  const stack = $('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${esc(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/* ── Scroll reveal ── */
function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  $$('[data-reveal]').forEach(el => obs.observe(el));
}

/* ── Mobile nav ── */
function initMobileNav() {
  const toggle = $('mobileNavToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.addEventListener('click', e => {
    if (!e.target.closest('.sidenav') && !e.target.closest('#mobileNavToggle')) {
      document.body.classList.remove('nav-open');
    }
  });
}

/* ── Number formatter ── */
function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

/* ── Mineral palette (consistent across pages) ── */
const MINERAL_PALETTE = {
  'Base metal':                                       { color: '#9333EA', dimColor: 'rgba(147,51,234,0.12)', icon: '⚙' },
  'Bauxite':                                          { color: '#F97316', dimColor: 'rgba(249,115,22,0.12)',  icon: '🪨' },
  'Bauxite and rare earth elements':                  { color: '#DB2777', dimColor: 'rgba(219,39,119,0.12)', icon: '💠' },
  'Iron ore':                                         { color: '#DC2626', dimColor: 'rgba(220,38,38,0.12)',   icon: '🔩' },
  'Iron ore and associated major oxides':             { color: '#B91C1C', dimColor: 'rgba(185,28,28,0.12)',   icon: '⛏' },
  'Limestone':                                        { color: '#94A3B8', dimColor: 'rgba(148,163,184,0.12)', icon: '🪵' },
  'Manganese ore':                                    { color: '#0891B2', dimColor: 'rgba(8,145,178,0.12)',   icon: '🔮' },
  'Molybdenite and associated elements':              { color: '#059669', dimColor: 'rgba(5,150,105,0.12)',   icon: '✦' },
  'Molybdenite and associated pathfinder elements':   { color: '#10B981', dimColor: 'rgba(16,185,129,0.12)', icon: '🧪' },
  'Tungsten and tin':                                 { color: '#D97706', dimColor: 'rgba(217,119,6,0.12)',   icon: '💡' },
};

function getMineralPalette(mineral) {
  return MINERAL_PALETTE[mineral] || { color: '#E98245', dimColor: 'rgba(233,130,69,0.12)', icon: '◈' };
}

/* ── Chart helpers (using Chart.js if available) ── */
function chartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color = '#87786E';
  Chart.defaults.borderColor = '#493A30';
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.plugins.tooltip.backgroundColor = '#332922';
  Chart.defaults.plugins.tooltip.titleColor = '#F5EEE7';
  Chart.defaults.plugins.tooltip.bodyColor = '#B9AAA0';
  Chart.defaults.plugins.tooltip.borderColor = '#493A30';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.legend.labels.color = '#B9AAA0';
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initMobileNav();
  chartDefaults();
});

/* ── Exports for page scripts ── */
window.GeoMine = {
  $, $$, esc, getJSON, postJSON, toast, fmt, getMineralPalette,
};
