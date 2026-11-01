# 01 — Tahoe ("Liquid Glass") Component Catalog

**Status**: Approved Specification with Owner Overrides Applied (No application code modified)
**Scope**: Complete specification for all target component families: purpose, anatomy, variants/sizes, 7 interactive states, material assignment (`P1`, `Amendments A1 & A2`), role-specific shell variants (`Amendment A3`), mobile (`< 768px`) vs desktop (`>= 768px`) behavior, accessibility, `390px` ASCII wireframes, and exact live-repo `file:line` replacement targets.

---

## Global State Matrix Applied to All Interactive Components

Every interactive control implements all 7 states with strict priority (`disabled > loading > pressed/active > focus-visible > selected > hover > default`):

| State | Visual & Material Treatment | Motion / Timing | Accessibility |
| :--- | :--- | :--- | :--- |
| **1. Default** | Resting token fill (opaque, solid tinted, or glass material per component spec) + hairline border | Resting | Base role & label |
| **2. Hover** (`@media (hover: hover)`) | Subtle brightness/tint shift (`brand-600 -> brand-700` on primary; `rgba(15,23,42,0.04)` fill on ghost/glass items) | `120ms` ease-out | Cursor `pointer` |
| **3. Pressed / Active** | Tactile scale-down (`scale(0.97)` on buttons/cards, `scale(0.95)` on icon buttons) + deeper tint (`brand-800` or `rgba(124,58,237,0.20)`) | `90ms` `--motion-press` (CSS `:active` `< 16ms` compositor response `[VERIFIED]`; device feel `[UNVERIFIED]`) | `transform: none` under `prefers-reduced-motion` |
| **4. Focus-Visible** | `2px` solid ring `--tint-focus-ring` (`rgba(124,58,237,0.45)`) with `2px` offset (`ring-offset-white`) | Instant | Keyboard navigation only (`:focus-visible`), never obscures label |
| **5. Disabled** | `opacity-45`, `pointer-events-none`, saturated fills neutralized or softened, no press scale | None | Native `disabled` attribute or `aria-disabled="true"` |
| **6. Loading / Pending** | Inline `Loader2` (`16px` spinning SVG, `aria-hidden="true"`), label preserved or replaced on icon-only, **trigger locked against double click (`[VERIFIED]` requirement per `Override Q5`)** | Continuous spin (`1s` linear) | `aria-busy="true"`, `disabled` |
| **7. Selected / Active Route** | Tinted pill fill `--tint-glass-surface` (`rgba(124,58,237,0.14)`) + `brand-700` bold text/icon, or solid `brand-600` capsule with white text + checkmark | `200ms` `--motion-spring-snappy` | `aria-selected="true"`, `aria-current="page"`, or `aria-pressed="true"` |

---

## 1. Navbar / Top Toolbar (`AppShell` Top Bar — Admin & Staff Variants)

- **Purpose**: Global context bar housing brand identity, active `StoreSwitcher`, contextual page title (on Admin multi-route screens) or POS connectivity/offline queue status (on Staff POS-only shell), and the User Profile / Preferences trigger.
- **Material (`P1` & `Amendment A1`)**:
  - **Normal Idle / Scrolling**: **`glass-regular`** (`rgba(255,255,255,0.82)`, `backdrop-filter: blur(20px) saturate(180%)`, bottom hairline `rgba(15,23,42,0.08)`, `shadow-glass-sm` on scroll).
  - **When Any Sheet / Popover / Modal Is Open (`html[data-overlay-open="true"]` — `Amendment A1`)**: Automatically switches to **opaque `#FFFFFF` (`0px` blur)** so background bars never consume a `backdrop-filter` pass behind an open overlay (`[VERIFIED]` CSS variable rule).
