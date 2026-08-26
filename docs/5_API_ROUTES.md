# RabbitPOS API Endpoint Architecture

> Base API Path: `/api/v1`  
> Response Format: Standardized JSON Envelope  
> Content-Type: `application/json; charset=utf-8`

```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation completed successfully"
}
```

---

## 1. Authentication & Session

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Authenticate user credentials, returns JWT Bearer token & session |
| `POST` | `/auth/setup-password` | Public | First-time mandatory password setup for newly seeded accounts |
| `POST` | `/auth/logout` | Authenticated | Invalidate current user session |
| `GET` | `/auth/me` | Authenticated | Get current authenticated user profile & role |

---

## 2. Menu Catalog & Auto-Tagging

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Authenticated | List all active categories with product counts |
| `POST` | `/categories` | Admin | Create a new category |
| `PUT` | `/categories/reorder` | Admin | Reorder category display sequence |
| `PUT` | `/categories/:id` | Admin | Update category name, image_url, or status |
| `DELETE` | `/categories/:id` | Admin | Soft-delete category |
| `GET` | `/products` | Authenticated | List products with variants (`category_id`, `tag`, `is_active`) |
| `GET` | `/products/:id` | Authenticated | Get detailed product by ID |
| `POST` | `/products` | Admin | Create new product with variants |
| `PUT` | `/products/:id` | Admin | Update product information |
| `DELETE` | `/products/:id` | Admin | Delete product and associated variants |
| `POST` | `/products/:id/variants` | Admin | Add variant to existing product |
| `PUT` | `/variants/:id` | Admin | Update variant prices (COGS & Retail price) |
| `DELETE` | `/variants/:id` | Admin | Delete variant |
| `GET` | `/products/auto-tag/config` | Admin | Get auto-tagging threshold configuration |
| `PUT` | `/products/auto-tag/config` | Admin | Save auto-tagging rules & thresholds |
| `POST` | `/products/auto-tag/preview` | Admin | Preview products eligible for tags before applying |
| `POST` | `/products/auto-tag/apply` | Admin | Execute auto-tagging engine on active menu |
| `POST` | `/products/auto-tag/toggle-lock` | Admin | Lock/unlock product tag against auto updates |

---

## 3. Dynamic Toppings

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/toppings` | Authenticated | List active toppings for POS variant selector (`category_id`) |
| `GET` | `/toppings/all` | Authenticated | List all toppings (active & inactive) for management |
| `POST` | `/toppings` | Admin | Create new topping with price, COGS, and category scope |
| `PUT` | `/toppings/reorder` | Admin | Reorder topping display sequence |
| `PUT` | `/toppings/:id` | Admin | Update topping details & availability |
| `DELETE` | `/toppings/:id` | Admin | Delete topping |

---

## 4. Promotion Engine

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/promotions/active` | Authenticated | List eligible running promotions for POS cart dropdown |
| `GET` | `/promotions` | Admin | List all promotions with search, type, and status filters |
| `POST` | `/promotions` | Admin | Create new promotional discount or gift campaign |
| `PUT` | `/promotions/reorder` | Admin | Reorder promotion display sequence |
| `PUT` | `/promotions/:id` | Admin | Update promotion campaign settings |
| `DELETE` | `/promotions/:id` | Admin | Delete promotion |

---

## 5. POS & Orders

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/orders` | Authenticated | Create new order (item snapshots, toppings, discounts, auto-inflow) |
| `GET` | `/orders` | Authenticated | List order history (date range, status, fund, cashier) |
| `GET` | `/orders/:id` | Authenticated | Get detailed order with line items & toppings |
| `POST` | `/orders/:id/cancel` | Authenticated | Cancel order with reason, optional fund refund & reverse transaction |
| `GET` | `/vietqr/generate` | Authenticated | Generate dynamic VietQR image for POS customer payment screen |

---

## 6. Financial Ledger & Funds Management

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/funds` | Authenticated | List payment funds (Cash, VietQR, etc.) |
| `GET` | `/funds/:id/balance` | Authenticated | Get theoretical real-time balance |
| `POST` | `/funds/:id/reconcile` | Admin | Submit physical cash count and log variance transaction |
| `GET` | `/funds/period-summary` | Admin | Periodic audit (opening, inflows, outflows, closing balances) |
| `GET` | `/funds/cashier-shift-summary` | Authenticated | Get cashier shift collected cash summary |
| `GET` | `/transactions` | Admin | List ledger transactions with type, fund, date filters |
| `POST` | `/transactions` | Admin | Create manual inflow or outflow transaction |
| `PUT` | `/transactions/:id` | Admin | Edit manual transaction (adjusts fund balance atomically) |
| `DELETE` | `/transactions/:id` | Admin | Delete manual transaction (reverts fund balance atomically) |
| `GET` | `/transactions/category-breakdown` | Admin | Aggregate financial breakdown by category for date range |
| `GET` | `/transaction-categories` | Authenticated | List transaction categories (`type=inflow|outflow`) |
| `POST` | `/transaction-categories` | Admin | Create custom transaction category |
| `PUT` | `/transaction-categories/reorder` | Admin | Reorder transaction categories sequence |
| `PUT` | `/transaction-categories/:id` | Admin | Update transaction category name/type |
| `POST` | `/transaction-categories/:id/set-default` | Admin | Set default selection for quick expense entry |
| `DELETE` | `/transaction-categories/:id` | Admin | Delete custom category (blocked for `is_system=true`) |

