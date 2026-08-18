/**
 * purchase-order-form.js - Dynamic Purchase Order Form Logic
 */

let suppliersCatalog = [];
let itemsCatalog = [];
let editingPOId = null;
let currentStatus = 'Draft';

document.addEventListener('DOMContentLoaded', async () => {
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('po-date').value = today;
  
  // Set expected delivery to today + 7 days
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  document.getElementById('po-delivery-date').value = nextWeek.toISOString().split('T')[0];

  // Auto-generate default Reference Number (REF-YYYYMMDD-XXXX)
  const dateCompact = today.replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const defaultRef = `REF-${dateCompact}-${randomSuffix}`;
  document.getElementById('po-reference').value = defaultRef;

  // Check URL query param for Edit mode
  const urlParams = new URLSearchParams(window.location.search);
  editingPOId = urlParams.get('id');

  await loadCatalogs();

  if (editingPOId) {
    document.getElementById('form-title').textContent = `Edit Purchase Order: ${editingPOId}`;
    await loadPOForEdit(editingPOId);
  } else {
    // Add 1 default blank row
    addItemRow();
    updateSupplierState();
  }
});

async function loadCatalogs() {
  try {
    const [supRes, itemRes] = await Promise.all([
      fetch('/api/suppliers.php'),
      fetch('/api/items.php')
    ]);

    if (supRes.ok) {
      const supData = await supRes.json();
      suppliersCatalog = (supData.data || []).filter(s => (s.status || '').toLowerCase() === 'active');
      populateSupplierDropdown(suppliersCatalog);
    }

    if (itemRes.ok) {
      const itemData = await itemRes.json();
      itemsCatalog = (itemData.data || []).filter(i => (i.status || '').toLowerCase() === 'active');
    }
  } catch (err) {
    console.error('Catalog load error:', err);
    showToast('Failed to load supplier/item catalogs from backend', 'error');
  }
}

function populateSupplierDropdown(suppliers) {
  const select = document.getElementById('po-supplier');
  select.innerHTML = '<option value="">-- Select Supplier --</option>' + 
    suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.id})</option>`).join('');
}

let previousSupplierId = '';

function onSupplierChange() {
  const supplierSelect = document.getElementById('po-supplier');
  const selectedId = supplierSelect.value;

  // Check if any item row currently has a selected item
  const rows = document.querySelectorAll('.item-line-row');
  let hasSelectedItems = false;
  rows.forEach(row => {
    const select = row.querySelector('.item-select');
    if (select && select.value) hasSelectedItems = true;
  });

  if (hasSelectedItems && previousSupplierId && previousSupplierId !== selectedId) {
    const confirmReset = confirm('Changing the Supplier will reset your selected order item lines. Do you wish to continue?');
    if (!confirmReset) {
      supplierSelect.value = previousSupplierId;
      return;
    }
    // Reset line items table to 1 fresh row
    resetItemLines();
  }

  previousSupplierId = selectedId;

  const supplier = suppliersCatalog.find(s => s.id === selectedId);
  if (supplier && supplier.payment_terms) {
    document.getElementById('po-payment-terms').value = supplier.payment_terms;
  }

  updateSupplierState();
}

function resetItemLines() {
  const tbody = document.getElementById('line-items-body');
  if (tbody) {
    tbody.innerHTML = '';
    addItemRow();
  }
}

function updateSupplierState() {
  const selectedId = document.getElementById('po-supplier') ? document.getElementById('po-supplier').value : '';
  const notice = document.getElementById('no-supplier-notice');
  const tableWrapper = document.getElementById('items-table-wrapper');
  const sidebarPane = document.querySelector('.po-sidebar-pane');
  const addItemBtn = document.getElementById('add-item-btn');

  // Financial Summary box is always visible
  if (sidebarPane) sidebarPane.style.display = 'block';

  if (selectedId) {
    if (notice) notice.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'block';
    if (addItemBtn) addItemBtn.style.display = 'inline-flex';
  } else {
    if (notice) notice.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (addItemBtn) addItemBtn.style.display = 'none';
  }
}

let currentPickerRowId = null;

function openItemPickerModal(rowId) {
  currentPickerRowId = rowId;
  const modal = document.getElementById('item-picker-modal');
  const searchInput = document.getElementById('item-picker-search');

  if (searchInput) searchInput.value = '';
  renderItemPickerModalList(itemsCatalog);

  if (modal) modal.classList.add('open');
  if (searchInput) setTimeout(() => searchInput.focus(), 100);
}

function closeItemPickerModal() {
  const modal = document.getElementById('item-picker-modal');
  if (modal) modal.classList.remove('open');
  currentPickerRowId = null;
}

function closeItemPickerModalOnBackdrop(e) {
  if (e && e.target === document.getElementById('item-picker-modal')) {
    closeItemPickerModal();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('item-picker-modal');
    if (modal && modal.classList.contains('open')) {
      closeItemPickerModal();
    }
  }
});

function filterItemPickerModalList() {
  const query = (document.getElementById('item-picker-search').value || '').toLowerCase().trim();
  const filtered = itemsCatalog.filter(i => 
    i.id.toLowerCase().includes(query) ||
    i.name.toLowerCase().includes(query) ||
    (i.category && i.category.toLowerCase().includes(query)) ||
    (i.description && i.description.toLowerCase().includes(query))
  );
  renderItemPickerModalList(filtered);
}

function renderItemPickerModalList(items) {
  const tbody = document.getElementById('item-picker-table-body');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
          No matching catalog items found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr class="item-picker-row" onclick="selectItemFromPicker('${item.id}')" style="cursor: pointer;">
      <td><strong style="color: var(--primary);">${item.id}</strong></td>
      <td>
        <strong style="color: var(--text-main);">${escapeHtml(item.name)}</strong>
        <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(item.description || '')}</div>
      </td>
      <td><span class="topbar-pill">${escapeHtml(item.unit || 'Piece')}</span></td>
      <td><strong>$${parseFloat(item.purchase_price || 0).toFixed(2)}</strong></td>
      <td style="text-align: right;">
        <button type="button" class="btn btn-primary btn-sm">Select</button>
      </td>
    </tr>
  `).join('');
}

