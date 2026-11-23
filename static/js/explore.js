/* ═══════════════════════════════════════════════════════════
   GeoMine AI — Explore Sites JavaScript (Warm Copper Palette)
   ═══════════════════════════════════════════════════════════ */
'use strict';

const exploreState = {
  allSites: [],
  filteredSites: [],
  currentView: 'grid', // 'grid' | 'map' | 'split'
  selectedMineral: 'all',
  selectedState: 'all',
  selectedDistrict: 'all',
  selectedAssay: 'all',
  sortOrder: 'name',
  searchQuery: '',
  maps: {
    main: null,
    split: null,
    mini: null
  },
  layers: {
    main: null,
    split: null
  },
  markers: {},
  splitMarkers: {},
  activeSiteId: null
};

document.addEventListener('DOMContentLoaded', () => {
  initExplorePage();
});

async function initExplorePage() {
  initEventListeners();
  await loadFilterOptions();
  await loadMineralChips();
  await fetchAndRenderSites();
}

/* ── Event Listeners ── */
function initEventListeners() {
  // Search input
  const searchInput = document.getElementById('siteSearch');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        exploreState.searchQuery = e.target.value.trim().toLowerCase();
        fetchAndRenderSites();
      }, 250);
    });
  }

  // View toggle
  document.querySelectorAll('.view-segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Sort select
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      exploreState.sortOrder = e.target.value;
      fetchAndRenderSites();
    });
  }

  // Sidebar filters
  const stateFilter = document.getElementById('filterState');
  if (stateFilter) {
    stateFilter.addEventListener('change', (e) => {
      exploreState.selectedState = e.target.value;
      updateActiveFilterTags();
      fetchAndRenderSites();
    });
  }

  const districtFilter = document.getElementById('filterDistrict');
  if (districtFilter) {
    districtFilter.addEventListener('change', (e) => {
      exploreState.selectedDistrict = e.target.value;
      updateActiveFilterTags();
      fetchAndRenderSites();
    });
  }

  const assayFilter = document.getElementById('filterAssay');
  if (assayFilter) {
    assayFilter.addEventListener('change', (e) => {
      exploreState.selectedAssay = e.target.value;
      updateActiveFilterTags();
      fetchAndRenderSites();
    });
  }

  // Reset filters
  const resetBtn = document.getElementById('resetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAllFilters);
  }

  // Drawer close
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeSiteDrawer);
  }

  const backdrop = document.getElementById('siteDrawerBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSiteDrawer();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSiteDrawer();
  });

  // Drawer tabs
  document.querySelectorAll('.drawer-tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanel = tab.dataset.tab;
      document.querySelectorAll('.drawer-tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.drawer-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(`tabPanel_${targetPanel}`);
      if (panel) panel.classList.add('active');
      if (targetPanel === 'location' && exploreState.maps.mini) {
        setTimeout(() => exploreState.maps.mini.invalidateSize(), 50);
      }
    });
  });
}

/* ── Load Filter Options ── */
async function loadFilterOptions() {
  try {
    const opts = await window.GeoMine.getJSON('/api/filter-options');
    const stateSel = document.getElementById('filterState');
    const distSel = document.getElementById('filterDistrict');

    if (stateSel) {
      opts.states.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        stateSel.appendChild(opt);
      });
    }

    if (distSel) {
      opts.districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        distSel.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Error loading filter options:', err);
  }
}

