# RabbitPOS Database Schema Specification

> Database Engine: PostgreSQL 16  
> ORM: GORM (Go)  
> Migration Management: Versioned SQL Migrations (`backend/migrations/000001` - `000018`)

---

## 1. Catalog & Product Domain

### `categories`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique category identifier |
| `name` | VARCHAR(100) | NOT NULL | Category name (e.g. Cà Phê, Trà Sữa) |
| `image_url` | VARCHAR(255) | NULL | Static path or URL to category image |
| `display_order` | INT | DEFAULT 0 | Sorting priority in POS navigation bar |
| `is_active` | BOOLEAN | DEFAULT true | Soft-enable toggle |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `products`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique product identifier |
| `category_id` | BIGINT | FK -> `categories.id` | Associated category |
| `name` | VARCHAR(200) | NOT NULL | Product name |
| `description` | TEXT | NULL | Marketing description / recipe notes |
| `image_url` | VARCHAR(255) | NULL | Uploaded image path |
| `tag` | VARCHAR(50) | DEFAULT 'none' | Tag value (`none`, `best_seller`, `new`, `signature`) |
| `is_tag_locked` | BOOLEAN | DEFAULT false | Locks tag from Auto-Tagging engine updates |
| `is_active` | BOOLEAN | DEFAULT true | Active status in POS grid |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `product_variants`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique variant identifier |
| `product_id` | BIGINT | FK -> `products.id` ON DELETE CASCADE | Parent product |
| `variant_name` | VARCHAR(100) | NOT NULL | Size / option (e.g., "Size M", "Size L", "Chai 500ml") |
| `cogs_price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Cost of Goods Sold (Giá vốn) |
| `retail_price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Menu retail selling price |
| `sku` | VARCHAR(50) | UNIQUE, NULL | Stock keeping unit barcode |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `toppings`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique topping identifier |
| `name` | VARCHAR(100) | NOT NULL | Topping name (e.g., Trân châu hoàng kim) |
| `price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Selling price |
| `cogs` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Cost of goods |
| `category_id` | BIGINT | FK -> `categories.id`, NULL | Category scope (NULL = Global Topping) |
| `display_order` | INT | DEFAULT 0 | Sorting order |
| `is_active` | BOOLEAN | DEFAULT true | Availability toggle |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

## 2. Promotions & Discount Domain

### `promotions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique promotion identifier |
| `name` | VARCHAR(255) | NOT NULL | Campaign name |
| `promo_type` | VARCHAR(50) | NOT NULL | `discount_amount`, `discount_percent`, `gift_item` |
| `discount_value` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Amount in VND or Percentage (%) |
| `min_order_amount` | NUMERIC(15,2) | DEFAULT 0.00 | Minimum order threshold |
| `min_quantity` | INT | DEFAULT 0 | Minimum items in cart |
| `scope` | VARCHAR(50) | NOT NULL, DEFAULT 'all' | `all`, `category`, `product` |
| `target_ids` | JSONB | DEFAULT '[]' | Target category/product IDs |
| `gift_product_variant_id` | BIGINT | FK -> `product_variants.id`, NULL | Gifted item variant |
| `start_date` | TIMESTAMPTZ | NULL | Effective start timestamp |
| `end_date` | TIMESTAMPTZ | NULL | Expiration timestamp |
| `usage_limit` | INT | NULL | Max usage limit across system |
| `usage_count` | INT | DEFAULT 0 | Atomic counter of applied orders |
| `display_order` | INT | DEFAULT 0 | Display sequence |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

## 3. Orders & Cashier Domain

### `orders`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique order record |
| `order_code` | VARCHAR(50) | UNIQUE, NOT NULL | Standard code (e.g. `ORD-20260827-012011-0042`) |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'completed' | `pending`, `completed`, `cancelled` |
| `subtotal` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Raw sum of items & toppings |
| `discount_amount` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Manual cashier discount |
| `promotion_id` | BIGINT | FK -> `promotions.id` ON DELETE SET NULL | Applied promotion |
| `promotion_discount` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Promotion discount value |
| `shipping_fee` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Delivery / shipping fee |
| `platform_fee_discount` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Partner platform fee discount |
| `surcharge` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Holiday / night surcharge |
| `total_amount` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Final billed amount |
| `fund_id` | BIGINT | FK -> `funds.id` | Target payment fund |
| `created_by` | VARCHAR(100) | DEFAULT 'cashier' | User identity |
| `cashier_id` | BIGINT | FK -> `users.id`, NULL | Cashier user reference |
| `cashier_name` | VARCHAR(100) | DEFAULT '' | Cashier display name |
| `cancel_reason` | TEXT | NULL | Cancellation reason note |
| `cancelled_at` | TIMESTAMPTZ | NULL | Cancellation timestamp |
| `note` | TEXT | NULL | Special customer instructions / order note |
| `created_at` | TIMESTAMPTZ | NOT NULL | Order creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `order_items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique item line |
| `order_id` | BIGINT | FK -> `orders.id` ON DELETE CASCADE | Associated order |
| `product_variant_id` | BIGINT | FK -> `product_variants.id` | Ordered drink variant |
| `quantity` | INT | NOT NULL, DEFAULT 1 | Item quantity |
| `unit_price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Unit price snapshot |
| `line_total` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Line total (unit_price * qty + toppings) |
| `selected_toppings` | JSONB | NOT NULL, DEFAULT '[]' | JSON snapshot of toppings |
| `toppings_price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Total toppings fee per line |
| `notes` | TEXT | NULL | Sugar / ice / customization notes |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

## 4. Financial Ledger & Funds Domain

### `funds`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique fund repository |
| `name` | VARCHAR(100) | NOT NULL | Fund name (e.g., Tiền mặt tại quầy, MBBank VietQR) |
| `fund_type` | VARCHAR(50) | NOT NULL | `cash`, `bank`, `e-wallet` |
| `current_balance` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Real-time theoretical cash balance |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `transaction_categories`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique category ID |
| `name` | VARCHAR(100) | NOT NULL | Category name |
| `type` | VARCHAR(20) | NOT NULL | `outflow`, `inflow`, `both` |
| `code` | VARCHAR(50) | NULL | Short code identifier |
| `is_system` | BOOLEAN | NOT NULL, DEFAULT false | System category protection toggle |
| `display_order` | INT | DEFAULT 0 | Sorting position |
| `is_default` | BOOLEAN | DEFAULT false | Default selection flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `transactions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique ledger transaction |
| `fund_id` | BIGINT | FK -> `funds.id` | Associated fund |
| `transaction_type` | VARCHAR(20) | NOT NULL | `inflow`, `outflow` |
| `category` | VARCHAR(100) | NOT NULL | `sale`, `ingredient_purchase`, `utility_bill`, `reconciliation_variance`, custom category |
| `amount` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Transaction amount in VND |
| `reference_order_id` | BIGINT | FK -> `orders.id` ON DELETE SET NULL, NULL | Linked POS order |
| `description` | TEXT | NULL | Detailed notes |
| `created_by` | VARCHAR(100) | DEFAULT 'cashier' | Author string |
| `cashier_id` | BIGINT | FK -> `users.id`, NULL | Author user reference |
| `cashier_name` | VARCHAR(100) | DEFAULT '' | Author display name |
| `created_at` | TIMESTAMPTZ | NOT NULL | Transaction timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

