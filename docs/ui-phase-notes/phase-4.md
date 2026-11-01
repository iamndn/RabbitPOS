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
8. `promotions` (`app/promotions/page.tsx`)
9. `purchases` (`app/purchases/page.tsx`)
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
- **Search inputs**: Height `h-11 md:h-9.5`, text `text-base md:text-xs`, radius `rounded-xl`, focus ring `focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600`.
- **Filter button**: Height `h-11 md:h-9.5`, radius `rounded-xl`, font `text-xs font-bold`, active badge `Badge variant="brand"`.
- **Chips**: `FilterPill` / `Chip` with touch target $\ge 36\text{px}$, selected state `bg-brand-600 text-white`.
- **Filter sheet**: Powered by `ResponsiveSheet` portaled to `document.body` with safe-area bottom padding (`pb-safe`).