/* ── Load Mineral Chips ── */
async function loadMineralChips() {
  const container = document.getElementById('mineralChipsBar');
  if (!container) return;

  try {
    const [minerals, counts] = await Promise.all([
      window.GeoMine.getJSON('/api/minerals'),
      window.GeoMine.getJSON('/api/mineral-counts')
    ]);

    const totalSites = Object.values(counts).reduce((a, b) => a + b, 0);

    let html = `
      <button class="explore-chip active" data-mineral="all">
        <span>🌐 All Minerals</span>
        <span class="explore-chip-count">${totalSites}</span>
      </button>
    `;

    minerals.forEach(min => {
      const pal = window.GeoMine.getMineralPalette(min);
      const count = counts[min] || 0;
      html += `
        <button class="explore-chip" data-mineral="${window.GeoMine.esc(min)}">
          <span>${pal.icon} ${window.GeoMine.esc(min)}</span>
          <span class="explore-chip-count">${count}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.explore-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.explore-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        exploreState.selectedMineral = chip.dataset.mineral;
        updateActiveFilterTags();
        fetchAndRenderSites();
      });
    });
  } catch (err) {
    console.error('Error loading mineral chips:', err);
  }
}

/* ── Fetch & Render Sites ── */
async function fetchAndRenderSites() {
  const grid = document.getElementById('siteCardsGrid');
  const emptyState = document.getElementById('exploreEmptyState');
  const resultCountSidebar = document.getElementById('sidebarResultCount');
  const resultCountHeader = document.getElementById('headerResultCount');

  if (grid) {
    grid.innerHTML = `
      <div class="skeleton" style="height: 380px;"></div>
      <div class="skeleton" style="height: 380px;"></div>
      <div class="skeleton" style="height: 380px;"></div>
    `;
  }

  const params = new URLSearchParams({
    mineral: exploreState.selectedMineral,
    state: exploreState.selectedState,
    district: exploreState.selectedDistrict,
    has_assay: exploreState.selectedAssay,
    sort: exploreState.sortOrder,
    q: exploreState.searchQuery
  });

  try {
    const sites = await window.GeoMine.getJSON(`/api/sites?${params}`);
    exploreState.filteredSites = sites;

    if (resultCountSidebar) resultCountSidebar.textContent = sites.length;
    if (resultCountHeader) resultCountHeader.textContent = `${sites.length} Sites Identified`;

    if (!sites.length) {
      if (grid) grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      clearMapMarkers();
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    renderSiteCards(sites);
    syncMapMarkers(sites);
    syncSplitList(sites);
  } catch (err) {
    console.error('Error fetching sites:', err);
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--error);">
        Failed to load geological sites. Please verify server connection.
      </div>`;
    }
  }
}

/* ── Render Site Cards ── */
function renderSiteCards(sites) {
  const grid = document.getElementById('siteCardsGrid');
  if (!grid) return;

  grid.innerHTML = sites.map(site => {
    const pal = window.GeoMine.getMineralPalette(site.primary_mineral);
    const loc = [site.district, site.state].filter(Boolean).join(', ');
    const isSelected = site.site_id === exploreState.activeSiteId;

    return `
      <article class="site-card ${isSelected ? 'selected' : ''}" data-site-id="${window.GeoMine.esc(site.site_id)}">
        <div class="site-card-visual" style="background: radial-gradient(circle at 75% 25%, ${pal.dimColor} 0%, var(--bg-elevated) 70%);">
          <div class="site-card-visual-bg"></div>
          <span class="site-card-mineral-icon">${pal.icon}</span>
          <div class="site-card-badges">
            <span class="badge badge-accent">${window.GeoMine.esc(site.primary_mineral)}</span>
            ${site.has_assay ? `<span class="badge badge-success">✓ ASSAYS</span>` : ''}
          </div>
          <span class="site-card-id">${window.GeoMine.esc(site.site_id)}</span>
        </div>

        <div class="site-card-body">
          <h3 class="site-card-title">${window.GeoMine.esc(site.site_name)}</h3>
          <div class="site-card-loc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${window.GeoMine.esc(loc || 'Location on record')}</span>
          </div>

          <div class="site-card-mineral-tag">
            <span class="site-card-mineral-dot" style="background: ${pal.color}; box-shadow: 0 0 6px ${pal.color};"></span>
            <span>${window.GeoMine.esc(site.primary_mineral)}</span>
          </div>

          <div class="site-card-stats">
            <div class="site-card-stat">
              <div class="site-card-stat-val">${site.record_count.toLocaleString()}</div>
              <div class="site-card-stat-label">Records</div>
            </div>
            <div class="site-card-stat">
              <div class="site-card-stat-val">${site.has_assay ? site.assay_count.toLocaleString() : '0'}</div>
              <div class="site-card-stat-label">Assay Rows</div>
            </div>
          </div>

          <div class="site-card-coords">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
            </svg>
            <span>${site.latitude.toFixed(4)}°N, ${site.longitude.toFixed(4)}°E</span>
          </div>
        </div>

        <div class="site-card-footer">
          <button class="card-btn-explore" data-action="explore" data-site-id="${window.GeoMine.esc(site.site_id)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Explore Site</span>
          </button>
          <button class="card-btn-map" data-action="map" data-site-id="${window.GeoMine.esc(site.site_id)}" title="View on Map">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <span>Map</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  // Attach card click handlers
  grid.querySelectorAll('.site-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const exploreBtn = e.target.closest('[data-action="explore"]');
      const mapBtn = e.target.closest('[data-action="map"]');
      const siteId = card.dataset.siteId;

      if (mapBtn) {
        e.stopPropagation();
        focusSiteOnMap(siteId);
      } else {
        openSiteDrawer(siteId);
      }
    });
  });
}

/* ── Leaflet Map Setup & Synchronization ── */
function initMap(mapId) {
  const container = document.getElementById(mapId);
  if (!container) return null;

  const map = L.map(mapId, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([21.5, 80.5], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  return map;
}

function syncMapMarkers(sites) {
  if (exploreState.currentView === 'map' && !exploreState.maps.main) {
    exploreState.maps.main = initMap('exploreMap');
    exploreState.layers.main = L.layerGroup().addTo(exploreState.maps.main);
  }
  if (exploreState.currentView === 'split' && !exploreState.maps.split) {
    exploreState.maps.split = initMap('splitMap');
    exploreState.layers.split = L.layerGroup().addTo(exploreState.maps.split);
  }

  const targetMap = exploreState.currentView === 'split' ? exploreState.maps.split : exploreState.maps.main;
  const targetLayer = exploreState.currentView === 'split' ? exploreState.layers.split : exploreState.layers.main;
  const targetRegistry = exploreState.currentView === 'split' ? exploreState.splitMarkers : exploreState.markers;

  if (!targetMap || !targetLayer) return;

  targetLayer.clearLayers();
  for (const k in targetRegistry) delete targetRegistry[k];

  const bounds = [];

  sites.forEach(site => {
    const pal = window.GeoMine.getMineralPalette(site.primary_mineral);
    const icon = L.divIcon({
      className: '',
      html: `<div class="custom-copper-pin" style="width: 14px; height: 14px; background: ${pal.color};"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([site.latitude, site.longitude], { icon }).addTo(targetLayer);

    marker.bindPopup(`
      <div style="font-family: var(--font-body); min-width: 180px;">
        <strong style="color: var(--accent); font-size: 13px;">${window.GeoMine.esc(site.site_name)}</strong>
        <div style="color: #B9AAA0; font-size: 11px; margin: 4px 0;">${window.GeoMine.esc(site.district || '')}, ${window.GeoMine.esc(site.state || '')}</div>
        <div style="font-size: 11px; color: #E8D6C1;">Mineral: <b>${window.GeoMine.esc(site.primary_mineral)}</b></div>
        <div style="font-size: 11px; color: #87786E; margin-bottom: 8px;">Records: ${site.record_count.toLocaleString()}</div>
        <a href="#" style="color: var(--accent); font-weight: 600; font-size: 11px; text-decoration: underline;" onclick="event.preventDefault(); window.openSiteDrawer('${site.site_id}');">
          Open Exploration Details →
        </a>
      </div>
    `);

    marker.on('click', () => {
      highlightSite(site.site_id);
    });

    targetRegistry[site.site_id] = marker;
    bounds.push([site.latitude, site.longitude]);
  });

  if (bounds.length) {
    targetMap.fitBounds(L.latLngBounds(bounds).pad(0.12), { maxZoom: 8 });
  }
}

function clearMapMarkers() {
  if (exploreState.layers.main) exploreState.layers.main.clearLayers();
  if (exploreState.layers.split) exploreState.layers.split.clearLayers();
}

/* ── Split List Sync ── */
function syncSplitList(sites) {
  const container = document.getElementById('splitListItems');
  const countEl = document.getElementById('splitListCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${sites.length} Sites`;

  container.innerHTML = sites.map(site => {
    const pal = window.GeoMine.getMineralPalette(site.primary_mineral);
    const loc = [site.district, site.state].filter(Boolean).join(', ');
    const isAct = site.site_id === exploreState.activeSiteId;

    return `
      <div class="split-item ${isAct ? 'active' : ''}" data-site-id="${window.GeoMine.esc(site.site_id)}">
        <span style="color: ${pal.color}; font-size: 14px; margin-top: 2px;">${pal.icon}</span>
        <div>
          <div class="split-item-name">${window.GeoMine.esc(site.site_name)}</div>
          <div class="split-item-meta">${window.GeoMine.esc(loc)} · ${window.GeoMine.esc(site.primary_mineral)}</div>
        </div>
        <div class="split-item-count">${site.record_count.toLocaleString()} rows</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.split-item').forEach(item => {
    item.addEventListener('click', () => {
      const siteId = item.dataset.siteId;
      highlightSite(siteId);
      const marker = exploreState.splitMarkers[siteId];
      if (marker && exploreState.maps.split) {
        exploreState.maps.split.setView(marker.getLatLng(), 9, { animate: true });
        marker.openPopup();
      }
    });
  });
}

/* ── View Switching ── */
function switchView(view) {
  exploreState.currentView = view;
  document.querySelectorAll('.view-segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  const gridWrap = document.getElementById('viewGridWrap');
  const mapWrap = document.getElementById('viewMapWrap');
  const splitWrap = document.getElementById('viewSplitWrap');

  if (gridWrap) gridWrap.classList.toggle('hidden', view !== 'grid');
  if (mapWrap) mapWrap.classList.toggle('hidden', view !== 'map');
  if (splitWrap) splitWrap.classList.toggle('hidden', view !== 'split');

  setTimeout(() => {
    if (view === 'map') {
      if (!exploreState.maps.main) {
        exploreState.maps.main = initMap('exploreMap');
        exploreState.layers.main = L.layerGroup().addTo(exploreState.maps.main);
      }
      exploreState.maps.main.invalidateSize();
      syncMapMarkers(exploreState.filteredSites);
    } else if (view === 'split') {
      if (!exploreState.maps.split) {
        exploreState.maps.split = initMap('splitMap');
        exploreState.layers.split = L.layerGroup().addTo(exploreState.maps.split);
      }
      exploreState.maps.split.invalidateSize();
      syncMapMarkers(exploreState.filteredSites);
      syncSplitList(exploreState.filteredSites);
    }
  }, 100);
}

/* ── Highlight Site ── */
function highlightSite(siteId) {
  exploreState.activeSiteId = siteId;

  // Highlight card
  document.querySelectorAll('.site-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.siteId === siteId);
  });

  // Highlight split item
  document.querySelectorAll('.split-item').forEach(i => {
    i.classList.toggle('active', i.dataset.siteId === siteId);
  });
}

function focusSiteOnMap(siteId) {
  highlightSite(siteId);
  if (exploreState.currentView === 'grid') {
    switchView('map');
  }
  setTimeout(() => {
    const marker = exploreState.markers[siteId] || exploreState.splitMarkers[siteId];
    const map = exploreState.currentView === 'split' ? exploreState.maps.split : exploreState.maps.main;
    if (marker && map) {
      map.flyTo(marker.getLatLng(), 10, { animate: true, duration: 1 });
      setTimeout(() => marker.openPopup(), 1000);
    }
  }, 200);
  window.GeoMine.toast('Centered map on selected exploration site', 'info');
}

/* ── Site Detail Drawer ── */
async function openSiteDrawer(siteId) {
  const backdrop = document.getElementById('siteDrawerBackdrop');
  if (!backdrop) return;

  highlightSite(siteId);

  try {
    const [detail, geology] = await Promise.all([
      window.GeoMine.getJSON(`/api/site/${encodeURIComponent(siteId)}`),
      window.GeoMine.getJSON(`/api/external/geology?site_id=${encodeURIComponent(siteId)}`)
    ]);

    // Populate Header
    const pal = window.GeoMine.getMineralPalette(detail.primary_mineral);
    document.getElementById('drawerSiteName').textContent = detail.site_name;
    document.getElementById('drawerSiteId').textContent = `ID: ${detail.site_id} · ${detail.record_count.toLocaleString()} Total Records`;
    document.getElementById('drawerMineralBadge').innerHTML = `
      <span class="badge badge-accent" style="color: ${pal.color}; border-color: ${pal.color};">
        ${pal.icon} ${window.GeoMine.esc(detail.primary_mineral)}
      </span>
    `;

    // Overview Tab
    document.getElementById('drawerMetrics').innerHTML = `
      <div class="stat-pill">
        <div>
          <div class="stat-pill-val">${detail.record_count.toLocaleString()}</div>
          <div class="stat-pill-label">Exploration Records</div>
        </div>
      </div>
      <div class="stat-pill">
        <div>
          <div class="stat-pill-val" style="color: var(--sand);">${detail.assays.length}</div>
          <div class="stat-pill-label">Distinct Analytes</div>
        </div>
      </div>
      <div class="stat-pill">
        <div>
          <div class="stat-pill-val" style="color: var(--success);">${detail.sources.length}</div>
          <div class="stat-pill-label">Source Bulletins</div>
        </div>
      </div>
      <div class="stat-pill">
        <div>
          <div class="stat-pill-val" style="color: var(--warning);">${detail.minerals.length}</div>
          <div class="stat-pill-label">Mineral Types</div>
        </div>
      </div>
    `;

    // Ore types
    const oreTypesBox = document.getElementById('drawerOreTypes');
    if (oreTypesBox) {
      if (detail.ore_types && detail.ore_types.length) {
        oreTypesBox.innerHTML = `
          <div class="input-label">RECORDED ORE / SAMPLE LITHOLOGY TYPES</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${detail.ore_types.map(ot => `<span class="badge badge-muted">${window.GeoMine.esc(ot)}</span>`).join('')}
          </div>
        `;
      } else {
        oreTypesBox.innerHTML = `<span class="text-muted" style="font-size: 12px;">Ore type classification not explicitly listed.</span>`;
      }
    }

    // Location Tab
    document.getElementById('drawerLocationDetails').innerHTML = `
      <div class="grid-2">
        <div class="card" style="padding: 12px;">
          <div class="input-label">STATE JURISDICTION</div>
          <div style="font-weight: 600;">${window.GeoMine.esc(detail.state || 'Not specified')}</div>
        </div>
        <div class="card" style="padding: 12px;">
          <div class="input-label">DISTRICT</div>
          <div style="font-weight: 600;">${window.GeoMine.esc(detail.district || 'Not specified')}</div>
        </div>
      </div>
      <div class="card" style="padding: 12px; margin-top: 8px;">
        <div class="input-label">MEDIAN SITE-LEVEL COORDINATES</div>
        <div class="text-mono" style="color: var(--accent); font-size: 13px;">
          LAT ${detail.latitude.toFixed(6)}° N &nbsp;|&nbsp; LON ${detail.longitude.toFixed(6)}° E
        </div>
        <div class="text-muted" style="font-size: 10px; margin-top: 4px;">
          * Coordinate note: Represents the geographic median of records in this block, not individual borehole collars.
        </div>
      </div>
    `;

    // Drawer Mini Map
    setTimeout(() => {
      const miniMapContainer = document.getElementById('drawerMiniMap');
      if (miniMapContainer) {
        if (!exploreState.maps.mini) {
          exploreState.maps.mini = L.map('drawerMiniMap', { zoomControl: false }).setView([detail.latitude, detail.longitude], 10);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO'
          }).addTo(exploreState.maps.mini);
        } else {
          exploreState.maps.mini.setView([detail.latitude, detail.longitude], 10);
        }
        L.marker([detail.latitude, detail.longitude]).addTo(exploreState.maps.mini);
        exploreState.maps.mini.invalidateSize();
      }
    }, 150);

    // Assays Tab Table
    const assayTableBody = document.getElementById('drawerAssayTableBody');
    if (assayTableBody) {
      if (detail.assays && detail.assays.length) {
        assayTableBody.innerHTML = detail.assays.map(a => `
          <tr>
            <td class="analyte-name">${window.GeoMine.esc(a.analyte)}</td>
            <td class="text-mono" style="color: var(--text-muted);">${window.GeoMine.esc(a.unit)}</td>
            <td class="text-mono">${a.count.toLocaleString()}</td>
            <td class="analyte-mean">${a.mean.toFixed(2)}</td>
            <td class="text-mono">${a.median.toFixed(2)}</td>
            <td class="text-mono" style="color: var(--text-muted);">${a.min} – ${a.max}</td>
          </tr>
        `).join('');
      } else {
        assayTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No analytical assay records registered for this block.</td></tr>`;
      }
    }

    // Geological Context Tab (External Data Enrichment)
    const geoBox = document.getElementById('drawerGeologyContext');
    if (geoBox && geology.geological_context) {
      const g = geology.geological_context;
      geoBox.innerHTML = `
        <div class="card" style="padding: 14px; border-left: 3px solid var(--accent);">
          <div class="input-label">REGIONAL GEOLOGICAL PROVINCE / CRATON</div>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${window.GeoMine.esc(g.craton_province)}</div>
          <div class="text-secondary" style="font-size: 12px; margin-top: 4px;"><strong>Regional Stratigraphy:</strong> ${window.GeoMine.esc(g.regional_stratigraphy)}</div>
          <div class="text-secondary" style="font-size: 12px; margin-top: 2px;"><strong>Predominant Lithology:</strong> ${window.GeoMine.esc(g.predominant_lithology)}</div>
          <div class="text-secondary" style="font-size: 12px; margin-top: 2px;"><strong>Chronostratigraphic Age:</strong> ${window.GeoMine.esc(g.chronostratigraphic_age)}</div>
          <div class="text-muted text-mono" style="font-size: 10px; margin-top: 8px;">
            Source: ${window.GeoMine.esc(g.source)} (${window.GeoMine.esc(g.retrieval_date)})
          </div>
        </div>
      `;
    }

    // Sources Tab
    const sourcesList = document.getElementById('drawerSourcesList');
    if (sourcesList) {
      if (detail.sources && detail.sources.length) {
        sourcesList.innerHTML = detail.sources.map(src => `
          <div class="card" style="padding: 12px; margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-primary); font-weight: 500;">${window.GeoMine.esc(src)}</div>
            <div class="text-mono text-muted" style="font-size: 10px; margin-top: 4px;">Verbatim Source Exploration Bulletin Reference</div>
          </div>
        `).join('');
      } else {
        sourcesList.innerHTML = `<span class="text-muted" style="font-size: 12px;">Source documentation reference pending transcription.</span>`;
      }
    }

    backdrop.classList.remove('hidden');
  } catch (err) {
    console.error('Error opening site details:', err);
    window.GeoMine.toast('Failed to load site exploration record details', 'error');
  }
}

function closeSiteDrawer() {
  const backdrop = document.getElementById('siteDrawerBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

window.openSiteDrawer = openSiteDrawer;

/* ── Active Filter Tags Update ── */
function updateActiveFilterTags() {
  const container = document.getElementById('activeFilterTags');
  if (!container) return;

  const tags = [];
  if (exploreState.selectedMineral !== 'all') tags.push({ label: `Mineral: ${exploreState.selectedMineral}`, key: 'mineral' });
  if (exploreState.selectedState !== 'all') tags.push({ label: `State: ${exploreState.selectedState}`, key: 'state' });
  if (exploreState.selectedDistrict !== 'all') tags.push({ label: `District: ${exploreState.selectedDistrict}`, key: 'district' });
  if (exploreState.selectedAssay !== 'all') tags.push({ label: `Assay: ${exploreState.selectedAssay === 'yes' ? 'With Assays' : 'No Assays'}`, key: 'assay' });

  container.innerHTML = tags.map(t => `
    <span class="filter-tag">
      <span>${window.GeoMine.esc(t.label)}</span>
      <span class="filter-tag-del" onclick="removeFilter('${t.key}')">✕</span>
    </span>
  `).join('');
}

window.removeFilter = function(key) {
  if (key === 'mineral') {
    exploreState.selectedMineral = 'all';
    document.querySelectorAll('.explore-chip').forEach(c => c.classList.toggle('active', c.dataset.mineral === 'all'));
  } else if (key === 'state') {
    exploreState.selectedState = 'all';
    const sel = document.getElementById('filterState');
    if (sel) sel.value = 'all';
  } else if (key === 'district') {
    exploreState.selectedDistrict = 'all';
    const sel = document.getElementById('filterDistrict');
    if (sel) sel.value = 'all';
  } else if (key === 'assay') {
    exploreState.selectedAssay = 'all';
    const sel = document.getElementById('filterAssay');
    if (sel) sel.value = 'all';
  }
  updateActiveFilterTags();
  fetchAndRenderSites();
};

function resetAllFilters() {
  exploreState.selectedMineral = 'all';
  exploreState.selectedState = 'all';
  exploreState.selectedDistrict = 'all';
  exploreState.selectedAssay = 'all';
  exploreState.searchQuery = '';

  const searchInput = document.getElementById('siteSearch');
  if (searchInput) searchInput.value = '';
  const stateSel = document.getElementById('filterState');
  if (stateSel) stateSel.value = 'all';
  const distSel = document.getElementById('filterDistrict');
  if (distSel) distSel.value = 'all';
  const assaySel = document.getElementById('filterAssay');
  if (assaySel) assaySel.value = 'all';

  document.querySelectorAll('.explore-chip').forEach(c => c.classList.toggle('active', c.dataset.mineral === 'all'));

  updateActiveFilterTags();
  fetchAndRenderSites();
  window.GeoMine.toast('All filters have been reset', 'info');
}
