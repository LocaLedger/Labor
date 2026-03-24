/* ================================
   PURE CSS/HTML CHARTS - TOTALLY OFFLINE
================================= */

function renderOfflineCharts() {
  const view = window.currentChartView || 'pie';

  let data, records, defs;
  try {
    data = loadData();
    records = data.records.filter(r => !r.deleted);
    defs = data.customFields || [];

    // Apply dashboard date filter
    const _df = (typeof dashboardDateFilter !== 'undefined') ? dashboardDateFilter : null;
    if (_df && _df.type !== 'all') {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let startDate, endDate;

      if (_df.type === "month") {
        startDate = new Date(currentYear, currentMonth, 1);
        endDate = new Date(currentYear, currentMonth + 1, 0);
      } else if (_df.type === "ytd") {
        startDate = new Date(currentYear, 0, 1);
        endDate = today;
      } else if (_df.type === "past3months") {
        startDate = new Date(currentYear, currentMonth - 3, 1);
        endDate = today;
      } else if (_df.type === "range" && _df.startDate && _df.endDate) {
        startDate = new Date(_df.startDate);
        endDate = new Date(_df.endDate);
      }

      if (startDate && endDate) {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        records = records.filter(r => r.date >= startStr && r.date <= endStr);
      }
    }

    // Apply custom field filters
    if (typeof applyCustomFilters === 'function' && typeof dashboardFilters !== 'undefined') {
      records = applyCustomFilters(records, defs, dashboardFilters);
    }
  } catch(e) {
    console.error('Error loading data:', e);
    showEmptyChartState();
    return;
  }

  if (!records || records.length === 0) {
    showEmptyChartState();
    return;
  }

  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

  function normalizeHexColor(hex) {
    if (!hex) return null;
    const s = String(hex).trim();
    if (!s || s === "none") return null;
    const withHash = s.startsWith("#") ? s : `#${s}`;
    const m = withHash.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m) return null;
    let h = m[0].toLowerCase();
    if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    return h;
  }

  function getLocationColor(label, index) {
    const hex = normalizeHexColor(data?.locations?.[label]?.preferredColor);
    return hex || colors[index % colors.length];
  }

  // --- All container IDs ---
  const allContainers = ['locationPieChart', 'tipsVsHourlyChart', 'dailyIncomeChart', 'hoursByLocationChart', 'customChartDisplay'];
  allContainers.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  });

  let containerId;
  let html = '';

  // ── PIE (by location income) ──────────────────────────────────────────────
  if (view === 'pie') {
    containerId = 'locationPieChart';
    const locationData = {};
    records.forEach(r => {
      const total = calculateRecordTotal(r, defs);
      if (total > 0) locationData[r.location] = (locationData[r.location] || 0) + total;
    });
    const sorted = Object.entries(locationData).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    html = `<div class="text-center text-2xl font-bold mb-4">$${total.toFixed(0)}</div>`;
    sorted.forEach(([label, value], i) => {
      const pct = ((value / total) * 100).toFixed(0);
      const barWidth = (value / total) * 100;
      html += `
        <div class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-300">${label}</span>
            <span class="text-gray-400">$${value.toFixed(0)} (${pct}%)</span>
          </div>
          <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width:${barWidth}%;background:${getLocationColor(label, i)}"></div>
          </div>
        </div>`;
    });
  }

  // ── BAR (tips vs hourly) ──────────────────────────────────────────────────
  else if (view === 'bar') {
    containerId = 'tipsVsHourlyChart';
    const hourlyTotal = records.reduce((s, r) => s + calculateBasePay(r), 0);
    const tipsTotal = records.reduce((s, r) => s + (parseFloat(r.tips) || 0), 0);
    const max = Math.max(hourlyTotal, tipsTotal) || 1;
    html = `
      <div class="mb-4">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-300">Hourly Earnings</span>
          <span class="text-gray-400">$${hourlyTotal.toFixed(0)}</span>
        </div>
        <div class="h-6 bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 rounded-full" style="width:${(hourlyTotal/max)*100}%"></div>
        </div>
      </div>
      <div class="mb-4">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-300">Tips</span>
          <span class="text-gray-400">$${tipsTotal.toFixed(0)}</span>
        </div>
        <div class="h-6 bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full bg-green-500 rounded-full" style="width:${(tipsTotal/max)*100}%"></div>
        </div>
      </div>`;
  }

  // ── LINE (over time — smart grouping) ────────────────────────────────────
  else if (view === 'line') {
    containerId = 'dailyIncomeChart';
    const dates = records.map(r => r.date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const daySpan = minDate && maxDate
      ? Math.round((new Date(maxDate) - new Date(minDate)) / 86400000)
      : 0;

    // Decide grouping granularity
    let bucketFn, sortKeys, labelFn;

    if (daySpan <= 14) {
      // By day
      bucketFn = r => r.date;
      sortKeys = keys => keys.slice().sort();
      labelFn = k => {
        const d = new Date(k + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
    } else if (daySpan <= 90) {
      // By week (ISO week — Monday-anchored)
      bucketFn = r => {
        const d = new Date(r.date + 'T00:00:00');
        const day = d.getDay() || 7;
        const mon = new Date(d); mon.setDate(d.getDate() - (day - 1));
        return mon.toISOString().split('T')[0];
      };
      sortKeys = keys => [...new Set(keys)].sort();
      labelFn = k => {
        const d = new Date(k + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
    } else {
      // By month
      bucketFn = r => r.date ? r.date.slice(0, 7) : null;
      sortKeys = keys => [...new Set(keys)].sort();
      labelFn = k => {
        const [y, m] = k.split('-');
        return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      };
    }

    const buckets = {};
    records.forEach(r => {
      if (!r.date) return;
      const key = bucketFn(r);
      if (!key) return;
      const total = calculateRecordTotal(r, defs);
      if (total > 0) buckets[key] = (buckets[key] || 0) + total;
    });

    const keys = sortKeys(Object.keys(buckets)).slice(-12);
    if (keys.length === 0) { showEmptyChartState(); return; }

    const maxVal = Math.max(...keys.map(k => buckets[k]));
    const BAR_HEIGHT = 100; // px, fixed canvas height

    html = `<div style="display:flex;align-items:flex-end;gap:4px;height:${BAR_HEIGHT}px;padding-bottom:0">`;
    keys.forEach(k => {
      const val = buckets[k];
      const h = Math.round((val / maxVal) * BAR_HEIGHT);
      const lbl = labelFn(k);
      html += `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0">
          <div title="$${val.toFixed(0)}" style="width:100%;height:${h}px;background:#6366f1;border-radius:3px 3px 0 0"></div>
        </div>`;
    });
    html += `</div>`;
    html += `<div style="display:flex;gap:4px;margin-top:4px">`;
    keys.forEach(k => {
      html += `<div style="flex:1;text-align:center;font-size:10px;color:#6b7280;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${labelFn(k)}</div>`;
    });
    html += `</div>`;
  }

  // ── HOURS (by location) ───────────────────────────────────────────────────
  else if (view === 'hours') {
    containerId = 'hoursByLocationChart';
    const locationHours = {};
    records.forEach(r => {
      const hours = parseFloat(r.hours) || 0;
      if (hours > 0) locationHours[r.location] = (locationHours[r.location] || 0) + hours;
    });
    const sorted = Object.entries(locationHours).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(...sorted.map(([, v]) => v)) || 1;
    sorted.forEach(([label, value], i) => {
      html += `
        <div class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-300">${label}</span>
            <span class="text-gray-400">${value.toFixed(1)} hrs</span>
          </div>
          <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width:${(value/max)*100}%;background:${getLocationColor(label, i)}"></div>
          </div>
        </div>`;
    });
  }

  // ── CUSTOM CHARTS ─────────────────────────────────────────────────────────
  else if (view.startsWith('custom_')) {
    containerId = 'customChartDisplay';
    const chartId = view.slice(7);
    const charts = loadCustomCharts();
    const cfg = charts.find(c => c.id === chartId);
    if (!cfg) { showEmptyChartState(); return; }
    html = renderCustomChartHTML(records, defs, cfg, colors, data);
  }

  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = 'block';
    container.innerHTML = html;
  }
}

// ── Custom chart renderer ──────────────────────────────────────────────────
function renderCustomChartHTML(records, defs, cfg, colors, data) {
  const { metric, groupBy, label: chartLabel, metricLabel } = cfg;

  function getMetricValue(r) {
    if (metric === 'total')     return calculateRecordTotal(r, defs);
    if (metric === 'tips')      return parseFloat(r.tips) || 0;
    if (metric === 'base')      return calculateBasePay(r);
    if (metric === 'hours')     return parseFloat(r.hours) || 0;
    if (metric === 'count')     return 1;
    if (metric === 'avg_shift') return calculateRecordTotal(r, defs);
    if (metric === 'avg_hour')  return calculateRecordTotal(r, defs);
    return 0;
  }

  function getGroupKey(r) {
    if (groupBy === 'location') return r.location || '(none)';
    if (groupBy === 'month') {
      if (!r.date) return '(unknown)';
      const [y, m] = r.date.split('-');
      return `${y}-${m}`;
    }
    if (groupBy === 'week') {
      if (!r.date) return '(unknown)';
      const d = new Date(r.date + 'T00:00:00');
      const day = d.getDay() || 7;
      const mon = new Date(d); mon.setDate(d.getDate() - (day - 1));
      return mon.toISOString().split('T')[0];
    }
    if (groupBy === 'dayofweek') {
      if (!r.date) return '(unknown)';
      const d = new Date(r.date + 'T00:00:00');
      return String(d.getDay()); // 0=Sun
    }
    if (groupBy.startsWith('custom_')) {
      const fieldKey = groupBy.slice(7);
      return r.customFields?.[fieldKey] ?? r[fieldKey] ?? '(none)';
    }
    return '(other)';
  }

  function formatGroupLabel(key) {
    if (groupBy === 'month') {
      const [y, m] = key.split('-');
      return new Date(+y, +m-1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    if (groupBy === 'week') {
      const d = new Date(key + 'T00:00:00');
      return 'Wk ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (groupBy === 'dayofweek') {
      return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][+key] || key;
    }
    return String(key);
  }

  // Accumulate
  const buckets = {};
  const counts  = {};
  const hours   = {};
  records.forEach(r => {
    const k = getGroupKey(r);
    buckets[k] = (buckets[k] || 0) + getMetricValue(r);
    counts[k]  = (counts[k]  || 0) + 1;
    hours[k]   = (hours[k]   || 0) + (parseFloat(r.hours) || 0);
  });

  // Sort
  let keys;
  if (groupBy === 'month' || groupBy === 'week')  keys = Object.keys(buckets).sort();
  else if (groupBy === 'dayofweek')               keys = ['0','1','2','3','4','5','6'].filter(k => k in buckets);
  else                                            keys = Object.entries(buckets).sort((a,b) => b[1]-a[1]).map(([k]) => k);
  keys = keys.slice(0, 8);

  // Compute final display values
  const displayVals = keys.map(k => {
    if (metric === 'avg_shift') return buckets[k] / (counts[k] || 1);
    if (metric === 'avg_hour')  return buckets[k] / (hours[k]  || 1);
    return buckets[k];
  });

  const max = Math.max(...displayVals) || 1;
  const isMoney  = ['total','tips','base','avg_shift','avg_hour'].includes(metric);
  const isCount  = metric === 'count';
  const isHours  = metric === 'hours';

  function fmt(v) {
    if (isMoney)  return '$' + v.toFixed(0);
    if (isHours)  return v.toFixed(1) + ' h';
    return String(Math.round(v));
  }

  let html = `<div class="text-xs text-gray-500 mb-3">${chartLabel} · ${metricLabel} by ${groupBy}</div>`;
  keys.forEach((k, i) => {
    const val = displayVals[i];
    html += `
      <div class="mb-3">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-300">${formatGroupLabel(k)}</span>
          <span class="text-gray-400">${fmt(val)}</span>
        </div>
        <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${(val/max)*100}%;background:${colors[i % colors.length]}"></div>
        </div>
      </div>`;
  });

  if (keys.length === 0) html += '<div class="text-center text-gray-500 py-4">No data</div>';
  return html;
}

function showEmptyChartState() {
  ['locationPieChart', 'tipsVsHourlyChart', 'dailyIncomeChart', 'hoursByLocationChart', 'customChartDisplay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const container = document.getElementById('locationPieChart');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = '<div class="text-center text-gray-500 py-8">No data for this period</div>';
  }
}

// Override renderAllCharts
window.renderAllCharts = function() { renderOfflineCharts(); };

// Override switchChartView to use offline charts
window.switchChartView = function(view) {
  window.currentChartView = view;
  document.querySelectorAll('.chart-tab').forEach(btn => {
    const isActive = btn.dataset.view === view;
    if (isActive) {
      btn.classList.remove('bg-gray-700', 'text-gray-300');
      btn.classList.add('bg-indigo-600', 'text-white');
    } else {
      btn.classList.remove('bg-indigo-600', 'text-white');
      btn.classList.add('bg-gray-700', 'text-gray-300');
    }
    // Custom chart tabs use violet styling, reset to their base when inactive
    if (btn.dataset.custom) {
      if (isActive) {
        btn.style.background = 'linear-gradient(135deg,#7c3aed,#6366f1)';
        btn.style.color = '#fff';
        btn.classList.remove('bg-gray-700', 'text-gray-300', 'bg-indigo-600');
      } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('bg-gray-700', 'text-gray-300');
      }
    }
  });
  renderOfflineCharts();
};

/* Chart Controls UI */
window.renderChartControls = function() {
  const currentView = window.currentChartView || 'pie';
  const customCharts = (typeof loadCustomCharts === 'function') ? loadCustomCharts() : [];
  const canAdd = customCharts.length < 2;

  function defaultTab(view, label) {
    const active = currentView === view;
    return `<button onclick="switchChartView('${view}')" class="chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded ${active ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}" data-view="${view}">${label}</button>`;
  }

  function customTab(cfg) {
    const view = 'custom_' + cfg.id;
    const active = currentView === view;
    const base = active
      ? 'chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded text-white font-medium'
      : 'chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300';
    const style = active ? 'background:linear-gradient(135deg,#7c3aed,#6366f1)' : '';
    return `<button onclick="switchChartView('${view}')" class="${base}" data-view="${view}" data-custom="1" style="${style}" title="Long-press to edit" ondblclick="showAddCustomChartSheet('${cfg.id}')">${cfg.label}</button>`;
  }

  return `
    <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
      ${canAdd ? `<button onclick="showAddCustomChartSheet()" class="chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded border border-dashed border-violet-500 text-violet-400" data-view="">+</button>` : ''}
      ${customCharts.map(customTab).join('')}
      ${defaultTab('pie',   'By Location')}
      ${defaultTab('bar',   'Tips vs Hourly')}
      ${defaultTab('line',  'Over Time')}
      ${defaultTab('hours', 'Hours')}
    </div>
  `;
};
