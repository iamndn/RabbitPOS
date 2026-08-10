# Takeaway POS Development Roadmap

## Phase 1: Core Data & Catalog Management (Week 1)
- **Database:** PostgreSQL. Define schemas: `Products`, `Categories`, `Variants` (e.g., Size, Toppings).
- **Features:**
  - CRUD operations for categories and products.
  - Product tagging (e.g., "Best Seller", "New").
  - Cost of Goods Sold (COGS) and Retail Price management per variant.

## Phase 2: POS Order Entry & Fund Management (Week 2)
- **Database:** Define schemas: `Orders`, `Order_Items`, `Funds` (Payment methods).
- **Features:**
  - Mobile-first POS UI: Responsive grid for item selection, variant modifiers, and quantity adjustments.
  - Cart calculations (Subtotal, Discounts, Total).
  - Checkout flow: Select target `Fund` (e.g., Cash Drawer, Bank Transfer) and complete order.

## Phase 3: Financial Ledger & Cash Flow (Week 3)
- **Database:** Define schema: `Transactions`.
- **Features:**
  - Automated "Inflow" transaction logging when an order is completed (linked to the selected Fund).
  - UI for manual "Outflow" transactions (e.g., purchasing ingredients, utility bills).
  - Fund balance reconciliation (Theoretical Balance vs. Actual Balance).

## Phase 4: Analytics & Reporting (Week 4)
- **Features:**
  - Executive Dashboard: Total Revenue, Gross Profit (Revenue - COGS - Expenses).
  - Top-selling items and variant statistics.
  - Dynamic date filtering (Today, This Week, This Month, Custom Range).