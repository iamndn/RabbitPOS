# Design Brief — Phase T3: Role-Aware Tahoe `AppShell`, POS Workspace `"/"` & POS Modals (`M01–M07`)

## Locked Decisions & Token Mapping (`3A -> 3B -> 3C`)
- **Q8 = Option A (Locked)**: Record in `docs/font-decision.md` & `06-open-questions.md`; apply `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), ...` with `tabular-nums` / `'tnum' 1` **only** to `.tabular-nums, .tabular-num, .font-num` and `fontFamily.num`.
- **Compact Form Modifier (`>= md` ONLY)**: Add `.app-input-compact` / `.app-select-compact` (`h-11 md:h-8 text-base md:text-xs rounded-field md:rounded-sm-tahoe`) — strictly `44px` + `16px` below `md`, `32px` + `12px` on `>= md` desktop pointer.
- **3A Role-Aware `AppShell` (`z-shell-bar: 30`, `glass-regular`)**:
  - `staff` (`!canManageStore`): Compact Top Header (`52px`/`56px`) with Logo + `StoreSwitcher`, inline `POS | Thu chi` 2-pill capsule, Online/Offline status pill, and Cashier User Menu (`VI | EN`, `Hiệu ứng kính` `Switch`, `Đăng xuất`). **`0` Bottom Tab Bar, `0` Left Sidebar.**
  - `admin` & `SuperAdmin`: Sticky `glass-regular` Top Bar with passive scroll-fade inline route title (`Q4`, `0` React scroll re-renders, hidden on `/`); `< 768px` Floating `56px` capsule Tab Bar (`POS`, `Thu chi`, `Nhập hàng`, `Báo cáo` + `Thêm` opening `ResponsiveSheet` `z-75`); `>= 768px` Collapsible `glass-regular` Left Sidebar (`68px` default `768–1023px`, `240px` default `>= 1024px`, `rabbitpos_sidebar_collapsed` `Q2`, `--shell-sidebar-w` CSS var).
  - `StoreSwitcher` restyled for light glass (`11px` floor, `0` `shadow-2xs`); `InstallPWABanner` moved to `z-sheet` (`75`), `glass-thick`, vector icon, i18n keys.
- **3B POS Catalog (`app/page.tsx`)**: `0` `backdrop-filter` across product grid/category rail (opaque `bg-slate-900/90` `{n} size` pill); `16px` (`text-base md:text-sm`) capsule search input (`h-11 md:h-9 rounded-full`) matching neighbouring Filter/Queue capsule buttons; inline Sort/Tag modal migrated to `ResponsiveSheet` (`z-75`/`z-70`); Quick-Cart Bar upgraded to `.surface-cart-bar` (`#2E1065` solid, `0px` blur, `z-cart-bar: 35`, `rounded-full`) coexisting cleanly above `admin` Tab Bar (`10px` gap), in `staff` thumb zone, and offset by `--shell-sidebar-w` on `>= 768px`.
- **3C POS Modals (`M01–M07`) & `measure-blur.md`**: Migrate `VariantSelectorModal`, `OfflineQueueModal` (`z-50`), `CartDrawer` (`z-50` drawer/sheet with `useOverlayLayer` nested demotion), and `CheckoutModal`, `VietQRModal`, `ReceiptModal` (preserving 80mm `#thermal-receipt` preview), `GiftItemSelectorModal` (`z-60` `nested`); document console blur counter in `docs/ui-tahoe/measure-blur.md`.

## Shell + POS ASCII Wireframes (`390px`, `768px`, `1280px`)
```text
[staff 390px: 0 Tab/Sidebar]     [admin 390px: Floating Tab+Cart] [admin/SuperAdmin 768px -> 1280px]
+------------------------------+ +------------------------------+ +------------------------------------+
| [Logo][Store] (POS|Thu) [Av] | | [Logo][Store]      [Onl][Av] | | [Logo][Store]  [Title]   [Onl][Av] |
|------------------------------| |------------------------------| |------+-----------------------------|
| ( Search 16px h-11 ) (SapXep)| | ( Search 16px h-11 ) (SapXep)| | 68px | ( Search h-9 )     (SapXep) |
| [Cat] [Card 0blur][Card 0blr]| | [Cat] [Card 0blur][Card 0blr]| | /240 | [Cat] [Card][Card][Card]    |
|                              | |  ( #2E1065 Cart Bar z-35 )   | | Rail |                             |
|  ( #2E1065 Cart Bar z-35 )   | |  ( POS | Thu | Nhap|BC|Them )| | z-30 |    ( #2E1065 Cart z-35 )    |
+------------------------------+ +------------------------------+ +------+-----------------------------+
```

## Anti-Generic Critique & Pre-Build Revisions
- **Blur budget `<= 2` on POS**: Top Bar (`1`) + Tab Bar or Sidebar (`1` on `admin`, `0` on `staff`) = `1–2` passes; Product Grid (`0`) + Solid `#2E1065` Cart Bar (`0`) = `0` extra passes; opening any sheet/modal sets `html[data-overlay-open="true"]`, demoting shell bars to `#FFFFFF` (`0px` blur).
- **Fixed iOS zoom & mismatched toolbar heights**: Removed `text-xs` mobile override on POS search input (`app/page.tsx:1238`) so all toolbar controls share `h-11 md:h-9 rounded-full` and `16px` mobile input text.
- **Eliminated dead Tailwind v4 utilities**: Removed all `shadow-2xs`, `shadow-xs`, `backdrop-blur-xs`, `animate-in`, and `< 11px` UI micro-text (preserving only the 12 justified 80mm thermal paper lines in `ReceiptModal`).