function selectItemFromPicker(itemId) {
  if (!currentPickerRowId) return;

  const row = document.getElementById(currentPickerRowId);
  if (!row) return;

  const item = itemsCatalog.find(i => i.id === itemId);
  if (!item) return;

  const nameInput = row.querySelector('.item-picker-input');
  const hiddenIdInput = row.querySelector('.item-id-hidden');
  const codeInput = row.querySelector('.item-code');
  const unitInput = row.querySelector('.item-unit');
  const priceInput = row.querySelector('.item-price');
  const taxInput = row.querySelector('.item-tax');

  if (nameInput) nameInput.value = item.name;
  if (hiddenIdInput) hiddenIdInput.value = item.id;
  if (codeInput) codeInput.value = item.id;
  if (unitInput) unitInput.value = item.unit || 'Piece';
  if (priceInput) priceInput.value = parseFloat(item.purchase_price || 0).toFixed(2);
  if (taxInput) taxInput.value = parseFloat(item.tax || 0);

  checkVolumeTiers(currentPickerRowId);
  calculateTotals();
  closeItemPickerModal();

  showToast(`Selected "${item.name}" for line item.`);
}

function addItemRow(initialData = null) {
  const tbody = document.getElementById('line-items-body');
  const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.className = 'item-line-row';

  const initialItemName = initialData ? (initialData.item_name || initialData.description || initialData.item_id) : '';
  const initialItemId = initialData ? initialData.item_id : '';

  tr.innerHTML = `
    <td>
      <div style="position: relative;">
        <input type="text" class="form-control item-picker-input" placeholder="🔍 Search & Select Item..." readonly onclick="openItemPickerModal('${rowId}')" data-row-id="${rowId}" required value="${escapeHtml(initialItemName)}" style="cursor: pointer; background-color: #fff; padding-right: 28px;">
        <input type="hidden" class="item-id-hidden" value="${initialItemId}">
        <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.5; font-size: 13px;">🔍</span>
      </div>
    </td>
    <td><input type="text" class="form-control item-code" readonly value="${initialData ? (initialData.item_code || initialItemId) : ''}"></td>
    <td><input type="number" step="1" min="1" class="form-control item-qty" value="${initialData ? initialData.quantity : 1}" oninput="onQtyOrPriceChange('${rowId}')" required></td>
    <td><input type="text" class="form-control item-unit" readonly value="${initialData ? initialData.unit : ''}"></td>
    <td><input type="number" step="0.01" min="0" class="form-control item-price" value="${initialData ? initialData.unit_price : '0.00'}" oninput="calculateTotals()" required></td>
    <td>
      <div style="display:flex; gap:4px; align-items:center;">
        <select class="form-control item-disc-type" style="width: 55px; padding: 4px;" onchange="calculateTotals()">
          <option value="%" ${initialData && initialData.discount_type === '%' ? 'selected' : ''}>%</option>
          <option value="$" ${initialData && initialData.discount_type === '$' ? 'selected' : ''}>$</option>
        </select>
        <input type="number" step="0.01" min="0" class="form-control item-discount" value="${initialData ? (initialData.discount_val !== undefined ? initialData.discount_val : (initialData.discount || 0)) : '0.00'}" oninput="calculateTotals()" style="flex:1;">
      </div>
      <div class="tier-badge" id="tier-badge-${rowId}" style="font-size:10px; color:#059669; margin-top:2px; font-weight:600;"></div>
    </td>
    <td><input type="number" step="0.1" min="0" max="100" class="form-control item-tax" readonly value="${initialData ? (initialData.tax || 0) : '0'}" oninput="calculateTotals()"></td>
    <td style="text-align: right;"><strong class="item-line-total">$0.00</strong></td>
    <td style="text-align: center;">
      <button type="button" class="btn-icon" onclick="removeRow('${rowId}')" title="Remove Line">✕</button>
    </td>
  `;

  tbody.appendChild(tr);

  if (initialData && initialItemId) {
    checkVolumeTiers(rowId);
  }
  calculateTotals();
}

