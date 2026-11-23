/* ═══════════════════════════════════════════════════════════
   GeoMine AI — Analytics Workspace JavaScript (Warm Copper)
   ═══════════════════════════════════════════════════════════ */
'use strict';

const analyticsState = {
  minerals: [],
  selectedMineral: 'Bauxite',
  selectedAnalyte: 'Al2O3',
  charts: {
    mineralOverview: null,
    siteComp: null,
    distribution: null,
    stateDensity: null
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initAnalyticsPage();
});

async function initAnalyticsPage() {
  initAnalyticsControls();
  await loadAnalyticsFilters();
  await renderAllAnalytics();
}

/* ── Filter Controls ── */
function initAnalyticsControls() {
  const mineralSelect = document.getElementById('analyticMineralSelect');
  if (mineralSelect) {
    mineralSelect.addEventListener('change', async (e) => {
      analyticsState.selectedMineral = e.target.value;
      await updateAnalyteOptions();
      await renderAllAnalytics();
    });
  }

  const analyteSelect = document.getElementById('analyticAnalyteSelect');
  if (analyteSelect) {
    analyteSelect.addEventListener('change', async (e) => {
      analyticsState.selectedAnalyte = e.target.value;
      await renderAnalyteSpecificAnalytics();
    });
  }
}

async function loadAnalyticsFilters() {
  try {
    const minerals = await window.GeoMine.getJSON('/api/minerals');
    analyticsState.minerals = minerals;
    const mineralSelect = document.getElementById('analyticMineralSelect');

    if (mineralSelect) {
      mineralSelect.innerHTML = minerals.map(m => `
        <option value="${window.GeoMine.esc(m)}" ${m === analyticsState.selectedMineral ? 'selected' : ''}>
          ${window.GeoMine.esc(m)}
        </option>
      `).join('');
    }

    await updateAnalyteOptions();
  } catch (err) {
    console.error('Error loading analytics filters:', err);
  }
}

async function updateAnalyteOptions() {
  const analyteSelect = document.getElementById('analyticAnalyteSelect');
  if (!analyteSelect) return;

  try {
    const topAnalytes = await window.GeoMine.getJSON(`/api/analytics/top-analytes?mineral=${encodeURIComponent(analyticsState.selectedMineral)}`);

    if (topAnalytes && topAnalytes.length) {
      analyteSelect.innerHTML = topAnalytes.map((a, i) => `
        <option value="${window.GeoMine.esc(a.analyte)}" ${i === 0 ? 'selected' : ''}>
          ${window.GeoMine.esc(a.analyte)} (${a.unit || 'unit'}) — ${a.count} records
        </option>
      `).join('');
      analyticsState.selectedAnalyte = topAnalytes[0].analyte;
    } else {
      analyteSelect.innerHTML = '<option value="">No analytes recorded</option>';
      analyticsState.selectedAnalyte = '';
    }
  } catch (err) {
    console.error('Error updating analyte options:', err);
  }
}

/* ── Render Master Analytics ── */
async function renderAllAnalytics() {
  await Promise.all([
    renderMineralOverviewChart(),
    renderStateSummaryChart(),
    renderAnalyteSpecificAnalytics()
  ]);
}

/* ── Chart 1: Mineral Distribution Overview ── */
async function renderMineralOverviewChart() {
  const canvas = document.getElementById('chartMineralOverview');
  if (!canvas) return;

  try {
    const data = await window.GeoMine.getJSON('/api/analytics/mineral-overview');
    const labels = data.map(d => d.mineral);
    const records = data.map(d => d.record_count);

    if (analyticsState.charts.mineralOverview) {
      analyticsState.charts.mineralOverview.destroy();
    }

    const ctx = canvas.getContext('2d');
    analyticsState.charts.mineralOverview = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Assay Records',
          data: records,
          backgroundColor: '#E98245',
          hoverBackgroundColor: '#FF9557',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => `Unique Sites: ${data[ctx.dataIndex].site_count}`
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 30,
              font: { size: 10 }
            },
            grid: { display: false }
          },
          y: {
            grid: { color: 'rgba(73, 58, 48, 0.4)' },
            ticks: {
              callback: (v) => v >= 1000 ? `${v / 1000}k` : v
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error rendering mineral overview chart:', err);
  }
}

