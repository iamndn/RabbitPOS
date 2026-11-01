# 02 — Layout, Application Shell, Reachability Matrix & Page Templates

**Status**: Pre-Flight Verified Specification with Owner Overrides Applied (No application code modified)
**Scope**: Role-based shell architecture (`Amendment A3` refined by Pre-Flight Reachability Audit), complete route & top-level tab reachability matrix across `staff`, `admin`, and `SuperAdmin` on `< 768px` and `>= 768px`, responsive breakpoints (`Override Q2`), dynamic overlay demotion (`Amendment A1`), solid tinted POS Quick-Cart Bar (`Amendment A2`), large title behavior (`Override Q4`), and the 5 standard page templates (`T1–T5`).

---

## 1. Role-Based Application Shell Architecture (`Amendment A3`, `Override Q2` & Pre-Flight Audit)

### 1.1 Pre-Flight Navigation Defects Detected & Fixed (`[VERIFIED]` Against Live Codebase)
Auditing every `app/**/page.tsx` route, `frontend/src/components/AppShell.tsx:54–140`, and `backend/internal/routes/routes.go:85–275` (`[VERIFIED]`) uncovered **two navigation reachability defects** in the initial shell draft, both fixed below before Phase T1 begins:

1. **Defect Fixed #1 — Role `staff` Reachability of `/transactions` (`?tab=ledger`, `?tab=orders`, `?tab=funds`)**:
   - **Empirical Finding (`[VERIFIED]`)**: In `AppShell.tsx:108–114`, `staff` (`!canManageStore`) is blocked only from `['/products', '/purchases', '/promotions', '/funds', '/settings', '/stores', '/users']`. In `AppShell.tsx:129, 132`, `staff` currently has **`visible: true` on TWO operational routes**: **`/` (`POS Bán hàng`)** AND **`/transactions` (`Thu chi`)**. Backend RBAC (`routes.go:144–174`) and `app/transactions/page.tsx:273, 1355–2722` explicitly grant `staff` access to `/transactions` so cashiers can: (a) log operational shift expenses (`POST /transactions` on `?tab=ledger`), (b) look up shift orders and reprint receipts (`GET /orders` on `?tab=orders`), and (c) view cashier shift fund balances (`GET /funds/cashier-shift-summary` on `?tab=funds`, while hiding admin-only reconciliation/edit/delete controls).
   - **Why Pure 1-Destination POS Header Was a Defect**: Treating `staff` as strictly `/` POS-only with zero link to `/transactions` would leave `/transactions` (`ledger`, `orders`, `funds`) with **no entry point** for `staff` on `< 768px` or `>= 768px`, violating *"Same routes, same data flow, same functionality"*.
   - **Navigation Fix Applied (`staff` Compact Top Header with 2-Destination Inline Capsule)**:
     - **Preserve `Amendment A3` Zero-Bottom / Zero-Side Chrome**: Role `staff` still renders **NO Bottom Tab Bar on `< 768px`** and **NO Left Sidebar on `>= 768px`**, preserving `+64px` vertical height on mobile POS (with the Solid POS Cart Bar flush above `safe-area-inset-bottom`) and `100%` horizontal width on tablet/desktop POS (`[VERIFIED]`).
     - **Add Inline 2-Destination Capsule in `staff` Compact Top Header**: Inside the `52px` (`< 768px`) / `56px` (`>= 768px`) `glass-regular` Compact Top Header, render a compact 2-pill `SegmentedControl` capsule: **`POS` (`/`) | `Thu chi` (`/transactions`)** alongside `StoreSwitcher` (interactive when `storesList.length > 1`, static store badge when `1` store) and the Cashier User Menu (`VI/EN`, `Hiệu ứng kính`, `Đăng xuất`).
2. **Defect Fixed #2 — Direct 1-Tap Reachability of `/promotions` (`/products?open=promotions`) for `admin` & `SuperAdmin`**:
   - **Empirical Finding (`[VERIFIED]`)**: `app/promotions/page.tsx:10` redirects via `router.replace('/products?open=promotions')` to open `PromotionsModal` (`app/products/page.tsx:284, 613`). Previously, `Khuyến mãi` had no dedicated entry in the mobile `More` sheet or desktop `Sidebar`, requiring the user to navigate to `/products` first and hunt for a secondary toolbar button.
   - **Navigation Fix Applied**: Add **`Khuyến mãi` (`/products?open=promotions`, alias `/promotions`, icon `Tag`)** as an explicit first-class navigation row in **both** the `< 768px` **`Thêm` ("More") Sheet** and the `>= 768px` **Left Sidebar (`Quản trị` group)** for `admin` and `SuperAdmin` (in addition to retaining the toolbar button on `/products`).
