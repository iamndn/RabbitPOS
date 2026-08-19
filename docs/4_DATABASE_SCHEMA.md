# RabbitPOS Database Schema Design

## 1. Catalog Domain

### `categories`
- `id` (PK, BIGSERIAL)
- `name` (VARCHAR(100), NOT NULL)
- `image_url` (VARCHAR(255), NULL)
- `display_order` (INT, DEFAULT 0)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `products`
- `id` (PK, BIGSERIAL)
- `category_id` (BIGINT, FK -> `categories.id`)
- `name` (VARCHAR(200), NOT NULL)
- `description` (TEXT)
- `image_url` (VARCHAR(255), NULL)
- `tag` (VARCHAR(50), DEFAULT 'none') — Values: `none`, `best_seller`, `new`
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `product_variants`
- `id` (PK, BIGSERIAL)
- `product_id` (BIGINT, FK -> `products.id`)
- `variant_name` (VARCHAR(100), NOT NULL) — e.g., "Size M", "Size L"
- `cogs_price` (NUMERIC(10,2), NOT NULL, DEFAULT 0.00)
- `retail_price` (NUMERIC(10,2), NOT NULL, DEFAULT 0.00)
- `sku` (VARCHAR(50), UNIQUE)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `toppings`
- `id` (PK, BIGSERIAL)
- `name` (VARCHAR(100), NOT NULL)
- `price` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `cogs` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `category_id` (BIGINT, NULL, FK -> `categories.id`) — NULL means Global Topping applicable to all products
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## 2. Promotions Domain

### `promotions`
- `id` (PK, BIGSERIAL)
- `name` (VARCHAR(255), NOT NULL)
- `promo_type` (VARCHAR(50), NOT NULL) — `discount_amount`, `discount_percent`, `gift_item`
- `discount_value` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `min_order_amount` (NUMERIC(15,2), DEFAULT 0.00)
- `min_quantity` (INT, DEFAULT 0)
- `scope` (VARCHAR(50), NOT NULL, DEFAULT 'all') — `all`, `category`, `product`
- `target_ids` (JSONB, DEFAULT '[]')
- `gift_product_variant_id` (BIGINT, NULL, FK -> `product_variants.id`)
- `start_date` (TIMESTAMPTZ, NULL)
- `end_date` (TIMESTAMPTZ, NULL)
- `usage_limit` (INT, NULL)
- `usage_count` (INT, DEFAULT 0)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## 3. Order & Cashier Domain

### `orders`
- `id` (PK, BIGSERIAL)
- `order_code` (VARCHAR(50), UNIQUE, NOT NULL) — e.g. `ORD-20260811-153045-0012`
- `status` (VARCHAR(30), NOT NULL, DEFAULT 'completed') — `pending`, `completed`, `cancelled`
- `subtotal` (NUMERIC(12,2), NOT NULL, DEFAULT 0.00)
- `discount_amount` (NUMERIC(12,2), NOT NULL, DEFAULT 0.00)
- `promotion_id` (BIGINT, NULL, FK -> `promotions.id` ON DELETE SET NULL)
- `promotion_discount` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `shipping_fee` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `platform_fee_discount` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `surcharge` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `total_amount` (NUMERIC(12,2), NOT NULL, DEFAULT 0.00)
- `fund_id` (BIGINT, NOT NULL, FK -> `funds.id`)
- `created_by` (VARCHAR(100), DEFAULT 'cashier')
- `cashier_id` (BIGINT, NULL, FK -> `users.id`)
- `cashier_name` (VARCHAR(100), DEFAULT '')
- `cancel_reason` (TEXT, NULL)
- `cancelled_at` (TIMESTAMPTZ, NULL)
- `note` (TEXT, NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `order_items`
- `id` (PK, BIGSERIAL)
- `order_id` (BIGINT, NOT NULL, FK -> `orders.id` ON DELETE CASCADE)
- `product_variant_id` (BIGINT, NOT NULL, FK -> `product_variants.id`)
- `quantity` (INT, NOT NULL, DEFAULT 1)
- `unit_price` (NUMERIC(10,2), NOT NULL, DEFAULT 0.00)
- `line_total` (NUMERIC(10,2), NOT NULL, DEFAULT 0.00)
- `selected_toppings` (JSONB, NOT NULL, DEFAULT '[]')
- `toppings_price` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `notes` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## 4. Financial Ledger & Funds Domain

### `funds`
- `id` (PK, BIGSERIAL)
- `name` (VARCHAR(100), NOT NULL) — e.g. "Tiền mặt tại quầy", "Tài khoản VietQR"
- `fund_type` (VARCHAR(50), NOT NULL) — `cash`, `bank`, `e-wallet`
- `current_balance` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `transaction_categories`
- `id` (PK, BIGSERIAL)
- `name` (VARCHAR(100), NOT NULL)
- `type` (VARCHAR(20), NOT NULL) — `outflow`, `inflow`, `both`
- `code` (VARCHAR(50), NULL)
- `is_system` (BOOLEAN, NOT NULL, DEFAULT false)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `transactions`
- `id` (PK, BIGSERIAL)
- `fund_id` (BIGINT, NOT NULL, FK -> `funds.id`)
- `transaction_type` (VARCHAR(20), NOT NULL) — `inflow`, `outflow`
- `category` (VARCHAR(100), NOT NULL) — `sale`, `ingredient_purchase`, `utility_bill`, `reconciliation_variance`, `other` or dynamic custom category
- `amount` (NUMERIC(15,2), NOT NULL, DEFAULT 0.00)
- `reference_order_id` (BIGINT, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `description` (TEXT)
- `created_by` (VARCHAR(100), DEFAULT 'cashier')
- `cashier_id` (BIGINT, NULL, FK -> `users.id`)
- `cashier_name` (VARCHAR(100), DEFAULT '')
- `created_at`, `updated_at` (TIMESTAMPTZ)

---

## 5. Users & System Settings

### `users`
- `id` (PK, BIGSERIAL)
- `username` (VARCHAR(50), UNIQUE, NOT NULL)
- `password` (VARCHAR(255), NOT NULL)
- `role` (VARCHAR(20), NOT NULL) — `admin`, `cashier`
- `needs_password_setup` (BOOLEAN, DEFAULT false)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### `settings`
- `id` (PK, BIGSERIAL)
- `key` (VARCHAR(100), UNIQUE, NOT NULL)
- `value` (TEXT, NOT NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)