/* ── Chart 2: State Exploration Density ── */
async function renderStateSummaryChart() {
  const canvas = document.getElementById('chartStateSummary');
  if (!canvas) return;

  try {
    const data = await window.GeoMine.getJSON('/api/analytics/state-summary');
    const labels = data.map(d => d.state);
    const records = data.map(d => d.record_count);

    if (analyticsState.charts.stateDensity) {
      analyticsState.charts.stateDensity.destroy();
    }

    const ctx = canvas.getContext('2d');
    analyticsState.charts.stateDensity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Records by State',
          data: records,
          backgroundColor: '#78B89A',
          hoverBackgroundColor: '#9AD2B7',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => `Sites: ${data[ctx.dataIndex].site_count} | Minerals: ${data[ctx.dataIndex].minerals.join(', ')}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(73, 58, 48, 0.4)' },
            ticks: { callback: (v) => v >= 1000 ? `${v / 1000}k` : v }
          },
          y: { grid: { display: false } }
        }
      }
    });
  } catch (err) {
    console.error('Error rendering state summary chart:', err);
  }
}

/* ── Analyte-Specific Analytics: Site Comparison & Distribution ── */
async function renderAnalyteSpecificAnalytics() {
  if (!analyticsState.selectedAnalyte) return;

  await Promise.all([
    renderSiteComparisonChart(),
    renderAnalyteDistributionChart()
  ]);
}

/* ── Chart 3: Site Comparison for Selected Analyte ── */
async function renderSiteComparisonChart() {
  const canvas = document.getElementById('chartSiteComparison');
  if (!canvas) return;

  try {
    const sites = await window.GeoMine.getJSON(`/api/analytics/analyte-comparison?mineral=${encodeURIComponent(analyticsState.selectedMineral)}&analyte=${encodeURIComponent(analyticsState.selectedAnalyte)}`);

    const labels = sites.map(s => s.site_name);
    const means = sites.map(s => s.mean);
    const unit = sites.length ? sites[0].unit : '';

    // Update Card Subtitle
    const sub = document.getElementById('siteCompSub');
    if (sub) {
      sub.textContent = `${analyticsState.selectedAnalyte} (${unit}) across ${sites.length} sites in ${analyticsState.selectedMineral}`;
    }

    if (analyticsState.charts.siteComp) {
      analyticsState.charts.siteComp.destroy();
    }

    const ctx = canvas.getContext('2d');
    analyticsState.charts.siteComp = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `Mean ${analyticsState.selectedAnalyte} (${unit})`,
          data: means,
          backgroundColor: '#FF9557',
          hoverBackgroundColor: '#E98245',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const s = sites[ctx.dataIndex];
                return `Median: ${s.median} | Range: ${s.min} – ${s.max} | Samples: ${s.count}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { maxRotation: 40, minRotation: 20, font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            grid: { color: 'rgba(73, 58, 48, 0.4)' },
            title: {
              display: true,
              text: `${analyticsState.selectedAnalyte} (${unit})`,
              color: '#87786E'
            }
          }
        }
      }
    });

    renderComparisonTable(sites, unit);
    renderDynamicInsights(sites, unit);
  } catch (err) {
    console.error('Error rendering site comparison chart:', err);
  }
}

