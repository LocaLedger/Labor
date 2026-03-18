/* ================================
   PURE CSS/HTML CHARTS - TOTALLY OFFLINE
================================= */

function renderOfflineCharts() {
  const view = window.currentChartView || 'pie';
  
  // Get records using the main app's loadData function
  try {
    var data = loadData();
    var records = data.records.filter(r => !r.deleted);
    var defs = data.customFields || [];
    
    // Apply date filter (same logic as getFilteredRecords in index.html)
    if (typeof dateFilter !== 'undefined') {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      
      let startDate, endDate;
      
      if (dateFilter.type === "all") {
        // No filtering - use all records
        startDate = null;
        endDate = null;
      } else if (dateFilter.type === "month") {
        startDate = new Date(currentYear, currentMonth, 1);
        endDate = new Date(currentYear, currentMonth + 1, 0);
      } else if (dateFilter.type === "ytd") {
        startDate = new Date(currentYear, 0, 1);
        endDate = today;
      } else if (dateFilter.type === "past3months") {
        startDate = new Date(currentYear, currentMonth - 3, 1);
        endDate = today;
      } else if (dateFilter.type === "range" && dateFilter.startDate && dateFilter.endDate) {
        startDate = new Date(dateFilter.startDate);
        endDate = new Date(dateFilter.endDate);
      } else {
        startDate = new Date(currentYear, currentMonth, 1);
        endDate = new Date(currentYear, currentMonth + 1, 0);
      }
      
      // Only filter if we have date bounds
      if (startDate && endDate) {
        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];
        records = records.filter(r => r.date >= startStr && r.date <= endStr);
      }
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
    if (h.length === 4) {
      h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    }
    return h;
  }

  function getPreferredLocationColor(label) {
    const hex = normalizeHexColor(data?.locations?.[label]?.preferredColor);
    return hex || null;
  }

  function getLocationColor(label, index) {
    return getPreferredLocationColor(label) || colors[index % colors.length];
  }
  
  let html = '';
  
  if (view === 'pie') {
    // Income by location
    const locationData = {};
    records.forEach(r => {
      const total = calculateRecordTotal(r, defs);
      if (total > 0) {
        locationData[r.location] = (locationData[r.location] || 0) + total;
      }
    });
    
    const sorted = Object.entries(locationData).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    
    html = `<div class="text-center text-2xl font-bold mb-4">$${total.toFixed(0)}</div>`;
    
    sorted.forEach(([label, value], i) => {
      const pct = ((value / total) * 100).toFixed(0);
      const barWidth = (value / total) * 100;
      const color = getLocationColor(label, i);
      html += `
        <div class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-300">${label}</span>
            <span class="text-gray-400">$${value.toFixed(0)} (${pct}%)</span>
          </div>
          <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width: ${barWidth}%; background: ${color}"></div>
          </div>
        </div>
      `;
    });
  }
  
  else if (view === 'bar') {
    // Tips vs Hourly
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
          <div class="h-full bg-indigo-500 rounded-full" style="width: ${(hourlyTotal / max) * 100}%"></div>
        </div>
      </div>
      <div class="mb-4">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-300">Tips</span>
          <span class="text-gray-400">$${tipsTotal.toFixed(0)}</span>
        </div>
        <div class="h-6 bg-gray-700 rounded-full overflow-hidden">
          <div class="h-full bg-green-500 rounded-full" style="width: ${(tipsTotal / max) * 100}%"></div>
        </div>
      </div>
    `;
  }
  
  else if (view === 'line') {
    // Daily chart - last 7 days as bar
    const dailyData = {};
    records.forEach(r => {
      const total = calculateRecordTotal(r, defs);
      if (total > 0 && r.date) {
        dailyData[r.date] = (dailyData[r.date] || 0) + total;
      }
    });
    
    const sortedDates = Object.keys(dailyData).sort().slice(-7);
    const max = Math.max(...sortedDates.map(d => dailyData[d])) || 1;
    
    html = '<div class="flex items-end justify-between gap-1 h-32">';
    sortedDates.forEach(date => {
      const value = dailyData[date];
      const height = (value / max) * 100;
      const d = new Date(date);
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      html += `
        <div class="flex-1 flex flex-col items-center">
          <div class="w-full bg-indigo-500 rounded-t" style="height: ${height}%"></div>
          <div class="text-xs text-gray-500 mt-1">${day}</div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  else if (view === 'hours') {
    // Hours by location
    const locationHours = {};
    records.forEach(r => {
      const hours = parseFloat(r.hours) || 0;
      if (hours > 0) {
        locationHours[r.location] = (locationHours[r.location] || 0) + hours;
      }
    });
    
    const sorted = Object.entries(locationHours).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(...sorted.map(([, v]) => v)) || 1;
    
    sorted.forEach(([label, value], i) => {
      const barWidth = (value / max) * 100;
      const color = getLocationColor(label, i);
      html += `
        <div class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-300">${label}</span>
            <span class="text-gray-400">${value.toFixed(1)} hrs</span>
          </div>
          <div class="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width: ${barWidth}%; background: ${color}"></div>
          </div>
        </div>
      `;
    });
  }
  
  // Hide all chart divs, show container
  ['locationPieChart', 'tipsVsHourlyChart', 'dailyIncomeChart', 'hoursByLocationChart'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  });
  
  let containerId;
  if (view === 'pie') containerId = 'locationPieChart';
  else if (view === 'bar') containerId = 'tipsVsHourlyChart';
  else if (view === 'line') containerId = 'dailyIncomeChart';
  else if (view === 'hours') containerId = 'hoursByLocationChart';
  
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = 'block';
    container.innerHTML = html;
  }
}

function showEmptyChartState() {
  ['locationPieChart', 'tipsVsHourlyChart', 'dailyIncomeChart', 'hoursByLocationChart'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
    }
  });
  
  const container = document.getElementById('locationPieChart');
  if (container) {
    container.style.display = 'block';
    container.innerHTML = '<div class="text-center text-gray-500 py-8">No data for this period</div>';
  }
}

// Override renderAllCharts
window.renderAllCharts = function() {
  renderOfflineCharts();
};

// Override switchChartView to use offline charts
window.switchChartView = function(view) {
  window.currentChartView = view;
  
  // Update tab styling
  document.querySelectorAll('.chart-tab').forEach(btn => {
    if (btn.dataset.view === view) {
      btn.classList.remove('bg-gray-700', 'text-gray-300');
      btn.classList.add('bg-indigo-600', 'text-white');
    } else {
      btn.classList.remove('bg-indigo-600', 'text-white');
      btn.classList.add('bg-gray-700', 'text-gray-300');
    }
  });
  
  // Re-render charts with new view
  renderOfflineCharts();
};

/* Chart Controls UI */
window.renderChartControls = function() {
  const currentView = window.currentChartView || 'pie';
  return `
    <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
      <button onclick="switchChartView('pie')" class="chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded ${currentView === 'pie' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}" data-view="pie">
        By Location
      </button>
      <button onclick="switchChartView('bar')" class="chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded ${currentView === 'bar' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}" data-view="bar">
        Tips vs Hourly
      </button>
      <button onclick="switchChartView('line')" class="chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded ${currentView === 'line' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}" data-view="line">
        Over Time
      </button>
      <button onclick="switchChartView('hours')" class="chart-tab flex-shrink-0 px-3 py-1.5 text-xs rounded ${currentView === 'hours' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}" data-view="hours">
        Hours
      </button>
    </div>
  `;
};
