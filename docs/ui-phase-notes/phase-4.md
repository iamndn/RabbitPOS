# Design Brief — Phase 4: Filter Bars

## Scope & Target Screens
Create a reusable `FilterBar` component pattern in `components/ui/` and apply to pages one commit at a time in exact order:
1. `transactions` — Ledger tab (`activeTab === 'transactions'`)
2. `transactions` — Orders tab (`activeTab === 'orders'`)
3. `transactions` — Purchases-cost tab (`activeTab === 'purchases'` / `PurchasesCostTab.tsx`)
4. `dashboard` (`app/dashboard/page.tsx`)
5. `products` (`app/products/page.tsx`)
6. `users` (`app/users/page.tsx`)
7. `stores` (`app/stores/page.tsx`)
8. `promotions` (`app/promotions/page.tsx` — redirect wrapper to `products?open=promotions`)
9. `purchases` (`app/purchases/page.tsx` — wrapper for `PurchasesCostTab`)
10. Modal-level filters:
    - `DiscountedOrdersModal.tsx`
    - `AllProductsRankingModal.tsx`
    - `ProductSalesPerformanceSection.tsx`
    - `PromotionsModal.tsx`
    - `EmailReportModal.tsx`

---

## 390px Mobile FilterBar Architecture
```
+---------------------------------------+ [390px Viewport Frame]
| [ 🔍 Tìm kiếm giao dịch...       [X] ] | (Search slot, 44px height, 16px font)
| [ ⚙️ Bộ lọc (2) ]  [ 📅 01/11 - Hôm nay ]| (Filter sheet button + Date/Actions)
+---------------------------------------+
| < [Tất cả] [Thu tiền] [Chi tiền] [Mới] >| (HorizontalScroller chips row)
+---------------------------------------+

When "Bộ lọc (N)" is pressed on mobile (< md):
+---------------------------------------+
| [Backdrop: slate-900/40 blur-sm]      |
|  +---------------------------------+  |
|  |             ====                |  | (Drag Handle)
|  | Bộ lọc nâng cao              X  |  | (Sheet Title + Close)
|  +---------------------------------+  |
|  | Loại giao dịch                  |  |
|  | [ ModernSelect: Thu tiền    ▼ ] |  | (Stacked selects / controls)
|  | Quỹ tiền mặt                    |  |
|  | [ ModernSelect: Quỹ chính   ▼ ] |  |
|  | Danh mục thu chi                |  |
|  | [ ModernSelect: Tất cả      ▼ ] |  |
|  +---------------------------------+  |
|  | [ Đặt lại ]      [ Áp dụng (2) ] |  | (Sticky Footer)
|  +---------------------------------+  |
+---------------------------------------+
```

---

## Desktop (md+) Layout Plan
- Inline horizontal flex layout:
  `[ Search (w-64) ] [ Select 1 ] [ Select 2 ] [ Chip row ] ---> [ Date / Action Slot ]`
- No mobile sheet button displayed (`md:hidden`).
- Clear visual hierarchy, no clipped controls, generous whitespace (`gap-2 sm:gap-3`).

---

## Token Mapping & Style Principles
- **Search inputs**: Height `h-11 md:h-9.5`, text `text-base md:text-xs` (prevents iOS auto-zoom), radius `rounded-xl`, focus ring `focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600`.
- **Filter button**: Height `h-11 md:h-9.5`, radius `rounded-xl`, font `text-xs font-bold`, active badge `Badge variant="brand"`.
- **Chips**: `FilterPill` / `Chip` with touch target $\ge 36\text{px}$, selected state `bg-brand-600 text-white`.
- **Filter sheet**: Powered by `ResponsiveSheet` portaled to `document.body` with safe-area bottom padding (`pb-safe`).

---

## Implementation & Git Commit Log

| Step / Target | Commit | Scope / Changes |
| :--- | :--- | :--- |
| **Setup** | `6aa3ace8` | Created `components/ui/FilterBar.tsx` with responsive sheet & desktop inline modes; added i18n keys to `vi.json` and `en.json`. |
| **1. Transactions (Ledger Tab)** | `498fe678` | Migrated search input, filter modal, and chips to `<FilterBar>` + `ModernSelect` + `Chip`. |
| **2. Transactions (Orders Tab)** | `a0b9062c` | Migrated order search, channel & status filter modal, and chips to `<FilterBar>` + `ModernSelect` + `Chip`. |
| **3. Transactions (Purchases-Cost Tab)** | `42e95ba7` | Migrated both sub-tabs (BOM profit recovery & ingredients spec) to `<FilterBar>`, eliminating over 700 lines of duplicated modal markup. |
| **4. Dashboard** | `b780a885` | Standardized dashboard timeframe bar onto `<FilterBar>` search/action slots. |
| **5. Products** | `b8143a3b` | Migrated product search, category, tag, status filters, and active chips onto `<FilterBar>`, deleting 312 lines of ad-hoc modal markup. |
| **6. Users** | `717cebe8` | Standardized user search, role filter, status filter, and active chips onto `<FilterBar>`. |
| **7. Stores** | `5237fa06` | Standardized store search and active/inactive status filter onto `<FilterBar>`. |
| **8. Promotions & Purchases Pages** | Verified | `promotions/page.tsx` is an internal redirect to `products?open=promotions`; `purchases/page.tsx` wraps `PurchasesCostTab` (migrated in step 3). |
| **9. Modal-Level Filters** | `dd9db3c5` | Migrated `DiscountedOrdersModal`, `AllProductsRankingModal`, `ProductSalesPerformanceSection`, `PromotionsModal`, and `EmailReportModal` onto unified `<FilterBar>` and `<FilterPill>`. |

---

## Verification & Polish
- **Type Checking**: Full clean run `npx --no-install tsc --noEmit` exits with 0 errors across all modified pages and components.
- **Viewport Testing**:
  - At $\le 768\text{px}$ (mobile/tablet): Clean search input, compact filter trigger button with dynamic count badge, opening full `ResponsiveSheet` bottom sheet with sticky footer.
  - At $> 768\text{px}$ (desktop): Filter controls render horizontally inline next to the search input, maximizing screen space without clipping.
- **Presentation Integrity**: Strictly presentation layer only; zero changes to backend routes, database schema, calculations, sync logic, or authentication.
