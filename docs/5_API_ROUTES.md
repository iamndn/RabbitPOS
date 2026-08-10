## 2. API Endpoint Architecture
 
Base path: `/api/v1`
Response envelope (per project rules): `{ "status": "success|error", "data": {...}, "message": "..." }`
 
### 2.1 Catalog
- `GET /categories` — List all categories.
- `POST /categories` — Create a new category.
- `PUT /categories/:id` — Update a category.
- `DELETE /categories/:id` — Soft-delete a category.
- `GET /products` — List products (supports filters: category_id, tag, is_active).
- `GET /products/:id` — Get product details with variants.
- `POST /products` — Create a product with initial variant(s).
- `PUT /products/:id` — Update product info.
- `DELETE /products/:id` — Soft-delete a product.
- `POST /products/:id/variants` — Add a variant to a product.
- `PUT /variants/:id` — Update a variant (price/COGS).
- `DELETE /variants/:id` — Soft-delete a variant.
### 2.2 POS / Orders
- `GET /funds` — List active funds (for checkout selection).
- `POST /orders` — Create a new order (cart items + selected fund) and trigger inflow transaction.
- `GET /orders` — List orders (filter by date range, status, fund).
- `GET /orders/:id` — Get order detail with items.
- `PUT /orders/:id/cancel` — Cancel an order and reverse its transaction.
### 2.3 Financial Ledger
- `GET /transactions` — List transactions (filter by fund_id, type, date range).
- `POST /transactions` — Manually log an outflow (or manual inflow).
- `GET /funds/:id/balance` — Get theoretical balance vs. reconciled actual balance.
- `POST /funds/:id/reconcile` — Submit actual counted balance and log variance.
### 2.4 Analytics & Reporting
- `GET /analytics/dashboard` — Aggregate revenue, gross profit, expenses for a date range.
- `GET /analytics/top-products` — Top-selling products/variants for a date range.
- `GET /analytics/cash-flow` — Inflow vs. outflow summary by fund/date.
### 2.5 Auth (assumed baseline, not detailed in roadmap scope)
- `POST /auth/login` — Authenticate staff/admin user.
- `POST /auth/logout` — Invalidate session/token.
- `GET /auth/me` — Get current authenticated user profile.