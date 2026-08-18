/**
 * sidebar.js - Shared Sidebar & Topbar Component Injector
 */

document.addEventListener('DOMContentLoaded', () => {
  initGlobalTheme();
  renderSidebar();
  renderTopbar();
});

function initGlobalTheme() {
  const savedTheme = localStorage.getItem('procurepulse_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

function toggleGlobalTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('procurepulse_theme', isDark ? 'dark' : 'light');

  const topbarBtn = document.getElementById('global-theme-toggle-icon');
  if (topbarBtn) {
    topbarBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  }

  // Sync dashboard theme toggle icon if present
  const dashIcon = document.getElementById('theme-toggle-icon');
  if (dashIcon) {
    dashIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  if (typeof renderAnalyticsChart === 'function') {
    renderAnalyticsChart();
  }
}

function renderSidebar() {
  const mount = document.getElementById('sidebar-mount');
  if (!mount) return;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const isPOActive = currentPath === 'purchase-orders.html' || currentPath === 'purchase-order-form.html';
  const isMastersActive = currentPath === 'suppliers.html' || currentPath === 'items.html';

  mount.className = 'sidebar';
  mount.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo-icon">P</div>
      <div>
        <div class="sidebar-brand">ProcurePulse</div>
        <div class="sidebar-subbrand">Purchase Management ERP</div>
      </div>
    </div>

    <div class="sidebar-nav">
      <div class="nav-section-title">Main Menu</div>
      
      <a href="index.html" class="nav-link ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </a>

      <!-- Purchase Orders Dropdown Menu -->
      <a href="purchase-orders.html" class="nav-link submenu-toggle ${isPOActive ? 'active open' : ''}" id="po-toggle">
        <span style="display:flex; align-items:center; gap:12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Purchase Orders
        </span>
        <svg class="submenu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </a>

      <div class="submenu ${isPOActive ? 'open' : ''}" id="po-submenu">
        <a href="purchase-orders.html" class="nav-link ${currentPath === 'purchase-orders.html' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          All Orders List
        </a>
        <a href="purchase-order-form.html" class="nav-link ${currentPath === 'purchase-order-form.html' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create New PO
        </a>
      </div>

      <div class="nav-section-title">Master Data</div>

      <!-- Masters Dropdown Menu -->
      <a href="suppliers.html" class="nav-link submenu-toggle ${isMastersActive ? 'active open' : ''}" id="masters-toggle">
        <span style="display:flex; align-items:center; gap:12px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          Masters
        </span>
        <svg class="submenu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </a>

      <div class="submenu ${isMastersActive ? 'open' : ''}" id="masters-submenu">
        <a href="suppliers.html" class="nav-link ${currentPath === 'suppliers.html' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Suppliers Master
        </a>
        <a href="items.html" class="nav-link ${currentPath === 'items.html' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Items Catalog
        </a>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="user-avatar">N</div>
      <div>
        <div style="font-weight: 600; color: #f8fafc;">Nathaneal</div>
        <div style="font-size: 11px;">Procurement Mgr</div>
      </div>
    </div>
  `;

  // Bind arrow click listener to toggle dropdown without navigating
  const setupToggle = (toggleId, submenuId) => {
    const toggle = document.getElementById(toggleId);
    const submenu = document.getElementById(submenuId);
    if (toggle && submenu) {
      const arrow = toggle.querySelector('.submenu-arrow');
      if (arrow) {
        arrow.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle.classList.toggle('open');
          submenu.classList.toggle('open');
        });
      }
    }
  };

  setupToggle('po-toggle', 'po-submenu');
  setupToggle('masters-toggle', 'masters-submenu');
}

function renderTopbar() {
  const mount = document.getElementById('topbar-mount');
  if (!mount) return;

  const isDark = document.body.classList.contains('dark-mode');

  mount.className = 'topbar';
  mount.innerHTML = `
    <div class="topbar-title-area">
      <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 500;">
        Enterprise Procurement System
      </div>
    </div>
    <div class="topbar-actions" style="display:flex; align-items:center; gap:16px;">
      <button type="button" class="btn btn-outline btn-sm" onclick="toggleGlobalTheme()" style="padding: 4px 10px; font-size:12px;">
        <span id="global-theme-toggle-icon">${isDark ? '☀️ Light' : '🌙 Dark'}</span>
      </button>
      <div style="font-size: 12.5px; color: var(--text-muted); font-weight: 500;">
        System Status: <span style="color: var(--success); font-weight: 600;">Operational</span>
      </div>
    </div>
  `;
}
