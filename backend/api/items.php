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
$items = read_json('items');

switch ($method) {
    case 'GET':
        if ($request_id) {
            foreach ($items as $item) {
                if ($item['id'] === $request_id) {
                    send_json_response(200, ['success' => true, 'data' => $item]);
                }
            }
            send_json_response(404, ['success' => false, 'message' => 'Item not found']);
        }
        send_json_response(200, ['success' => true, 'data' => array_values($items)]);
        break;

    case 'POST':
        $data = get_request_data();
        $errors = validate_item($data);

        if (!empty($errors)) {
            send_json_response(422, ['success' => false, 'errors' => $errors, 'message' => 'Validation failed']);
        }

        $new_id = generate_next_id('items', 'ITM', 101);
        $new_item = [
            'id' => $new_id,
            'name' => trim($data['name']),
            'description' => trim($data['description'] ?? ''),
            'category' => trim($data['category'] ?? 'General'),
            'unit' => trim($data['unit'] ?? 'Piece'),
            'purchase_price' => floatval($data['purchase_price']),
            'tax' => isset($data['tax']) ? floatval($data['tax']) : 0,
            'status' => $data['status'] ?? 'Active'
        ];

        $items[] = $new_item;
        if (write_json('items', $items)) {
            send_json_response(201, ['success' => true, 'data' => $new_item, 'message' => 'Item created successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to save item record']);
        }
        break;

    case 'PUT':
        $data = get_request_data();
        $id = $request_id ?? ($data['id'] ?? null);

        if (!$id) {
            send_json_response(400, ['success' => false, 'message' => 'Item ID is required for update']);
        }

        $errors = validate_item($data, true);
        if (!empty($errors)) {
            send_json_response(422, ['success' => false, 'errors' => $errors, 'message' => 'Validation failed']);
        }

        $found = false;
        foreach ($items as $index => $item) {
            if ($item['id'] === $id) {
                $items[$index] = [
                    'id' => $id,
                    'name' => trim($data['name']),
                    'description' => trim($data['description'] ?? $item['description']),
                    'category' => trim($data['category'] ?? $item['category']),
                    'unit' => trim($data['unit'] ?? $item['unit']),
                    'purchase_price' => floatval($data['purchase_price']),
                    'tax' => isset($data['tax']) ? floatval($data['tax']) : $item['tax'],
                    'status' => $data['status'] ?? $item['status']
                ];
                $found = true;
                $updated_item = $items[$index];
                break;
            }
        }

        if (!$found) {
            send_json_response(404, ['success' => false, 'message' => 'Item not found']);
        }

        if (write_json('items', $items)) {
            send_json_response(200, ['success' => true, 'data' => $updated_item, 'message' => 'Item updated successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to update item record']);
        }
        break;

    case 'DELETE':
        $id = $request_id ?? (get_request_data()['id'] ?? null);
        if (!$id) {
            send_json_response(400, ['success' => false, 'message' => 'Item ID is required for deletion']);
        }

        $filtered = [];
        $found = false;
        foreach ($items as $item) {
            if ($item['id'] === $id) {
                $found = true;
            } else {
                $filtered[] = $item;
            }
        }

        if (!$found) {
            send_json_response(404, ['success' => false, 'message' => 'Item not found']);
        }

        if (write_json('items', $filtered)) {
            send_json_response(200, ['success' => true, 'message' => 'Item deleted successfully']);
        } else {
            send_json_response(500, ['success' => false, 'message' => 'Failed to delete item record']);
        }
        break;

    default:
        send_json_response(405, ['success' => false, 'message' => 'Method Not Allowed']);
        break;
}