3. **Note on `/dashboard` for Role `staff` (`[VERIFIED]` Parity)**:
   - In `AppShell.tsx:133`, `/dashboard` has `visible: canManageStore` (`false` for `staff`), so `staff` has **no navigation entry** to `/dashboard` in production today (even though `AppShell.tsx:109` omits `/dashboard` from `adminRoutes` and `app/dashboard/page.tsx:84, 96, 1564` defensively hides the `profit` tab if `isStaff` visits `/dashboard` by URL). Keeping `/dashboard` restricted to `admin` and `SuperAdmin` in navigation preserves 100% existing behavior without altering auth/route-guard logic.

### 1.2 Breakpoint & Three-Role Shell Matrix (`staff`, `admin`, `SuperAdmin`)

In `frontend/src/lib/auth.ts:54–80` and `AppShell.tsx:54–57` (`[VERIFIED]`), authenticated users resolve to three effective roles:
- **`staff`**: `isStaffRole` (`staff` / `cashier`, `!canManageStore`).
- **`admin`**: Store Owner / Store Admin (`owner` / `store_admin`, `canManageStore === true && !isSuperAdmin`).
- **`SuperAdmin`**: Platform Master (`master` / `super_admin` / `admin`, `isSuperAdmin === true && canManageStore === true`).

| Viewport Tier | Width Range | Role `staff` Shell (`!canManageStore` — 2 Destinations: `/` & `/transactions`) | Role `admin` (`owner` / `store_admin`) & Role `SuperAdmin` (`master`) Shell |
| :--- | :--- | :--- | :--- |
| **Compact & Standard Phone** | `360px – 767px` (`< 768px`) | • **Top Header**: `52px` + `pt-safe` (`glass-regular`) with Store Badge/`StoreSwitcher`, inline **`POS \| Thu chi`** capsule, Online/Offline dot, and Cashier Menu<br>• **Bottom Tab Bar**: **NONE (`0px`)**<br>• **Sidebar**: **NONE (`0px`)**<br>• **POS Cart Bar**: `bottom-[max(0.75rem,env(safe-area-inset-bottom))]` | • **Top Bar**: `52px` + `pt-safe` (`glass-regular`) with Logo, `StoreSwitcher`, scroll-fade inline title (`Q4`), User Menu<br>• **Bottom Tab Bar**: Floating `56px` capsule (`4` primary tabs: `POS`, `Thu chi`, `Nhập hàng`, `Báo cáo` + 5th `Thêm` sheet; `/stores` shown in `Thêm` & `StoreSwitcher` for `SuperAdmin` only)<br>• **Sidebar**: **NONE**<br>• **POS Cart Bar**: `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` |
| **Tablet** | `768px – 1023px` (`md`) | • **Top Header**: `56px` (`glass-regular`) with Store Badge/`StoreSwitcher`, inline **`POS \| Thu chi`** capsule, Online/Offline pill, Cashier Menu<br>• **Bottom Tab Bar**: **NONE**<br>• **Sidebar**: **NONE** (`100%` width for POS/Ledger)<br>• **POS Cart Bar**: `md:bottom-5` centered | • **Top Toolbar**: `56px` (`glass-regular`)<br>• **Bottom Tab Bar**: **NONE**<br>• **Left Sidebar**: **Collapsed `68px` icon-only rail by default** (`Q2`, expandable to `240px`; includes `/stores` icon for `SuperAdmin` only)<br>• **POS Cart Bar**: `md:bottom-5` centered in content column |
| **Desktop & Wide POS** | `>= 1024px` (`lg` – `4k`) | • **Top Header**: `56px` (`glass-regular`) with Store Badge/`StoreSwitcher`, inline **`POS \| Thu chi`** capsule, Online/Offline pill, Cashier Menu<br>• **Bottom Tab Bar**: **NONE**<br>• **Sidebar**: **NONE** (`100%` width for POS/Ledger)<br>• **POS Cart Bar**: `md:bottom-5` centered | • **Top Toolbar**: `56px` (`glass-regular`)<br>• **Bottom Tab Bar**: **NONE**<br>• **Left Sidebar**: **Expanded `240px` by default** (`Q2`, collapsible to `68px` via `localStorage` `rabbitpos_sidebar_collapsed`; includes `/stores` row for `SuperAdmin` only)<br>• **POS Cart Bar**: `md:bottom-5` centered in content column |

---

## 2. Exact Navigation Structure & Complete Reachability Matrix

### 2.1 Admin & SuperAdmin Mobile Bottom Tab Bar (`< 768px` — 4 Primary Tabs + `Thêm` Sheet)

