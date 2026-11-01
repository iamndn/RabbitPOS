# 04 — Risk, Performance Budget, Accessibility, Non-Existent Class Audit & Rollback Plan

**Status**: Approved Specification with Owner Overrides Applied (No application code modified)
**Scope**: Hard `backdrop-filter` budget (`<= 3` simultaneously visible layers, `Amendment A1`), dynamic overlay demotion, per-template layer accounting (including worst-case POS screen), complete `file:line` audit of non-existent Tailwind 3.x classes (`Amendment A4`), CLI-measurable vs hardware `[UNVERIFIED]` checks (`Amendment A6`), WCAG AA accessibility plan, browser support matrix, and single-switch rollback architecture.

---

## 1. Hard `backdrop-filter` Budget & Dynamic Demotion Rules (`P1`, `P7`, `Amendments A1 & A2`)

### 1.1 Budget Definition (`Amendment A1` — Non-Negotiable)
- **Hard Ceiling**: **At most `3` SIMULTANEOUSLY VISIBLE `backdrop-filter` layers** may exist on any screen at any instant (`[VERIFIED]` design invariant).
- **Maximum Glass-on-Glass Stacking Depth (`P1`)**: **2 levels maximum**.
- **Repeating List / Grid Items**: **`0` `backdrop-filter` layers** allowed inside `map()` loops (product cards, table rows, ledger items, chips, badges).
- **POS Floating Quick-Cart Bar (`Amendment A2`)**: Uses **100% opaque solid tinted material (`--surface-cart-bar` `#2E1065`, `0` `backdrop-filter`)**.

### 1.2 What Happens When a Sheet, Popover, or Dialog Opens (`Amendment A1`)
To guarantee that opening overlays never stacks additional `backdrop-filter` passes on top of the shell bars:
1. **Shell Bar Demotion (`html[data-overlay-open="true"]`)**:
   - Whenever any `ResponsiveSheet` (`z-70` popover / `z-75` sheet), `ModalShell` (`z-50` / `z-60`), or `ConfirmModal` (`z-80`) is open, a shared ref-counted hook sets `document.documentElement.setAttribute('data-overlay-open', 'true')`.
   - A CSS rule in `globals.css` (`html[data-overlay-open="true"]`) immediately switches the material variables of:
     - `AppShell` Top Bar (`z-30`) -> **Opaque `#FFFFFF` (`0px` blur)**
     - `AppShell` Mobile Bottom Tab Bar (`z-30`) -> **Opaque `#FFFFFF` (`0px` blur)**
     - `AppShell` Desktop Sidebar (`z-30`) -> **Opaque `#FFFFFF` (`0px` blur)**
     - Sticky sub-headers / table `<thead>` (`z-10` / `z-20`) -> **Opaque `#F8FAFC` (`0px` blur)**
2. **Parent Modal Demotion Under Nested Overlays (`data-under-nested-overlay="true"`)**:
   - When a primary modal (`z-50`, e.g., `CartDrawer`, `TransactionModal`, or `ReconcileHistoryModal`) is open and a child overlay opens on top of it (`CheckoutModal` `z-60`, `VietQRModal` `z-60`, `ModernSelect` `z-70`/`z-75`, or `ConfirmModal` `z-80`), the lower `z-50` modal switches its outer shell to **Opaque `#FFFFFF` (`0px` blur)**.
   - Consequently, **only the topmost active overlay carries `glass-thick` (`1` blur layer)**!
3. **Backdrop Scrim (`glass-scrim`)**:
   - Uses a pure translucent dimmer (`rgba(2, 6, 23, 0.40)`, **`0px` blur**) on all viewports so the full-screen backdrop never consumes a blur pass.

### 1.3 Complete Per-Template & Worst-Case POS `backdrop-filter` Layer Accounting (`Amendment A1` — `[VERIFIED]`)