- **Z-Index**: `z-shell-bar` (`30`).
- **Role-Specific Variants (`Amendment A3` + Pre-Flight Reachability Fix)**:
  1. **Role `staff` (Zero-Tab-Bar / Zero-Sidebar Compact Header with 2-Destination Capsule)**:
     - Because `AppShell.tsx:108-115, 129, 132` (`[VERIFIED]`) blocks `staff` from admin routes while actively granting `staff` access to **two** operational destinations — `/` (`POS`) and `/transactions` (`Thu chi`: shift expenses `?tab=ledger`, shift order history/reprints `?tab=orders`, and cashier shift summary `?tab=funds`) — `staff` has **no bottom tab bar and no left sidebar** (`Amendment A3`), and reaches both `/` and `/transactions` directly from the compact top header (`02-layout-and-shell.md` §1.1 & §2.4).
     - The compact header (`h-13` `52px` + `pt-safe` on mobile; `h-14` `56px` on tablet/desktop) spans full width and contains:
       - **Leading**: Store Logo (`32px` `rounded-xl`) + Store Name badge (or `StoreSwitcher` capsule pill if the staff user is assigned to `> 1` store).
       - **Center-Leading**: Compact 2-pill inline `SegmentedControl` capsule: **`POS` (`/`) | `Thu chi` (`/transactions`)**.
       - **Center-Trailing**: Live connectivity / Offline Queue status badge (`Online` emerald dot or `Offline (N)` amber capsule trigger).
       - **Trailing**: Cashier Profile Capsule (`h-9 rounded-full`, shows initials + `Thu ngân / Staff` badge) -> opens `ResponsiveSheet` User Menu containing Language toggle (`VI | EN`), `"Hiệu ứng kính (Liquid Glass)"` per-device `Switch`, and `Đăng xuất / Logout`.
  2. **Role `admin` (`owner` / `store_admin`) & `SuperAdmin` (`master` / `super_admin`)**:
     - Mobile (`< 768px`): Leading Logo + `StoreSwitcher` capsule pill; Center fade-in page title when scrolled (`data-scrolled="true"` on non-POS screens per `Q4`); Trailing User Profile Capsule.
     - Tablet/Desktop (`>= 768px`): Sits to the right of the Left Sidebar, housing `StoreSwitcher`, current screen breadcrumb/title, and User Profile Capsule.
- **Accessibility**: `<header role="banner">`; all icon/avatar triggers have explicit `aria-label` and `aria-expanded`.
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/AppShell.tsx:148-361` (`[VERIFIED]`).
  - Updates `<meta name="theme-color">` in `frontend/src/app/layout.tsx:54` from `#3b0764` to `#F2F4F8` (`[VERIFIED]`).
- **390px ASCII Wireframe (`staff` vs `admin`)**:
```
[Role: staff — Compact Header (No Tab Bar / No Sidebar, 2-Item POS | ThuChi Capsule)]
+---------------------------------------+ [390px Viewport - Top Safe Area]
|  [Notch / Dynamic Island Safe Inset]  | pt-safe (glass-regular)
| (Logo Q1) [(*POS)|ThuChi] [●]  (NV v) | h-13 (52px) glass-regular z-30
+---------------------------------------+

[Role: admin / SuperAdmin — Multi-Route Header]
+---------------------------------------+ [390px Viewport - Top Safe Area]
|  [Notch / Dynamic Island Safe Inset]  | pt-safe (glass-regular)
| (Logo) [Chi nhanh Q1 v]    (AD Owner) | h-13 (52px) glass-regular z-30
+---------------------------------------+
```

---

## 2. Mobile Bottom Tab Bar (`AppShell` Floating Glass Platter + "More" Sheet — Admin & SuperAdmin Only)

