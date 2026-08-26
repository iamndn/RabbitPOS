# RabbitPOS Frontend Component Hierarchy & Architecture

> Framework: Next.js 14 (App Router)  
> Language: TypeScript  
> Styling: Tailwind CSS & Lucide React Icons  
> Design Philosophy: Mobile-First Touch Optimized

---

## 1. Application Routes (`frontend/src/app/`)

| Route | Access Level | Description |
| :--- | :--- | :--- |
| `/` | Staff & Admin | Main POS Order Entry Screen (Default landing for cashiers) |
| `/login` | Public | Authentication & First-Time Password Reset Screen |
| `/products` | Admin Only | Menu Catalog, Category Tree, Dynamic Toppings & Auto-Tagging |
| `/purchases` | Admin Only | Raw Ingredients, Purchase Invoices, Recipe BOM & Cost Sync |
| `/promotions` | Admin Only | Promotional Campaigns & Discount Engine Management |
| `/transactions` | Admin Only | Financial Ledger (Sổ Thu Chi) & Order History with Cancellation/Re-order |
| `/funds` | Admin Only | Multi-Fund Management, Periodic Audit & Cashier Shift Summary |
| `/dashboard` | Admin Only | BI Executive Analytics (Revenue, P&L Statement, Product Rankings) |
| `/settings` | Admin Only | Store Branding, Logo, Email/SMTP, Google Sheets Sync & Web Backup/Restore |

---

## 2. Component Hierarchy by Screen

### 2.1 POS Order Entry Screen (`/`)
- **`PosLayout`**
  - **`AppShell`** (Top navbar with dynamic store logo, cashier status, language switcher, user dropdown)
  - **`CategoryTabBar`** (Horizontal touch-scrollable category tabs with active indicators)
  - **`ProductSearchBar`** (Debounced 250ms real-time search with clear button)
  - **`ProductGrid`**
    - **`ProductCard`** (Optimized with `React.memo`, image lazy load, tag badges: Best Seller/New, starting price)
  - **`VariantSelectorModal`**
    - Size radio buttons (M / L / Bottle)
    - 5-Tier Sugar level selector (`0%`, `30%`, `50%`, `70%`, `100%`)
    - 5-Tier Ice level selector (`0%`, `30%`, `50%`, `70%`, `100%`, Separate Ice)
    - Multi-select Toppings list with real-time price updates
    - Quantity stepper & Add to Cart button
  - **`CartDrawer`** (Collapsible mobile bottom sheet & desktop side panel)
    - **`CartItemRow`** (Variant name, modifiers, inline unit price editor, qty stepper, remove)
    - **`OrderNoteInput`** (Persistent order notes synchronized to `localStorage`)
    - **`PromotionSelector`** (Dropdown of active campaigns with discount deduction)
    - **`ExtraFeeControls`** (Manual discount, Platform fee discount, Shipping fee, Surcharge)
    - **`CartSummary`** (Subtotal, Total discount, Final payable total)
    - **`CheckoutButton`**
  - **`CheckoutModal`**
    - Payment Fund Selector (Tiền mặt / VietQR)
    - Cash change calculator (Amount received vs Total)
    - Dynamic Napas 247 VietQR display
    - Order Confirmation button (triggers atomic order creation & auto-inflow transaction)
  - **`ReceiptModal`** (Thermal printer optimized layout: 58mm/80mm receipt format)

---

### 2.2 Catalog & Toppings Management (`/products`)
- **`ProductManagementLayout`**
  - Category sidebar / horizontal tabs with drag-and-drop / reorder arrows
  - Category CRUD dialogs with image upload
  - Product List Table / Grid with search and category filtering
  - **`ProductFormDialog`** (Product metadata, image uploader, tag selector, variant table)
  - **`ToppingsManagementPanel`**
    - Topping CRUD modal (Name, Price, COGS, Category scope)
    - 1-Click active toggle switch
    - Display reordering controls
  - **`AutoTagConfigModal`**
    - Tagging rules configuration (Sales volume & revenue thresholds)
    - Preview modal showing eligible drinks
    - 1-Click apply & lock/unlock per item

---

