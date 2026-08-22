# RabbitPOS API Endpoint Architecture

Base path: `/api/v1`

Standard response envelope:
```json
{
  "status": "success|error",
  "data": { ... },
  "message": "..."
}
```

---

## 1. Authentication & Users
- `POST /auth/login` — Authenticate user (staff/admin), return JWT token & session info.
- `POST /auth/setup-password` — First-time password setup for accounts with `needs_password_setup = true`.
- `POST /auth/logout` — Invalidate session/token (Protected).
- `GET /auth/me` — Get current authenticated user profile (Protected).

---

## 2. Catalog & Menu Management
- `GET /categories` — List all categories with product count (Protected).
- `POST /categories` — Create a new category (Admin only).
- `PUT /categories/:id` — Update a category (Admin only).
- `DELETE /categories/:id` — Soft-delete a category (Admin only).
- `GET /products` — List all products with variants (Protected, filters: `category_id`, `tag`, `is_active`).
- `GET /products/:id` — Get product detail with variants (Protected).
- `POST /products` — Create product with variants (Admin only).
- `PUT /products/:id` — Update product details (Admin only).
- `DELETE /products/:id` — Delete product (Admin only).
- `POST /products/:id/variants` — Add a new variant to product (Admin only).
- `PUT /variants/:id` — Update variant price/COGS (Admin only).
- `DELETE /variants/:id` — Delete variant (Admin only).

---

## 3. Toppings Management
- `GET /toppings` — List active toppings for POS variant selector (Protected, filter: `category_id`).
- `GET /toppings/all` — List all toppings (active & inactive) for management (Protected).
- `POST /toppings` — Create new topping (Admin only).
- `PUT /toppings/:id` — Update topping name, price, cogs, category_id, is_active (Admin only).
- `DELETE /toppings/:id` — Delete topping (Admin only).

---

## 4. Promotions Engine
- `GET /promotions/active` — List currently active promotions for POS cart application (Protected).
- `GET /promotions` — List all promotions with search, type, and status filters (Admin only).
- `GET /promotions/:id` — Get promotion details (Admin only).
- `POST /promotions` — Create new promotion (Admin only).
- `PUT /promotions/:id` — Update promotion details & active status (Admin only).
- `DELETE /promotions/:id` — Delete promotion (Admin only, protected against deleting promotions linked to orders).

---

## 5. POS & Orders
- `GET /funds` — List active payment funds (Cash, VietQR, Bank, etc.) (Protected).
- `POST /orders` — Create new order with items, toppings snapshots, discounts, fees, and auto-transaction (Protected).
- `GET /orders` — List order history with date range, status, fund, cashier filters (Protected).
- `GET /orders/:id` — Get order detail with items and toppings (Protected).
- `POST /orders/:id/cancel` — Cancel order with reason, optional fund refund, and reverse transaction (Protected).
- `GET /vietqr/generate` — Generate dynamic VietQR code image for an order (Protected).

---

## 6. Financial Ledger & Funds Management
- `GET /transactions` — List transaction history with fund, type, category, date filters (Protected).
- `POST /transactions` — Record manual inflow or outflow transaction (Admin only).
- `PUT /transactions/:id` — Edit manual transaction (adjusts fund balance atomically) (Admin only, blocked for order transactions).
- `DELETE /transactions/:id` — Delete manual transaction (reverts fund balance atomically) (Admin only, blocked for order transactions).
- `GET /transactions/category-breakdown` — Aggregate financial breakdown by category for a period (Protected).
- `GET /transaction-categories` — List transaction categories (Protected, filter: `type`).
- `POST /transaction-categories` — Create custom transaction category (Admin only).
- `PUT /transaction-categories/:id` — Update transaction category (Admin only).
- `DELETE /transaction-categories/:id` — Delete custom transaction category (Admin only, blocked for system categories).
- `GET /funds/:id/balance` — Get theoretical balance vs actual counted balance (Protected).
- `POST /funds/:id/reconcile` — Submit actual balance count and log reconciliation variance (Admin only).
- `GET /funds/period-summary` — Compare funds opening, inflows, outflows, closing balances between periods (Admin only).
- `GET /funds/cashier-shift-summary` — Cashier shift summary of cash collected (Protected).

---

## 7. Business Intelligence & Analytics
- `GET /analytics/revenue` — Aggregate gross sales, discounts, shipping, surcharges, net revenue, AOV, time series (Admin only).
- `GET /analytics/profit` — P&L analysis: Net revenue, COGS, gross profit, operating expenses, net profit, margins (Admin only).
- `GET /analytics/products-ranking` — Menu performance ranking by revenue, profit, quantity, margin with sorting & pagination (Admin only).

---

## 8. System Settings & File Upload
- `GET /settings` — Get all system configuration key-value pairs (Protected).
- `PUT /settings` — Update system configuration (Admin only).
- `POST /upload` — Upload image file (categories, products, store logo) with 5MB limit (Protected).
- `GET /health` — Check service health and PostgreSQL database connectivity (Public).

---

## 9. Inventory Purchases, Ingredients & Recipe BOM Management
- `GET /purchases/ingredients` — List all tracked raw ingredients, fruits, produce, and packaging (Protected).
- `POST /purchases/ingredients` — Create a new raw ingredient with category, unit, yield rate (Admin only).
- `PUT /purchases/ingredients/:id` — Update ingredient name, category, unit, yield rate (Admin only).
- `DELETE /purchases/ingredients/:id` — Delete ingredient (Admin only, checks for active recipe usage).
- `GET /purchases/ingredients/:id/history` — Get purchase invoice history log and unit price fluctuations (Protected).
- `GET /purchases/cost-comparison` — Estimate theoretical COGS for all active product variants and toppings based on BOM recipes vs menu COGS (Protected).
- `POST /purchases/apply-cost` — Single or bulk 1-click update of calculated BOM COGS into menu `product_variants.cogs_price` or `toppings.cogs` (Admin only).
- `GET /purchases/recipes/:target_type/:target_id` — Get BOM recipe items and ingredients for a product variant or topping (Protected).
- `POST /purchases/recipes/:target_type/:target_id` — Save BOM recipe items with usage quantities (Admin only).