---

## 7. Inventory Purchases, Ingredients & Recipe BOM

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/purchases/ingredients` | Authenticated | List tracked raw ingredients, units, and yield rates |
| `POST` | `/purchases/ingredients` | Admin | Create a new raw ingredient |
| `PUT` | `/purchases/ingredients/:id` | Admin | Update ingredient info (unit, yield rate, category) |
| `DELETE` | `/purchases/ingredients/:id` | Admin | Delete ingredient (checks recipe usage) |
| `GET` | `/purchases/ingredients/:id/history` | Authenticated | View purchase invoice history & price trend for ingredient |
| `GET` | `/purchases/cost-comparison` | Authenticated | Compare calculated BOM recipe COGS vs. menu selling COGS |
| `POST` | `/purchases/apply-cost` | Admin | 1-Click update of calculated BOM COGS into menu prices |
| `GET` | `/purchases/recipes/:target_type/:target_id` | Authenticated | Get BOM recipe ingredients for variant or topping |
| `POST` | `/purchases/recipes/:target_type/:target_id` | Admin | Save BOM recipe ingredient ratios |

---

## 8. Executive BI Analytics & Reports

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/analytics/revenue` | Admin | Revenue BI: gross sales, net revenue, discounts, AOV, time-series |
| `GET` | `/analytics/profit` | Admin | P&L Statement: net revenue, COGS, gross/net profit & margins |
| `GET` | `/analytics/products-ranking` | Admin | Menu ranking by volume, revenue, profit with multi-sort & pagination |
| `GET` | `/analytics/products-sales-performance` | Admin | Detailed variant performance metrics |
| `GET` | `/analytics/hourly-distribution` | Admin | Peak sales hours breakdown (0h-23h) |
| `GET` | `/analytics/dashboard` | Admin | High-level KPI summary cards |
| `GET` | `/analytics/top-products` | Admin | Top 5 best-performing items |
| `GET` | `/analytics/cash-flow` | Admin | Daily cash inflow vs outflow comparison |
| `POST` | `/analytics/send-daily-report-email` | Admin | Dispatch on-demand financial summary HTML report via email |

---

## 9. Settings, Integrations, Backup & Import

| Method | Endpoint | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/settings` | Authenticated | Get all system configuration key-value pairs |
| `PUT` | `/settings` | Admin | Update store info, logo, currency, VietQR, email settings |
| `POST` | `/settings/test-smtp` | Admin | Test SMTP server connection and authentication |
| `POST` | `/settings/sheets/test-connection` | Admin | Verify Google Cloud Service Account connection to Google Sheet |
| `POST` | `/settings/sheets/sync-now` | Admin | Trigger immediate 2-way sync with Google Sheets |
| `GET` | `/settings/sheets/status` | Admin | Check Google Sheets synchronization health and last sync time |
| `GET` | `/backup/export` | Admin | Download full PostgreSQL database backup snapshot |
| `POST` | `/backup/restore` | Admin | Restore database snapshot directly from Web UI |
| `GET` | `/import/template` | Admin | Download standard Excel template for catalog data migration |
| `POST` | `/import/excel` | Admin | Upload and import catalog/orders from Excel file |
| `POST` | `/upload` | Authenticated | Upload product/logo image file (max 5MB) |
| `GET` | `/health` | Public | System and database connectivity health probe |