### 2.3 Purchases, Ingredients & Recipe BOM (`/purchases`)
- **`PurchasesLayout`**
  - **Tab 1: Raw Ingredients Catalog**
    - Ingredient CRUD (Name, Category: Fruit/Dairy/Packaging, Unit: kg/g/ml, Yield Rate)
    - Purchase invoice history & price trend chart per ingredient
  - **Tab 2: Recipe BOM & Cost Comparison**
    - **`RecipeEditorModal`** (Assign raw ingredients and usage quantities per portion for drinks & toppings)
    - Cost comparison table: Calculated BOM COGS vs Current Menu COGS
    - 1-Click "Apply Cost to Menu" button (single or bulk update)

---

### 2.4 Financial Ledger & Order History (`/transactions`)
- **`TransactionsLayout`**
  - **`ModernDateRangePicker`** (Quick date presets: Today, Yesterday, This Week, This Month, Custom)
  - **Tab 1: Financial Cash Ledger (Sổ Thu Chi)**
    - Category breakdown bar chart (Inflow vs Outflow distribution)
    - Add Manual Outflow/Inflow dialog with dynamic category dropdown and optional BOM link
    - Transaction table with inline edit & delete actions
    - **`TransactionCategoryModal`** (Manage custom income/expense categories with `is_system` protection)
  - **Tab 2: Order History**
    - Order status filter, search by order code or cashier
    - View receipt modal & print
    - Cancel order dialog (with optional cash refund toggle)
    - 1-Click Re-order button (restores order items to active POS cart)
  - Export to Excel (`.xlsx`) & CSV

---

### 2.5 Multi-Fund Overview & Reconciliation (`/funds`)
- **`FundsLayout`**
  - Fund balance overview cards (Cash drawer & VietQR accounts)
  - **`ReconcileDialog`** (Physical count entry, variance calculation, auto-variance logging)
  - Cashier Shift Report summary card
  - **`PeriodicBalanceAuditTable`** (Opening balance, Inflows, Outflows, Closing balance, Period growth)

---

### 2.6 Executive BI Dashboard (`/dashboard`)
- **`DashboardLayout`**
  - **`ModernDateRangePicker`**
  - **`SendEmailReportModal`** (On-demand financial summary dispatcher)
  - **Tab 1: Revenue BI**
    - KPI Cards: Net Revenue, Gross Sales, Order Count, Average Order Value (AOV), Total Discounts
    - Interactive SVG Time-Series Chart (Revenue trends)
    - Payment Method Distribution Pie/Bar
    - Hourly Peak Sales Distribution Chart (0h-23h)
    - Top 5 Best-Selling Products Widget
  - **Tab 2: Profit & Loss (P&L)**
    - KPI Cards: Gross Profit & Margin %, Net Profit & Margin %, Total COGS, Operating Expenses
    - Formal Financial P&L Statement breakdown table
    - **`AllProductsRankingModal`** (Complete menu performance ranking, sorting, CSV export)

---

### 2.7 System Settings & Integrations (`/settings`)
- **`SettingsLayout`**
  - Store Information & Logo Upload
  - Receipt Customization (Store name, address, footer note, thermal printer width)
  - Payment Settings (MBBank Account number, account name, Napas BIN)
  - Email & Daily Report Settings (Admin recipients list, SMTP configuration, Test SMTP button)
  - Google Sheets Bi-Modal Sync (Spreadsheet ID, service account verification, Sync Now button)
  - Database Backup & Restore (1-Click snapshot download, snapshot restore)
  - Data Migration (Excel template download, catalog import wizard)

---

## 3. Shared Global Components & Libraries

- **`components/AppShell.tsx`**: Unified navigation layout, responsive desktop sidebar / mobile navbar, User Profile Dropdown (profile info, role badge, language toggle, logout).
- **`components/common/ModernDateRangePicker.tsx`**: Popover date range picker with standard business date shortcuts.
- **`lib/cache.ts`**: Client-side thread-safe SWR-like cache with TTL and mutation invalidation.
- **`lib/api.ts`**: Typed REST API fetch client with automatic token attachment and error envelope normalization.
- **`lib/auth.ts`**: JWT auth manager (token storage, decoded claims, role guards).
- **`lib/exportExcel.ts` & `lib/exportCsv.ts`**: Client-side data formatting and spreadsheet generation.
- **`lib/i18n/`**: Bilingual dictionary provider (`vi.json` and `en.json`) with `LanguageContext`.