- **Purpose**: One-hand thumb-zone primary navigation on phones (`< 768px`) for `admin` and `SuperAdmin` roles (`owner`, `store_admin`, `master`, `super_admin`), adhering strictly to **P1**, **P2**, **P9**, and **Amendment A3**.
- **Visibility by Role (`Amendment A3`)**:
  - **Role `staff`**: **NOT RENDERED (`null`)**. Omitting the bottom tab bar reclaims `64px` of vertical screen height on phones and allows the Solid POS Quick-Cart Bar to sit directly at the bottom safe-area inset (`bottom-[max(0.75rem,env(safe-area-inset-bottom))]`), while `/` and `/transactions` are switched via the Compact Header's `POS | Thu chi` capsule (`[VERIFIED]` layout & reachability calculation).
  - **Role `admin` & `SuperAdmin` (`canManageStore === true`)**: Rendered on `< 768px` (`md:hidden`) with **4 Primary Tab Pills + 1 `"Thêm (More)"` Tab Pill (`5` items total)**.
- **Material (`P1` & `Amendment A1`)**:
  - **Idle / Scrolling**: **`glass-regular`** floating capsule platter (`rounded-full`, `rgba(255,255,255,0.82)`, `blur(20px) saturate(180%)`, `shadow-glass-md`, `1px` specular border).
  - **When Any Overlay Is Open (`html[data-overlay-open="true"]`)**: Demotes to **opaque `#FFFFFF` (`0px` blur)** (`Amendment A1`).
- **Z-Index**: `z-shell-bar` (`30`).
- **Exact 4 Primary Tab Items + "More" Sheet Contents (`Amendment A3` + Pre-Flight Reachability Fix)**:
  1. **Tab 1 — `POS` (`/`, icon `ShoppingCart`)**: Core order-taking screen.
  2. **Tab 2 — `Thu chi` (`/transactions`, icon `ArrowUpRight`)**: Daily ledger (`Sổ thu/chi` `?tab=ledger`), order history (`Lịch sử đơn hàng` `?tab=orders`), and cash fund reconciliation (`Quản lý quỹ` `?tab=funds` / `/funds`).
  3. **Tab 3 — `Nhập hàng` (`/purchases`, icon `ShoppingBag`)**: Core daily ingredient purchase, multi-level unit conversion, and BOM cost/profit recovery workflow (`AGENTS.md` §4).
  4. **Tab 4 — `Báo cáo` (`/dashboard`, icon `LayoutDashboard`)**: Daily revenue, profit waterfall reconciliation, and top-selling product performance.
     - *Why `Báo cáo` is Tab 4 and `Thực đơn` / `Khuyến mãi` live at the top of `Thêm` (Reasoned Default)*: Store owners on mobile check live sales, cash reconciliation (`Thu chi`), ingredient restocks (`Nhập hàng`), and daily revenue/profit (`Báo cáo`) multiple times every shift, whereas adding/editing menu items or promotions is an occasional catalog-setup activity. Placing `Báo cáo` in Tab 4 makes all 4 daily monitoring/operational flows 1-tap reachable (`[VERIFIED]` task-frequency analysis).
  5. **Tab 5 — `Thêm` ("More" Sheet Trigger, icon `LayoutGrid`)**:
     - Opens a `ResponsiveSheet` (`glass-thick`, `z-sheet: 75`) containing:
       - **Section A — Quản trị & Cấu hình (Management Routes)**:
         1. `Thực đơn` (`/products`, icon `Package` — Menu items, Categories, Toppings, Tags, Auto-Tagging)
         2. `Khuyến mãi` (`/products?open=promotions`, alias `/promotions`, icon `Tag` — Direct 1-tap launch into `PromotionsModal`)
         3. `Quản lý nhân sự` (`/users`, icon `Users` — Staff & Admin accounts, roles, store assignments)
         4. `Cài đặt hệ thống` (`/settings`, icon `Settings` — Store profile, Currency, VietQR, Email, Google Sheets, and SuperAdmin Backup/Restore)
         5. `Chuỗi cửa hàng` (`/stores`, icon `Store` — visible strictly when `isSuperAdmin === true`)
       - **Section B — Tùy chọn thiết bị (Device Preferences)**:
         1. `Ngôn ngữ / Language`: Capsule `SegmentedControl` (`VI | EN`)
         2. `Hiệu ứng kính (Liquid Glass)`: Per-device `Switch` (`localStorage` key `rabbitpos_glass_effects`, `Override Q3`)
       - **Section C — Tài khoản**:
         1. `Đăng xuất` (`LogOut`, danger soft action)
     - *Active Route Indicator on Tab 5*: When viewing `/products`, `/promotions`, `/users`, `/settings`, or `/stores`, Tab 5 (`Thêm`) highlights in active `brand-700` tint (`--tint-glass-surface`) so active location is always unmistakable.
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/AppShell.tsx:128-140` and `AppShell.tsx:371-391` (`[VERIFIED]`).
- **390px ASCII Wireframe (Admin Mobile Tab Bar + "More" Sheet)**:
```
[Admin Bottom Tab Bar Platter — 5 Capsule Items]
| +-----------------------------------+ |
| | (*POS) (ThuChi) (Nhap) (BCao) (+) | | h-14 (56px) glass-regular capsule
| +-----------------------------------+ |
|        [=== Home Indicator ===]       | pb-safe

