# RabbitPOS Development Roadmap & Milestone History

## Phase 1: Core Data, Catalog & Auth Setup (Completed)
- **Database:** PostgreSQL schemas for `categories`, `products`, `product_variants`, `funds`, `users`.
- **Features:**
  - First-time password setup workflow for seeded cashier accounts (`NDN`, `NHUNG`, `DAT`).
  - Cashier identification stamped into orders and transactions (`cashier_id`, `cashier_name`).
  - Store logo upload and system branding settings.
  - Fix for leading zero and backspace sticking input glitch.

## Phase 2: Sugar/Ice Tiers & Dynamic Toppings (Completed)
- **Database:** `toppings` schema with pricing, COGS, category/global scope, and display order.
- **Features:**
  - 5 standardized sugar & ice presets (`100%`, `70%`, `50%`, `30%`, `0%`).
  - Dynamic toppings selector with snapshot preservation in `order_items.selected_toppings` (JSONB).
  - Thermal receipt printing format with item modifiers and toppings.

## Phase 3: Promotion Engine & POS Cart Flexibility (Completed)
- **Database:** `promotions` schema with types (`discount_amount`, `discount_percent`, `gift_item`), scope, and usage limits.
- **Features:**
  - Active promotion selector in POS cart.
  - Inline price override per cart item.
  - Flexible fee adjusters: manual discount, platform fee discount, shipping fee, holiday surcharge.
  - Order cancellation modal with optional automated fund refund.
  - 1-click re-order to restore past orders into active cart.

## Phase 4: BI Analytics, Funds Audit & Dynamic Categories (Completed)
- **Database:** `transaction_categories` schema with `is_system` protection.
- **Features:**
  - Executive Dual-Tab BI Dashboard: Sales Revenue analytics & Profit & Loss (P&L) statement.
  - All products ranking modal with multi-criteria sorting and CSV export.
  - Periodic funds balance audit table with period-over-period variance tracking.
  - Dynamic transaction category management and manual transaction edit/delete with atomic fund balance adjustments.

## Phase 5: UI/UX Modernization & Order Notes (Completed)
- **Features:**
  - Order notes support across database (`orders.note`), POS cart drawer, and thermal receipts.
  - User Profile dropdown menu with avatar, role badge, language toggle, and logout.
  - Clean login screen displaying dynamic store logo and brand title.
  - Reusable `ModernDateRangePicker` component with date shortcuts.
  - Full cart state reset on order completion.

## Phase 6: Internationalization (i18n) & Operational Enhancements (Completed)
- **Features:**
  - Complete bilingual support (Vietnamese & English) via `LanguageContext` and JSON dictionaries.
  - Dynamic media upload endpoint (`/api/v1/upload`) with 5MB validation.
  - CSV and Excel export utilities for financial ledger, order history, and product rankings.

## Phase 7: Automated & On-Demand Email Reports (Completed)
- **Features:**
  - SMTP service integration with HTML email templates.
  - Daily scheduled cron job (23:00) sending revenue and P&L summaries to admin emails.
  - On-demand email dispatch modal on Dashboard and shift close email on Funds screen.
  - SMTP connection test in System Settings.

## Phase 8: Full-Stack Performance Optimization (Completed)
- **Features:**
  - PostgreSQL connection pool tuning (`MaxOpenConns=30`, `MaxIdleConns=15`).
  - 5 Composite performance indexes (`000015_performance_indexes.up.sql`).
  - SQL push-down aggregation for period fund summaries (single `GROUP BY` query).
  - In-memory thread-safe TTL Cache for categories, products, funds, toppings, settings.
  - Client-side SWR-like cache (`cache.ts`) and debounced search inputs.
  - HTTP Gzip compression middleware.

## Phase 9: Google Sheets Bi-Modal Sync & Auto Product Tagging (Completed)
- **Features:**
  - Google Sheets API v4 integration using service account credentials.
  - Automated product tagging engine (`best_seller`, `new`, `signature`) based on sales velocity and revenue thresholds with manual lock override (`is_tag_locked`).

## Phase 10: Inventory Purchases, Raw Ingredients & Recipe BOM (Completed)
- **Database:** `ingredients`, `purchase_items`, `recipe_items` schemas (`000018_purchase_tracking_and_recipes.up.sql`).
- **Features:**
  - Raw ingredient catalog with yield rate and unit tracking.
  - Purchase invoices linked to cash outflow transactions, calculating weighted-average purchase prices.
  - Bill of Materials (BOM) recipe builder for drink variants and toppings.
  - Real-time COGS comparison and 1-click sync to menu selling prices.
  - Historical Excel/CSV data migration engine.