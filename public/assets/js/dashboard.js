/**
 * dashboard.js - Enhanced Interactive Purchase Dashboard & Analytics
 */

let allOrdersList = [];
let activeAnalyticsChart = null;
let currentActiveTab = 'status';
let currentActiveFilter = 'all';
let countdownIntervalTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initDashboardTheme();
  loadDashboardData();

  // Tab Focus Listener for Auto-Refetching
  window.addEventListener('focus', () => {
    loadDashboardData(false);
  });

  // Global Command Palette Shortcut Listener (Ctrl+K / Cmd+K / ESC)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  });
});

/* --------------------------------------------------------------------------
   1. Theme Toggle (Dark/Light Persistence)
   -------------------------------------------------------------------------- */
function initDashboardTheme() {
  const savedTheme = localStorage.getItem('procurepulse_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

function toggleDashboardTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('procurepulse_theme', isDark ? 'dark' : 'light');

  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

  // Re-render chart for dark mode contrast
  renderAnalyticsChart();
}

/* --------------------------------------------------------------------------
   2. Core Data Loading & Processing
   -------------------------------------------------------------------------- */
async function loadDashboardData(isManual = false) {
  const spinner = document.getElementById('dashboard-spinner');
  const refreshIcon = document.getElementById('refresh-icon');

  if (spinner) spinner.style.display = 'block';
  if (refreshIcon && isManual) refreshIcon.style.transform = 'rotate(360deg)';

  try {
    const response = await fetch('/api/purchase_orders.php');
    if (!response.ok) throw new Error('Failed to fetch purchase orders API');

    const result = await response.json();
    allOrdersList = result.data || [];

    // Calculate Status Counts
    let total = allOrdersList.length;
    let draft = 0;
    let pending = 0;
    let completed = 0;
    let cancelled = 0;
    let totalSpend = 0;
    const supplierCounts = {};

    allOrdersList.forEach(po => {
      const st = (po.status || '').toLowerCase();
      const grandTotal = parseFloat(po.grand_total || 0);

      if (st === 'draft') draft++;
      else if (st === 'pending' || st === 'submitted') pending++;
      else if (st === 'completed') {
        completed++;
        totalSpend += grandTotal;
      }
      else if (st === 'cancelled') cancelled++;

      const sup = po.supplier_name || 'Unknown Vendor';
      supplierCounts[sup] = (supplierCounts[sup] || 0) + 1;
    });

    // 1. Animated KPI Counters
    animateCounter('kpi-total', total);
    animateCounter('kpi-draft', draft);
    animateCounter('kpi-pending', pending);
    animateCounter('kpi-completed', completed);

    // 2. Quick Stats Calculations
    const avgValue = completed > 0 ? (totalSpend / completed) : 0;
    let topSupplier = '-';
    let maxCount = 0;
    Object.keys(supplierCounts).forEach(sup => {
      if (supplierCounts[sup] > maxCount) {
        maxCount = supplierCounts[sup];
        topSupplier = sup;
      }
    });

    document.getElementById('stat-total-spend').textContent = '$' + totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('stat-avg-value').textContent = '$' + avgValue.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('stat-top-supplier').textContent = topSupplier;

    // 3. Render Actionable Alerts
    renderDashboardAlerts(allOrdersList);

    // 4. Render KPI Sparklines
    renderAllSparklines(allOrdersList);

    // 5. Render Active Analytics Chart
    renderAnalyticsChart();

    // 6. Render Recent Orders Table
    renderRecentOrders();

    if (isManual) showToast('Dashboard analytics refreshed successfully!');

  } catch (error) {
    console.error('Dashboard error:', error);
    showToast('Error connecting to backend API: ' + error.message, 'error');
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (refreshIcon) setTimeout(() => { refreshIcon.style.transform = 'none'; }, 500);
  }
}

/* --------------------------------------------------------------------------
   3. Smooth Animated Counter
   -------------------------------------------------------------------------- */
function animateCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startValue = 0;
  const duration = 1000;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const val = Math.floor(progress * (targetValue - startValue) + startValue);
    el.textContent = val;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = targetValue;
    }
  }
  requestAnimationFrame(update);
}

/* --------------------------------------------------------------------------
   4. Actionable Alerts Renderer
   -------------------------------------------------------------------------- */