[When Tab 5 (+) "Them" Is Tapped -> ResponsiveSheet (z-75)]
+---------------------------------------+
| [Scrim: rgba(2,6,23,0.40) - 0px blur] |
| .-----------------------------------. | <- glass-thick, rounded-t-[28px]
| |               =====               | |
| | Danh muc quan tri & Tuy chon   (X)| |
| | .-------------------------------. | | <- Opaque ListGroup (rounded-2xl)
| | | [📦] Thuc don               > | | |    /products (48px row)
| | |      ------------------------ | | |
| | | [🏷️] Khuyen mai             > | | |    /products?open=promotions
| | |      ------------------------ | | |
| | | [👥] Quan ly nhan su        > | | |    /users (48px row)
| | |      ------------------------ | | |
| | | [⚙️] Cai dat he thong       > | | |    /settings (48px row)
| | |      ------------------------ | | |
| | | [🏪] Chuoi cua hang (Super) > | | |    /stores (SuperAdmin only)
| | '-------------------------------' | |
| | .-------------------------------. | |
| | | [🌐] Ngon ngu        (VI | EN)| | |    Language SegmentedControl
| | |      ------------------------ | | |
| | | [✨] Hieu ung kinh      ( o ) | | |    Per-device localStorage Switch
| | '-------------------------------' | |
| | (          Dang xuat            ) | |
| '-----------------------------------' |
+---------------------------------------+
```

---

## 3. Tablet & Desktop Sidebar (`AppShell` Adaptive Sidebar `>= 768px` — Admin & SuperAdmin Only)

- **Purpose**: Persistent left-hand navigation rail on tablet (`768px–1023px`) and desktop (`>= 1024px`) for `admin` and `SuperAdmin` roles.
- **Visibility by Role (`Amendment A3`)**:
  - **Role `staff`**: **NOT RENDERED (`null`)**. On tablet and desktop POS terminals, `staff` gets the full 100% horizontal viewport width for the category rail and multi-column product grid, switching between `/` (`POS`) and `/transactions` (`Thu chi`) via the Compact Top Header's 2-pill capsule.
  - **Role `admin` & `SuperAdmin` (`canManageStore === true`)**: Rendered on `>= 768px` (`hidden md:flex`).
- **Material (`P1` & `Amendment A1`)**:
  - **Idle / Scrolling**: **`glass-regular`** (`rgba(255,255,255,0.80)`, `blur(20px) saturate(180%)`, right hairline border `border-glass`).
  - **When Any Overlay Is Open (`html[data-overlay-open="true"]`)**: Demotes to **opaque `#FFFFFF` (`0px` blur)** (`Amendment A1`).
