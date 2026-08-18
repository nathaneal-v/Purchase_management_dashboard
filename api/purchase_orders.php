<?php
if (file_exists(__DIR__ . '/includes/db.php')) {
    require_once __DIR__ . '/includes/db.php';
    require_once __DIR__ . '/includes/validate.php';
} else {
    require_once __DIR__ . '/../includes/db.php';
    require_once __DIR__ . '/../includes/validate.php';
}

handle_cors_preflight();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$request_id = $_GET['id'] ?? null;
$status_filter = $_GET['status'] ?? null;
$stats_flag = $_GET['stats'] ?? null;

$purchase_orders = read_json('purchase_orders');
$suppliers = read_json('suppliers');
$items_catalog = read_json('items');

switch ($method) {
    case 'GET':
        // Return summary metrics if stats requested
        if ($stats_flag === 'true') {
            $total_count = count($purchase_orders);
            $draft_count = 0;
            $pending_count = 0;
            $completed_count = 0;
            $cancelled_count = 0;

            foreach ($purchase_orders as $po) {
                $st = strtolower($po['status'] ?? '');
                if ($st === 'draft') $draft_count++;
                elseif ($st === 'pending' || $st === 'submitted') $pending_count++;
                elseif ($st === 'completed') $completed_count++;
                elseif ($st === 'cancelled') $cancelled_count++;
            }

            send_json_response(200, [
                'success' => true,
                'data' => [
                    'total' => $total_count,
                    'draft' => $draft_count,
                    'pending' => $pending_count,
                    'completed' => $completed_count,
                    'cancelled' => $cancelled_count
                ]
            ]);
        }

        if ($request_id) {
            foreach ($purchase_orders as $po) {
                if ($po['id'] === $request_id) {
                    send_json_response(200, ['success' => true, 'data' => $po]);
                }
            }
            send_json_response(404, ['success' => false, 'message' => 'Purchase Order not found']);
        }

        $result = $purchase_orders;
        if (!empty($status_filter) && strtolower($status_filter) !== 'all') {
            $result = array_filter($result, function($po) use ($status_filter) {
                return strtolower($po['status'] ?? '') === strtolower($status_filter);
            });
        }

        send_json_response(200, ['success' => true, 'data' => array_values($result)]);
        break;

    case 'POST':
        $data = get_request_data();

        // Perform server-side validation
        $errors = validate_purchase_order($data, $suppliers, $items_catalog);
        if (!empty($errors)) {
            send_json_response(422, ['success' => false, 'errors' => $errors, 'message' => 'Server validation failed']);
        }

        // Resolve supplier name
        $supplier_name = '';
        foreach ($suppliers as $s) {
            if ($s['id'] === $data['supplier_id']) {
                $supplier_name = $s['name'];
                break;
            }
        }

        // Recalculate line totals and summary totals server-side
        $processed_items = [];
        $subtotal = 0.0;
        $total_discount = 0.0;
        $total_tax = 0.0;

        foreach ($data['items'] as $item) {
            $qty = floatval($item['quantity']);
            $price = floatval($item['unit_price']);
            $disc = isset($item['discount']) ? floatval($item['discount']) : 0;
            $tax_pct = isset($item['tax']) ? floatval($item['tax']) : 0;

            $item_name = $item['item_name'] ?? '';
            $description = $item['description'] ?? '';
            $unit = $item['unit'] ?? 'Piece';

            foreach ($items_catalog as $cat_item) {
                if ($cat_item['id'] === $item['item_id']) {
                    $item_name = $cat_item['name'];
                    $description = $cat_item['description'] ?? '';
                    $unit = $cat_item['unit'] ?? $unit;
                    break;
                }
            }

            $base = $qty * $price;
            $line_tax = (($base - $disc) * $tax_pct) / 100.0;
            if ($line_tax < 0) $line_tax = 0;
            $line_total = ($base - $disc) + $line_tax;

            $subtotal += $base;
            $total_discount += $disc;
            $total_tax += $line_tax;

            $processed_items[] = [
                'item_id' => $item['item_id'],
                'item_code' => $item['item_code'] ?? $item['item_id'],
                'item_name' => $item_name,
                'description' => $description,
                'quantity' => $qty,
                'unit' => $unit,
                'unit_price' => $price,
                'discount' => $disc,
                'tax' => $tax_pct,
                'line_total' => round($line_total, 2)
            ];
        }

        $add_charges = isset($data['additional_charges']) ? floatval($data['additional_charges']) : 0.0;
        $grand_total = ($subtotal - $total_discount) + $total_tax + $add_charges;

        $ref_no = trim($data['reference_number'] ?? '');
        if (empty($ref_no)) {
            $ref_no = 'REF-' . date('Ymd') . '-' . rand(1000, 9999);
        }

        $new_id = generate_next_id('purchase_orders', 'PO', 1001);
        $new_po = [
            'id' => $new_id,
            'po_date' => $data['po_date'],
            'supplier_id' => $data['supplier_id'],
            'supplier_name' => $supplier_name,
            'expected_delivery_date' => $data['expected_delivery_date'],
            'reference_number' => $ref_no,
            'payment_terms' => trim($data['payment_terms'] ?? 'Net 30'),
            'delivery_location' => trim($data['delivery_location'] ?? ''),
            'notes' => trim($data['notes'] ?? ''),
            'status' => $data['status'] ?? 'Draft',
            'created_by' => 'Nathaneal',
            'created_at' => date('Y-m-d H:i:s'),
            'items' => $processed_items,
            'subtotal' => round($subtotal, 2),
            'total_discount' => round($total_discount, 2),
            'total_tax' => round($total_tax, 2),
            'additional_charges' => round($add_charges, 2),
            'grand_total' => round($grand_total, 2)
        ];

        $purchase_orders[] = $new_po;
        if (write_json('purchase_orders', $purchase_orders)) {
            send_json_response(201, ['success' => true, 'data' => $new_po, 'message' => 'Purchase Order created successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to save Purchase Order']);
        }
        break;

    case 'PUT':
        $data = get_request_data();
        $id = $request_id ?? ($data['id'] ?? null);

        if (!$id) {
            send_json_response(400, ['success' => false, 'message' => 'PO Number / ID is required for update']);
        }

        $errors = validate_purchase_order($data, $suppliers, $items_catalog, true);
        if (!empty($errors)) {
            send_json_response(422, ['success' => false, 'errors' => $errors, 'message' => 'Server validation failed']);
        }

        $supplier_name = '';
        foreach ($suppliers as $s) {
            if ($s['id'] === $data['supplier_id']) {
                $supplier_name = $s['name'];
                break;
            }
        }

        $processed_items = [];
        $subtotal = 0.0;
        $total_discount = 0.0;
        $total_tax = 0.0;

        foreach ($data['items'] as $item) {
            $qty = floatval($item['quantity']);
            $price = floatval($item['unit_price']);
            $disc = isset($item['discount']) ? floatval($item['discount']) : 0;
            $tax_pct = isset($item['tax']) ? floatval($item['tax']) : 0;

            $item_name = $item['item_name'] ?? '';
            $description = $item['description'] ?? '';
            $unit = $item['unit'] ?? 'Piece';

            foreach ($items_catalog as $cat_item) {
                if ($cat_item['id'] === $item['item_id']) {
                    $item_name = $cat_item['name'];
                    $description = $cat_item['description'] ?? '';
                    $unit = $cat_item['unit'] ?? $unit;
                    break;
                }
            }

            $base = $qty * $price;
            $line_tax = (($base - $disc) * $tax_pct) / 100.0;
            if ($line_tax < 0) $line_tax = 0;
            $line_total = ($base - $disc) + $line_tax;

            $subtotal += $base;
            $total_discount += $disc;
            $total_tax += $line_tax;

            $processed_items[] = [
                'item_id' => $item['item_id'],
                'item_code' => $item['item_code'] ?? $item['item_id'],
                'item_name' => $item_name,
                'description' => $description,
                'quantity' => $qty,
                'unit' => $unit,
                'unit_price' => $price,
                'discount' => $disc,
                'tax' => $tax_pct,
                'line_total' => round($line_total, 2)
            ];
        }

        $add_charges = isset($data['additional_charges']) ? floatval($data['additional_charges']) : 0.0;
        $grand_total = ($subtotal - $total_discount) + $total_tax + $add_charges;

        $found = false;
        foreach ($purchase_orders as $index => $po) {
            if ($po['id'] === $id) {
                $purchase_orders[$index] = [
                    'id' => $id,
                    'po_date' => $data['po_date'],
                    'supplier_id' => $data['supplier_id'],
                    'supplier_name' => $supplier_name,
                    'expected_delivery_date' => $data['expected_delivery_date'],
                    'reference_number' => trim($data['reference_number'] ?? $po['reference_number']),
                    'payment_terms' => trim($data['payment_terms'] ?? $po['payment_terms']),
                    'delivery_location' => trim($data['delivery_location'] ?? $po['delivery_location']),
                    'notes' => trim($data['notes'] ?? $po['notes']),
                    'status' => $data['status'] ?? $po['status'],
                    'created_by' => $po['created_by'] ?? 'Admin',
                    'created_at' => $po['created_at'] ?? date('Y-m-d H:i:s'),
                    'items' => $processed_items,
                    'subtotal' => round($subtotal, 2),
                    'total_discount' => round($total_discount, 2),
                    'total_tax' => round($total_tax, 2),
                    'additional_charges' => round($add_charges, 2),
                    'grand_total' => round($grand_total, 2)
                ];
                $found = true;
                $updated_po = $purchase_orders[$index];
                break;
            }
        }

        if (!$found) {
            send_json_response(404, ['success' => false, 'message' => 'Purchase Order not found']);
        }

        if (write_json('purchase_orders', $purchase_orders)) {
            send_json_response(200, ['success' => true, 'data' => $updated_po, 'message' => 'Purchase Order updated successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to update Purchase Order']);
        }
        break;

    case 'DELETE':
        $id = $request_id ?? (get_request_data()['id'] ?? null);
        if (!$id) {
            send_json_response(400, ['success' => false, 'message' => 'PO Number / ID is required for deletion']);
        }

        $filtered = [];
        $found = false;
        foreach ($purchase_orders as $po) {
            if ($po['id'] === $id) {
                $found = true;
            } else {
                $filtered[] = $po;
            }
        }

        if (!$found) {
            send_json_response(404, ['success' => false, 'message' => 'Purchase Order not found']);
        }

        if (write_json('purchase_orders', $filtered)) {
            send_json_response(200, ['success' => true, 'message' => 'Purchase Order deleted successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to delete Purchase Order']);
        }
        break;

    default:
        send_json_response(405, ['success' => false, 'message' => 'Method Not Allowed']);
        break;
}