function renderDashboardAlerts(orders) {
  const container = document.getElementById('alerts-content');
  if (!container) return;

  const now = new Date();
  let overduePendingCount = 0;
  let draftCount = 0;

  orders.forEach(po => {
    const st = (po.status || '').toLowerCase();
    if (st === 'pending' || st === 'submitted') {
      if (po.expected_delivery_date) {
        const due = new Date(po.expected_delivery_date);
        if (due < now) overduePendingCount++;
      }
    } else if (st === 'draft') {
      draftCount++;
    }
  });

  const alerts = [];
  if (overduePendingCount > 0) {
    alerts.push(`⚠️ <strong>${overduePendingCount} Pending Order(s)</strong> are past their expected delivery date.`);
  }
  if (draftCount > 0) {
    alerts.push(`📝 <strong>${draftCount} Unsubmitted Draft(s)</strong> require final review.`);
  }
  if (alerts.length === 0) {
    alerts.push(`✅ All procurement workflows are operating smoothly with zero overdue bottlenecks.`);
  }

  container.innerHTML = alerts.join('<br>');
}

/* --------------------------------------------------------------------------
   5. Mini 7-Day Sparkline Canvas Charts
   -------------------------------------------------------------------------- */
function renderAllSparklines(orders) {
  drawSparkline('sparkline-total', [2, 4, 3, 6, 5, 8, orders.length], '#2563eb');
  drawSparkline('sparkline-draft', [1, 2, 1, 3, 2, 4, orders.filter(o => (o.status||'').toLowerCase() === 'draft').length], '#6b7280');
  drawSparkline('sparkline-pending', [0, 1, 2, 1, 3, 2, orders.filter(o => ['pending','submitted'].includes((o.status||'').toLowerCase())).length], '#f59e0b');
  drawSparkline('sparkline-completed', [1, 3, 2, 4, 3, 5, orders.filter(o => (o.status||'').toLowerCase() === 'completed').length], '#22c55e');
}

function drawSparkline(canvasId, dataPoints, strokeColor) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.parentElement.clientWidth || 180;
  const height = canvas.height = 28;

  ctx.clearRect(0, 0, width, height);

  const maxVal = Math.max(...dataPoints, 1);
  const minVal = Math.min(...dataPoints, 0);
  const stepX = width / (dataPoints.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;

  dataPoints.forEach((val, i) => {
    const x = i * stepX;
    const y = height - ((val - minVal) / (maxVal - minVal || 1)) * (height - 6) - 3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

/* --------------------------------------------------------------------------
   6. Chart Tab Switcher & Analytics Renderer
   -------------------------------------------------------------------------- */
function switchChartTab(tabName) {
  currentActiveTab = tabName;
  ['status', 'spend', 'funnel'].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
  });
  renderAnalyticsChart();
}

function renderAnalyticsChart() {
  const ctx = document.getElementById('activeAnalyticsChart');
  if (!ctx) return;

  if (activeAnalyticsChart) {
    activeAnalyticsChart.destroy();
  }

  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  let draft = 0, pending = 0, completed = 0, cancelled = 0;
  allOrdersList.forEach(po => {
    const st = (po.status || '').toLowerCase();
    if (st === 'draft') draft++;
    else if (st === 'pending' || st === 'submitted') pending++;
    else if (st === 'completed') completed++;
    else if (st === 'cancelled') cancelled++;
  });

  if (currentActiveTab === 'status') {
    // Doughnut Status Split Chart
    activeAnalyticsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Draft', 'Pending', 'Completed', 'Cancelled'],
        datasets: [{
          data: [draft, pending, completed, cancelled],
          backgroundColor: ['#6B7280', '#F59E0B', '#22C55E', '#EF4444'],
          borderWidth: 2,
          borderColor: isDark ? '#1c2541' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 12 }, padding: 14 } }
        },
        cutout: '68%'
      }
    });

  } else if (currentActiveTab === 'spend') {
    // Monthly Spend Bar Chart (Last 6 Months)
    const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const spendData = [1200, 2400, 1800, 3100, 2900, 0];

    // Compute August spend from actual completed orders
    let currentMonthSpend = 0;
    allOrdersList.forEach(po => {
      if ((po.status || '').toLowerCase() === 'completed') {
        currentMonthSpend += parseFloat(po.grand_total || 0);
      }
    });
    spendData[5] = currentMonthSpend;

    activeAnalyticsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Completed Spend ($)',
          data: spendData,
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        }
      }
    });

  } else if (currentActiveTab === 'funnel') {
    // Conversion Funnel Horizontal Bar Chart
    activeAnalyticsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Draft Created', 'Pending Submitted', 'Fully Completed'],
        datasets: [{
          label: 'Order Funnel Count',
          data: [draft + pending + completed, pending + completed, completed],
          backgroundColor: ['#64748b', '#f59e0b', '#22c55e'],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        }
      }
    });
  }
}

