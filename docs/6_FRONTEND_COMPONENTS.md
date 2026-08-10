## 3. Frontend Component Hierarchy (Next.js, Mobile-First)
 
### 3.1 Screens (Routes)
- `/login` — Auth screen
- `/pos` — Main POS order entry screen (default landing for cashiers)
- `/pos/checkout` — Cart review & fund selection (may be a slide-over instead of a route)
- `/products` — Product/category management (admin)
- `/funds` — Fund list & reconciliation
- `/transactions` — Manual outflow entry & transaction history
- `/dashboard` — Analytics & reporting (admin)
### 3.2 Component Tree
 
**POS Order Entry (`/pos`)** — primary mobile screen
- `PosLayout`
  - `CategoryTabBar` (horizontal scroll, sticky)
  - `ProductGrid`
    - `ProductCard` (image, name, tag badge, starting price)
    - `VariantSelectorModal` (opens on tap: size/toppings selection, qty stepper)
  - `CartDrawer` (collapsible bottom sheet on mobile)
    - `CartItemRow` (variant name, qty controls, line total)
    - `CartSummary` (subtotal, discount input, total)
    - `CheckoutButton`
  - `CheckoutModal`
    - `FundSelector`
    - `OrderConfirmButton`
**Product Management (`/products`)** — admin, desktop-friendly but responsive
- `ProductManagementLayout`
  - `CategorySidebar` / `CategoryTabBar` (mobile)
  - `ProductTable` / `ProductCardList` (responsive switch)
  - `ProductFormDialog` (create/edit product + variants)
  - `VariantEditorRows`
**Funds & Transactions**
- `FundsOverview`
  - `FundBalanceCard` (per fund: theoretical vs actual)
  - `ReconcileDialog`
- `TransactionLedger`
  - `TransactionFilterBar` (date range, type, fund)
  - `TransactionTable`
  - `AddOutflowDialog`
**Dashboard (`/dashboard`)**
- `DashboardLayout`
  - `DateRangeFilter`
  - `KpiCardRow` (Revenue, Gross Profit, Order Count)
  - `TopProductsChart`
  - `CashFlowChart`
**Shared/Global**
- `AppShell` (top nav / bottom nav for mobile POS)
- `AuthGuard`
- `ApiClientProvider` (typed fetch wrapper, matches standardized response envelope)
- `ToastNotifier`