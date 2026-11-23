/* ═══════════════════════════════════════════════════════════
   GeoMine AI — Reports Workspace JavaScript (Warm Copper)
   ═══════════════════════════════════════════════════════════ */
'use strict';

const reportState = {
  title: 'GeoMineAI Mineral Exploration Intelligence Dossier',
  reportType: 'mineral_comp',
  selectedMineral: 'Bauxite',
  selectedSites: [],
  selectedAnalytes: [],
  sections: ['overview', 'sites', 'assays', 'comparison', 'sources', 'disclaimer'],
  userNotes: 'Preliminary technical reconnaissance dossier generated for exploration evaluation and comparative grade assessment.',
  allSites: []
};

document.addEventListener('DOMContentLoaded', () => {
  initReportsWorkspace();
});

async function initReportsWorkspace() {
  initReportFormEvents();
  await loadReportFilters();
  await triggerReportPreview();
}

/* ── Form Event Handlers ── */
function initReportFormEvents() {
  const titleInput = document.getElementById('reportTitleInput');
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      reportState.title = e.target.value.trim() || 'Untitled Exploration Report';
      document.getElementById('previewDocTitle').textContent = reportState.title;
    });
  }

  const typeSelect = document.getElementById('reportTypeSelect');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      reportState.reportType = e.target.value;
      triggerReportPreview();
    });
  }

  const mineralSelect = document.getElementById('reportMineralSelect');
  if (mineralSelect) {
    mineralSelect.addEventListener('change', async (e) => {
      reportState.selectedMineral = e.target.value;
      await updateSitesCheckboxList();
      await triggerReportPreview();
    });
  }

  const notesTextarea = document.getElementById('reportNotesInput');
  if (notesTextarea) {
    notesTextarea.addEventListener('input', (e) => {
      reportState.userNotes = e.target.value.trim();
      const notesBox = document.getElementById('previewNotesText');
      if (notesBox) {
        notesBox.textContent = reportState.userNotes || 'No custom methodology notes attached.';
      }
    });
  }

  // Section toggle checkboxes
  document.querySelectorAll('.section-toggle-card input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const section = chk.dataset.section;
      const card = chk.closest('.section-toggle-card');
      if (chk.checked) {
        if (!reportState.sections.includes(section)) reportState.sections.push(section);
        if (card) card.classList.add('checked');
      } else {
        reportState.sections = reportState.sections.filter(s => s !== section);
        if (card) card.classList.remove('checked');
      }
      togglePreviewSections();
    });
  });

  // Action Buttons
  const refreshBtn = document.getElementById('refreshPreviewBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      triggerReportPreview();
      window.GeoMine.toast('Report preview updated', 'info');
    });
  }

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportReportCsv);
  }

  const printPdfBtn = document.getElementById('printPdfBtn');
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

/* ── Load Filters & Initial Data ── */
async function loadReportFilters() {
  try {
    const [minerals, filterOpts] = await Promise.all([
      window.GeoMine.getJSON('/api/minerals'),
      window.GeoMine.getJSON('/api/filter-options')
    ]);

    const mineralSel = document.getElementById('reportMineralSelect');
    if (mineralSel) {
      mineralSel.innerHTML = `
        <option value="all">All Mineral Categories</option>
        ${minerals.map(m => `<option value="${window.GeoMine.esc(m)}" ${m === reportState.selectedMineral ? 'selected' : ''}>${window.GeoMine.esc(m)}</option>`).join('')}
      `;
    }

    reportState.allSites = filterOpts.sites;
    await updateSitesCheckboxList();
  } catch (err) {
    console.error('Error loading report filters:', err);
  }
}

/* ── Update Sites Checkbox List for Active Mineral ── */
async function updateSitesCheckboxList() {
  const container = document.getElementById('reportSitesList');
  if (!container) return;

  try {
    const sites = await window.GeoMine.getJSON(`/api/sites?mineral=${encodeURIComponent(reportState.selectedMineral)}`);
    reportState.selectedSites = sites.map(s => s.site_id);

    container.innerHTML = sites.map(s => `
      <label class="custom-checkbox-item">
        <input type="checkbox" value="${window.GeoMine.esc(s.site_id)}" checked class="site-checkbox">
        <span>${window.GeoMine.esc(s.site_name)} (${s.record_count.toLocaleString()} rows)</span>
      </label>
    `).join('');

    container.querySelectorAll('.site-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        reportState.selectedSites = Array.from(container.querySelectorAll('.site-checkbox:checked')).map(c => c.value);
        triggerReportPreview();
      });
    });
  } catch (err) {
    console.error('Error updating site checkboxes:', err);
  }
}

/* ── Generate & Trigger Live Report Preview ── */
async function triggerReportPreview() {
  const payload = {
    title: reportState.title,
    report_type: reportState.reportType,
    mineral: reportState.selectedMineral,
    site_ids: reportState.selectedSites,
    analytes: reportState.selectedAnalytes,
    sections: reportState.sections
  };

  try {
    const report = await window.GeoMine.postJSON('/api/report/generate', payload);
    renderReportPreview(report);
  } catch (err) {
    console.error('Error generating report preview:', err);
  }
}