- **Z-Index**: `z-shell-bar` (`30`).
- **Sizes (`Override Q2` Approved)**:
  - **Collapsed Icon-Only (`68px` / `w-[68px]`)**: Default on tablet (`768px–1023px`), or user-toggled on desktop (`localStorage` key `rabbitpos_sidebar_collapsed`).
  - **Expanded (`240px` / `w-60`)**: Default on desktop (`>= 1024px`). Shows daily operation routes (`POS` `/`, `Thu chi` `/transactions`, `Nhập hàng` `/purchases`, `Báo cáo` `/dashboard`) + divider + management routes (`Thực đơn` `/products`, `Khuyến mãi` `/products?open=promotions`, `Nhân sự` `/users`, `Cài đặt` `/settings`, `Chuỗi cửa hàng` `/stores` [SuperAdmin only]) + footer preferences (`VI/EN` + Glass switch).
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/AppShell.tsx:186-206` and `AppShell.tsx:280-358` (`[VERIFIED]`).

---

## 4. POS Floating Quick-Cart Bar (`app/page.tsx:1558` — `Amendment A2`)

- **Purpose**: Persistent floating checkout summary bar on the POS screen (`/`) when `cart.length > 0`, displaying item count, total payable amount, 1-tap Cash checkout, and 1-tap VietQR checkout.
- **Material (`Amendment A2` & `P9` — Non-Negotiable)**:
  - Uses **`--surface-cart-bar` (100% OPAQUE Solid Deep Brand Tint `#2E1065` `brand-950` / `#1E1B4B`, `0px` `backdrop-filter`)** with a `1px` specular inner top border (`rgba(255,255,255,0.16)`), outer ring (`rgba(124,58,237,0.35)`), and `shadow-glass-md`.
  - **Why Solid Instead of Glass (`Amendment A2`)**:
    1. Guarantees **15.4:1 contrast (`[VERIFIED]`)** for the white `.font-num` total (`formatCurrency(cartTotal)`) regardless of bright or busy product photos scrolling behind the bar.
    2. Consumes **0 `backdrop-filter` layers (`[VERIFIED]`)**, freeing the GPU budget while scrolling the POS product grid on mid-range Android devices.
- **Z-Index**: `z-cart-bar` (`35`).
- **Shape & Coexistence (`P2`, `P9`, `Amendment A3`)**:
  - Capsule platter (`rounded-full`, `h-14` `56px`, `px-3`).
  - **Mobile Position for `admin` (with Bottom Tab Bar present)**: `fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] inset-x-3` (`8px` clear gap above the `56px` Floating Bottom Tab Bar).
  - **Mobile Position for `staff` (no Bottom Tab Bar per `Amendment A3`)**: `fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3` (sits directly in the primary bottom thumb zone!).
  - **Desktop/Tablet Position (`>= 768px`)**: `md:bottom-5` centered within the POS content column.
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/app/page.tsx:1558-1610` (replaces `bg-slate-900/95 backdrop-blur-md z-30` with solid `--surface-cart-bar` at `z-35` and role-aware bottom offset `[VERIFIED]`).
- **390px ASCII Wireframe**:
```
+---------------------------------------+
| .-----------------------------------. | <- Solid #2E1065 Capsule (0px blur!)
| | (🛍️3) 145.000 d  (TienMat) (VietQR)| |    White .font-num total + 2 capsules
| '-----------------------------------' |
+---------------------------------------+
```

---

## 5. Button & IconButton (`components/ui/Button.tsx`)

- **Purpose**: Single shared trigger primitive for all actions across pages, headers, filter bars, and modal footers.
- **Material**:
  - `primary`, `danger`: Solid opaque fill (`brand-600` `#7C3AED` / `rose-600` `#E11D48`) with `inset 0 1px 0 rgba(255,255,255,0.22)` and soft shadow.
  - `secondary`: Opaque white (`--surface-card`) with `1px` border `rgba(15,23,42,0.10)`.
  - `soft`: Tinted capsule fill `rgba(124,58,237,0.12)` with `brand-700` text and `1px` border `rgba(124,58,237,0.20)`.
  - `ghost`: Transparent resting, `rgba(15,23,42,0.06)` hover, `rgba(15,23,42,0.10)` pressed.