## 5. Raw Ingredients, Purchases & Recipe BOM Domain

### `ingredients`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique raw ingredient |
| `name` | VARCHAR(200) | UNIQUE, NOT NULL | Ingredient name (e.g., Cam sành, Cà rốt, Ly nhựa 500ml) |
| `category` | VARCHAR(50) | NOT NULL, DEFAULT 'fruit' | `fruit`, `ingredient`, `packaging`, `other` |
| `unit` | VARCHAR(50) | NOT NULL, DEFAULT 'kg' | Base unit (`kg`, `g`, `ml`, `lít`, `lon`, `cái`) |
| `yield_rate` | NUMERIC(5,4) | NOT NULL, DEFAULT 1.0000 | Extraction / edible yield (e.g., 0.45 for Cam sành) |
| `latest_purchase_price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Most recent purchase price per unit |
| `average_purchase_price` | NUMERIC(15,2) | NOT NULL, DEFAULT 0.00 | Weighted average purchase price |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `purchase_items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique purchase line item |
| `transaction_id` | BIGINT | FK -> `transactions.id` ON DELETE CASCADE | Associated cash outflow transaction |
| `ingredient_id` | BIGINT | FK -> `ingredients.id` ON DELETE CASCADE | Purchased ingredient |
| `quantity` | NUMERIC(12,4) | NOT NULL | Purchased quantity in base unit |
| `unit` | VARCHAR(50) | DEFAULT '' | Measurement unit |
| `unit_price` | NUMERIC(15,2) | NOT NULL | Unit purchase price in VND |
| `subtotal` | NUMERIC(15,2) | NOT NULL | quantity * unit_price |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `recipe_items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique BOM ingredient ratio |
| `product_variant_id` | BIGINT | FK -> `product_variants.id` ON DELETE CASCADE, NULL | Linked drink variant |
| `topping_id` | BIGINT | FK -> `toppings.id` ON DELETE CASCADE, NULL | Linked topping |
| `ingredient_id` | BIGINT | FK -> `ingredients.id` ON DELETE CASCADE | Required raw ingredient |
| `usage_quantity` | NUMERIC(12,4) | NOT NULL | Required quantity per portion/serving |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

## 6. Users & Settings Domain

### `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique user account |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| `password` | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| `role` | VARCHAR(20) | NOT NULL | `admin`, `cashier` (staff) |
| `email` | VARCHAR(255) | NULL | Administrator email for automated daily reports |
| `needs_password_setup` | BOOLEAN | DEFAULT false | Enforces first-time password change |
| `is_active` | BOOLEAN | DEFAULT true | User account active toggle |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### `settings`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | Unique configuration item |
| `key` | VARCHAR(100) | UNIQUE, NOT NULL | Config key (e.g. `store_name`, `google_sheets_spreadsheet_id`) |
| `value` | TEXT | NOT NULL | JSON or string value |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

---

## 7. Performance Composite Indexes

The database includes optimized composite indexes defined in migrations `000013` and `000015`:

```sql
-- Orders & BI Analytics indexing
CREATE INDEX IF NOT EXISTS idx_orders_analytics ON orders (status, created_at, fund_id);
CREATE INDEX IF NOT EXISTS idx_order_items_perf ON order_items (order_id, product_variant_id);

-- Transactions & Fund balance indexing
CREATE INDEX IF NOT EXISTS idx_transactions_perf ON transactions (fund_id, transaction_type, created_at);

-- POS Menu & Toppings catalog indexing
CREATE INDEX IF NOT EXISTS idx_products_active_cat ON products (is_active, category_id);
CREATE INDEX IF NOT EXISTS idx_toppings_active_cat ON toppings (is_active, category_id);
```