/* ── Render Report Document ── */
function renderReportPreview(report) {
  // Title & Metadata
  document.getElementById('previewDocTitle').textContent = report.title;
  document.getElementById('previewDocMeta').innerHTML = `
    Generated: ${new Date(report.generated_at).toLocaleString('en-IN')}<br>
    Primary Dataset: ${report.data_source}<br>
    Report Scope: ${report.config.mineral === 'all' ? 'Multi-Mineral Portfolio' : report.config.mineral} (${report.config.site_ids.length} Selected Blocks)
  `;

  // Section 1: Executive Overview
  if (report.sections.overview) {
    const ov = report.sections.overview;
    document.getElementById('previewTotalRecords').textContent = ov.total_records.toLocaleString();
    document.getElementById('previewTotalSites').textContent = ov.total_sites.toLocaleString();
    document.getElementById('previewTotalMinerals').textContent = ov.minerals.length;
    document.getElementById('previewTotalStates').textContent = ov.states.length;
  }

  // Section 2: Sites Profile Table
  if (report.sections.sites) {
    const tbody = document.getElementById('previewSitesTableBody');
    if (tbody) {
      tbody.innerHTML = report.sections.sites.map(s => `
        <tr>
          <td style="font-weight: 600;">${window.GeoMine.esc(s.site_name)}</td>
          <td class="text-mono">${window.GeoMine.esc(s.site_id)}</td>
          <td>${window.GeoMine.esc(s.state || '')}</td>
          <td>${window.GeoMine.esc(s.district || '')}</td>
          <td class="text-mono">${s.record_count.toLocaleString()}</td>
          <td class="text-mono text-muted">${s.latitude.toFixed(4)}°N, ${s.longitude.toFixed(4)}°E</td>
        </tr>
      `).join('');
    }
  }

  // Section 3: Assay Statistics Table
  if (report.sections.assays) {
    const tbody = document.getElementById('previewAssayTableBody');
    if (tbody) {
      tbody.innerHTML = report.sections.assays.map(a => `
        <tr>
          <td style="font-weight: 600; color: var(--accent);">${window.GeoMine.esc(a.analyte)}</td>
          <td class="text-mono text-muted">${window.GeoMine.esc(a.unit)}</td>
          <td class="text-mono">${a.record_count.toLocaleString()}</td>
          <td class="text-mono" style="font-weight: 600;">${a.mean.toFixed(2)}</td>
          <td class="text-mono">${a.median.toFixed(2)}</td>
          <td class="text-mono text-muted">${a.min.toFixed(2)} – ${a.max.toFixed(2)}</td>
          <td class="text-mono text-muted">±${a.std.toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  // Section 4: Multi-Site Comparison Matrix
  const compSec = document.getElementById('previewComparisonSection');
  if (compSec) {
    if (report.sections.comparison && Object.keys(report.sections.comparison).length >= 2) {
      compSec.style.display = 'flex';
      const c = report.sections.comparison;
      const siteNames = Object.values(c).map(v => v.name);
      // Collect all common analytes
      const allAnalytes = new Set();
      Object.values(c).forEach(v => {
        Object.keys(v.analytes).forEach(a => allAnalytes.add(a));
      });

      const tableHead = document.getElementById('previewCompTableHead');
      const tableBody = document.getElementById('previewCompTableBody');

      if (tableHead && tableBody) {
        tableHead.innerHTML = `
          <tr>
            <th>Analyte</th>
            ${siteNames.map(name => `<th>${window.GeoMine.esc(name)}</th>`).join('')}
          </tr>
        `;

        tableBody.innerHTML = Array.from(allAnalytes).slice(0, 15).map(analyte => {
          const cells = Object.values(c).map(v => {
            const val = v.analytes[analyte];
            return val ? `<td class="text-mono">${val.mean} <span style="font-size: 10px; color: var(--text-muted);">${val.unit}</span></td>` : `<td style="color: var(--text-muted);">—</td>`;
          });
          return `
            <tr>
              <td style="font-weight: 600; color: var(--sand);">${window.GeoMine.esc(analyte)}</td>
              ${cells.join('')}
            </tr>
          `;
        }).join('');
      }
    } else {
      compSec.style.display = 'none';
    }
  }

  // User Notes
  const notesText = document.getElementById('previewNotesText');
  if (notesText) {
    notesText.textContent = reportState.userNotes || 'No custom methodology notes attached.';
  }

  togglePreviewSections();
}

/* ── Toggle Visibility of Preview Sections ── */
function togglePreviewSections() {
  const mapping = {
    overview: 'previewOverviewSection',
    sites: 'previewSitesSection',
    assays: 'previewAssaySection',
    comparison: 'previewComparisonSection',
    sources: 'previewSourcesSection',
    disclaimer: 'previewDisclaimerSection'
  };

  for (const [sec, elemId] of Object.entries(mapping)) {
    const el = document.getElementById(elemId);
    if (el) {
      el.style.display = reportState.sections.includes(sec) ? 'flex' : 'none';
    }
  }
}

/* ── Export CSV Functionality ── */
async function exportReportCsv() {
  const payload = {
    mineral: reportState.selectedMineral,
    site_ids: reportState.selectedSites,
    analytes: reportState.selectedAnalytes
  };

  try {
    const res = await window.GeoMine.postJSON('/api/report/export-csv', payload);
    if (!res || !res.records || !res.records.length) {
      window.GeoMine.toast('No records available to export for selected criteria', 'warning');
      return;
    }

    const columns = res.columns;
    let csvContent = columns.join(',') + '\n';

    res.records.forEach(row => {
      const line = columns.map(col => {
        let val = row[col] ?? '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',');
      csvContent += line + '\n';
    });

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GeoMineAI_${reportState.selectedMineral}_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.GeoMine.toast(`Exported ${res.records.length.toLocaleString()} records to CSV`, 'success');
  } catch (err) {
    console.error('CSV Export Error:', err);
    window.GeoMine.toast('Failed to generate CSV export', 'error');
  }
}
