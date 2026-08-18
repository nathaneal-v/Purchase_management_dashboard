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
$suppliers = read_json('suppliers');

switch ($method) {
    case 'GET':
        if ($request_id) {
            foreach ($suppliers as $s) {
                if ($s['id'] === $request_id) {
                    send_json_response(200, ['success' => true, 'data' => $s]);
                }
            }
            send_json_response(404, ['success' => false, 'message' => 'Supplier not found']);
        }
        send_json_response(200, ['success' => true, 'data' => array_values($suppliers)]);
        break;

    case 'POST':
        $data = get_request_data();
        $errors = validate_supplier($data);

        if (!empty($errors)) {
            send_json_response(422, ['success' => false, 'errors' => $errors, 'message' => 'Validation failed']);
        }

        $new_id = generate_next_id('suppliers', 'SUP', 101);
        $new_supplier = [
            'id' => $new_id,
            'name' => trim($data['name']),
            'contact_person' => trim($data['contact_person'] ?? ''),
            'phone' => trim($data['phone'] ?? ''),
            'email' => trim($data['email'] ?? ''),
            'address' => trim($data['address'] ?? ''),
            'tax_number' => trim($data['tax_number'] ?? ''),
            'payment_terms' => trim($data['payment_terms'] ?? 'Net 30'),
            'status' => $data['status'] ?? 'Active'
        ];

        $suppliers[] = $new_supplier;
        if (write_json('suppliers', $suppliers)) {
            send_json_response(201, ['success' => true, 'data' => $new_supplier, 'message' => 'Supplier created successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to save supplier record']);
        }
        break;

    case 'PUT':
        $data = get_request_data();
        $id = $request_id ?? ($data['id'] ?? null);

        if (!$id) {
            send_json_response(400, ['success' => false, 'message' => 'Supplier ID is required for update']);
        }

        $errors = validate_supplier($data, true);
        if (!empty($errors)) {
            send_json_response(422, ['success' => false, 'errors' => $errors, 'message' => 'Validation failed']);
        }

        $found = false;
        foreach ($suppliers as $index => $s) {
            if ($s['id'] === $id) {
                $suppliers[$index] = [
                    'id' => $id,
                    'name' => trim($data['name']),
                    'contact_person' => trim($data['contact_person'] ?? $s['contact_person']),
                    'phone' => trim($data['phone'] ?? $s['phone']),
                    'email' => trim($data['email'] ?? $s['email']),
                    'address' => trim($data['address'] ?? $s['address']),
                    'tax_number' => trim($data['tax_number'] ?? $s['tax_number']),
                    'payment_terms' => trim($data['payment_terms'] ?? $s['payment_terms']),
                    'status' => $data['status'] ?? $s['status']
                ];
                $found = true;
                $updated_supplier = $suppliers[$index];
                break;
            }
        }

        if (!$found) {
            send_json_response(404, ['success' => false, 'message' => 'Supplier not found']);
        }

        if (write_json('suppliers', $suppliers)) {
            send_json_response(200, ['success' => true, 'data' => $updated_supplier, 'message' => 'Supplier updated successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to update supplier record']);
        }
        break;

    case 'DELETE':
        $id = $request_id ?? (get_request_data()['id'] ?? null);
        if (!$id) {
            send_json_response(400, ['success' => false, 'message' => 'Supplier ID is required for deletion']);
        }

        $filtered = [];
        $found = false;
        foreach ($suppliers as $s) {
            if ($s['id'] === $id) {
                $found = true;
            } else {
                $filtered[] = $s;
            }
        }

        if (!$found) {
            send_json_response(404, ['success' => false, 'message' => 'Supplier not found']);
        }

        if (write_json('suppliers', $filtered)) {
            send_json_response(200, ['success' => true, 'message' => 'Supplier deleted successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to delete supplier record']);
        }
        break;

    default:
        send_json_response(405, ['success' => false, 'message' => 'Method Not Allowed']);
        break;
}
