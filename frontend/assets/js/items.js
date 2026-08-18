/**
 * items.js - Item Master Frontend Logic
 */

let itemsList = [];
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchItems();
});

async function fetchItems() {
  try {
    const res = await fetch('/api/items.php');
    if (!res.ok) throw new Error('Failed to load items');
    
    const result = await res.json();
    itemsList = result.data || [];
    renderItemsTable(itemsList);
    populateItemFilterDropdown(itemsList);
    document.getElementById('item-count').textContent = itemsList.length;
  } catch (err) {
    console.error('Fetch items error:', err);
    showToast('Failed to fetch item catalog from backend API', 'error');
  }
}

function populateItemFilterDropdown(items) {
  const select = document.getElementById('item-filter-select');
  if (!select) return;
  select.innerHTML = '<option value="">All Catalog Items</option>' +
    items.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${i.id})</option>`).join('');
}

function renderItemsTable(data) {
  const tbody = document.getElementById('items-table-body');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">
          No items found matching your filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(item => `
    <tr>
      <td><strong style="color: var(--primary);">${item.id}</strong></td>
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(item.description || '')}</div>
      </td>
      <td><span class="topbar-pill">${escapeHtml(item.category || 'General')}</span></td>
      <td>${escapeHtml(item.unit || 'Piece')}</td>
      <td><strong>$${parseFloat(item.purchase_price || 0).toFixed(2)}</strong></td>
      <td>${parseFloat(item.tax || 0)}%</td>
      <td><span class="badge badge-${(item.status || 'active').toLowerCase()}">${item.status}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-outline btn-sm" onclick="editItem('${item.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="promptDeleteItem('${item.id}', '${escapeHtml(item.name)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterItems() {
  const query = (document.getElementById('item-search').value || '').toLowerCase();
  const selectedItemId = document.getElementById('item-filter-select') ? document.getElementById('item-filter-select').value : '';

  const filtered = itemsList.filter(item => {
    const matchesSearch = !query || 
      item.id.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query));

    const matchesDropdown = !selectedItemId || item.id === selectedItemId;

    return matchesSearch && matchesDropdown;
  });

  renderItemsTable(filtered);
}

function openItemModal(isEdit = false) {
  document.getElementById('item-modal-title').textContent = isEdit ? 'Edit Item' : 'Add New Item';
  document.getElementById('item-modal').classList.add('open');
}

function closeItemModal() {
  document.getElementById('item-modal').classList.remove('open');
  document.getElementById('item-form').reset();
  document.getElementById('item-id').value = '';
}

function editItem(id) {
  const item = itemsList.find(i => i.id === id);
  if (!item) return;

  document.getElementById('item-id').value = item.id;
  document.getElementById('item-name').value = item.name || '';
  document.getElementById('item-category').value = item.category || '';
  document.getElementById('item-unit').value = item.unit || 'Piece';
  document.getElementById('item-price').value = item.purchase_price || 0;
  document.getElementById('item-tax').value = item.tax || 0;
  document.getElementById('item-status').value = item.status || 'Active';
  document.getElementById('item-description').value = item.description || '';

  openItemModal(true);
}

async function handleItemSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('item-id').value;
  const payload = {
    id: id || undefined,
    name: document.getElementById('item-name').value.trim(),
    category: document.getElementById('item-category').value.trim(),
    unit: document.getElementById('item-unit').value,
    purchase_price: parseFloat(document.getElementById('item-price').value),
    tax: parseFloat(document.getElementById('item-tax').value || 0),
    status: document.getElementById('item-status').value,
    description: document.getElementById('item-description').value.trim()
  };

  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/items.php', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      const msg = result.errors ? Object.values(result.errors).join(', ') : (result.message || 'Operation failed');
      showToast(msg, 'error');
      return;
    }

    showToast(id ? 'Item updated successfully!' : 'Item created successfully!');
    closeItemModal();
    fetchItems();

  } catch (err) {
    console.error('Save item error:', err);
    showToast('Network error while saving item', 'error');
  }
}

function promptDeleteItem(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-item-name').textContent = name;
  document.getElementById('delete-item-modal').classList.add('open');

  document.getElementById('confirm-delete-item-btn').onclick = async () => {
    try {
      const res = await fetch(`/api/items.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        showToast(result.message || 'Failed to delete item', 'error');
        return;
      }

      showToast('Item deleted successfully');
      closeDeleteItemModal();
      fetchItems();
    } catch (err) {
      console.error('Delete item error:', err);
      showToast('Error deleting item', 'error');
    }
  };
}

function closeDeleteItemModal() {
  deleteTargetId = null;
  document.getElementById('delete-item-modal').classList.remove('open');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
