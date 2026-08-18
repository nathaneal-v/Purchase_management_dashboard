<?php
/**
 * db.php - Storage and Helper Functions for JSON-based Database (Vercel + Local Host Sync Compatible)
 */

if (!empty($_SERVER['QUERY_STRING'])) {
    $parsed_query = [];
    parse_str($_SERVER['QUERY_STRING'], $parsed_query);
    if (is_array($parsed_query)) {
        $_GET = array_merge($_GET ?? [], $parsed_query);
    }
}

/**
 * Get primary JSON data file path
 */
function get_data_filepath($entity) {
    $candidates = [
        __DIR__ . '/../data/' . $entity . '.json',
        __DIR__ . '/../../backend/data/' . $entity . '.json',
        __DIR__ . '/../../api/data/' . $entity . '.json'
    ];

    foreach ($candidates as $loc) {
        if (file_exists($loc)) {
            return $loc;
        }
    }

    // Fallback to /tmp if no static file exists
    $tmpDir = sys_get_temp_dir();
    return rtrim($tmpDir, '/\\') . '/procurepulse_' . $entity . '.json';
}

/**
 * Send JSON HTTP response with proper headers
 */
function send_json_response($status_code, $payload) {
    http_response_code($status_code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Handle CORS preflight options request
 */
function handle_cors_preflight() {
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
        http_response_code(200);
        exit;
    }
}

/**
 * Read JSON file contents as PHP array
 */
function read_json($entity) {
    $filePath = get_data_filepath($entity);
    if (!file_exists($filePath)) {
        return [];
    }
    $content = @file_get_contents($filePath);
    if ($content === false || empty(trim($content))) {
        return [];
    }
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

/**
 * Write PHP array into JSON file atomically across all storage targets
 */
function write_json($entity, $data) {
    $json_content = json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    // Write to all existing & writable data locations (local disk + Vercel /tmp)
    $tmpDir = sys_get_temp_dir();
    $targetLocations = [
        __DIR__ . '/../data/' . $entity . '.json',
        __DIR__ . '/../../backend/data/' . $entity . '.json',
        __DIR__ . '/../../api/data/' . $entity . '.json',
        rtrim($tmpDir, '/\\') . '/procurepulse_' . $entity . '.json'
    ];

    $writtenCount = 0;
    foreach (array_unique($targetLocations) as $loc) {
        $dir = dirname($loc);
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $res = @file_put_contents($loc, $json_content, LOCK_EX);
        if ($res !== false) {
            $writtenCount++;
        }
    }

    return $writtenCount > 0;
}

/**
 * Auto-generate next sequential code/ID based on prefix
 */
function generate_next_id($entity, $prefix, $start_num = 101) {
    $records = read_json($entity);
    if (empty($records)) {
        return $prefix . '-' . $start_num;
    }

    $max_num = $start_num - 1;
    foreach ($records as $record) {
        if (isset($record['id'])) {
            $id_str = $record['id'];
            $parts = explode('-', $id_str);
            if (count($parts) >= 2 && is_numeric(end($parts))) {
                $num = (int)end($parts);
                if ($num > $max_num) {
                    $max_num = $num;
                }
            }
        }
    }

    return $prefix . '-' . ($max_num + 1);
}

/**
 * Get request input body as array (supports both JSON body and $_POST)
 */
function get_request_data() {
    $input = file_get_contents('php://input');
    if (empty($input)) {
        $input = file_get_contents('php://stdin');
    }
    if (!empty($input)) {
        $decoded = json_decode($input, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return $_POST;
}
