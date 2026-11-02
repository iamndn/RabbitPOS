# Design Brief — Phase T4: Financial Operations, Purchases & Menu Catalog

## Locked Decisions & Token Mapping (`4A -> 4G`)
- **Template T2 (List + FilterBar)**: Applied to `/transactions` (`ledger`, `orders`, `funds`), `/purchases`, and `/products`.
- **Sticky FilterBar (`z-20`, `glass-regular`)**: Anchored below Top Bar (`z-30`); demotes to `#FFFFFF` on modal open (`Amendment A1`). Search input `16px` on `< md`, `h-11` on mobile, `h-9` on `>= md`.
- **Opaque Cards & Tables (`0px` blur)**: KPI stat tiles, transaction list cards, and table headers use `--surface-card`, `--border-card`, `--shadow-card`. Never stack blur on data rows (`P1`).
- **Q8 Numerals**: Tabular numerals (`.tabular-nums`, `.font-num`) applied strictly to money, balances, order codes, quantities, and margins.
- **Form Density & 2-Line Mobile Reflow**: On `>= md`, compact modifier `.app-input-compact` / `.app-select-compact` (`32px`). On `< md`, keep standard `44px` controls; reflow multi-column dense rows (e.g. `TransactionModal` qty/unit/price, `PurchasesCostTab` ingredient cost breakdown) into 2 lines instead of shrinking buttons or inputs.
- **Override Q5 (Zero `window.confirm`)**: Replace 4 native confirms (`transactions:711, 804`, `PurchasesCostTab:541, 812`) with `useConfirm({ zIndex: 80 })` backed by synchronous `useRef` locks + `disabled` CTA states, preserving error toasts on API/network failure.

## 390px Mobile Wireframe (`/transactions`, `/purchases`, `/products`)
```text
[Transactions 390px]             [Purchases 390px]               [Products 390px]
+------------------------------+ +------------------------------+ +------------------------------+
| [Top Bar: Logo | Store] z-30 | | [Top Bar: Logo | Store] z-30 | | [Top Bar: Logo | Store] z-30 |
| (So thu chi | Don | Quy) z-20| | ( Don hang | Nguyen lieu )   | | ( All | Ca phe | Tra | Banh )|
| [Filter: Date | Search]      | | [Filter: Supplier | Search]  | | [Search 16px] [Loc / Tag]    |
| [KPI: Thu | Chi | Chenh lech]| | [BOM Margin %] [Gia von uoc] | | [Product Card: Opaque 0blur] |
| [Tx Card: 2-line reflow]     | | [Ing Card: 2-line reflow]    | |  - Img | Name | 45.000d      |
|  - Date / Cat / Note         | |  - Qty / Unit / Price / Loss | |  - Status Switch | Edit btn  |
|  - Fund / +150.000d font-num | |  - Supplier / Total Cost     | |                              |
| (+ Nhap Thu/Chi 44px CTA)    | | (+ Nhap hang 44px CTA)       | | (+ Them mon moi 44px CTA)    |
+------------------------------+ +------------------------------+ +------------------------------+
```

## Anti-Generic Critique & Pre-Build Revisions
- **No uniform grey box syndrome**: Distinguished income (`+` emerald), expense (`-` rose), and transfer (`text-slate-700`) with semantic badges while keeping UI chrome strictly brand purple.
- **Zero iOS zoom**: Enforced `16px` (`text-base md:text-sm`) font on all search inputs, date pickers, and filter popovers.
- **Zero dead classes**: Replaced all `backdrop-blur-xs`, `shadow-2xs`, `shadow-xs`, and `animate-in` with Tahoe tokens.
- **Eliminated sub-11px micro-text**: Standardized micro-captions to `text-[11px] leading-tight` (except 80mm thermal receipt preview).