| Slot | Label (`vi` / `en`) | Target Route | Icon (`lucide-react`) | Reasoned Default (`Amendment A3`) |
| :---: | :--- | :--- | :--- | :--- |
| **Tab 1** | `POS` / `POS` | `/` | `ShoppingCart` | Highest-frequency operational workspace (order entry, cart, Cash/VietQR checkout). |
| **Tab 2** | `Thu chi` / `Ledger` | `/transactions` | `ArrowUpRight` | Second highest-frequency daily workflow: `Sổ thu/chi` (`?tab=ledger`), `Lịch sử đơn hàng` (`?tab=orders`), and `Quản lý quỹ` (`?tab=funds` / `/funds`). |
| **Tab 3** | `Nhập hàng` / `Purchases` | `/purchases` | `ShoppingBag` | Core F&B cost workflow (`AGENTS.md` §4): ingredient purchases, multi-level unit conversion, BOM recipe cost, and profit recovery. |
| **Tab 4** | `Báo cáo` / `Reports` | `/dashboard` | `LayoutDashboard` | Checked multiple times per shift on mobile by owners (`Tổng quan`, `Doanh thu`, `Lợi nhuận`). |
| **Tab 5** | `Thêm` / `More` | Opens `ResponsiveSheet` (`z-75`) | `LayoutGrid` | Houses lower-frequency catalog/admin configuration routes (`/products`, `/products?open=promotions`, `/users`, `/settings`, and `/stores` for `SuperAdmin`) plus per-device preferences (`VI/EN`, `Hiệu ứng kính`). Highlights active whenever `pathname` matches any route inside `Thêm`. |

### 2.2 Exact Contents of the `"Thêm (More)"` Sheet (`< 768px`, `admin` & `SuperAdmin`)
1. **Group 1 — Danh mục & Quản trị (Opaque `ListGroup`, `48px` rows)**:
   - **`Thực đơn` (`/products`, icon `Package`)**: Products, variants, categories, toppings, tags, auto-tagging.
   - **`Khuyến mãi` (`/products?open=promotions`, alias `/promotions`, icon `Tag`)**: Direct 1-tap launch into `PromotionsModal` (`Pre-Flight Fix #2`).
   - **`Quản lý nhân sự` (`/users`, icon `Users`)**: User accounts, roles (`Master / Owner / Staff`), store assignments.
   - **`Cài đặt hệ thống` (`/settings`, icon `Settings`)**: Store profile, currency, VietQR, email reports, Google Sheets sync, and (`SuperAdmin` only) backup/restore.
   - **`Chuỗi cửa hàng` (`/stores`, icon `Store`)**: Multi-store CRUD, cloning, and cross-store overview (**rendered strictly when `isSuperAdmin === true`**; also reachable via `StoreSwitcher` footer in Top Bar).
2. **Group 2 — Tùy chọn thiết bị (Device Preferences, Opaque `ListGroup`)**:
   - **`Ngôn ngữ / Language` (`Globe`)**: Inline capsule `SegmentedControl` (`VI | EN`).
   - **`Hiệu ứng kính / Glass effects` (`Sparkles`)**: Per-device `Switch` (`localStorage` key `rabbitpos_glass_effects`, `Override Q3`).
3. **Footer Action**:
   - **`Đăng xuất / Logout` (`LogOut`)**: Soft danger capsule button (`POST /auth/logout` $\to$ `/login`).

### 2.3 Exact Contents of the Left Sidebar (`>= 768px`, `admin` & `SuperAdmin`)
- **Group A — Vận hành hằng ngày (Daily Operations)**:
  1. `POS` (`/`, `ShoppingCart`)
  2. `Thu chi` (`/transactions`, `ArrowUpRight`)
  3. `Nhập hàng` (`/purchases`, `ShoppingBag`)
  4. `Báo cáo` (`/dashboard`, `LayoutDashboard`)
- **Hairline Divider (`--separator-hairline`)**
- **Group B — Quản trị & Cấu hình (Management & Setup)**:
  5. `Thực đơn` (`/products`, `Package`)
  6. `Khuyến mãi` (`/products?open=promotions`, `Tag`)
  7. `Nhân sự` (`/users`, `Users`)
  8. `Cài đặt` (`/settings`, `Settings`)
  9. `Chuỗi cửa hàng` (`/stores`, `Store` — **`SuperAdmin` only**)
- **Pinned Sidebar Footer**:
  - Collapse/Expand toggle button (`68px` $\leftrightarrow$ `240px`, `localStorage` `rabbitpos_sidebar_collapsed`), `VI | EN` pill, and `Hiệu ứng kính` quick switch (also accessible via Top Toolbar User Menu popover).

### 2.4 Complete Route & Top-Level Tab Reachability Matrix (`[VERIFIED]` Against All `app/**/page.tsx` Files)