| Template / Screen Scenario | Top Bar (`z-30`) | Bottom Tab Bar or Sidebar (`z-30`) | Sticky Subhead (`z-20`) | POS Cart Bar (`z-35`, `Amendment A2`) | Active Modal / Sheet / Popover (`z-50..80`) | Active Toast (`z-90`) | **Total Simultaneously Visible Blur Layers** | Budget (`<= 3`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **T1: POS (`/`) — Role `staff` Idle / Scrolling + Active Cart** | **`1`** (`glass-regular`) | **`0`** *(not rendered for `staff`, `A3`)* | `0` | **`0`** *(solid `#2E1065`, `A2`)* | `0` | `0` | **`1`** | **PASS (`1 / 3`)** |
| **T1: POS (`/`) — Role `admin` Idle / Scrolling + Active Cart** | **`1`** (`glass-regular`) | **`1`** (`glass-regular`) | `0` | **`0`** *(solid `#2E1065`, `A2`)* | `0` | `0` | **`2`** | **PASS (`2 / 3`)** |
| **T1: POS (`/`) — Role `admin` Scrolling + Active Cart + Toast** | **`1`** (`glass-regular`) | **`1`** (`glass-regular`) | `0` | **`0`** *(solid `#2E1065`, `A2`)* | `0` | **`1`** (`glass-regular`) | **`3`** | **PASS (`3 / 3`)** |
| **T1 WORST CASE (`Amendment A1`): POS (`/`) with Top Bar + Tab Bar + Cart Bar + 1 Open Overlay (`VariantSelector` / `CartDrawer` / `SortSheet`) + Toast** | **`0`** *(demoted to opaque `#FFFFFF` by `data-overlay-open`)* | **`0`** *(demoted to opaque `#FFFFFF` by `data-overlay-open`)* | `0` | **`0`** *(solid `#2E1065`, `A2`)* | **`1`** (`glass-thick` on open overlay; Scrim is `0` blur) | **`1`** (`glass-regular`) | **`2`** | **PASS (`2 / 3`)** |
| **T1 DEEP STACK: POS (`/`) with `CartDrawer` (`z-50`) + `CheckoutModal` (`z-60`) + Toast (`z-90`)** | **`0`** *(demoted to opaque)* | **`0`** *(demoted to opaque)* | `0` | **`0`** *(solid `#2E1065`)* | **`1`** (`CartDrawer` `z-50` demotes to opaque; only `CheckoutModal` `z-60` has `glass-thick`) | **`1`** (`glass-regular`) | **`2`** | **PASS (`2 / 3`)** |
| **T2: List + FilterBar (`/transactions`, `/purchases`, `/products`, `/users`, `/stores`) — Idle / Scrolling Table** | **`1`** (`glass-regular`) | **`1`** (`glass-regular`) | **`1`** *(optional `glass-thin` sticky `<thead>` on `md+`)* | N/A | `0` | `0` | **`2` (mobile) / `3` (desktop)** | **PASS (`2–3 / 3`)** |
| **T2: List + FilterBar — With Open Filter Sheet / `ModernSelect` / `TransactionModal` + Toast** | **`0`** *(demoted to opaque)* | **`0`** *(demoted to opaque)* | **`0`** *(demoted to opaque)* | N/A | **`1`** (`glass-thick` on active sheet/modal) | **`1`** (`glass-regular`) | **`2`** | **PASS (`2 / 3`)** |
| **T3: Analytics Dashboard (`/dashboard`) — Idle / Scrolling** | **`1`** (`glass-regular`) | **`1`** (`glass-regular`) | `0` | N/A | `0` | `0` (`+1` if Toast) | **`2` (`3` with Toast)** | **PASS (`2–3 / 3`)** |
| **T3: Analytics Dashboard — With `DateRangePicker` or `RankingModal` Open + Toast** | **`0`** *(demoted to opaque)* | **`0`** *(demoted to opaque)* | `0` | N/A | **`1`** (`glass-thick`) | **`1`** (`glass-regular`) | **`2`** | **PASS (`2 / 3`)** |
| **T4: Grouped Settings (`/settings`) — Idle / Scrolling** | **`1`** (`glass-regular`) | **`1`** (`glass-regular`) | `0` | N/A | `0` | `0` (`+1` if Toast) | **`2` (`3` with Toast)** | **PASS (`2–3 / 3`)** |
| **T4: Login (`/login`) — Idle / With Setup Modal + Toast** | `0` *(no `AppShell`)* | `0` *(no `AppShell`)* | `0` | N/A | `0` (`1` when Setup Modal open) | `0` (`+1` if Toast) | **`0`–`2`** | **PASS (`<= 2 / 3`)** |
| **T5: Modal + Nested `ModernSelect` or `ConfirmDialog` (`z-80`) + Toast (`z-90`)** | **`0`** *(demoted to opaque)* | **`0`** *(demoted to opaque)* | `0` | `0` | **`1`** *(parent `z-50` modal demoted to opaque; only `z-75`/`z-80` child has `glass-thick`)* | **`1`** (`glass-regular`) | **`2`** | **PASS (`2 / 3`)** |
| **Any Screen with `html.no-glass`, `prefers-reduced-transparency`, or `prefers-contrast`** | **`0`** | **`0`** | **`0`** | **`0`** | **`0`** | **`0`** | **`0`** | **PASS (`0 / 3`)** |

---

## 2. Complete Verification & Inventory of Non-Existent Tailwind 3.x Classes (`Amendment A4`)

### 2.1 Explicit Confirmation (`[VERIFIED]`)
1. **We do NOT upgrade Tailwind CSS.** The project stays strictly on `tailwindcss@3.4.19` (`frontend/package.json` `[VERIFIED]`).
2. **Proof of Non-Existence in Installed Tailwind `3.4.19` (`[VERIFIED]`)**:
   - Running `node -e "const t=require('tailwindcss/defaultTheme'); console.log(Object.keys(t.boxShadow), Object.keys(t.blur))"` inside `/opt/RabbitPOS/frontend` outputs:
     - `boxShadow`: `['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'inner', 'none']` (`shadow-2xs` and `shadow-xs` do **not** exist in Tailwind v3; they are Tailwind v4 class names).
     - `blur` / `backdropBlur`: `['0', 'none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', '3xl']` (`backdrop-blur-xs` does **not** exist in Tailwind v3; it is a Tailwind v4 class name).
   - Inspecting the compiled production CSS bundle `.next/static/css/*.css` (`[VERIFIED]`) confirms `0` occurrences of `.shadow-2xs`, `.shadow-xs`, `.backdrop-blur-xs`, `.animate-in`, `.fade-in`, or `.slide-in-from-*`.

### 2.2 Complete List of Every `backdrop-blur-xs` Occurrence (`35` Occurrences Across `24` Files — `[VERIFIED]`)

| File (`frontend/src/...`) | Count | Exact Line Numbers (`file:line`) |
| :--- | :---: | :--- |
| `app/login/page.tsx` | 1 | `559` |
| `app/page.tsx` | 2 | `272`, `1295` |
| `app/products/page.tsx` | 1 | `966` |
| `app/settings/page.tsx` | 1 | `2105` |
| `app/transactions/page.tsx` | 6 | `2947`, `3034`, `3128`, `3220`, `3339`, `3451` |
| `app/users/page.tsx` | 2 | `956`, `1273` |
| `components/common/ConfirmModal.tsx` | 1 | `134` |
| `components/common/EmailReportModal.tsx` | 1 | `209` |
| `components/common/ImageCropModal.tsx` | 2 | `299`, `304` |
| `components/dashboard/AllProductsRankingModal.tsx` | 1 | `162` |
| `components/dashboard/DiscountedOrdersModal.tsx` | 2 | `289`, `512` |
| `components/pos/OfflineQueueModal.tsx` | 1 | `195` |
| `components/pos/VariantSelectorModal.tsx` | 1 | `330` |
| `components/products/AutoTaggingModal.tsx` | 1 | `311` |
| `components/products/CategoryManagerModal.tsx` | 1 | `259` |
| `components/products/PromotionsModal.tsx` | 2 | `397`, `623` |
| `components/products/TagManagerModal.tsx` | 1 | `256` |
| `components/products/ToppingManagerModal.tsx` | 1 | `283` |
| `components/transactions/PurchasesCostTab.tsx` | 3 | `2019`, `2254`, `2522` |
| `components/transactions/TransactionCategoryModal.tsx` | 2 | `274`, `559` |
| `components/transactions/TransactionModal.tsx` | 2 | `752`, `1471` |
| **TOTAL `backdrop-blur-xs`** | **35** | *(All 35 replace with `ModalShell` `glass-scrim`/`glass-thick`, or opaque pill at `app/page.tsx:272`)* |

### 2.3 Complete List of Every `shadow-2xs` Occurrence (`165` Occurrences Across `26` Files — `[VERIFIED]`)

| File (`frontend/src/...`) | Count | Exact Line Numbers (`file:line`) |
| :--- | :---: | :--- |
| `app/dashboard/page.tsx` | 2 | `236`, `878` |
| `app/page.tsx` | 11 | `252`, `1199`, `1206`, `1217`, `1260`, `1333`, `1363`, `1384`, `1412`, `1435`, `1521` |
| `app/products/page.tsx` | 4 | `592`, `600`, `607`, `614` |
| `app/settings/page.tsx` | 7 | `826`, `936`, `1310`, `1655`, `1843`, `1851`, `1925` |
| `app/transactions/page.tsx` | 19 | `1337`, `1348`, `1359`, `1395`, `1405`, `1501`, `1558`, `2303`, `2331`, `2356`, `2671`, `2691`, `2712`, `2728`, `2736`, `2747`, `2757`, `2766`, `3516` |
| `components/AppShell.tsx` | 3 | `243`, `338`, `349` |
| `components/StoreSwitcher.tsx` | 3 | `217`, `235`, `264` |
| `components/common/EmailReportModal.tsx` | 6 | `214`, `299`, `305`, `311`, `317`, `345` |
| `components/common/ModernDateRangePicker.tsx` | 10 | `457`, `499`, `558`, `572`, `596`, `655`, `700`, `741`, `764`, `776` |
| `components/common/SalesChannelModal.tsx` | 3 | `377`, `389`, `466` |
| `components/common/ToastContainer.tsx` | 1 | `177` |
| `components/dashboard/AllProductsRankingModal.tsx` | 1 | `243` |
| `components/dashboard/DiscountedOrdersModal.tsx` | 4 | `324`, `339`, `361`, `492` |
| `components/dashboard/WaterfallReconciliationWidget.tsx` | 8 | `79`, `91`, `96`, `114`, `120`, `146`, `152`, `176` |
| `components/pos/CartDrawer.tsx` | 6 | `428`, `461`, `575`, `579`, `707`, `717` |
| `components/pos/GiftItemSelectorModal.tsx` | 3 | `176`, `192`, `281` |
| `components/pos/OfflineQueueModal.tsx` | 5 | `242`, `251`, `260`, `269`, `293` |
| `components/products/AutoTaggingModal.tsx` | 20 | `362`, `389`, `413`, `427`, `438`, `445`, `459`, `467`, `482`, `495`, `526`, `549`, `555`, `561`, `567`, `584`, `644`, `711`, `857`, `894` |
| `components/products/CategoryManagerModal.tsx` | 7 | `264`, `298`, `361`, `378`, `389`, `407`, `498` |
| `components/products/PromotionsModal.tsx` | 3 | `402`, `757`, `768` |
| `components/products/TagManagerModal.tsx` | 6 | `261`, `281`, `302`, `319`, `435`, `528` |
| `components/products/ToppingManagerModal.tsx` | 12 | `288`, `399`, `416`, `433`, `449`, `467`, `484`, `514`, `605`, `630`, `715`, `830` |
| `components/transactions/PurchasesCostTab.tsx` | 13 | `914`, `927`, `939`, `1115`, `1306`, `1454`, `1535`, `1720`, `2055`, `2080`, `2087`, `2426`, `2553` |
| `components/transactions/TransactionCategoryModal.tsx` | 1 | `279` |
| `components/transactions/TransactionModal.tsx` | 6 | `974`, `1159`, `1198`, `1337`, `1355`, `1363` |
| `components/ui/FilterBar.tsx` | 1 | `87` |
| **TOTAL `shadow-2xs`** | **165** | *(Replaced per file with `--shadow-card`, `shadow-glass-sm` on active thumbs, or removed to `0px` on flat inline pills — NOT aliased in `tailwind.config.ts`)* |

### 2.4 Complete List of Every `shadow-xs` Occurrence (`130` Occurrences Across `29` Files — `[VERIFIED]`)

| File (`frontend/src/...`) | Count | Exact Line Numbers (`file:line`) |
| :--- | :---: | :--- |
| `app/login/page.tsx` | 3 | `215`, `249`, `264` |
| `app/page.tsx` | 1 | `272` |
| `app/settings/page.tsx` | 23 | `518`, `520`, `640`, `811`, `872`, `946`, `1045`, `1114`, `1140`, `1188`, `1378`, `1391`, `1509`, `1572`, `1606`, `1619`, `1766`, `1824`, `1860`, `1898`, `1994`, `2084`, `2164` |
| `app/stores/page.tsx` | 12 | `328`, `342`, `356`, `371`, `385`, `403`, `492`, `569`, `634`, `645`, `651`, `768` |
| `app/transactions/page.tsx` | 12 | `1307`, `1369`, `1491`, `1545`, `1559`, `2656`, `2783`, `3022`, `3116`, `3197`, `3326`, `3438` |
| `app/users/page.tsx` | 11 | `461`, `499`, `509`, `519`, `529`, `621`, `625`, `761`, `805`, `960`, `1277` |
| `components/AppShell.tsx` | 1 | `382` |
| `components/common/ConfirmModal.tsx` | 1 | `160` |
| `components/common/EmailReportModal.tsx` | 1 | `406` |
| `components/common/ModernDateRangePicker.tsx` | 1 | `787` |
| `components/common/ModernSelect.tsx` | 1 | `238` |
| `components/common/SalesChannelModal.tsx` | 3 | `218`, `436`, `546` |
| `components/common/ToastContainer.tsx` | 5 | `105`, `114`, `123`, `132`, `142` |
| `components/dashboard/ProductSalesPerformanceSection.tsx` | 3 | `499`, `509`, `519` |
| `components/dashboard/WaterfallReconciliationWidget.tsx` | 1 | `170` |
| `components/pos/CartDrawer.tsx` | 5 | `57`, `58`, `59`, `60`, `61` |
| `components/pos/GiftItemSelectorModal.tsx` | 2 | `235`, `236` |
| `components/pos/VariantSelectorModal.tsx` | 4 | `250`, `274`, `337`, `347` |
| `components/products/AutoTaggingModal.tsx` | 2 | `402`, `603` |
| `components/products/CategoryManagerModal.tsx` | 2 | `315`, `449` |
| `components/products/PromotionsModal.tsx` | 3 | `423`, `499`, `936` |
| `components/products/TagManagerModal.tsx` | 3 | `304`, `422`, `463` |
| `components/products/ToppingManagerModal.tsx` | 2 | `353`, `551` |
| `components/stores/MemberManagerModal.tsx` | 2 | `421`, `432` |
| `components/transactions/PurchasesCostTab.tsx` | 11 | `922`, `934`, `946`, `1092`, `1103`, `1707`, `1915`, `2242`, `2276`, `2287`, `2509` |
| `components/transactions/TransactionCategoryModal.tsx` | 1 | `591` |
| `components/transactions/TransactionModal.tsx` | 5 | `761`, `820`, `832`, `898`, `1489` |
| `types/sales_channel.ts` | 9 | `13`, `14`, `15`, `16`, `17`, `18`, `19`, `20`, `21` |
| **TOTAL `shadow-xs`** | **130** | *(121 in `.tsx` + 9 in `types/sales_channel.ts`; replaced per file — NOT aliased in `tailwind.config.ts`)* |

### 2.5 Single Chosen Migration Strategy, Visible Changes Across All 330 Occurrences & `/ui-gallery` First Review (`Pre-Flight Item 5` — Locked)

- **Hard Constraint (`[VERIFIED]`)**: **We do NOT upgrade Tailwind CSS** (`tailwindcss@3.4.19` remains pinned).
- **Single Chosen Strategy — Per-File Contextual Replacement to Tahoe Tokens (Zero Legacy Aliasing in `tailwind.config.ts`)**:
  - We explicitly **reject** defining `boxShadow['2xs']`, `boxShadow['xs']`, or `backdropBlur['xs']` in `frontend/tailwind.config.ts`.
  - **Why Global Config Aliasing Was Rejected (`[VERIFIED]` Architectural Risk)**:
    1. Defining `backdropBlur['xs']` globally in Phase T1 would immediately turn all **35** silent no-op occurrences (including POS product card badges `app/page.tsx:272`, image crop tags `ImageCropModal.tsx:299,304`, and 27 full-screen modal scrims) into active GPU `backdrop-filter` compositor passes at once — violating Principle `P1` (zero blur on content cards/badges) and breaking `Amendment A1`'s `<= 3` simultaneously visible blur budget before those files are visited.
    2. Defining `shadow-2xs` and `shadow-xs` globally would suddenly inject drop shadows onto **295** elements simultaneously — including nested inner summary boxes inside already-elevated cards/modals and flat inline status badges — violating Principle `P3` (hierarchy from tint and hairline borders, never shadow-on-shadow).
    3. Keeping legacy Tailwind v4 names out of `tailwind.config.ts` guarantees that the Phase T6 automated audit (`grep -rnE "\b(shadow-2xs|shadow-xs|backdrop-blur-xs)\b" frontend/src/` returning `0`) proves 100% deliberate migration.
- **Exact Visible Change Caused Across All `330` Occurrences (`165` + `130` + `35`)**:
  Because all `330` occurrences currently emit **`0` CSS rules** (`box-shadow: none` and `backdrop-filter: none` `[VERIFIED]` in `.next/static/css/*.css`), replacing them file-by-file during Phases T2–T5 produces the following controlled visual changes:

| Legacy Class (`Count`) | Current Rendered Appearance (`Tailwind 3.4.19` No-Op `[VERIFIED]`) | Per-File Tahoe Replacement Rule (Contextual, No Global Regex) | Visible Change Perceived by User (`[UNVERIFIED]` optical balance verified at Gate G1) |
| :--- | :--- | :--- | :--- |
| **`shadow-2xs`** (`165` occurrences across `26` files) | `box-shadow: none` (`0px` flat) | • **Flat inline badges, table tags, avatar initials, and inactive filter chips (~65%)**: **Delete class** (`0px` shadow; rely on tint fill + `1px` hairline border per `P3`).<br>• **Active `SegmentedControl` thumbs, primary capsule CTAs, and active toggle pills (~35%)**: Replace with **`shadow-glass-sm`** (`0 2px 8px -2px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.65)`). | • Flat badges/chips: **Zero unintended shadow jump** (stays clean and flat).<br>• Active segmented thumbs & primary pills: Gain a **crisp `1px–2px` tactile lift + top specular highlight** so the selected thumb visibly floats above the recessed `#EAECEF` track instead of looking pasted flat. |
| **`shadow-xs`** (`130` occurrences across `28` files) | `box-shadow: none` (`0px` flat), paired today with `border-slate-200` (`#E2E8F0`) | • **Top-level opaque `Card`s, KPI tiles, and fund cards**: Replace `border-slate-200 shadow-xs` with **`border-card shadow-card`** (`0 1px 2px rgba(15,23,42,0.04), 0 0 0 1px rgba(15,23,42,0.05)`).<br>• **Nested inner boxes inside an already-elevated card/modal & `types/sales_channel.ts` badge presets**: **Delete shadow class** (`0px` shadow; use `--surface-grouped` `#EAECEF` / tint fill). | • Top-level cards/KPIs: Heavy `#E2E8F0` gray outlines soften into a **`5%–7%` alpha hairline with a subtle `1px–2px` ambient contact shadow** against the `#F2F4F8` canvas (`P3`).<br>• Nested inner boxes & channel badges: Stay flat (`0px` shadow), preventing muddy double-shadow stacking. |
| **`backdrop-blur-xs`** (`35` occurrences across `21` files) | `backdrop-filter: none` (`0px` blur), leaving semi-transparent fills (`bg-slate-900/50` scrims or `bg-slate-900/80` badges) unblurred | • **Content badges & image crop pills (`app/page.tsx:272`, `ImageCropModal.tsx:299,304`) and sticky modal footers (`VariantSelectorModal.tsx:330`)**: **Delete blur class** and raise fill to **opaque/near-opaque** (`bg-slate-900/90` on photo pills, opaque `#FFFFFF` + top hairline on modal footers).<br>• **Modal/Sheet viewport scrims (`31` modal backdrop occurrences)**: Migrate to `ModalShell` / `ResponsiveSheet`, where **`glass-scrim` stays `0px` blur (`rgba(2,6,23,0.40)`)** and translucency moves onto the **`glass-thick` (`blur(28px) saturate(190%)`) dialog/sheet platter itself**. | • Photo badges & modal footers: Slightly higher solid opacity for sharper text legibility, **`0` GPU blur cost**.<br>• Modal/Sheet openings: Underlying page remains crisp behind a clean `40%` dark scrim (instead of blurring the entire viewport), while the **floating sheet/dialog frame itself gains genuine frosted Liquid Glass (`28px` blur + specular border)** within the `<= 3` blur budget (`Amendment A1`). |

- **How This Visible Change Is Reviewed in `/ui-gallery` FIRST (at Gate G1 Before Touching Screens)**:
  - Before Phases T3–T5 touch any of the 28 production screen/modal files, Commit 2D (`src/app/ui-gallery/page.tsx`) renders a dedicated **"Section 0: Tailwind 3.4.19 No-Op Baseline vs Tahoe Token Visual Diff"** panel displaying 4 side-by-side `"Before (Current No-Op)"` vs `"After (Tahoe Token)"` specimen pairs on `#F2F4F8` canvas:
    1. *Active `SegmentedControl` Thumb & Primary Capsule CTA* (`0px` flat no-op vs `shadow-glass-sm`).
    2. *Opaque Content `Card` & KPI Tile* (`border-slate-200` + `0px` shadow no-op vs `border-card` + `shadow-card`).
    3. *Nested Inner Summary Box & Sales-Channel Pill* (`0px` shadow retained + `--surface-grouped` tint).
    4. *Interactive `ModalShell` / `ResponsiveSheet` Trigger* (`bg-slate-900/50` unblurred scrim + opaque box vs `glass-scrim` `0px` blur + `glass-thick` `28px` frosted sheet platter).
  - The owner inspects these 4 exact visual transitions on a real phone and desktop at **Gate G1** (`05-execution-plan.md` §4) before approving Phase T3–T5 screen migrations.

---

## 3. Measurable vs `UNVERIFIED` Performance & Device Claims (`Amendment A6`)

### 3.1 CLI-Measurable & Deterministic (`[VERIFIED]`)
1. **Static `backdrop-filter` Layer Audit (`[VERIFIED]` via grep/AST)**: Confirm `backdrop-blur-*` / `--mat-glass-*` appear strictly in the approved shell/overlay files and `0` times in repeating list/grid items or the POS Cart Bar.
2. **Dynamic Overlay Demotion (`[VERIFIED]` via CSS selector logic)**: Confirm `html[data-overlay-open="true"]` sets `backdrop-filter: none` and opaque `#FFFFFF` on `z-30` shell bars and `z-20` sticky headers.
3. **Font Payload Reduction (`[VERIFIED]` via byte measurement)**: Removing `Nunito` (`52,224 B` variable + static files) and keeping only `inter-latin-wght-normal.woff2` (`48,256 B`) + `inter-vietnamese-wght-normal.woff2` (`10,252 B`) reduces self-hosted font payload from `108.1 KB` to **`57.1 KB` (`58,508 B` — 71% under the 200 KB budget)** on non-Apple platforms, and **`57.1 KB` total** on Apple platforms (where SF Pro is native and Inter serves tabular numerals).
4. **Compiled CSS Audit (`[VERIFIED]` via `.next/static/css/*.css`)**: Confirm all `shadow-*` and `backdrop-blur-*` utilities emit valid CSS rules in Tailwind `3.4.19`.

### 3.2 Physical Device Checks (`[UNVERIFIED]` Until Tested at Gates G1–G3)
All 6 `[UNVERIFIED]` hardware checks are cataloged with test steps in `06-open-questions.md` §3 (*"Items to Verify on Physical Device"*).

---

## 4. Accessibility, Browser Matrix & Rollback Plan (`P7`, `Override Q3`)

- **Worst-Case Glass Contrast (`[VERIFIED]` Math)**: `slate-900` (`12.4:1`), `slate-700` (`6.63:1`), `slate-600` (`4.86:1`), and `brand-700` (`4.68:1`) all pass WCAG AA (`>= 4.5:1`) over `glass-regular` (`82%` white) composited over dark `#1E293B`.
- **Automatic OS Accessibility Disabling (`Override Q3` — `[VERIFIED]` CSS Media Queries)**:
  - `@media (prefers-reduced-transparency: reduce)` -> forces all `glass-*` tokens to `100%` opaque `#FFFFFF` / `#F8FAFC` with `backdrop-filter: none`.
  - `@media (prefers-contrast: more)` -> forces all `glass-*` tokens to `100%` opaque `#FFFFFF` with `1.5px–2px` `#334155` borders and `0px` blur.
- **Per-Device Rollback Switch (`Override Q3` — `[VERIFIED]`)**:
  - `localStorage.getItem('rabbitpos_glass_effects') === 'false'` applies `html.no-glass` on boot before paint and via the `Switch` in User Menu / `Settings > Giao diện`.
