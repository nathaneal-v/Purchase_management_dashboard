/**
 * suppliers.js - Supplier Master Frontend Logic
 */

let suppliersList = [];
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchSuppliers();
});

async function fetchSuppliers() {
  try {
    const res = await fetch('/api/suppliers.php');
    if (!res.ok) throw new Error('Failed to load suppliers');
    
    const result = await res.json();
    suppliersList = result.data || [];
    renderSuppliersTable(suppliersList);
    populateSupplierFilterDropdown(suppliersList);
    document.getElementById('supplier-count').textContent = suppliersList.length;
  } catch (err) {
    console.error('Fetch suppliers error:', err);
    showToast('Failed to fetch suppliers from backend API', 'error');
  }
}

function populateSupplierFilterDropdown(suppliers) {
  const select = document.getElementById('supplier-filter-select');
  if (!select) return;
  select.innerHTML = '<option value="">All Suppliers</option>' +
    suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.id})</option>`).join('');
}

function renderSuppliersTable(data) {
  const tbody = document.getElementById('suppliers-table-body');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">
          No suppliers found matching your filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td><strong style="color: var(--primary);">${s.id}</strong></td>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${escapeHtml(s.contact_person || '-')}</td>
      <td>
        <div>${escapeHtml(s.phone || '')}</div>
        <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(s.email || '')}</div>
      </td>
      <td>${escapeHtml(s.tax_number || '-')}</td>
      <td><span class="topbar-pill">${escapeHtml(s.payment_terms || 'Net 30')}</span></td>
      <td><span class="badge badge-${(s.status || 'active').toLowerCase()}">${s.status}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-outline btn-sm" onclick="editSupplier('${s.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="promptDeleteSupplier('${s.id}', '${escapeHtml(s.name)}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterSuppliers() {
  const query = (document.getElementById('supplier-search').value || '').toLowerCase();
  const selectedSupplierId = document.getElementById('supplier-filter-select') ? document.getElementById('supplier-filter-select').value : '';

  const filtered = suppliersList.filter(s => {
    const matchesSearch = !query || 
      s.id.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(query)) ||
      (s.email && s.email.toLowerCase().includes(query));

    const matchesDropdown = !selectedSupplierId || s.id === selectedSupplierId;

    return matchesSearch && matchesDropdown;
  });

  renderSuppliersTable(filtered);
}

function openSupplierModal(isEdit = false) {
  document.getElementById('supplier-modal-title').textContent = isEdit ? 'Edit Supplier' : 'Add New Supplier';
  document.getElementById('supplier-modal').classList.add('open');
}

function closeSupplierModal() {
  document.getElementById('supplier-modal').classList.remove('open');
  document.getElementById('supplier-form').reset();
  document.getElementById('supplier-id').value = '';
}

function editSupplier(id) {
  const s = suppliersList.find(item => item.id === id);
  if (!s) return;

  document.getElementById('supplier-id').value = s.id;
  document.getElementById('supplier-name').value = s.name || '';
  document.getElementById('supplier-contact').value = s.contact_person || '';

  // Parse phone region code if present
  let phoneStr = (s.phone || '').trim();
  const knownPrefixes = ['+91', '+1', '+44', '+61', '+49', '+971', '+65', '+81'];
  let matchedPrefix = '+91';

  for (const prefix of knownPrefixes) {
    if (phoneStr.startsWith(prefix)) {
      matchedPrefix = prefix;
      phoneStr = phoneStr.replace(prefix, '').trim();
      break;
    }
  }

  document.getElementById('supplier-phone-region').value = matchedPrefix;
  document.getElementById('supplier-phone').value = phoneStr;
  document.getElementById('supplier-email').value = s.email || '';
  document.getElementById('supplier-tax').value = s.tax_number || '';
  document.getElementById('supplier-terms').value = s.payment_terms || 'Net 30';
  document.getElementById('supplier-status').value = s.status || 'Active';
  document.getElementById('supplier-address').value = s.address || '';

  openSupplierModal(true);
}

async function handleSupplierSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('supplier-id').value;
  const regionCode = document.getElementById('supplier-phone-region').value;
  const rawPhone = document.getElementById('supplier-phone').value.trim();
  const digitsOnly = rawPhone.replace(/\D/g, '');

  if (!rawPhone || digitsOnly.length < 7 || digitsOnly.length > 15) {
    showToast('Please enter a valid telephone number (7 to 15 digits).', 'error');
    return;
  }

  const email = document.getElementById('supplier-email').value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    showToast('Please enter a valid email address (e.g. name@domain.com).', 'error');
    return;
  }

  const formattedPhone = `${regionCode} ${rawPhone}`;

  const payload = {
    id: id || undefined,
    name: document.getElementById('supplier-name').value.trim(),
    contact_person: document.getElementById('supplier-contact').value.trim(),
    phone: formattedPhone,
    email: document.getElementById('supplier-email').value.trim(),
    tax_number: document.getElementById('supplier-tax').value.trim(),
    payment_terms: document.getElementById('supplier-terms').value,
    status: document.getElementById('supplier-status').value,
    address: document.getElementById('supplier-address').value.trim()
  };

  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/suppliers.php', {
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

    showToast(id ? 'Supplier updated successfully!' : 'Supplier created successfully!');
    closeSupplierModal();
    fetchSuppliers();

  } catch (err) {
    console.error('Save supplier error:', err);
    showToast('Network error while saving supplier', 'error');
  }
}

function promptDeleteSupplier(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-supplier-name').textContent = name;
  document.getElementById('delete-confirm-modal').classList.add('open');

  document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
      const res = await fetch(`/api/suppliers.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        showToast(result.message || 'Failed to delete supplier', 'error');
        return;
      }

      showToast('Supplier deleted successfully');
      closeDeleteModal();
      fetchSuppliers();
    } catch (err) {
      console.error('Delete supplier error:', err);
      showToast('Error deleting supplier', 'error');
    }
  };
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('delete-confirm-modal').classList.remove('open');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