function checkVolumeTiers(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const itemIdInput = row.querySelector('.item-id-hidden') || row.querySelector('.item-select');
  const itemId = itemIdInput ? itemIdInput.value : '';
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const item = itemsCatalog.find(i => i.id === itemId);
  const tierBadge = document.getElementById(`tier-badge-${rowId}`);

  if (item && item.discount_tiers && item.discount_tiers.length > 0) {
    const applicableTier = item.discount_tiers
      .filter(t => qty >= t.min_qty)
      .sort((a, b) => b.min_qty - a.min_qty)[0];

    if (applicableTier) {
      const discTypeSelect = row.querySelector('.item-disc-type');
      const discInput = row.querySelector('.item-discount');

      if (discTypeSelect && discInput) {
        discTypeSelect.value = '%';
        discInput.value = applicableTier.discount_pct;
      }

      if (tierBadge) {
        tierBadge.textContent = `🎉 ${applicableTier.discount_pct}% Volume Tier (Qty ≥ ${applicableTier.min_qty})`;
      }
    } else {
      if (tierBadge) tierBadge.textContent = '';
    }
  } else {
    if (tierBadge) tierBadge.textContent = '';
  }
}

function onQtyOrPriceChange(rowId) {
  checkVolumeTiers(rowId);
  calculateTotals();
}

function onItemSelect(rowId, overwritePrice = true) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const itemId = row.querySelector('.item-select').value;
  const item = itemsCatalog.find(i => i.id === itemId);

  if (item) {
    row.querySelector('.item-code').value = item.id;
    row.querySelector('.item-unit').value = item.unit || 'Piece';
    if (overwritePrice) {
      row.querySelector('.item-price').value = parseFloat(item.purchase_price || 0).toFixed(2);
      row.querySelector('.item-tax').value = parseFloat(item.tax || 0);
      checkVolumeTiers(rowId);
    }
  } else {
    row.querySelector('.item-code').value = '';
    row.querySelector('.item-unit').value = '';
  }

  calculateTotals();
}

function removeRow(rowId) {
  const tbody = document.getElementById('line-items-body');
  if (tbody.children.length <= 1) {
    showToast('A Purchase Order must contain at least 1 item line.', 'error');
    return;
  }
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    calculateTotals();
  }
}

function calculateTotals() {
  const rows = document.querySelectorAll('.item-line-row');
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const discType = row.querySelector('.item-disc-type') ? row.querySelector('.item-disc-type').value : '$';
    const discVal = parseFloat(row.querySelector('.item-discount').value) || 0;
    const taxPct = parseFloat(row.querySelector('.item-tax').value) || 0;

    const baseLine = qty * price;

    let lineDiscountAmount = 0;
    if (discType === '%') {
      lineDiscountAmount = (baseLine * discVal) / 100;
    } else {
      lineDiscountAmount = discVal;
    }

    const lineAfterDiscount = Math.max(0, baseLine - lineDiscountAmount);
    const lineTax = (lineAfterDiscount * taxPct) / 100;
    const lineTotal = lineAfterDiscount + lineTax;

    row.querySelector('.item-line-total').textContent = '$' + lineTotal.toFixed(2);

    subtotal += baseLine;
    totalDiscount += lineDiscountAmount;
    totalTax += lineTax;
  });

  const addCharges = parseFloat(document.getElementById('additional-charges').value) || 0;
  const grandTotal = (subtotal - totalDiscount) + totalTax + addCharges;

  document.getElementById('summary-subtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('summary-discount').textContent = '-$' + totalDiscount.toFixed(2);
  document.getElementById('summary-tax').textContent = '+$' + totalTax.toFixed(2);
  document.getElementById('summary-grand-total').textContent = '$' + grandTotal.toFixed(2);
}

