/* ═══════════════════════════════════════════════════════════
   GeoMine AI — Dashboard (Product Homepage) JavaScript
   ═══════════════════════════════════════════════════════════ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initStrataInteractive();
  initHowItWorksStepper();
  loadExternalSources();
  initSmoothScroll();
});

/* ── Geological Strata Interactive Explorer ── */
function initStrataInteractive() {
  const layers = document.querySelectorAll('.strata-layer');
  const calloutText = document.getElementById('strataCalloutText');
  if (!layers.length || !calloutText) return;

  const strataData = {
    'l1': {
      title: 'Lateritic Duricrust & Ironstone Capping',
      desc: 'Top weathering horizon containing indurated ferruginous pebbles, pisolitic laterite, and hydrated iron oxides. Thickness ranges between 0.5m – 4.2m in peninsular plateau profiles.'
    },
    'l2': {
      title: 'Bauxitic Profile & Aluminous Horizon',
      desc: 'Enriched gibbsite-boehmite core zone with elevated Al2O3 concentrations and depleted reactive silica. Typical target zone for commercial aluminum extraction.'
    },
    'l3': {
      title: 'Lithomargic Clay & Saprolitic Transition',
      desc: 'Transition interval dominated by kaolinite and altered silicate minerals. Marks the boundary between weathering mantle and semi-decomposed parent bedrock.'
    },
    'l4': {
      title: 'Precambrian Crystalline / Bedrock Host',
      desc: 'Unweathered Archean-Proterozoic crystalline basement (gneiss, schist, granulite, or limestone). Supplies foundational geochemical baseline data.'
    }
  };

  layers.forEach(layer => {
    layer.addEventListener('click', () => {
      layers.forEach(l => l.classList.remove('active'));
      layer.classList.add('active');
      const key = layer.dataset.strata;
      if (strataData[key]) {
        calloutText.innerHTML = `<strong>${strataData[key].title}:</strong> ${strataData[key].desc}`;
      }
    });
  });
}

/* ── "How It Works" Stepper ── */
function initHowItWorksStepper() {
  const stepBtns = document.querySelectorAll('.hiw-step-btn');
  const stagePreview = document.getElementById('hiwStagePreview');
  if (!stepBtns.length || !stagePreview) return;

  const stages = [
    {
      tag: 'STEP 01 / DISCOVERY',
      title: 'Geospatial Site Discovery & Multi-Mineral Indexing',
      body: 'Filter and inspect 18 verified exploration site groups across India. Search by mineral category (Bauxite, Limestone, Iron Ore, Base Metals, Molybdenite, Manganese, Tungsten-Tin) or administrative jurisdiction without manual PDF review.',
      highlights: [
        'Coordinate-backed site group boundaries',
        'State & district location verification',
        'Multi-view display: Cards, Map, or Split View',
        'Assay availability indicators'
      ],
      linkText: 'Open Explore Sites →',
      linkHref: '/explore'
    },
    {
      tag: 'STEP 02 / INSPECTION',
      title: 'Source-Traceable Assay Inspection & Quality Audits',
      body: 'Inspect individual assay records with strict data hygiene. Distinguish between multi-analyte rows belonging to a single sample versus independent drill cores, backed by verbatim government and exploration bulletins.',
      highlights: [
        'Audit status and transcription verification',
        'Specific analyte concentration units (%, mg/kg, ppm)',
        'Sample media identification (borehole, bedrock, core)',
        'Verbatim exploration bulletin source references'
      ],
      linkText: 'Inspect Exploration Records →',
      linkHref: '/explore'
    },
    {
      tag: 'STEP 03 / COMPARISON',
      title: 'Multi-Site & Analyte Comparative Analytics',
      body: 'Conduct rigorous cross-sectional comparisons between geological blocks. Contrast grades of major oxides (Al2O3, Fe2O3, CaO, SiO2) and trace pathfinder elements across different geological provinces with instant distribution charts.',
      highlights: [
        'Analyte concentration comparative bar charts',
        'Frequency distribution histograms & percentiles',
        'Side-by-side site assay comparison tables',
        'Cross-sectional regional variance insights'
      ],
      linkText: 'Launch Analytics Workspace →',
      linkHref: '/analytics'
    },
    {
      tag: 'STEP 04 / REPORTING',
      title: 'Custom Technical Reporting & Clean Data Export',
      body: 'Generate customizable, publication-grade mineral exploration reports. Choose target sites, filter specific analytes, configure custom sections, inspect live previews, and export directly to clean CSV or formatted PDF printout.',
      highlights: [
        'User-selected report type and focus minerals',
        'Dynamic executive overview and assay tables',
        'Honest caveats, missing value notes & disclaimers',
        'One-click CSV dataset & PDF report exports'
      ],
      linkText: 'Configure Custom Report →',
      linkHref: '/reports'
    }
  ];

  function renderStage(idx) {
    const s = stages[idx];
    if (!s) return;
    stagePreview.innerHTML = `
      <div class="hiw-stage-header">
        <span class="hiw-stage-tag">${s.tag}</span>
      </div>
      <h3 class="hiw-stage-title">${s.title}</h3>
      <p class="hiw-stage-body">${s.body}</p>
      <div class="hiw-stage-highlights">
        ${s.highlights.map(h => `
          <div class="hiw-highlight-item">
            <svg class="hiw-highlight-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${h}</span>
          </div>
        `).join('')}
      </div>
      <div>
        <a href="${s.linkHref}" class="btn btn-primary btn-sm">
          ${s.linkText}
        </a>
      </div>
    `;
  }

  stepBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      stepBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStage(idx);
    });
  });

  // Initial render
  renderStage(0);
}

/* ── Load External Sources List from Backend API ── */
async function loadExternalSources() {
  const container = document.getElementById('externalSourcesList');
  if (!container) return;

  try {
    const sources = await window.GeoMine.getJSON('/api/external/sources');
    if (!sources || !sources.length) return;

    container.innerHTML = sources.map((src, idx) => {
      const isOnline = src.status.toLowerCase().includes('active') || src.status.toLowerCase().includes('connected');
      const badgeCls = isOnline ? 'status-active' : 'status-ref';
      const typeBadge = src.type ? `<span class="external-source-type">${window.GeoMine.esc(src.type)}</span>` : '';
      return `
        <div class="external-source-card ext-card-animate" style="animation-delay: ${idx * 0.08}s;">
          <div class="external-source-header">
            <div class="external-source-title-group">
              <span class="external-source-name">${window.GeoMine.esc(src.name)}</span>
              ${typeBadge}
            </div>
            <span class="external-source-status ${badgeCls}">${src.status}</span>
          </div>
          <span class="external-source-auth">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px; margin-right: 4px; opacity: 0.7;">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            ${window.GeoMine.esc(src.authority)}
          </span>
          <p class="external-source-desc">${window.GeoMine.esc(src.coverage)}</p>
          <div class="external-source-footer">
            <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="external-source-link">
              <span>Official Portal</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('External sources fallback active:', err);
  }
}

/* ── Smooth Scroll for in-page anchors ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}
