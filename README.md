# ProcurePulse - ERP Purchase Management Dashboard

A production-quality, full-stack **Purchase Management Dashboard** designed for ERP-style enterprise procurement. Features a modern responsive UI, dynamic Chart.js dashboards, dynamic multi-item Purchase Order creation with live financial calculations, complete Supplier & Item master data management, and PHP backend REST JSON APIs backed by file-based JSON database storage.

---

## Key Features

- 📊 **Dynamic Purchase Dashboard:** Overview cards for Total, Draft, Pending, and Completed POs computed live from the backend JSON database. Features a Chart.js donut chart for status distribution and a recent PO activity feed.
- 📝 **Purchase Order Module:**
  - Dynamic multi-item line details table (Add/Remove rows without page reload).
  - Auto-fills Item Code, Description, Unit of Measure, and standard Purchase Price on item selection.
  - Real-time client-side financial calculations: Subtotal, Line Discounts, Line Taxes, Additional Shipping Charges, and Grand Total.
  - Dual action buttons: **Save as Draft** (`Draft` status) and **Submit Order** (`Pending` status).
  - Search, status filtering, and interactive quick-view modal.
- 🏢 **Supplier Master:** Full CRUD interface for vendor management, contact persons, tax/VAT numbers, and default payment terms (`Net 15`, `Net 30`, `Net 60`).
- 📦 **Item Master Catalog:** Full CRUD interface for item catalog management, categories, units of measure, purchase pricing, and tax rates.
- 🔒 **Server-Side Validation:** All business logic, ID generation (`PO-1001`, `SUP-101`, `ITM-101`), and data validation are enforced in PHP, returning structured JSON error payloads with proper HTTP status codes.
- 🚀 **Zero-Config Local PHP Execution:** Includes a lightweight Node dev server utilizing `@php-wasm/cli` so you can run and test the complete PHP stack locally without pre-installing system PHP binaries.

---

## Tech Stack & Architecture

- **Frontend:** HTML5, Vanilla CSS3 (Custom ERP Design System with CSS Variables, modern flexbox & grid layouts), Vanilla JavaScript (ES6+ Modules, Fetch API, DOM manipulation).
- **Backend:** PHP (Procedural/OOP JSON REST endpoints).
- **Database:** JSON File Storage (`backend/data/purchase_orders.json`, `suppliers.json`, `items.json`) with file-locking (`flock`) for atomic read/write operations.
- **Deployment:** Pre-configured for Vercel with `vercel.json` (`vercel-php` serverless function runtime).

### Directory Structure

```
purchase_management/
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   │   └── style.css               # Primary ERP styling, variables, components, badges
│   │   └── js/
│   │       ├── sidebar.js             # Reusable shared sidebar and topbar component
│   │       ├── toast.js               # Unified toast notification helper
│   │       ├── dashboard.js           # Dashboard metrics & Chart.js graph integration
│   │       ├── purchase-orders.js     # PO list view, status filter & delete prompt
│   │       ├── purchase-order-form.js # Form header, dynamic item rows & live math
│   │       ├── suppliers.js           # Supplier Master CRUD & modal logic
│   │       └── items.js               # Item Master CRUD & modal logic
│   ├── index.html                     # Purchase Dashboard (Home)
│   ├── purchase-orders.html           # PO List Page
│   ├── purchase-order-form.html       # Create/Edit PO Form Page
│   ├── suppliers.html                 # Supplier Master Page
│   └── items.html                     # Item Master Page
├── backend/
│   ├── api/
│   │   ├── purchase_orders.php        # PO REST API (GET, POST, PUT, DELETE)
│   │   ├── suppliers.php              # Supplier REST API (GET, POST, PUT, DELETE)
│   │   └── items.php                  # Item REST API (GET, POST, PUT, DELETE)
│   ├── data/
│   │   ├── purchase_orders.json       # PO database records
│   │   ├── suppliers.json             # Supplier database records
│   │   └── items.json                 # Item database records
│   └── includes/
│       ├── db.php                     # Atomic JSON read/write & sequential ID generator
│       └── validate.php               # Server-side validation functions
├── server.js                           # Node local dev server (Bridges PHP API via PHP-WASM)
├── vercel.json                         # Vercel deployment configuration
├── package.json                        # Node dependencies (Express)
└── README.md                           # Documentation & Setup guide
```

---

## Local Quickstart Guide

### Prerequisites
- Node.js (v18+ recommended)

### Running the Application

1. Clone or navigate to the project directory:
   ```bash
   cd purchase_management
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm start
   ```

4. Open your browser at:
   [http://localhost:3000](http://localhost:3000)

*Note: The Node server automatically routes requests under `/backend/api/*.php` through PHP-WASM CLI, making local testing completely self-contained.*

---

## API Endpoints Reference

### 1. Purchase Orders (`/backend/api/purchase_orders.php`)
- `GET /backend/api/purchase_orders.php` - List all POs (Supports `?status=Draft` or `?stats=true`).
- `GET /backend/api/purchase_orders.php?id=PO-1001` - Fetch single PO by ID.
- `POST /backend/api/purchase_orders.php` - Create a new PO (Calculates totals & validates server-side).
- `PUT /backend/api/purchase_orders.php` - Update existing PO.
- `DELETE /backend/api/purchase_orders.php?id=PO-1001` - Delete PO record.

### 2. Suppliers (`/backend/api/suppliers.php`)
- `GET /backend/api/suppliers.php` - List all suppliers (or `?id=SUP-101`).
- `POST /backend/api/suppliers.php` - Create supplier (Auto-generates `SUP-xxx` ID).
- `PUT /backend/api/suppliers.php` - Update supplier.
- `DELETE /backend/api/suppliers.php?id=SUP-101` - Delete supplier.

### 3. Items (`/backend/api/items.php`)
- `GET /backend/api/items.php` - List all catalog items (or `?id=ITM-101`).
- `POST /backend/api/items.php` - Create catalog item (Auto-generates `ITM-xxx` ID).
- `PUT /backend/api/items.php` - Update item.
- `DELETE /backend/api/items.php?id=ITM-101` - Delete item.

---

## Vercel Deployment Instructions

1. Push your repository to GitHub.
2. Import the repository into your Vercel Dashboard.
3. Vercel will automatically detect `vercel.json` and configure the static frontend routing alongside serverless PHP function endpoints (`vercel-php@0.6.0`).
4. Deploy and access your live application!