Every single Next.js route in `frontend/src/app/` (`11` production routes + `1` dev-only verification route) and every top-level internal tab/view is accounted for below across all `3` roles and both viewport tiers (`0` orphaned or unreachable routes `[VERIFIED]`):

| Route / URL & Source File (`[VERIFIED]`) | Top-Level Page / Internal Tab / Modal View | Role: `staff` (`< 768px` Phone) | Role: `staff` (`>= 768px` Tablet/Desktop) | Role: `admin` (`owner` / `store_admin`, `< 768px`) | Role: `admin` (`owner` / `store_admin`, `>= 768px`) | Role: `SuperAdmin` (`master`, `< 768px`) | Role: `SuperAdmin` (`master`, `>= 768px`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`/login`**<br>`app/login/page.tsx` | Public Auth (`login` mode, `register` mode, `setup-password` modal) | Unauthenticated auto-redirect (`AppShell.tsx:99`) or **Header Cashier Menu $\to$ `Đăng xuất`** | Unauthenticated auto-redirect or **Header Cashier Menu $\to$ `Đăng xuất`** | Unauthenticated auto-redirect or **`Thêm` Sheet / Header User Menu $\to$ `Đăng xuất`** | Unauthenticated auto-redirect or **Header User Menu $\to$ `Đăng xuất`** | Unauthenticated auto-redirect or **`Thêm` Sheet / Header User Menu $\to$ `Đăng xuất`** | Unauthenticated auto-redirect or **Header User Menu $\to$ `Đăng xuất`** |
| **`/`**<br>`app/page.tsx` | **POS Bán hàng** (Catalog, CartDrawer, Cash/VietQR Checkout, Offline Queue) | **Compact Top Header** inline capsule **`POS`** (plus Logo tap) | **Compact Top Header** inline capsule **`POS`** (plus Logo tap) | **Bottom Tab Bar — Tab 1 (`POS`)** (plus Logo tap) | **Left Sidebar — Item 1 (`POS`)** (plus Logo tap) | **Bottom Tab Bar — Tab 1 (`POS`)** (plus Logo tap) | **Left Sidebar — Item 1 (`POS`)** (plus Logo tap) |
| **`/transactions`** (`?tab=ledger`)<br>`app/transactions/page.tsx` | **Thu chi — Tab 1: `Sổ thu/chi`** (Financial Ledger) | **Compact Top Header** inline capsule **`Thu chi`** $\to$ default segmented tab `Sổ thu/chi` *(view + add expense; no edit/delete)* | **Compact Top Header** inline capsule **`Thu chi`** $\to$ default segmented tab `Sổ thu/chi` *(view + add expense; no edit/delete)* | **Bottom Tab Bar — Tab 2 (`Thu chi`)** $\to$ segmented tab `Sổ thu/chi` *(full CRUD)* | **Left Sidebar — Item 2 (`Thu chi`)** $\to$ segmented tab `Sổ thu/chi` *(full CRUD)* | **Bottom Tab Bar — Tab 2 (`Thu chi`)** $\to$ segmented tab `Sổ thu/chi` *(full CRUD)* | **Left Sidebar — Item 2 (`Thu chi`)** $\to$ segmented tab `Sổ thu/chi` *(full CRUD)* |
| **`/transactions?tab=orders`**<br>`app/transactions/page.tsx` | **Thu chi — Tab 2: `Lịch sử đơn hàng`** (Order History & Receipt Reprint) | **Compact Top Header** capsule **`Thu chi`** $\to$ segmented tab `Lịch sử đơn hàng` *(view + print receipt; no cancel/delete)* | **Compact Top Header** capsule **`Thu chi`** $\to$ segmented tab `Lịch sử đơn hàng` *(view + print receipt; no cancel/delete)* | **Bottom Tab Bar — Tab 2 (`Thu chi`)** $\to$ segmented tab `Lịch sử đơn hàng` *(full + cancel/delete)* | **Left Sidebar — Item 2 (`Thu chi`)** $\to$ segmented tab `Lịch sử đơn hàng` *(full + cancel/delete)* | **Bottom Tab Bar — Tab 2 (`Thu chi`)** $\to$ segmented tab `Lịch sử đơn hàng` *(full + cancel/delete)* | **Left Sidebar — Item 2 (`Thu chi`)** $\to$ segmented tab `Lịch sử đơn hàng` *(full + cancel/delete)* |
| **`/transactions?tab=funds`** & **`/funds`**<br>`app/funds/page.tsx` | **Thu chi — Tab 3: `Quản lý quỹ`** (`/funds` redirects via `router.replace('/transactions?tab=funds')`) | **Compact Top Header** capsule **`Thu chi`** $\to$ segmented tab `Quản lý quỹ` *(shift summary & balances; `/funds` direct alias redirects `staff` to `/` per `AppShell:109`)* | **Compact Top Header** capsule **`Thu chi`** $\to$ segmented tab `Quản lý quỹ` *(shift summary & balances; no reconcile mutations)* | **Bottom Tab Bar — Tab 2 (`Thu chi`)** $\to$ segmented tab `Quản lý quỹ` *(full reconciliation CRUD; `/funds` alias redirects here)* | **Left Sidebar — Item 2 (`Thu chi`)** $\to$ segmented tab `Quản lý quỹ` *(full reconciliation CRUD; `/funds` alias redirects here)* | **Bottom Tab Bar — Tab 2 (`Thu chi`)** $\to$ segmented tab `Quản lý quỹ` *(full reconciliation CRUD; `/funds` alias redirects here)* | **Left Sidebar — Item 2 (`Thu chi`)** $\to$ segmented tab `Quản lý quỹ` *(full reconciliation CRUD; `/funds` alias redirects here)* |
| **`/purchases`**<br>`app/purchases/page.tsx` | **Nhập hàng — Sub-tab 1: `Thu hồi vốn & Giá vốn BOM`** (`profit-recovery`) | *Blocked (`AppShell:109` redirects to `/`; backend `storeAdmin`)* | *Blocked (`AppShell:109` redirects to `/`; backend `storeAdmin`)* | **Bottom Tab Bar — Tab 3 (`Nhập hàng`)** $\to$ default sub-tab `Thu hồi vốn & Giá vốn BOM` | **Left Sidebar — Item 3 (`Nhập hàng`)** $\to$ default sub-tab `Thu hồi vốn & Giá vốn BOM` | **Bottom Tab Bar — Tab 3 (`Nhập hàng`)** $\to$ default sub-tab `Thu hồi vốn & Giá vốn BOM` | **Left Sidebar — Item 3 (`Nhập hàng`)** $\to$ default sub-tab `Thu hồi vốn & Giá vốn BOM` |
| **`/purchases`** (`ingredients`)<br>`PurchasesCostTab.tsx` | **Nhập hàng — Sub-tab 2: `Nguyên liệu & Quy đổi`** (`ingredients` + Purchase Expense Modal) | *Blocked (`AppShell:109` redirects to `/`)* | *Blocked (`AppShell:109` redirects to `/`)* | **Bottom Tab Bar — Tab 3 (`Nhập hàng`)** $\to$ segmented sub-tab `Nguyên liệu & Quy đổi` | **Left Sidebar — Item 3 (`Nhập hàng`)** $\to$ segmented sub-tab `Nguyên liệu & Quy đổi` | **Bottom Tab Bar — Tab 3 (`Nhập hàng`)** $\to$ segmented sub-tab `Nguyên liệu & Quy đổi` | **Left Sidebar — Item 3 (`Nhập hàng`)** $\to$ segmented sub-tab `Nguyên liệu & Quy đổi` |
| **`/dashboard`**<br>`app/dashboard/page.tsx` | **Báo cáo — Tabs: `Tổng quan` (`overview`), `Doanh thu` (`revenue`), `Lợi nhuận` (`profit`)** | *Not in `staff` nav (`AppShell:133` `visible: canManageStore`; `profit` hidden if URL visited directly)* | *Not in `staff` nav (`AppShell:133` `visible: canManageStore`; `profit` hidden if URL visited directly)* | **Bottom Tab Bar — Tab 4 (`Báo cáo`)** $\to$ segmented tabs `Tổng quan` \| `Doanh thu` \| `Lợi nhuận` | **Left Sidebar — Item 4 (`Báo cáo`)** $\to$ segmented tabs `Tổng quan` \| `Doanh thu` \| `Lợi nhuận` | **Bottom Tab Bar — Tab 4 (`Báo cáo`)** $\to$ segmented tabs `Tổng quan` \| `Doanh thu` \| `Lợi nhuận` | **Left Sidebar — Item 4 (`Báo cáo`)** $\to$ segmented tabs `Tổng quan` \| `Doanh thu` \| `Lợi nhuận` |
| **`/products`**<br>`app/products/page.tsx` | **Thực đơn** (Products + toolbar modals: `Danh mục`, `Topping`, `Nhãn`, `Auto-Tag`) | *Blocked (`AppShell:109` redirects to `/`)* | *Blocked (`AppShell:109` redirects to `/`)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 1 (`Thực đơn`)** | **Left Sidebar — Item 5 (`Thực đơn`)** | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 1 (`Thực đơn`)** | **Left Sidebar — Item 5 (`Thực đơn`)** |
| **`/promotions`** & **`/products?open=promotions`**<br>`app/promotions/page.tsx` | **Khuyến mãi** (`/promotions` redirects to `/products?open=promotions` $\to$ `PromotionsModal`) | *Blocked (`AppShell:109` redirects to `/`)* | *Blocked (`AppShell:109` redirects to `/`)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 2 (`Khuyến mãi`)** *(plus toolbar button on `/products`)* | **Left Sidebar — Item 6 (`Khuyến mãi`)** *(plus toolbar button on `/products`)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 2 (`Khuyến mãi`)** *(plus toolbar button on `/products`)* | **Left Sidebar — Item 6 (`Khuyến mãi`)** *(plus toolbar button on `/products`)* |
| **`/users`**<br>`app/users/page.tsx` | **Quản lý nhân sự** (Staff/Owner/Master accounts & store memberships) | *Blocked (`AppShell:109` & `users/page.tsx:107` redirect to `/`)* | *Blocked (`AppShell:109` & `users/page.tsx:107` redirect to `/`)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 3 (`Quản lý nhân sự`)** *(also Header User Menu)* | **Left Sidebar — Item 7 (`Nhân sự`)** *(also Header User Menu)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 3 (`Quản lý nhân sự`)** *(also Header User Menu)* | **Left Sidebar — Item 7 (`Nhân sự`)** *(also Header User Menu)* |
| **`/settings`**<br>`app/settings/page.tsx` | **Cài đặt — Tabs 1–5**: `Cửa hàng` (`store`), `Tiền tệ` (`currency`), `VietQR` (`vietqr`), `Email` (`email`), `Google Sheets` (`sheets`) | *Blocked (`AppShell:109` redirects to `/`; device `VI/EN` & `Hiệu ứng kính` are in Header Cashier Menu)* | *Blocked (`AppShell:109` redirects to `/`; device `VI/EN` & `Hiệu ứng kính` are in Header Cashier Menu)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 4 (`Cài đặt hệ thống`)** $\to$ section pills `1–5` *(SMTP test button hidden)* | **Left Sidebar — Item 8 (`Cài đặt`)** $\to$ left section list `1–5` *(also Header User Menu)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 4 (`Cài đặt hệ thống`)** $\to$ section pills `1–5` *(includes SMTP test)* | **Left Sidebar — Item 8 (`Cài đặt`)** $\to$ left section list `1–5` *(includes SMTP test)* |
| **`/settings`** (`backup` tab)<br>`app/settings/page.tsx:619` | **Cài đặt — Tab 6: `Sao lưu & Nhập dữ liệu`** (`backup`: Excel Import & Full JSON AEAD Backup/Restore) | *Blocked (`AppShell:109`)* | *Blocked (`AppShell:109`)* | *Hidden (`settings/page.tsx:619` renders `backup` tab strictly for `isSuperAdmin`; backend `/backup/*` is `RoleMaster`)* | *Hidden (`settings/page.tsx:619` `isSuperAdmin` only)* | **`Thêm` Sheet $\to$ `Cài đặt hệ thống` $\to$ pill `Sao lưu & Khôi phục`** | **Left Sidebar $\to$ `Cài đặt` $\to$ row `Sao lưu & Khôi phục`** |
| **`/stores`**<br>`app/stores/page.tsx` | **Chuỗi cửa hàng** (Platform Store CRUD, Cloning, Members & Cross-Store Overview) | *Blocked (`AppShell:109, 117` redirects to `/`; multi-store `staff` switches active store via Header `StoreSwitcher`)* | *Blocked (`AppShell:109, 117`; multi-store `staff` switches active store via Header `StoreSwitcher`)* | *Blocked (`AppShell:117` & `stores/page.tsx:275` require `isSuperAdmin`; multi-store `admin` switches store via Header `StoreSwitcher`)* | *Blocked (`AppShell:117` & `stores/page.tsx:275`; multi-store `admin` switches store via Header `StoreSwitcher`)* | **Bottom Tab Bar — Tab 5 (`Thêm` Sheet) $\to$ Row 5 (`Chuỗi cửa hàng`)** *(AND Header `StoreSwitcher` footer link)* | **Left Sidebar — Item 9 (`Chuỗi cửa hàng`)** *(AND Header `StoreSwitcher` footer link)* |
| **`/ui-gallery`** *(Phases T2–T5 dev only; deleted in T6)* | **Temporary Tahoe Specimen Gallery (`Override Q7`)** | *Blocked (`isAdmin()` redirects to `/`; absent from all nav)* | *Blocked (`isAdmin()` redirects to `/`; absent from all nav)* | **Direct URL entry only on `:3001` dev server** *(absent from all nav; `0` API calls; deleted in Phase T6)* | **Direct URL entry only on `:3001` dev server** *(absent from all nav; `0` API calls; deleted in Phase T6)* | **Direct URL entry only on `:3001` dev server** *(absent from all nav; `0` API calls; deleted in Phase T6)* | **Direct URL entry only on `:3001` dev server** *(absent from all nav; `0` API calls; deleted in Phase T6)* |

---

## 3. Scroll-Edge Behavior, Dynamic Overlay Demotion & Safe Areas (`Amendments A1 & A2`)

### 3.1 Passive Scroll-Edge Transition (`Override Q4` Approved)
- A single passive scroll listener (`{ passive: true }`) in `AppShell` toggles `data-scrolled="true"` on `<header>` when `window.scrollY > 12` (zero React `setState` re-renders during scroll `[VERIFIED]`).
- **On Management/Report Pages (`/transactions`, `/purchases`, `/dashboard`, `/products`, `/settings`, `/users`, `/stores`)**:
  - At top of page (`scrollY <= 12`): The page's `Large Title` (`26px` mobile / `28px` desktop) is visible in the page header; the Top Bar's inline title slot is `opacity-0` (`staff` header keeps its compact `POS | Thu chi` capsule visible instead of an inline title).
  - When scrolled (`scrollY > 48`): On `admin` / `SuperAdmin` screens, the Top Bar's inline title (`text-headline` `15px` semibold) softly fades to `opacity-100`.
- **On POS (`/`)**:
  - No `Large Title` is rendered (`0px` vertical overhead per `Override Q4`), so the search capsule, category rail, and product grid appear immediately below the Top Bar.

### 3.2 Dynamic Background-Bar Demotion When Any Overlay Opens (`Amendment A1`)
- Whenever any overlay (`ResponsiveSheet`, `ModalShell`, or `ConfirmModal`) mounts, a shared ref-counted utility increments an active overlay counter and sets `document.documentElement.setAttribute('data-overlay-open', 'true')`.
- Under `html[data-overlay-open="true"]`:
  - The `AppShell` Top Bar (`z-30`), Mobile Bottom Tab Bar (`z-30`), Desktop Sidebar (`z-30`), and any sticky `glass-thin` sub-header (`z-20`) **immediately switch from `glass-regular`/`glass-thin` to opaque `#FFFFFF` (`backdrop-filter: none`)** (`[VERIFIED]` deterministic CSS selector; visual transition smoothness on hardware marked `[UNVERIFIED]` `V2` in `06-open-questions.md`).
  - When the overlay closes and the counter returns to `0`, `data-overlay-open` is removed and the shell bars restore their `glass-regular` blur.

### 3.3 390px ASCII Wireframes — POS Screen (`admin`/`SuperAdmin` vs `staff` with 2-Item Header Capsule)
```
[A. Admin / SuperAdmin Mobile POS (390px) — Solid Cart Bar + Glass Tab Bar Coexistence]
+---------------------------------------+
|  [Notch / Dynamic Island Safe Inset]  | pt-safe
| (Logo) [Chi nhanh Q1 v]  [Online] (AD)| Top Bar: h-13 (52px) glass-regular z-30
+---------------------------------------+
| ( 🔍 Tim mon nhanh... ) (SX) (Tag)    | Search & Sort Capsule Row (h-11, 44px)
+---------------------------------------+
| .----------. .----------. .---------. |
| | Danh muc | | [Anh]    | | [Anh]   | | Opaque Category Rail + 2-Col Opaque
| |----------| | Ca phe   | | Tra dao | | Product Cards (0 backdrop-filter!)
| |*Tat ca 42| | 29.000 d | | 35.000 d| |
| '----------' '----------' '---------' |
| .-----------------------------------. | <- z-35 SOLID #2E1065 Cart Bar (0 blur!)
| | (🛍️3) 96.000 d  (Tien mat) (VietQR)| |    bottom: calc(4.5rem + safe-area)
| '-----------------------------------' |
|                 (8px gap)             |
| .-----------------------------------. | <- z-30 Glass Tab Bar Platter (h-14)
| | (*POS) (ThuChi) (Nhap) (BCao) (+) | |    bottom: max(0.5rem, safe-area)
| '-----------------------------------' |
|        [=== Home Indicator ===]       | env(safe-area-inset-bottom)
+---------------------------------------+

[B. Staff Mobile POS (390px) — No Bottom Tab Bar, 2-Item Header Capsule (POS | Thu chi)]
+---------------------------------------+
|  [Notch / Dynamic Island Safe Inset]  | pt-safe
| (Logo Q1) [(*POS)|ThuChi] [●]  (NV v) | Compact Header: h-13 glass-regular z-30
+---------------------------------------+
| ( 🔍 Tim mon nhanh... ) (SX) (Tag)    | Search & Sort Capsule Row (h-11, 44px)
+---------------------------------------+
| .----------. .----------. .---------. |
| | Danh muc | | [Anh]    | | [Anh]   | | +64px more vertical space for products!
| |----------| | Ca phe   | | Tra dao | |
| |*Tat ca 42| | 29.000 d | | 35.000 d| |
| | Ca phe 12| '----------' '---------' |
| | Tra    15| .----------. .---------. |
| | Sinh to 8| | [Anh]    | | [Anh]   | |
| '----------' | Bac xiu  | | Matcha  | |
|              | 32.000 d | | 42.000 d| |
|              '----------' '---------' |
| .-----------------------------------. | <- z-35 SOLID #2E1065 Cart Bar (0 blur!)
| | (🛍️3) 96.000 d  (Tien mat) (VietQR)| |    bottom: max(0.75rem, safe-area)
| '-----------------------------------' |
|        [=== Home Indicator ===]       | env(safe-area-inset-bottom)
+---------------------------------------+
```

---

## 4. The 5 Standard Page Templates (`T1–T5`)

| Template ID | Name & Assigned Screens | Header Pattern (`Override Q4`) | Primary Surface Structure (`P1`) | Active `backdrop-filter` Layers (Idle / With Open Overlay + Toast) |
| :--- | :--- | :--- | :--- | :--- |
| **T1** | **Split POS Workspace** (`/`) | **No Large Title**; compact Search capsule + Sort/Tag triggers directly below Top Bar | Opaque sticky Category Rail (`Card`) + Opaque 2–8 col Product Grid (`Card`) + **Solid `#2E1065` POS Quick-Cart Bar (`z-35`, `0` blur)** | • Idle (`staff`): **1** (`Top Bar`)<br>• Idle (`admin`/`SuperAdmin`): **2** (`Top Bar` + `Tab Bar`/`Sidebar`)<br>• With Overlay + Toast: **2** (`Overlay` + `Toast`; shell bars demote to opaque!) |
| **T2** | **Data List / Ledger + FilterBar** (`/transactions`, `/purchases`, `/products`, `/users`, `/stores`) | Static `Large Title` (`26px/28px`) + Primary Capsule CTA; inline title fades into Top Bar on scroll | Capsule `SegmentedControl` (optional) + Opaque KPI Strip + `FilterBar` + Mobile Opaque `ListGroup` / Desktop Opaque Table (`glass-thin` sticky `<thead>` only when scrolling table) | • Idle (`staff` on `/transactions`): **1–2** (`Top Bar` + optional sticky `<thead>`)<br>• Idle (`admin`/`SuperAdmin`): **2–3**<br>• With Overlay + Toast: **2** (`Overlay` + `Toast`; shell bars & `<thead>` demote to opaque!) |
| **T3** | **Analytics & KPI Dashboard** (`/dashboard`) | Static `Large Title` + Timeframe/Export `FilterBar` | Opaque KPI `Card` grid + Opaque `WaterfallReconciliationWidget` + Opaque Chart & Ranking `Card`s | • Idle: **2** (`Top Bar` + `Tab Bar`/`Sidebar`)<br>• With Overlay + Toast: **2** (`Overlay` + `Toast`) |
| **T4** | **Grouped Settings & Auth** (`/settings`, `/login`) | Static `Large Title` + Primary `Lưu cài đặt` Capsule CTA (`/settings`); Centered `rounded-panel` Card (`/login`) | Scrollable capsule section pills (`< 768px`) / Left `ListGroup` (`>= 768px`) + Opaque inset grouped `Card` blocks with `FieldShell` & `Switch` rows | • Idle (`/settings`): **2** (`Top Bar` + `Tab Bar`/`Sidebar`)<br>• Idle (`/login`): **0** (or **1** if Toast active)<br>• With Overlay + Toast: **2** (`Overlay` + `Toast`) |
| **T5** | **Modal & Focused Task Sheet** (`ModalShell` / `ResponsiveSheet` / `ConfirmModal`) | Sticky header (`Title 3` `17px/18px` + `44px` close `IconButton`) + top grabber on mobile | Outer shell: **`glass-thick`** (`1` blur layer) over unblurred **`glass-scrim`** (`0` blur). Inner cards, tables, and sticky footer: **Opaque** (`0` blur). Sets `html[data-overlay-open="true"]`. | • Single Modal/Sheet open: **1** (`Overlay`)<br>• Modal/Sheet + Toast: **2** (`Overlay` + `Toast`)<br>• Nested Modal/Confirm over Modal + Toast: **2** (lower modal demotes to opaque + `Topmost Overlay` + `Toast`) |