function onLocationSelectChange(val) {
  const customInput = document.getElementById('po-delivery-location');
  if (!customInput) return;

  if (val === 'CUSTOM') {
    customInput.style.display = 'block';
    customInput.focus();
  } else {
    customInput.style.display = 'none';
    customInput.value = val;
  }
}

function applyNoteTemplate(templateText) {
  if (!templateText) return;
  const textarea = document.getElementById('po-notes');
  if (!textarea) return;

  if (textarea.value.trim() === '') {
    textarea.value = templateText;
  } else {
    textarea.value = textarea.value.trim() + '\n' + templateText;
  }
  const tSel = document.getElementById('note-template-select');
  if (tSel) tSel.value = '';
}

function onPaymentTermsSelectChange(val) {
  const termsInput = document.getElementById('po-payment-terms');
  if (!termsInput) return;

  if (val === 'CUSTOM') {
    termsInput.style.display = 'block';
    termsInput.value = '';
    termsInput.focus();
  } else {
    termsInput.style.display = 'none';
    termsInput.value = val;
  }
}

function getPaymentTermsValue() {
  const selectVal = document.getElementById('po-payment-terms-select') ? document.getElementById('po-payment-terms-select').value : '';
  const termsInput = document.getElementById('po-payment-terms');

  if (selectVal === 'CUSTOM') {
    return termsInput ? termsInput.value.trim() : '';
  }
  return termsInput ? termsInput.value.trim() : selectVal;
}

function getDeliveryLocationValue() {
  const selectVal = document.getElementById('po-location-select') ? document.getElementById('po-location-select').value : '';
  const customInput = document.getElementById('po-delivery-location');

  if (selectVal === 'CUSTOM') {
    return customInput ? customInput.value.trim() : '';
  }
  return selectVal || (customInput ? customInput.value.trim() : '');
}

async function loadPOForEdit(id) {
  try {
    const res = await fetch(`/api/purchase_orders.php?id=${id}`);
    if (!res.ok) throw new Error('PO not found');

    const result = await res.json();
    const po = result.data;

    document.getElementById('po-number').value = po.id;
    document.getElementById('po-date').value = po.po_date;
    document.getElementById('po-supplier').value = po.supplier_id;
    previousSupplierId = po.supplier_id;
    document.getElementById('po-delivery-date').value = po.expected_delivery_date;
    document.getElementById('po-reference').value = po.reference_number || '';

    // Handle Payment Terms Presets vs Custom
    const terms = po.payment_terms || 'Net 30 Days';
    const termsSelect = document.getElementById('po-payment-terms-select');
    const termsInput = document.getElementById('po-payment-terms');
    const presetTerms = ['Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Immediate / Due on Receipt', '50% Advance, 50% on Delivery'];

    if (termsSelect && termsInput) {
      if (presetTerms.includes(terms)) {
        termsSelect.value = terms;
        termsInput.style.display = 'none';
        termsInput.value = terms;
      } else {
        termsSelect.value = 'CUSTOM';
        termsInput.style.display = 'block';
        termsInput.value = terms;
      }
    }

    const loc = po.delivery_location || '';
    const locSelect = document.getElementById('po-location-select');
    const locInput = document.getElementById('po-delivery-location');

    if (locSelect) {
      const presetOptions = ['Main Warehouse, Gate 3', 'East Warehouse, Dock 4', 'HQ Office - 4th Floor', 'IT Operations Room'];
      if (presetOptions.includes(loc)) {
        locSelect.value = loc;
        if (locInput) locInput.style.display = 'none';
      } else if (loc) {
        locSelect.value = 'CUSTOM';
        if (locInput) {
          locInput.style.display = 'block';
          locInput.value = loc;
        }
      }
    }

    document.getElementById('po-notes').value = po.notes || '';
    document.getElementById('additional-charges').value = parseFloat(po.additional_charges || 0).toFixed(2);

    currentStatus = po.status || 'Draft';
    const badge = document.getElementById('form-status-badge');
    if (badge) {
      badge.textContent = currentStatus;
      badge.className = `badge badge-${currentStatus.toLowerCase()}`;
    }

    const cancelBtn = document.getElementById('cancel-po-btn');
    const completeBtn = document.getElementById('complete-po-btn');
    const draftBtn = document.getElementById('draft-po-btn');

    if (currentStatus.toLowerCase() === 'pending' || currentStatus.toLowerCase() === 'submitted') {
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
      if (completeBtn) completeBtn.style.display = 'inline-flex';
    } else if (currentStatus.toLowerCase() === 'draft') {
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    } else if (currentStatus.toLowerCase() === 'completed' || currentStatus.toLowerCase() === 'cancelled') {
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (completeBtn) completeBtn.style.display = 'none';
      if (draftBtn) draftBtn.style.display = 'none';
    }

    // Populate Item Rows
    const tbody = document.getElementById('line-items-body');
    tbody.innerHTML = '';

    if (po.items && po.items.length > 0) {
      po.items.forEach(item => addItemRow(item));
    } else {
      addItemRow();
    }

    updateSupplierState();

  } catch (err) {
    console.error('Load PO for edit error:', err);
    showToast('Failed to load Purchase Order details for editing', 'error');
  }
}