- **Shape (`P2`)**: **Capsule (`rounded-full`)** across all sizes (`sm`, `md`, `lg`).
- **Sizes & Touch Targets (`P9`)**:
  - `sm`: Mobile `36px` (`h-9 px-3.5 text-xs`), Desktop `32px` (`md:h-8 md:px-3 text-xs`).
  - `md` (Default): Mobile **`44px`** (`h-11 px-4 text-headline` `15px`), Desktop **`36px`** (`md:h-9 md:px-3.5 md:text-subhead`).
  - `lg` (Primary CTA / Checkout): Mobile **`48px`** (`h-12 px-5 text-base font-semibold`), Desktop **`44px`** (`md:h-11 md:px-5`).
  - `IconButton`: `sm` (`36px` mobile / `32px` desktop), `md` (**`44px × 44px`** mobile / `36px × 36px` desktop), `lg` (`48px × 48px` mobile / `44px × 44px` desktop).
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/ui/Button.tsx:19-36` and `100-104` (`[VERIFIED]`), plus remaining ad-hoc button strings across pages/modals.

---

## 6. Card (`components/ui/Card.tsx`)

- **Purpose**: Opaque surface container for grouping related content, KPI metrics, product items, and settings sections.
- **Material (`P1`, `P3`)**: **Strictly OPAQUE (`--surface-card` `#FFFFFF`, `0` `backdrop-filter`)**. Uses `rounded-card` (`16px` / `rounded-2xl`), hairline border `border-card` (`1px solid rgba(15,23,42,0.07)`), and `shadow-card` (replaces non-existent `shadow-2xs`/`shadow-xs`).
- **POS Product Card Badge Fix (`[VERIFIED]` in `app/page.tsx:272`)**:
  - Replaces `bg-slate-900/80 backdrop-blur-xs shadow-xs` on the `{variantsCount} size` badge (`app/page.tsx:272`) with an **opaque** pill (`bg-slate-900/90 text-white shadow-card`, `0` `backdrop-filter`).
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/ui/Card.tsx:10-77` and `frontend/src/app/page.tsx:235-340` (`[VERIFIED]`).

---

## 7. Divider / Separator (`components/ui/Divider.tsx` — New Primitive Export)

- **Purpose**: Hairline visual separation between list rows, menu groups, sidebar sections, and card headers (`P3`).
- **Material**: Opaque hairline `--separator-hairline` (`rgba(15, 23, 42, 0.07)` on light surfaces; `rgba(15, 23, 42, 0.09)` inside glass menus/sheets).
- **Variants**: `full`, `inset` (`ml-4` or `ml-12`), `vertical`, `labeled`.
- **Replaces (Live Repo `file:line`)**: `AppShell.tsx:324`, `ResponsiveSheet.tsx:218`, `settings/page.tsx`, `transactions/page.tsx` (`[VERIFIED]`).

---

## 8. Tabs & Segmented Control (`components/ui/SegmentedControl.tsx`)

- **Purpose**: Mutually exclusive view/mode switcher within a page or sheet.
- **Material**:
  - Outer Track: Opaque recessed well (`--surface-grouped` `rgba(15,23,42,0.06)`), `rounded-full` (`radius-capsule`), `p-1`.
  - Active Thumb: Concentric `rounded-full` white pill (`#FFFFFF`, `shadow-glass-sm`) with `brand-700` semibold text. Zero `backdrop-filter`.
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/ui/SegmentedControl.tsx:53-94`, `frontend/src/app/transactions/page.tsx:1435-1485`, `frontend/src/components/transactions/PurchasesCostTab.tsx:1045-1095`, `frontend/src/app/settings/page.tsx:545-645`, and `frontend/src/components/LanguageToggle.tsx:1-40` (`[VERIFIED]`).

---

## 9. Dropdown / Menu / Picker (`ModernSelect`, `StoreSwitcher`, `QuickTagPicker`, User Menu)

- **Purpose**: Single-choice selection (`ModernSelect`), store switcher (`StoreSwitcher`), user menu (`AppShell`), and tag picker (`QuickTagPicker`).
- **Material**:
  - Trigger: Opaque `--surface-card` (`#FFFFFF`), `rounded-field` (`12px`), `44px` mobile / `36px` desktop.
  - Overlay (via `ResponsiveSheet`): **`glass-thick`** (`rgba(255,255,255,0.88)`, `blur(28px) saturate(190%)`) over unblurred `glass-scrim`. Opening sets `html[data-overlay-open="true"]` (`Amendment A1`).
