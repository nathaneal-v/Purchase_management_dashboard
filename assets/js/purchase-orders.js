/**
 * purchase-orders.js - Purchase Order List Logic
 */

let purchaseOrdersList = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchPurchaseOrders();
});

async function fetchPurchaseOrders() {
  try {
    const res = await fetch('/api/purchase_orders.php');
    if (!res.ok) throw new Error('Failed to load purchase orders');

    const result = await res.json();
    purchaseOrdersList = result.data || [];
    filterPOList();
  } catch (err) {
    console.error('Fetch PO error:', err);
    showToast('Failed to fetch Purchase Orders from backend', 'error');
  }
}

function filterPOList() {
  const query = (document.getElementById('po-search').value || '').toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;

  const filtered = purchaseOrdersList.filter(po => {
    const matchesSearch =
      po.id.toLowerCase().includes(query) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(query)) ||
      (po.reference_number && po.reference_number.toLowerCase().includes(query));

    const matchesStatus = (statusFilter === 'All') || (po.status || '').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  renderPOTable(filtered);
  document.getElementById('po-count').textContent = filtered.length;
}

function renderPOTable(orders) {
  const tbody = document.getElementById('po-table-body');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">
          No purchase orders found matching filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(po => `
    <tr>
      <td><strong style="color: var(--primary);">${po.id}</strong></td>
      <td>${po.po_date || '-'}</td>
      <td><strong>${escapeHtml(po.supplier_name || 'N/A')}</strong></td>
      <td>${po.expected_delivery_date || '-'}</td>
      <td><strong>$${parseFloat(po.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
      <td><span class="badge badge-${(po.status || 'draft').toLowerCase()}">${po.status}</span></td>
      <td>${escapeHtml(po.created_by || 'Nathaneal')}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn btn-outline btn-sm" onclick="viewPO('${po.id}')">View</button>
        <a href="purchase-order-form.html?id=${po.id}" class="btn btn-outline btn-sm">Edit</a>
        <button class="btn btn-danger btn-sm" onclick="promptDeletePO('${po.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function viewPO(id) {
  const po = purchaseOrdersList.find(o => o.id === id);
  if (!po) return;

  document.getElementById('view-po-id').textContent = po.id;
  document.getElementById('view-po-edit-btn').href = `purchase-order-form.html?id=${po.id}`;

  const cancelBtn = document.getElementById('view-po-cancel-btn');
  if (cancelBtn) {
    if ((po.status || '').toLowerCase() !== 'cancelled') {
      cancelBtn.style.display = 'inline-flex';
      cancelBtn.onclick = () => cancelOrder(po);
    } else {
      cancelBtn.style.display = 'none';
    }
  }

  const content = document.getElementById('po-view-content');
  content.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
      <div>
        <p style="font-size:12px; color:var(--text-muted);">Supplier</p>
        <p style="font-weight:700; font-size:15px; color:var(--text-main);">${escapeHtml(po.supplier_name)}</p>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">PO Date: <strong>${po.po_date}</strong></p>
        <p style="font-size:12px; color:var(--text-muted);">Expected Delivery: <strong>${po.expected_delivery_date}</strong></p>
      </div>
      <div>
        <p style="font-size:12px; color:var(--text-muted);">Status</p>
        <p><span class="badge badge-${(po.status || 'draft').toLowerCase()}">${po.status}</span></p>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Payment Terms: <strong>${escapeHtml(po.payment_terms || 'Net 30')}</strong></p>
        <p style="font-size:12px; color:var(--text-muted);">Reference: <strong>${escapeHtml(po.reference_number || 'N/A')}</strong></p>
      </div>
    </div>

    ${po.delivery_location ? `<p style="font-size:12.5px; margin-bottom: 12px;"><strong>Delivery Location:</strong> ${escapeHtml(po.delivery_location)}</p>` : ''}
    ${po.notes ? `<p style="font-size:12.5px; margin-bottom: 16px; color: var(--text-muted);"><em>Notes: "${escapeHtml(po.notes)}"</em></p>` : ''}

    <h4 style="font-size:14px; margin-bottom: 8px;">Order Line Items</h4>
    <div class="table-container" style="margin-bottom: 16px;">
      <table class="data-table" style="font-size: 12.5px;">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Disc</th>
            <th>Tax</th>
            <th style="text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${(po.items || []).map(item => `
            <tr>
              <td>
                <strong>${escapeHtml(item.item_name)}</strong>
                <div style="font-size:11px; color:var(--text-muted);">${item.item_code}</div>
              </td>
              <td>${item.quantity} ${item.unit}</td>
              <td>$${parseFloat(item.unit_price).toFixed(2)}</td>
              <td>$${parseFloat(item.discount || 0).toFixed(2)}</td>
              <td>${item.tax}%</td>
              <td style="text-align:right;"><strong>$${parseFloat(item.line_total).toFixed(2)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div style="display:flex; justify-content:flex-end;">
      <div style="width:260px; font-size:13px;">
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Subtotal:</span> <span>$${parseFloat(po.subtotal || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; color:var(--danger);"><span>Discount:</span> <span>-$${parseFloat(po.total_discount || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Tax:</span> <span>+$${parseFloat(po.total_tax || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Add. Charges:</span> <span>+$${parseFloat(po.additional_charges || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; font-weight:700; font-size:15px; border-top:1px solid var(--border);">
          <span>Grand Total:</span> <span style="color:var(--primary);">$${parseFloat(po.grand_total || 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('po-view-modal').classList.add('open');
}

function closePOViewModal() {
  document.getElementById('po-view-modal').classList.remove('open');
}

function promptDeletePO(id) {
  document.getElementById('delete-po-id').textContent = id;
  document.getElementById('delete-po-modal').classList.add('open');

  document.getElementById('confirm-delete-po-btn').onclick = async () => {
    try {
      const res = await fetch(`/api/purchase_orders.php?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        showToast(result.message || 'Failed to delete purchase order', 'error');
        return;
      }

      showToast('Purchase order deleted successfully');
      closeDeletePOModal();
      fetchPurchaseOrders();
    } catch (err) {
      console.error('Delete PO error:', err);
      showToast('Error deleting purchase order', 'error');
    }
  };
}

function closeDeletePOModal() {
  document.getElementById('delete-po-modal').classList.remove('open');
}

async function cancelOrder(po) {
  if (!confirm(`Are you sure you want to cancel Purchase Order ${po.id}?`)) return;

  const payload = {
    ...po,
    status: 'Cancelled'
  };

  try {
    const res = await fetch('/api/purchase_orders.php', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      showToast(result.message || 'Failed to cancel purchase order', 'error');
      return;
    }

    showToast(`Purchase Order ${po.id} marked as Cancelled`);
    closePOViewModal();
    fetchPurchaseOrders();
  } catch (err) {
    console.error('Cancel PO error:', err);
    showToast('Error cancelling purchase order', 'error');
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

/* --------------------------------------------------------------------------
   Excel & CSV Document Export Feature
   -------------------------------------------------------------------------- */
function exportPurchaseOrdersExcel() {
  if (!purchaseOrdersList || purchaseOrdersList.length === 0) {
    showToast('No purchase orders available to export', 'error');
    return;
  }

  const exportData = purchaseOrdersList.map(po => {
    const itemsSummary = (po.items || []).map(i => `${i.item_name || i.item_id} (x${i.qty})`).join('; ');

    return {
      'PO Number': po.id || '',
      'PO Date': po.po_date || '',
      'Reference Number': po.reference_number || '',
      'Supplier Code': po.supplier_id || '',
      'Supplier Name': po.supplier_name || '',
      'Delivery Location': po.delivery_location || '',
      'Expected Delivery Date': po.expected_delivery_date || '',
      'Subtotal ($)': parseFloat(po.subtotal || 0).toFixed(2),
      'Tax Amount ($)': parseFloat(po.tax_amount || 0).toFixed(2),
      'Grand Total ($)': parseFloat(po.grand_total || 0).toFixed(2),
      'Status': po.status || 'Draft',
      'Created By': po.created_by || 'Admin User',
      'Items Summary': itemsSummary,
      'Notes & Instructions': po.notes || ''
    };
  });

  try {
    if (window.XLSX) {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");

      const colWidths = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length + 4, 16)
      }));
      worksheet['!cols'] = colWidths;

      const filename = `Purchase_Orders_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      showToast('Purchase Orders exported to Excel (.xlsx) document successfully!');
    } else {
      downloadCSV(exportData);
    }
  } catch (err) {
    console.error('Excel Export Error:', err);
    showToast('Error exporting purchase orders: ' + err.message, 'error');
  }
}

function downloadCSV(exportData) {
  const headers = Object.keys(exportData[0]);
  const csvRows = [headers.join(',')];

  exportData.forEach(row => {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] || '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Purchase_Orders_Export_${new Date().toISOString().split('T')[0]}.csv`);
  link.click();
  showToast('Purchase Orders exported to CSV document successfully!');
}