async function savePO(targetStatus) {
  const supplierId = document.getElementById('po-supplier').value;
  const poDate = document.getElementById('po-date').value;
  const deliveryDate = document.getElementById('po-delivery-date').value;

  if (!poDate) {
    showToast('PO Date is required.', 'error');
    return;
  }

  if (!supplierId) {
    showToast('Please select a Supplier.', 'error');
    return;
  }

  if (!deliveryDate) {
    showToast('Expected Delivery Date is required.', 'error');
    return;
  }

  const deliveryLocation = getDeliveryLocationValue();
  if (!deliveryLocation) {
    showToast('Delivery Location is required.', 'error');
    return;
  }

  // Collect line items
  const rows = document.querySelectorAll('.item-line-row');
  const itemsPayload = [];
  let hasItemError = false;

  rows.forEach((row, idx) => {
    const itemIdInput = row.querySelector('.item-id-hidden') || row.querySelector('.item-select');
    const itemId = itemIdInput ? itemIdInput.value : '';
    const qty = parseFloat(row.querySelector('.item-qty').value);
    const price = parseFloat(row.querySelector('.item-price').value);

    if (!itemId) {
      showToast(`Line ${idx + 1}: Please select an Item.`, 'error');
      hasItemError = true;
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      showToast(`Line ${idx + 1}: Quantity must be greater than 0.`, 'error');
      hasItemError = true;
      return;
    }

    const discType = row.querySelector('.item-disc-type') ? row.querySelector('.item-disc-type').value : '$';
    const discVal = parseFloat(row.querySelector('.item-discount').value) || 0;

    let lineDiscountAmount = 0;
    if (discType === '%') {
      lineDiscountAmount = (qty * price * discVal) / 100;
    } else {
      lineDiscountAmount = discVal;
    }

    const itemObj = itemsCatalog.find(i => i.id === itemId);

    itemsPayload.push({
      item_id: itemId,
      item_code: row.querySelector('.item-code').value || itemId,
      item_name: itemObj ? itemObj.name : 'Item',
      description: itemObj ? itemObj.description : '',
      quantity: qty,
      unit: row.querySelector('.item-unit').value || 'Piece',
      unit_price: price || 0,
      discount_type: discType,
      discount_val: discVal,
      discount: lineDiscountAmount,
      tax: parseFloat(row.querySelector('.item-tax').value) || 0
    });
  });

  if (hasItemError) return;

  if (itemsPayload.length === 0) {
    showToast('At least 1 item line is required.', 'error');
    return;
  }

  const finalStatus = targetStatus || currentStatus || 'Draft';

  const payload = {
    id: editingPOId || undefined,
    po_date: poDate,
    supplier_id: supplierId,
    expected_delivery_date: deliveryDate,
    reference_number: document.getElementById('po-reference').value.trim(),
    payment_terms: getPaymentTermsValue(),
    delivery_location: getDeliveryLocationValue(),
    notes: document.getElementById('po-notes').value.trim(),
    additional_charges: parseFloat(document.getElementById('additional-charges').value) || 0,
    status: finalStatus,
    items: itemsPayload
  };

  const method = editingPOId ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/purchase_orders.php', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      let msg = result.message || 'Validation failed';
      if (result.errors) {
        if (result.errors.items_detail) {
          msg = result.errors.items_detail.join('<br>');
        } else {
          msg = Object.values(result.errors).join(', ');
        }
      }
      showToast(msg, 'error', 5000);
      return;
    }

    showToast(`Purchase Order ${result.data.id} saved as ${targetStatus}!`);
    
    setTimeout(() => {
      window.location.href = 'purchase-orders.html';
    }, 1200);

  } catch (err) {
    console.error('Save PO error:', err);
    showToast('Network error while communicating with PHP backend', 'error');
  }
}

function handlePOSubmit(event) {
  event.preventDefault();
  savePO('Pending');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