- **Z-Index**: Desktop Popover `z-popover` (`70`); Mobile Bottom Sheet `z-sheet` (`75`).
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/common/ModernSelect.tsx:1-407`, `frontend/src/components/StoreSwitcher.tsx:1-276`, `frontend/src/components/products/QuickTagPicker.tsx:95-134`, `frontend/src/components/AppShell.tsx:209-359` (`[VERIFIED]`).

---

## 10. Sheet & Popover (`components/ui/ResponsiveSheet.tsx` — `Override Q6` & `Amendment A1`)

- **Purpose**: Adaptive overlay primitive (Mobile `< 768px` Bottom Sheet at `z-75`; Desktop `>= 768px` Anchored Popover at `z-70`).
- **Material (`Amendment A1`)**:
  - Sheet/Popover Platter: **`glass-thick`** (`1` active `backdrop-filter` pass).
  - Backdrop Scrim: **`glass-scrim`** (`rgba(2,6,23,0.40)`, **`0px` blur**).
  - Sticky Footer inside Sheet: Opaque `#FFFFFF` with top hairline border (`0px` blur — removes the extra `backdrop-blur-sm` currently at `ResponsiveSheet.tsx:250` `[VERIFIED]`).
  - Mounting sets `html[data-overlay-open="true"]` (via ref-counted overlay tracker), demoting `AppShell` bars (`z-30`) to opaque `#FFFFFF`.
- **Detents & Header-Only Drag-to-Dismiss (`Override Q6` Approved)**:
  - Preset height detents (`detent="medium" | "large" | "auto"` -> `max-h-[60dvh]`, `max-h-[88dvh]`, `max-h-[85dvh]`).
  - Lightweight pointer-drag-to-dismiss attached **strictly to the non-scrolling top grabber/header bar** (`> 72px` downward drag or flick `> 0.5px/ms` triggers `onClose()`), plus single-tap `44px × 44px` `X` close button, backdrop tap, and `Escape` key.
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/ui/ResponsiveSheet.tsx:188-322` (`[VERIFIED]`).

---

## 11. Dialog / Alert & Modal Shell (`ConfirmModal.tsx` + `ModalShell.tsx` — `Override Q5` & `Amendment A1`)

- **Purpose**:
  1. **System Confirm / Alert Dialog (`ConfirmModal` at `z-dialog-alert: 80`)**: Confirmation for destructive or financial actions.
  2. **Task Modal Shell (`ModalShell` at `z-modal: 50` / `z-modal-nested: 60`)**: Shared wrapper for the 27 feature modals.
- **Material & Layer Demotion (`Amendment A1`)**:
  - Outer Dialog / Sheet Platter: **`glass-thick`** (`1` active `backdrop-filter` pass) over unblurred **`glass-scrim`** (`0px` blur). Inner body content cards/tables remain **opaque**.
  - When a `z-60` nested modal, `z-70` popover, `z-75` sheet, or `z-80` `ConfirmModal` opens above a `z-50` `ModalShell`, the lower `z-50` modal sets `data-under-nested-overlay="true"` and switches its own surface to opaque `#FFFFFF` (`0px` blur), guaranteeing **at most 1 active modal/sheet blur layer at all times (`[VERIFIED]`)**.