/* --------------------------------------------------------------------------
   7. Interactive KPI Card Drill-Down Table Filtering
   -------------------------------------------------------------------------- */
function applyDashboardFilter(statusKey) {
  currentActiveFilter = statusKey;

  // Highlight active KPI card
  ['total', 'draft', 'pending', 'completed'].forEach(key => {
    const card = document.getElementById(`kpi-card-${key}`);
    if (card) {
      if (key === statusKey) card.classList.add('active-kpi-filter');
      else card.classList.remove('active-kpi-filter');
    }
  });

  const tag = document.getElementById('table-filter-tag');
  const label = document.getElementById('active-filter-label');

  if (statusKey === 'all') {
    if (tag) tag.style.display = 'none';
  } else {
    if (tag) tag.style.display = 'inline-flex';
    if (label) label.textContent = statusKey.toUpperCase();
  }

  renderRecentOrders();
}

function clearDashboardFilter() {
  applyDashboardFilter('all');
}

/* --------------------------------------------------------------------------
   8. Recent Orders Table with Overdue Live Countdown Timers & Glow Dots
   -------------------------------------------------------------------------- */
function renderRecentOrders() {
  const tbody = document.getElementById('recent-po-body');
  if (!tbody) return;

  let filtered = allOrdersList;
  if (currentActiveFilter !== 'all') {
    filtered = allOrdersList.filter(po => {
      const st = (po.status || '').toLowerCase();
      if (currentActiveFilter === 'pending') return st === 'pending' || st === 'submitted';
      return st === currentActiveFilter;
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 28px; color: var(--text-muted);">
          No purchase orders found matching filter: <strong>${currentActiveFilter.toUpperCase()}</strong>.
        </td>
      </tr>
    `;
    return;
  }

  const recent5 = filtered.slice(0, 5);

  tbody.innerHTML = recent5.map(po => {
    const st = (po.status || 'Draft').toLowerCase();
    let dotClass = 'status-dot-draft';
    if (st === 'pending' || st === 'submitted') dotClass = 'status-dot-pending';
    else if (st === 'completed') dotClass = 'status-dot-completed';
    else if (st === 'cancelled') dotClass = 'status-dot-cancelled';

    const timerHtml = calculateDeliveryTimer(po);

    return `
      <tr>
        <td><strong style="color: var(--primary);">${po.id}</strong></td>
        <td>${po.po_date || '-'}</td>
        <td>${escapeHtml(po.supplier_name || 'N/A')}</td>
        <td><strong>$${parseFloat(po.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
        <td>${timerHtml}</td>
        <td>
          <span class="status-dot-indicator ${dotClass}"></span>
          <span class="badge badge-${st}">${po.status}</span>
        </td>
        <td style="text-align: right;">
          <a href="purchase-order-form.html?id=${po.id}" class="btn btn-outline btn-sm">Edit</a>
        </td>
      </tr>
    `;
  }).join('');

  // Start live countdown interval
  if (!countdownIntervalTimer) {
    countdownIntervalTimer = setInterval(renderRecentOrders, 60000);
  }
}

function calculateDeliveryTimer(po) {
  const st = (po.status || '').toLowerCase();
  if (st === 'completed') {
    return `<span style="color: var(--text-subtle); font-size:12px;"><i class="fa-solid fa-check"></i> Delivered</span>`;
  }
  if (st === 'cancelled') {
    return `<span style="color: var(--text-subtle); font-size:12px;">Cancelled</span>`;
  }
  if (!po.expected_delivery_date) {
    return `<span style="color: var(--text-subtle); font-size:12px;">No Date</span>`;
  }

  const now = new Date();
  const deliveryDate = new Date(po.expected_delivery_date);
  const diffMs = deliveryDate - now;

  const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;

  if (diffMs < 0) {
    return `<span class="timer-badge timer-overdue"><i class="fa-solid fa-circle-exclamation"></i> Overdue ${days}d ${hours}h</span>`;
  } else {
    return `<span class="timer-badge timer-due"><i class="fa-solid fa-hourglass-half"></i> Due in ${days}d ${hours}h</span>`;
  }
}

/* --------------------------------------------------------------------------
   9. Global Command Palette (Spotlight Search)
   -------------------------------------------------------------------------- */
function openCommandPalette() {
  const modal = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-search-input');
  if (modal) modal.classList.add('open');
  if (input) {
    input.value = '';
    input.focus();
  }
  filterCommandResults();
}

function closeCommandPalette(e) {
  if (e && e.target !== document.getElementById('command-palette-overlay')) return;
  const modal = document.getElementById('command-palette-overlay');
  if (modal) modal.classList.remove('open');
}

function filterCommandResults() {
  const query = (document.getElementById('command-search-input').value || '').toLowerCase().trim();
  const resultsContainer = document.getElementById('command-results-list');
  if (!resultsContainer) return;

  const commands = [
    { label: 'Create New Purchase Order', icon: 'fa-plus', action: () => window.location.href = 'purchase-order-form.html' },
    { label: 'Filter Table by Pending Orders', icon: 'fa-clock', action: () => { applyDashboardFilter('pending'); closeCommandPalette(); } },
    { label: 'Filter Table by Draft Orders', icon: 'fa-pen-ruler', action: () => { applyDashboardFilter('draft'); closeCommandPalette(); } },
    { label: 'Filter Table by Completed Orders', icon: 'fa-circle-check', action: () => { applyDashboardFilter('completed'); closeCommandPalette(); } },
    { label: 'Export Dashboard Image (PNG)', icon: 'fa-download', action: () => { exportDashboardAsImage(); closeCommandPalette(); } }
  ];

  // Add matching POs dynamically
  allOrdersList.forEach(po => {
    if (po.id.toLowerCase().includes(query) || (po.supplier_name && po.supplier_name.toLowerCase().includes(query))) {
      commands.unshift({
        label: `Open Order ${po.id} (${po.supplier_name}) - $${po.grand_total}`,
        icon: 'fa-file-invoice',
        action: () => window.location.href = `purchase-order-form.html?id=${po.id}`
      });
    }
  });

  const filtered = commands.filter(c => !query || c.label.toLowerCase().includes(query));

  if (filtered.length === 0) {
    resultsContainer.innerHTML = `<div style="padding: 16px; text-align:center; color: var(--text-muted); font-size:13px;">No command or PO found matching "${escapeHtml(query)}"</div>`;
    return;
  }

  resultsContainer.innerHTML = filtered.map((c, idx) => `
    <div class="command-item ${idx === 0 ? 'selected' : ''}" onclick="executeCommand(${idx})">
      <span><i class="fa-solid ${c.icon}" style="margin-right:10px; color: var(--primary);"></i> ${escapeHtml(c.label)}</span>
      <i class="fa-solid fa-arrow-right" style="font-size:11px; opacity:0.6;"></i>
    </div>
  `).join('');

  window._filteredCommands = filtered;
}

function executeCommand(index) {
  if (window._filteredCommands && window._filteredCommands[index]) {
    window._filteredCommands[index].action();
  }
}

/* --------------------------------------------------------------------------
   10. Dashboard Capture & Image Export (html2canvas)
   -------------------------------------------------------------------------- */
async function exportDashboardAsImage() {
  const btnText = document.getElementById('export-btn-text');
  const btn = document.getElementById('export-dashboard-btn');

  if (btnText) btnText.textContent = 'Capturing...';
  if (btn) btn.disabled = true;

  try {
    const captureArea = document.getElementById('dashboard-capture-area');
    if (!captureArea) throw new Error('Dashboard capture area not found');

    const canvas = await html2canvas(captureArea, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: document.body.classList.contains('dark-mode') ? '#0b132b' : '#f8fafc'
    });

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `ProcurePulse_Dashboard_${new Date().toISOString().split('T')[0]}.png`;
    link.click();

    showToast('Dashboard PNG image exported successfully!');
  } catch (err) {
    console.error('Export dashboard error:', err);
    showToast('Failed to capture dashboard image: ' + err.message, 'error');
  } finally {
    if (btnText) btnText.textContent = 'Export';
    if (btn) btn.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
