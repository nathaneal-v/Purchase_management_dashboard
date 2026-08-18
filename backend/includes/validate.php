<?php
/**
 * validate.php - Server-side Validation Helpers
 */

/**
 * Validate Supplier Data
 */
function validate_supplier($data, $is_update = false) {
    $errors = [];

    if (empty(trim($data['name'] ?? ''))) {
        $errors['name'] = 'Supplier Name is required.';
    }

    if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Invalid email address format.';
    }

    $phone = trim($data['phone'] ?? '');
    $digits_only = preg_replace('/\D/', '', $phone);
    if (empty($phone)) {
        $errors['phone'] = 'Phone number is required.';
    } else if (strlen($digits_only) < 7 || strlen($digits_only) > 15) {
        $errors['phone'] = 'Phone number must contain a valid 7 to 15 digit telephone number.';
    }

    if (empty(trim($data['contact_person'] ?? ''))) {
        $errors['contact_person'] = 'Contact person is required.';
    }

    return $errors;
}

/**
 * Validate Item Data
 */
function validate_item($data, $is_update = false) {
    $errors = [];

    if (empty(trim($data['name'] ?? ''))) {
        $errors['name'] = 'Item Name is required.';
    }

    if (!isset($data['purchase_price']) || !is_numeric($data['purchase_price']) || floatval($data['purchase_price']) < 0) {
        $errors['purchase_price'] = 'Purchase price must be a non-negative number.';
    }

    if (empty(trim($data['unit'] ?? ''))) {
        $errors['unit'] = 'Unit of measurement is required.';
    }

    if (isset($data['tax']) && (!is_numeric($data['tax']) || floatval($data['tax']) < 0 || floatval($data['tax']) > 100)) {
        $errors['tax'] = 'Tax rate must be a percentage between 0 and 100.';
    }

    return $errors;
}

/**
 * Validate Purchase Order Data
 */
function validate_purchase_order($data, $suppliers, $items_catalog, $is_update = false) {
    $errors = [];

    if (empty(trim($data['po_date'] ?? ''))) {
        $errors['po_date'] = 'PO Date is required.';
    }

    if (empty(trim($data['expected_delivery_date'] ?? ''))) {
        $errors['expected_delivery_date'] = 'Expected Delivery Date is required.';
    }

    if (empty(trim($data['delivery_location'] ?? ''))) {
        $errors['delivery_location'] = 'Delivery Location is required.';
    }

    if (empty($data['supplier_id'])) {
        $errors['supplier_id'] = 'Supplier selection is required.';
    } else {
        // Verify supplier exists
        $supplier_exists = false;
        foreach ($suppliers as $s) {
            if ($s['id'] === $data['supplier_id']) {
                $supplier_exists = true;
                break;
            }
        }
        if (!$supplier_exists) {
            $errors['supplier_id'] = 'Selected supplier does not exist in the Master database.';
        }
    }

    // Validate Items array
    if (empty($data['items']) || !is_array($data['items']) || count($data['items']) === 0) {
        $errors['items'] = 'At least one line item is required in the Purchase Order.';
    } else {
        $item_errors = [];
        foreach ($data['items'] as $index => $item) {
            $row_num = $index + 1;
            if (empty($item['item_id'])) {
                $item_errors[] = "Row {$row_num}: Item must be selected.";
            } else {
                // Verify item exists
                $exists = false;
                foreach ($items_catalog as $cat_item) {
                    if ($cat_item['id'] === $item['item_id']) {
                        $exists = true;
                        break;
                    }
                }
                if (!$exists) {
                    $item_errors[] = "Row {$row_num}: Selected item (ID: {$item['item_id']}) does not exist.";
                }
            }

            if (!isset($item['quantity']) || !is_numeric($item['quantity']) || floatval($item['quantity']) <= 0) {
                $item_errors[] = "Row {$row_num}: Quantity must be greater than 0.";
            }

            if (!isset($item['unit_price']) || !is_numeric($item['unit_price']) || floatval($item['unit_price']) < 0) {
                $item_errors[] = "Row {$row_num}: Unit price must be a non-negative number.";
            }
        }

        if (!empty($item_errors)) {
            $errors['items_detail'] = $item_errors;
        }
    }

    return $errors;
}