- **Pending-State Lock Against Double Execution (`Override Q5` — Binding)**:
  - Both `ConfirmModal` (`ConfirmContext.tsx` / `ConfirmModal.tsx`) and every financial modal (`cancellingOrder`, `deletingTransaction`, `deletingOrder`) enforce a synchronous in-flight lock (`isSubmittingRef.current = true` + `isLoading` state on the primary `Button`):
    - The Confirm / Delete / Cancel button is **immediately disabled** on the first click or `Enter` key press (`disabled={isPending}`, showing the spinner and blocking repeat clicks or `Enter` key events).
    - Every call site wraps its `fetchApi` call in `try / catch / finally`, displaying a clear error toast (`showToast('error', ...)`) on HTTP/network failure and releasing the lock in `finally` (see full 4-site + 3-modal table in `06-open-questions.md` Q5).
- **Replaces (Live Repo `file:line`)**:
  - `frontend/src/components/common/ConfirmModal.tsx:1-205`, `frontend/src/context/ConfirmContext.tsx:1-76`, and all 27 modals mapped in `03-screen-mapping.md` (`[VERIFIED]`).

---

## 12. Toast (`components/common/ToastContainer.tsx`)

- **Purpose**: Non-blocking transient feedback floating at the top safe-area (`max 3` visible items; rendered inside a single shared `glass-regular` platter or individual toast cards).
- **Material (`Amendment A1`)**: **`glass-regular`** (`1` active `backdrop-filter` pass; when multiple toasts stack, the outer toast stack container or active top card carries the single blur pass so toasts never exceed `1` blur layer in the viewport budget).
- **Z-Index**: `z-toast` (`90`, replacing `z-[9999]`).
- **Replaces (Live Repo `file:line`)**: `frontend/src/components/common/ToastContainer.tsx:32, 163, 177, 188` (`[VERIFIED]`).

---

## 13. Inputs, FieldShell, Switch, Badge, ListGroup, FilterBar, DateRangePicker, Empty & Skeleton States

- **Inputs & FieldShell (`globals.css:107-118`, `FieldShell.tsx`)**: Strictly **opaque** (`--surface-card` `#FFFFFF`, `0` blur), `rounded-field` (`12px`), `44px` height + `16px` font on mobile (`[VERIFIED]` prevents iOS auto-zoom), sentence-case `.app-label` (`13px–14px` semibold `slate-700`), `.font-num` (`Inter` `tabular-nums`) on numeric inputs.
- **Switch (`components/ui/Switch.tsx` — New Primitive)**: Opaque capsule track (`44px × 26px`, `#7C3AED` on / `#CBD5E1` off, `44px × 44px` hit target), `role="switch"`. Used for settings toggles and the per-device `"Hiệu ứng kính (Liquid Glass)"` switch (`Override Q3`).
- **Badge (`components/ui/Badge.tsx`)**: Strictly **opaque** soft tint (`0` blur), pill shape (`rounded-full`), `11px` (`text-caption`) hard floor.
- **Grouped List Rows (`components/ui/ListGroup.tsx` — New Primitive)**: Strictly **opaque** `--surface-card` (`#FFFFFF`, `rounded-2xl`) with inset hairline dividers (`--separator-hairline`), `min-h-[48px]` on mobile, `.font-num` right-aligned amounts.
- **FilterBar (`components/ui/FilterBar.tsx` + `Chip.tsx`)**: Capsule search input (`44px` mobile), capsule `Chip`/`FilterPill` row (opaque), and `Bộ lọc (N)` trigger opening `ResponsiveSheet` (`glass-thick`, `z-75`).
- **Date Range Picker (`components/common/ModernDateRangePicker.tsx`)**: Opaque capsule trigger (`.font-num`) opening `ResponsiveSheet` (`glass-thick`, `z-75` mobile / `z-70` desktop), capsule `SegmentedControl`, `>= 40px` circular day cells (`.font-num`).
- **Empty & Skeleton States (`components/ui/EmptyState.tsx` & `Skeleton.tsx`)**: Strictly **opaque** (`0` blur), concentric radii, reduced-motion safe.
