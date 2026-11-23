/* ============================================================
   GeoMine AI — Explore Sites — app.js
   ============================================================ */

'use strict';

// ── Utility helpers ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
}

function showToast(msg, type = 'info', icon = '◉') {
  const tc = $('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.innerHTML = `<span class="toast-icon">${icon}</span><span>${esc(msg)}</span>`;
  tc.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ── Mineral Config ───────────────────────────────────────────
const MINERAL_CONFIG = {
  'Base metal':                                       { icon: '⚙️', color: '#8b5cf6', cssVar: '--m-base' },
  'Bauxite':                                          { icon: '🪨', color: '#f97316', cssVar: '--m-bauxite' },
  'Bauxite and rare earth elements':                  { icon: '💠', color: '#ec4899', cssVar: '--m-rare-earth' },
  'Iron ore':                                         { icon: '🔩', color: '#ef4444', cssVar: '--m-iron' },
  'Iron ore and associated major oxides':             { icon: '⛏️', color: '#dc2626', cssVar: '--m-iron' },
  'Limestone':                                        { icon: '🪵', color: '#64748b', cssVar: '--m-limestone' },
  'Manganese ore':                                    { icon: '🔮', color: '#06b6d4', cssVar: '--m-manganese' },
  'Molybdenite and associated elements':              { icon: '✨', color: '#10b981', cssVar: '--m-molybdenite' },
  'Molybdenite and associated pathfinder elements':   { icon: '🧪', color: '#059669', cssVar: '--m-molybdenite' },
  'Tungsten and tin':                                 { icon: '💡', color: '#eab308', cssVar: '--m-tungsten' },
};

function mineralColor(mineral) {
  return (MINERAL_CONFIG[mineral] || {}).color || '#42e5d1';
}
function mineralIcon(mineral) {
  return (MINERAL_CONFIG[mineral] || {}).icon || '🪨';
}

// Geological background gradients per mineral type
const CARD_GRADIENTS = {
  'Base metal':   'linear-gradient(135deg,#1a0f2e 0%,#2d1458 60%,#1a0f2e 100%)',
  'Bauxite':      'linear-gradient(135deg,#2a0e00 0%,#4a1a00 60%,#2a0e00 100%)',
  'Bauxite and rare earth elements': 'linear-gradient(135deg,#1f0a1e 0%,#3d1240 60%,#1f0a1e 100%)',
  'Iron ore':     'linear-gradient(135deg,#1e0808 0%,#3b1010 60%,#1e0808 100%)',
  'Iron ore and associated major oxides': 'linear-gradient(135deg,#200a0a 0%,#400e0e 60%,#200a0a 100%)',
  'Limestone':    'linear-gradient(135deg,#0f1520 0%,#1e2a3a 60%,#0f1520 100%)',
  'Manganese ore':'linear-gradient(135deg,#001b22 0%,#003040 60%,#001b22 100%)',
  'Molybdenite and associated elements': 'linear-gradient(135deg,#031c10 0%,#063a1f 60%,#031c10 100%)',
  'Molybdenite and associated pathfinder elements': 'linear-gradient(135deg,#031c10 0%,#063a1f 60%,#031c10 100%)',
  'Tungsten and tin': 'linear-gradient(135deg,#1a1600 0%,#332c00 60%,#1a1600 100%)',
};

function cardGradient(mineral) {
  return CARD_GRADIENTS[mineral] || 'linear-gradient(135deg,#0f1620 0%,#1a2535 60%,#0f1620 100%)';
}

// ── State ────────────────────────────────────────────────────
const state = {
  allSites: [],
  filteredSites: [],
  currentView: 'grid',
  selectedMineral: 'all',
  currentPage: 1,
  perPage: 9,
  activeSiteId: null,
  maps: { main: null, split: null, detail: null },
  layers: { main: null, split: null },
  markerMap: {},         // siteId -> marker (main map)
  splitMarkerMap: {},    // siteId -> marker (split map)
  detailSite: null,
};

// ── Map Init ─────────────────────────────────────────────────
function createMap(containerId) {
  const m = L.map(containerId, { zoomControl: true, scrollWheelZoom: true })
    .setView([22.5, 79], 4.6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(m);
  return m;
}

function makeMarker(site, mapRef, layerRef, markerRegistry) {
  const color = mineralColor(site.primary_mineral || site.minerals?.[0]);
  const icon = L.divIcon({
    className: '',
    html: `<div class="custom-pin" style="width:12px;height:12px;background:${color};box-shadow:0 0 14px ${color}"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7]
  });
  const marker = L.marker([site.latitude, site.longitude], { icon }).addTo(layerRef);
  marker.bindPopup(buildPopupHTML(site));
  marker.on('popupopen', () => {
    document.querySelectorAll('.popup-link').forEach(a => {
      a.onclick = e => { e.preventDefault(); openSiteDetail(a.dataset.site); };
    });
    document.querySelectorAll('.popup-map-link').forEach(a => {
      a.onclick = e => { e.preventDefault(); focusSite(a.dataset.site, mapRef, markerRegistry); };
    });
  });
  marker.on('click', () => { highlightCard(site.site_id); });
  if (markerRegistry) markerRegistry[site.site_id] = marker;
  return marker;
}

function buildPopupHTML(site) {
  const color = mineralColor(site.primary_mineral);
  return `<b style="color:${color}">${esc(site.site_name)}</b>
    <br><span style="color:#8297a5">${esc([site.district, site.state].filter(Boolean).join(', '))}</span>
    <br><small>${esc(site.primary_mineral || '')}</small>
    <br><small style="color:#8297a5">${site.record_count.toLocaleString()} records</small>
    <br><a href="#" class="popup-link" data-site="${esc(site.site_id)}" style="color:${color}">Open Details →</a>
    &nbsp;
    <a href="#" class="popup-map-link" data-site="${esc(site.site_id)}" style="color:#8297a5">Focus ↗</a>`;
}

function setMarkerActive(siteId, markerRegistry, active) {
  const marker = markerRegistry[siteId];
  if (!marker) return;
  const site = state.allSites.find(s => s.site_id === siteId);
  const color = mineralColor(site?.primary_mineral);
  const cls = active ? 'custom-pin pin-active' : 'custom-pin';
  marker.setIcon(L.divIcon({
    className: '',
    html: `<div class="${cls}" style="width:${active ? 16 : 12}px;height:${active ? 16 : 12}px;background:${color};box-shadow:0 0 ${active ? 24 : 14}px ${color}"></div>`,
    iconSize: active ? [18, 18] : [14, 14],
    iconAnchor: active ? [9, 9] : [7, 7]
  }));
}

function fitMapBounds(mapRef, sites) {
  if (!sites.length) return;
  const bounds = L.latLngBounds(sites.map(s => [s.latitude, s.longitude]));
  mapRef.fitBounds(bounds.pad(.12), { maxZoom: 7, animate: true, duration: .8 });
}

function renderMarkers(sites, mapRef, layerRef, markerRegistry) {
  layerRef.clearLayers();
  for (const k in markerRegistry) delete markerRegistry[k];
  sites.forEach(s => makeMarker(s, mapRef, layerRef, markerRegistry));
}

function focusSite(siteId, mapRef, markerRegistry) {
  const s = state.allSites.find(x => x.site_id === siteId);
  if (!s || !mapRef) return;
  mapRef.flyTo([s.latitude, s.longitude], 11, { animate: true, duration: 1 });
  setTimeout(() => {
    const marker = markerRegistry[siteId];
    if (marker) marker.openPopup();
  }, 1000);
}

// ── Mineral Chips ─────────────────────────────────────────────
let mineralCounts = {};

async function buildMineralChips(minerals) {
  const container = $('mineralChips');
  container.innerHTML = '';

  // All chip
  const allChip = document.createElement('button');
  allChip.className = 'mineral-chip active';
  allChip.style.color = '#3de0cc';
  allChip.dataset.mineral = 'all';
  allChip.innerHTML = `
    <span class="mineral-chip-icon">🌐</span>
    <span class="mineral-chip-name">All Sites</span>
    <span class="mineral-chip-count">${state.allSites.length}</span>
  `;
  container.appendChild(allChip);

  minerals.forEach(mineral => {
    const cfg = MINERAL_CONFIG[mineral] || { icon: '🪨', color: '#42e5d1' };
    const count = mineralCounts[mineral] || 0;
    const chip = document.createElement('button');
    chip.className = 'mineral-chip';
    chip.style.color = cfg.color;
    chip.dataset.mineral = mineral;
    chip.innerHTML = `
      <span class="mineral-chip-icon">${cfg.icon}</span>
      <span class="mineral-chip-name">${esc(mineral)}</span>
      <span class="mineral-chip-count">${count}</span>
    `;
    container.appendChild(chip);
  });

  container.addEventListener('click', e => {
    const chip = e.target.closest('.mineral-chip');
    if (!chip) return;
    $$('.mineral-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.selectedMineral = chip.dataset.mineral;
    $('filterMineral').value = chip.dataset.mineral === 'all' ? 'all' : chip.dataset.mineral;
    loadSites();
  });
}

// ── Sidebar Filters ───────────────────────────────────────────
async function loadFilterOptions() {
  const opts = await getJSON('/api/filter-options');
  const mineralSel = $('filterMineral');
  const stateSel   = $('filterState');
  const districtSel = $('filterDistrict');

  opts.minerals.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    mineralSel.appendChild(o);
  });
  opts.states.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    stateSel.appendChild(o);
  });
  opts.districts.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    districtSel.appendChild(o);
  });

  [mineralSel, stateSel, districtSel, $('filterAssay')].forEach(el => {
    el.addEventListener('change', () => {
      if (el === mineralSel) {
        // Sync mineral chips
        state.selectedMineral = el.value;
        $$('.mineral-chip').forEach(c => {
          c.classList.toggle('active',
            c.dataset.mineral === el.value ||
            (el.value === 'all' && c.dataset.mineral === 'all'));
        });
      }
      updateActiveFilterTags();
      loadSites();
    });
  });

  $('resetFilters').addEventListener('click', resetAllFilters);
  $('filterMineral').addEventListener('change', () => {
    state.selectedMineral = $('filterMineral').value;
  });
}

function updateActiveFilterTags() {
  const filters = getActiveFilters();
  const container = $('activeFilters');
  const tagsEl = $('activeFilterTags');
  const hasActive = Object.values(filters).some(v => v !== 'all' && v !== '');
  container.style.display = hasActive ? 'block' : 'none';
  if (!hasActive) return;
  const labels = { mineral: 'Mineral', state: 'State', district: 'District', has_assay: 'Assay' };
  tagsEl.innerHTML = Object.entries(filters)
    .filter(([, v]) => v !== 'all' && v !== '')
    .map(([k, v]) => `
      <span class="filter-tag">
        <span>${esc(labels[k] || k)}: ${esc(v)}</span>
        <button class="filter-tag-remove" data-filter="${k}" title="Remove">&times;</button>
      </span>`)
    .join('');
  tagsEl.querySelectorAll('.filter-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      const selMap = { mineral: 'filterMineral', state: 'filterState', district: 'filterDistrict', has_assay: 'filterAssay' };
      if (selMap[f]) $(selMap[f]).value = 'all';
      if (f === 'mineral') {
        state.selectedMineral = 'all';
        $$('.mineral-chip').forEach(c => c.classList.toggle('active', c.dataset.mineral === 'all'));
      }
      updateActiveFilterTags();
      loadSites();
    });
  });
}

function getActiveFilters() {
  return {
    mineral: $('filterMineral').value,
    state: $('filterState').value,
    district: $('filterDistrict').value,
    has_assay: $('filterAssay').value,
  };
}

function resetAllFilters() {
  ['filterMineral', 'filterState', 'filterDistrict', 'filterAssay'].forEach(id => $(id).value = 'all');
  $('globalSearch').value = '';
  state.selectedMineral = 'all';
  $$('.mineral-chip').forEach(c => c.classList.toggle('active', c.dataset.mineral === 'all'));
  updateActiveFilterTags();
  loadSites();
  showToast('All filters cleared', 'info', '↺');
}

// ── Load Sites ────────────────────────────────────────────────
let loadTimer = null;

async function loadSites(immediate = false) {
  clearTimeout(loadTimer);
  if (!immediate) {
    loadTimer = setTimeout(() => loadSites(true), 220);
    return;
  }

  const spinner = $('searchSpinner');
  spinner.classList.remove('hidden');

  const f = getActiveFilters();
  const q = $('globalSearch').value.trim();
  const sort = $('sortSelect').value;
  const params = new URLSearchParams({
    mineral: f.mineral, state: f.state, district: f.district,
    has_assay: f.has_assay, q, sort
  });

  try {
    const sites = await getJSON(`/api/sites?${params}`);
    state.filteredSites = sites;
    state.currentPage = 1;
    renderAll(sites);
  } catch (err) {
    console.error(err);
    showToast('Could not load sites: ' + err.message, 'error', '⚠');
  } finally {
    spinner.classList.add('hidden');
  }
}

function renderAll(sites) {
  // Update counts
  const countStr = `${sites.length}`;
  $('sidebarResultCount').textContent = countStr;
  $('toolbarResultCount').innerHTML = `<strong>${countStr}</strong>`;

  // Render based on current view
  if (state.currentView === 'grid' || state.currentView === 'split') renderGrid(sites);
  if (state.currentView === 'map')   renderMapOnly(sites);
  if (state.currentView === 'split') renderSplitList(sites);

  // Always keep main map markers in sync
  if (state.maps.main && state.layers.main) {
    renderMarkers(sites, state.maps.main, state.layers.main, state.markerMap);
    $('visibleSites').textContent = `${sites.length} SITES DISPLAYED`;
    if (sites.length) fitMapBounds(state.maps.main, sites);
  }
  if (state.maps.split && state.layers.split) {
    renderMarkers(sites, state.maps.split, state.layers.split, state.splitMarkerMap);
    $('visibleSitesSplit').textContent = `${sites.length} SITES`;
    if (sites.length) fitMapBounds(state.maps.split, sites);
  }
}

// ── Grid Rendering ────────────────────────────────────────────
function renderGrid(sites) {
  const grid = $('siteGrid');
  const emptyState = $('emptyState');
  const paginationWrap = $('paginationWrap');

  if (!sites.length) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    paginationWrap.style.display = 'none';
    return;
  }
  emptyState.classList.add('hidden');

  // Pagination
  const total = sites.length;
  const totalPages = Math.ceil(total / state.perPage);
  state.currentPage = Math.min(state.currentPage, totalPages);
  const start = (state.currentPage - 1) * state.perPage;
  const pageSites = sites.slice(start, start + state.perPage);

  grid.innerHTML = pageSites.map((s, i) => buildCardHTML(s, i)).join('');
  attachCardEvents(grid, sites);

  // Pagination controls
  if (totalPages > 1) {
    paginationWrap.style.display = 'flex';
    $('pageInfo').textContent = `Page ${state.currentPage} of ${totalPages}`;
    $('prevPage').disabled = state.currentPage <= 1;
    $('nextPage').disabled = state.currentPage >= totalPages;
  } else {
    paginationWrap.style.display = 'none';
  }
}

function buildCardHTML(site, idx) {
  const color = mineralColor(site.primary_mineral);
  const icon  = mineralIcon(site.primary_mineral);
  const bg    = cardGradient(site.primary_mineral);
  const delay = `animation-delay:${idx * 55}ms`;

  const locationLine = [site.district, site.state].filter(Boolean).join(', ');
  const coords = `${site.latitude.toFixed(4)}°N, ${site.longitude.toFixed(4)}°E`;
  const hasAssay = site.has_assay;

  return `
  <article class="site-card" data-site="${esc(site.site_id)}" style="--accent:${color};${delay}" role="button" tabindex="0">
    <div class="card-image">
      <div class="card-image-bg" style="background:${bg}"></div>
      <div class="card-image-overlay"></div>
      <div class="card-mineral-visual">${icon}</div>
      <div class="card-badges">
        <span class="badge badge--mineral">${esc(site.primary_mineral || 'Unknown')}</span>
        ${hasAssay ? `<span class="badge badge--assay">◈ ASSAY DATA</span>` : ''}
      </div>
      <span class="card-site-id">${esc(site.site_id)}</span>
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(site.site_name)}</h3>
      <div class="card-location">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        ${esc(locationLine || 'Location not recorded')}
      </div>
      <div class="card-mineral-label">
        <span class="card-mineral-dot" style="background:${color};box-shadow:0 0 8px ${color}"></span>
        ${esc(site.primary_mineral || '—')}
      </div>
      <div class="card-stats">
        <div class="card-stat">
          <span class="card-stat-val">${site.record_count.toLocaleString()}</span>
          <span class="card-stat-label">RECORDS</span>
        </div>
        ${hasAssay ? `<div class="card-stat">
          <span class="card-stat-val" style="color:var(--cyan)">${site.assay_count.toLocaleString()}</span>
          <span class="card-stat-label">ASSAYS</span>
        </div>` : ''}
        ${site.minerals && site.minerals.length > 1 ? `<div class="card-stat">
          <span class="card-stat-val" style="color:var(--violet)">${site.minerals.length}</span>
          <span class="card-stat-label">MINERALS</span>
        </div>` : ''}
      </div>
      <div class="card-coords">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" style="color:var(--muted)">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
        </svg>
        <span>${coords}</span>
      </div>
    </div>
    <div class="card-footer">
      <button class="btn-primary explore-btn" data-site="${esc(site.site_id)}" style="background:${color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        Explore Site
      </button>
      <button class="btn-secondary map-btn" data-site="${esc(site.site_id)}" title="View on map">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
        Map
      </button>
    </div>
  </article>`;
}

function attachCardEvents(grid, sites) {
  grid.querySelectorAll('.explore-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openSiteDetail(btn.dataset.site);
    });
  });
  grid.querySelectorAll('.map-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      switchView('map');
      setTimeout(() => focusSite(btn.dataset.site, state.maps.main, state.markerMap), 100);
      showToast('Focused on map', 'info', '↗');
    });
  });
  grid.querySelectorAll('.site-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      openSiteDetail(card.dataset.site);
    });
    card.addEventListener('keypress', e => {
      if (e.key === 'Enter') openSiteDetail(card.dataset.site);
    });
  });
}

function highlightCard(siteId) {
  $$('.site-card').forEach(c => c.classList.toggle('highlighted', c.dataset.site === siteId));
  const active = document.querySelector(`.site-card[data-site="${CSS.escape(siteId)}"]`);
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Map Only View ─────────────────────────────────────────────
function renderMapOnly(sites) {
  if (state.maps.main) {
    renderMarkers(sites, state.maps.main, state.layers.main, state.markerMap);
    $('visibleSites').textContent = `${sites.length} SITES DISPLAYED`;
    if (sites.length) fitMapBounds(state.maps.main, sites);
  }
}

// ── Split View ────────────────────────────────────────────────
function renderSplitList(sites) {
  const list = $('splitSiteList');
  $('splitCount').textContent = `${sites.length} sites`;
  if (!sites.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No sites match</div>';
    return;
  }
  list.innerHTML = sites.map(s => {
    const color = mineralColor(s.primary_mineral);
    const loc = [s.district, s.state].filter(Boolean).join(', ');
    return `<div class="split-item" data-site="${esc(s.site_id)}" style="--accent:${color}">
      <div class="split-item-dot" style="background:${color};box-shadow:0 0 8px ${color}"></div>
      <div class="split-item-info">
        <div class="split-item-name">${esc(s.site_name)}</div>
        <div class="split-item-sub">${esc(loc)}</div>
      </div>
      <div class="split-item-count">${s.record_count.toLocaleString()}</div>
    </div>`;
  }).join('');

  list.querySelectorAll('.split-item').forEach(el => {
    el.addEventListener('click', () => {
      list.querySelectorAll('.split-item').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      focusSite(el.dataset.site, state.maps.split, state.splitMarkerMap);
    });
  });
}

// ── View Switching ────────────────────────────────────────────
function switchView(view) {
  state.currentView = view;
  $$('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view-panel').forEach(p => p.classList.remove('view-panel--active'));

  if (view === 'grid') {
    $('gridView').classList.add('view-panel--active');
    renderGrid(state.filteredSites);
  } else if (view === 'map') {
    $('mapView').classList.add('view-panel--active');
    setTimeout(() => {
      if (!state.maps.main) {
        state.maps.main = createMap('map');
        state.layers.main = L.layerGroup().addTo(state.maps.main);
        renderAll(state.filteredSites);
      } else {
        state.maps.main.invalidateSize();
      }
    }, 50);
  } else if (view === 'split') {
    $('splitView').classList.add('view-panel--active');
    setTimeout(() => {
      if (!state.maps.split) {
        state.maps.split = createMap('mapSplit');
        state.layers.split = L.layerGroup().addTo(state.maps.split);
        renderAll(state.filteredSites);
      } else {
        state.maps.split.invalidateSize();
      }
      renderSplitList(state.filteredSites);
    }, 50);
  }
}

// ── Site Detail Drawer ────────────────────────────────────────
let detailMinimap = null;

async function openSiteDetail(siteId) {
  try {
    const d = await getJSON(`/api/site/${encodeURIComponent(siteId)}`);
    state.detailSite = d;
    const color = mineralColor(d.primary_mineral);
    const icon  = mineralIcon(d.primary_mineral);

    // Header
    const badge = $('detailMineralBadge');
    badge.textContent = `${icon}  ${d.primary_mineral || 'Unknown mineral'}`;
    badge.style.cssText = `color:${color};background:${color}22;border:1px solid ${color}`;

    $('detailTitle').textContent = d.site_name;
    $('detailId').textContent = `ID: ${d.site_id}`;

    // Overview tab
    $('detailMetrics').innerHTML = `
      <div class="metric-card">
        <div class="metric-label">TOTAL RECORDS</div>
        <div class="metric-value">${d.record_count.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">ASSAY ANALYTES</div>
        <div class="metric-value" style="color:var(--cyan)">${d.assays.length || '—'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">DATA SOURCES</div>
        <div class="metric-value" style="color:var(--violet)">${d.sources.length || '—'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">MINERAL TYPES</div>
        <div class="metric-value" style="color:var(--gold)">${d.minerals.length}</div>
      </div>
    `;

    $('detailMineralsSection').innerHTML = `
      <div class="detail-section-label">MINERAL CATEGORIES</div>
      <div class="detail-mineral-tags">${d.minerals.map(m => {
        const mc = mineralColor(m);
        return `<span class="detail-mineral-tag" style="border-color:${mc}22;color:${mc}">
          ${mineralIcon(m)} ${esc(m)}
        </span>`;
      }).join('')}</div>
    `;

    if (d.ore_types && d.ore_types.length) {
      $('detailOreTypes').innerHTML = `
        <div class="detail-section-label" style="margin-top:16px">ORE TYPES</div>
        <div class="ore-type-list">${d.ore_types.slice(0, 12).map(ot => `<span class="ore-type-chip">${esc(ot)}</span>`).join('')}</div>
      `;
    } else {
      $('detailOreTypes').innerHTML = '';
    }

    // Location tab
    $('detailLocation').innerHTML = `
      <div class="location-row">
        <div class="location-row-label">STATE</div>
        <div class="location-row-value">${esc(d.state || 'Not recorded')}</div>
      </div>
      <div class="location-row">
        <div class="location-row-label">DISTRICT</div>
        <div class="location-row-value">${esc(d.district || 'Not recorded')}</div>
      </div>
      <div class="coord-display">
        <span>LAT&nbsp;&nbsp;${d.latitude.toFixed(6)}°</span>
        <span>LON&nbsp;&nbsp;${d.longitude.toFixed(6)}°</span>
      </div>
    `;

    // Mini-map
    const minimapEl = $('detailMinimap');
    minimapEl.innerHTML = '';
    if (detailMinimap) { detailMinimap.remove(); detailMinimap = null; }
    setTimeout(() => {
      detailMinimap = L.map('detailMinimap', { zoomControl: false, scrollWheelZoom: false, dragging: false, attributionControl: false })
        .setView([d.latitude, d.longitude], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(detailMinimap);
      const icon = L.divIcon({
        className: '',
        html: `<div class="custom-pin" style="width:14px;height:14px;background:${color};box-shadow:0 0 16px ${color}"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8]
      });
      L.marker([d.latitude, d.longitude], { icon }).addTo(detailMinimap);
      setTimeout(() => detailMinimap.invalidateSize(), 100);
    }, 50);

    // View on map button
    $('detailViewOnMap').onclick = () => {
      $('detailBackdrop').classList.add('hidden');
      switchView(state.currentView === 'split' ? 'split' : 'map');
      setTimeout(() => focusSite(siteId, state.maps.main || state.maps.split, state.markerMap || state.splitMarkerMap), 300);
      showToast(`Focused ${d.site_name} on map`, 'info', '↗');
    };

    // Assays tab
    if (d.assays.length) {
      $('assayContent').innerHTML = `
        <div style="margin-bottom:14px">
          <div class="detail-section-label">ASSAY SUMMARY — ${d.assays.length} analytes from ${d.record_count.toLocaleString()} records</div>
        </div>
        <div class="assay-table-wrap">
          <table class="assay-table">
            <thead>
              <tr>
                <th>ANALYTE</th><th>UNIT</th><th>COUNT</th><th>MEAN</th><th>MIN – MAX</th>
              </tr>
            </thead>
            <tbody>
              ${d.assays.slice(0, 40).map(a => `
                <tr>
                  <td class="analyte">${esc(a.analyte)}</td>
                  <td class="unit">${esc(a.unit)}</td>
                  <td class="numeric">${a.count}</td>
                  <td class="numeric">${a.mean}</td>
                  <td class="range">${a.min} – ${a.max}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${d.assays.length > 40 ? `<p style="color:var(--muted);font-size:11px;margin-top:10px">Showing 40 of ${d.assays.length} analytes</p>` : ''}
      `;
    } else {
      $('assayContent').innerHTML = `
        <div class="no-assay-state">
          <svg viewBox="0 0 48 48" fill="none" stroke="var(--muted)" stroke-width="1.5" width="48" height="48">
            <circle cx="24" cy="24" r="22"/><line x1="24" y1="14" x2="24" y2="26"/><circle cx="24" cy="32" r="1.5" fill="var(--muted)"/>
          </svg>
          <p>No assay data recorded for this site.</p>
        </div>`;
    }

    // Sources tab
    if (d.sources.length) {
      $('sourcesContent').innerHTML = d.sources.map((s, i) =>
        `<div class="source-item"><span class="source-idx">${String(i + 1).padStart(2, '0')}</span><span>${esc(s)}</span></div>`
      ).join('');
    } else {
      $('sourcesContent').innerHTML = '<div class="source-item"><span class="source-idx">—</span><span>No sources recorded</span></div>';
    }

    // Reset tabs to Overview
    $$('.detail-tab').forEach(t => t.classList.remove('active'));
    $$('.detail-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.detail-tab[data-tab="overview"]').classList.add('active');
    $('tab-overview').classList.add('active');

    // Show backdrop
    $('detailBackdrop').classList.remove('hidden');

    // Sync card highlight
    highlightCard(siteId);
    if (state.maps.main) setMarkerActive(siteId, state.markerMap, true);
    if (state.maps.split) setMarkerActive(siteId, state.splitMarkerMap, true);
    state.activeSiteId = siteId;
  } catch (err) {
    console.error(err);
    showToast('Could not load site details', 'error', '⚠');
  }
}

// ── Init ──────────────────────────────────────────────────────
async function start() {
  // Pagination wiring
  $('prevPage').addEventListener('click', () => {
    if (state.currentPage > 1) { state.currentPage--; renderGrid(state.filteredSites); window.scrollTo({top:0,behavior:'smooth'}); }
  });
  $('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(state.filteredSites.length / state.perPage);
    if (state.currentPage < totalPages) { state.currentPage++; renderGrid(state.filteredSites); window.scrollTo({top:0,behavior:'smooth'}); }
  });

  // Sort
  $('sortSelect').addEventListener('change', () => loadSites(true));

  // Global search
  let searchTimer;
  $('globalSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadSites(true), 300);
  });

  // View toggle
  $('viewToggle').addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (btn) switchView(btn.dataset.view);
  });

  // Sidebar toggle (mobile)
  $('sidebarToggle').addEventListener('click', () => {
    const sb = $('filterSidebar');
    sb.classList.toggle('open');
  });

  // Close sidebar on backdrop click (mobile)
  document.addEventListener('click', e => {
    const sb = $('filterSidebar');
    if (sb.classList.contains('open') && !sb.contains(e.target) && !$('sidebarToggle').contains(e.target)) {
      sb.classList.remove('open');
    }
  });

  // Detail drawer close
  $('closeDetail').addEventListener('click', () => {
    $('detailBackdrop').classList.add('hidden');
    if (state.activeSiteId) {
      if (state.maps.main) setMarkerActive(state.activeSiteId, state.markerMap, false);
      if (state.maps.split) setMarkerActive(state.activeSiteId, state.splitMarkerMap, false);
      $$('.site-card').forEach(c => c.classList.remove('highlighted'));
      state.activeSiteId = null;
    }
  });
  $('detailBackdrop').addEventListener('click', e => {
    if (e.target === $('detailBackdrop')) $('closeDetail').click();
  });

  // ESC key to close drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $('closeDetail').click();
  });

  // Detail drawer tabs
  $('detailTabs').addEventListener('click', e => {
    const tab = e.target.closest('.detail-tab');
    if (!tab) return;
    $$('.detail-tab').forEach(t => t.classList.remove('active'));
    $$('.detail-tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'location' && detailMinimap) {
      setTimeout(() => detailMinimap.invalidateSize(), 50);
    }
  });

  // Clear all filters
  $('clearAllFilters')?.addEventListener('click', resetAllFilters);

  try {
    // Load summary + minerals + filter-options in parallel
    const [summary, minerals, mineralCountsData] = await Promise.all([
      getJSON('/api/summary'),
      getJSON('/api/minerals'),
      getJSON('/api/mineral-counts'),
    ]);

    // Fill header stats
    $('totalSiteCount').textContent    = summary.sites.toLocaleString();
    $('totalMineralCount').textContent = summary.minerals.toLocaleString();
    $('totalRecordCount').textContent  = summary.records.toLocaleString();
    $('totalStateCount').textContent   = summary.states.toLocaleString();

    mineralCounts = mineralCountsData;

    // Load filter dropdowns
    await loadFilterOptions();

    // Load all sites once to get allSites for chips + initial grid
    const initSites = await getJSON('/api/sites?mineral=all&sort=name');
    state.allSites = initSites;
    state.filteredSites = initSites;

    // Build mineral chips
    await buildMineralChips(minerals);

    // Initial render: grid view
    switchView('grid');
    renderAll(initSites);

    // Also warm up main map but don't switch to it
    state.maps.main = createMap('map');
    state.layers.main = L.layerGroup().addTo(state.maps.main);
    renderMarkers(initSites, state.maps.main, state.layers.main, state.markerMap);
    if (initSites.length) fitMapBounds(state.maps.main, initSites);
    $('visibleSites').textContent = `${initSites.length} SITES DISPLAYED`;

    showToast(`${initSites.length} geological sites loaded`, 'success', '◈');
  } catch (err) {
    console.error(err);
    $('siteGrid').innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--muted)">
      <p>Could not load dataset: ${esc(err.message)}</p>
    </div>`;
    showToast('Dataset load failed', 'error', '⚠');
  }
}

start();