/* ── Chart 4: Analyte Histogram / Distribution ── */
async function renderAnalyteDistributionChart() {
  const canvas = document.getElementById('chartAnalyteDistribution');
  if (!canvas) return;

  try {
    const dist = await window.GeoMine.getJSON(`/api/analytics/analyte-distribution?mineral=${encodeURIComponent(analyticsState.selectedMineral)}&analyte=${encodeURIComponent(analyticsState.selectedAnalyte)}`);

    if (!dist || !dist.bins || dist.bins.length < 2) {
      return;
    }

    // Format bin labels as intervals e.g. "40.2 – 44.5"
    const binLabels = [];
    for (let i = 0; i < dist.bins.length - 1; i++) {
      binLabels.push(`${dist.bins[i]} – ${dist.bins[i+1]}`);
    }

    if (analyticsState.charts.distribution) {
      analyticsState.charts.distribution.destroy();
    }

    const ctx = canvas.getContext('2d');
    analyticsState.charts.distribution = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Sample Frequency',
          data: dist.counts,
          backgroundColor: '#B96D43',
          hoverBackgroundColor: '#E98245',
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 30, font: { size: 9 } },
            grid: { display: false }
          },
          y: {
            grid: { color: 'rgba(73, 58, 48, 0.4)' },
            title: { display: true, text: 'Frequency (Records)', color: '#87786E' }
          }
        }
      }
    });

    // Update Quick Metric Cards
    if (dist.stats) {
      const s = dist.stats;
      document.getElementById('statTotalRecords').textContent = s.count.toLocaleString();
      document.getElementById('statMeanValue').textContent = `${s.mean} ${dist.unit}`;
      document.getElementById('statMedianValue').textContent = `${s.median} ${dist.unit}`;
      document.getElementById('statStdDev').textContent = `±${s.std} ${dist.unit}`;
    }
  } catch (err) {
    console.error('Error rendering analyte distribution chart:', err);
  }
}

/* ── Comparison Table ── */
function renderComparisonTable(sites, unit) {
  const tbody = document.getElementById('compTableBody');
  if (!tbody) return;

  if (!sites.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No comparison records for this analyte.</td></tr>`;
    return;
  }

  tbody.innerHTML = sites.map(s => `
    <tr>
      <td class="site-name-cell">${window.GeoMine.esc(s.site_name)}</td>
      <td class="text-mono" style="color: var(--accent);">${window.GeoMine.esc(analyticsState.selectedAnalyte)}</td>
      <td class="text-mono text-muted">${window.GeoMine.esc(unit)}</td>
      <td class="text-mono">${s.count.toLocaleString()}</td>
      <td class="grade-cell">${s.mean.toFixed(2)}</td>
      <td class="text-mono">${s.median.toFixed(2)}</td>
      <td class="text-mono text-muted">${s.min.toFixed(2)} – ${s.max.toFixed(2)}</td>
      <td class="text-mono text-muted">±${s.std.toFixed(2)}</td>
    </tr>
  `).join('');
}

/* ── Dynamic Scientific Insights Panel ── */
function renderDynamicInsights(sites, unit) {
  const container = document.getElementById('analyticsInsightsList');
  if (!container) return;

  if (!sites.length) {
    container.innerHTML = `<div class="insight-item">No records available to generate comparative insights.</div>`;
    return;
  }

  const highest = sites[0]; // sorted desc by mean
  const lowest = sites[sites.length - 1];
  const totalSamples = sites.reduce((acc, s) => acc + s.count, 0);

  const insights = [
    `<strong>Grade Disparity:</strong> Across the ${sites.length} exploration blocks in ${analyticsState.selectedMineral}, recorded <em>${analyticsState.selectedAnalyte}</em> concentrations reach a maximum mean of <strong>${highest.mean} ${unit}</strong> at <strong>${window.GeoMine.esc(highest.site_name)}</strong>, compared to a minimum mean of <strong>${lowest.mean} ${unit}</strong> at <strong>${window.GeoMine.esc(lowest.site_name)}</strong>.`,
    `<strong>Sample Coverage:</strong> This cross-sectional evaluation encompasses <strong>${totalSamples.toLocaleString()}</strong> individual assay records, with the largest volume concentrated at <em>${window.GeoMine.esc(sites.reduce((prev, curr) => curr.count > prev.count ? curr : prev).site_name)}</em>.`,
    `<strong>Variance Profile:</strong> Intra-site standard deviations range between <strong>±${Math.min(...sites.map(s=>s.std))} ${unit}</strong> and <strong>±${Math.max(...sites.map(s=>s.std))} ${unit}</strong>, reflecting natural geological heterogeneity within the ore profile.`
  ];

  container.innerHTML = insights.map(i => `
    <div class="insight-item">
      <span class="insight-bullet">▸</span>
      <div>${i}</div>
    </div>
  `).join('');
}
