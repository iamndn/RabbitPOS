# T3 Diff Audit (read-only)

- Compared: `main` (7ce07c67, also the merge-base) vs `feat/ui-tahoe` HEAD `e95983e8`, worktree `/opt/RabbitPOS-tahoe`.
- Scope: `app/page.tsx`, `AppShell.tsx`, `StoreSwitcher.tsx`, `InstallPWABanner.tsx`, `components/pos/*` (7 modals).
- Only file written: this report. No installs, builds, DB or Docker commands. Line numbers are T3 lines unless marked `main:`.
- Labels: **VERIFIED** = a command was run and its output observed. **UNVERIFIED** = reasoned from code only, or needs a real device.
- Method: `git diff -U0 main HEAD -- <file>`, then `diff` of whole line ranges, so the proofs below do not rely on a heuristic filter.

---

## 1. Logic-diff audit

### 1.1 `app/page.tsx`: no change to any money, order, cart, offline or payment logic (VERIFIED)

```
diff <(git show main:frontend/src/app/page.tsx | sed -n 347,1190p) <(sed -n 356,1199p frontend/src/app/page.tsx)   -> empty
diff <(git show main:... | sed -n 1602,END p)                    <(sed -n 1645,END p T3)                       -> empty
```

- Main lines 347–1190 are byte-identical to T3 lines 356–1199.
  - That range contains `loadData`, legacy cart migration (main:612–620), `rabbitpos_active_cart_*` read/write, `submitOrder` (main:863) and its payload (`fund_id` main:902/978), `enqueueOfflineOrder` (main:946), `POST /orders` (main:1000), receipt data (main:1047), `handleOneTapCash/VietQR`, and `cartTotal` (main:1177).
- Main line 1602 to the end is identical too. That is the `CartDrawer`, `CheckoutModal` and `VietQRModal` props wiring, including `submitOrder(fundId)` and `submitOrder(selectedFundId || 2)`.
- Targeted grep: `git diff -U0 main HEAD -- page.tsx | grep -E '^[-+]' | grep -nE "orders|localStorage|rabbitpos_active|fetchApi|enqueue|saveOffline|discount|shipping|surcharge|fund|payment|vietqr|order_code"` returns only the import-line `fetchApi` edit and the `cartTotal` display `<p>` → `<span>`.

Hunks that are not pure className or i18n text:

| T3 file:line | What changed and why | Class |
|---|---|---|
| page.tsx:3–47 | Imports: added `useRef`, `Chip`, `EmptyState`, `ResponsiveSheet`, `getAuthUser/isMasterRole/isOwnerRole`; removed unused icons and `ApiResponse`/`Topping` types. | SAFE |
| :119–127 | `SORT_OPTIONS` → `SORT_OPTION_CONFIGS` (`labelKey` instead of hard-coded label). Same ids and same `sortBy` values. | SAFE |
| :350–355 | New `filterTriggerRef` and `canManageStore` memo. It reads `getAuthUser()` and uses the same expression as AppShell (`isMaster ‖ isSuperAdmin ‖ isOwner ‖ storeRole==='store_admin'`). It drives only bottom padding and cart-bar offset. | SAFE |
| :1200–1208 | `totalActiveProductsCount` and `activeSortLabel` memos (display only). | SAFE |
| :1319–1335 | New `Chip onRemove` handlers `setActiveTag(null)` and `setSortBy('default')`. Same state setters as the existing filter UI. | SAFE |
| :1341–1499 | Inline filter modal → `ResponsiveSheet`. Reset still calls `setActiveCategoryId(null); setActiveTag(null); setSortBy('default')`. "Apply" only closes the sheet, as before. | SAFE |
| :1504–1519 | List wrapper bottom padding is now role-aware (see §4). | SAFE |
| :1532, :1534 | `totalProductsCount={totalActiveProductsCount}`, `onSelectCategory={handleSelectCategory}`. `handleSelectCategory` already existed (main:858 ↔ T3:867). Before, it passed `setActiveCategoryId` directly. | SAFE |
| :1587–1644 | Cart bar `div` → `button type=button onClick={() => setIsCartDrawerOpen(true)}`. Same handler. "View cart" and "Checkout now" buttons keep `setIsCartDrawerOpen(true)` and `setIsCheckoutModalOpen(true)`. | SAFE |

### 1.2 `components/pos/*` (VERIFIED by `git diff -U0` hunks and region diffs)

- Pre-render logic blocks for these four files differ only in the import lines:
  - `VariantSelectorModal` (`handleAdd`, price maths, `notes` string)
  - `CheckoutModal` (`handleProceed`, fund pick)
  - `VietQRModal` (`tempOrderCode`, `/vietqr/generate`, `handleConfirm`)
  - `ReceiptModal` (settings load)
- `ReceiptModal` `#thermal-receipt` block:
  - Command: `diff` of the `id="thermal-receipt"` block (192 lines) after whitespace-normalising. The only difference is the added closing `</ModalShell>` on the last line, so receipt content is unchanged. VERIFIED.
  - Print behaviour and the `<style jsx global>` print CSS: **UNVERIFIED** (needs a real print).

| T3 file:line | What changed and why | Class |
|---|---|---|
| CartDrawer.tsx:139, 147–170 | Added `mounted` state, `useOverlayLayer(mounted && isOpen, 50, true)`, and an Escape handler (blocked while `isSubmitting` or the channel modal is open). Hooks stay above the early return at :399 (no hooks after it, VERIFIED by grep). | SAFE |
| CartDrawer.tsx:403 | Drawer is now rendered through `createPortal(..., document.body)`, with `GiftItemSelectorModal` and `SalesChannelModal` as siblings. Props and handlers are unchanged. All totals, `finalTotal`, `handleSelectChannel`, commission handlers, `handleApplyPromo`, 1-tap handlers and every `on*Change` call are identical to main (pre-render block and body checked). | SAFE |
| CartDrawer.tsx:409 | **New:** backdrop click closes the drawer (`!isSubmitting`). Main had no backdrop dismissal. Escape-to-close is also new. | NEEDS-OWNER-REVIEW (interaction, low risk) |
| CartDrawer.tsx:443 | Close button now `disabled={isSubmitting}` (before: not disabled). | SAFE (stricter) |
| CheckoutModal.tsx:74–79, VietQRModal.tsx:87–92 | `ModalShell nested preventClose={isSubmitting}`. Close, Escape and backdrop are blocked while submitting. Same `isSubmitting` flag and handlers as before. | SAFE |
| CheckoutModal / VietQR / Receipt / VariantSelector / Gift / OfflineQueue | **New:** `ModalShell` allows backdrop-tap and Escape to dismiss. Main had neither on any of them. A mis-tap on VietQR, Variant or Checkout closes it. Variant selections are lost. No order or money is committed by closing. | NEEDS-OWNER-REVIEW (same decision as the CartDrawer backdrop) |
| VariantSelectorModal.tsx:197 | `disabled={quantity <= 1}` on the minus button. `Math.max(1, …)` is retained. | SAFE |
| VariantSelectorModal.tsx | Sugar/ice sub-labels now come from `t('pos.sugar_*'/'ice_*')`. `handleAdd` still uses `lvl.label` (`'100%'`), so the saved `notes` string and cart payload are unchanged. | SAFE |
| OfflineQueueModal.tsx:85–143 | Toast and confirm strings → `t()`, `const res =` dropped (unused), `catch (e)` → `catch {`. The flow is identical: `navigator.onLine` check, `syncOfflineOrders({force:true,…})`, `updateOfflineOrderStatus(...)`, `deleteOfflineOrder`, `confirm(...)`. `useTranslation` was added before the early return. Enqueue/sync engine files are untouched (`git diff --stat` on `lib/offline` shows nothing). | SAFE |
| GiftItemSelectorModal / OfflineQueueModal | Card `div onClick` → `button`. Same `onSelectGift(variant, product); onClose()`. | SAFE |
| types/sales_channel.ts:12–22 | `active` class strings `shadow-xs` → `shadow-card`. Not in the T3 file list, shown for completeness. | SAFE |

Missing i18n key check (VERIFIED): all `t('…')` literals in the T3 files exist in `vi.json`, except `common.error` at `page.tsx:868`. That one already exists in main and has an `|| 'Lỗi'` fallback.

### 1.3 `AppShell.tsx`, `StoreSwitcher.tsx`, `InstallPWABanner.tsx`

AppShell.tsx (new code, all presentation or UI preferences):

| T3 file:line | What changed and why | Class |
|---|---|---|
| AppShell.tsx:90–164 | Effect 1 now also syncs glass prefs (`featureFlags`), reads `rabbitpos_sidebar_collapsed` and adds `matchMedia` listeners. The `/health` fetch and 60 s poll are unchanged. | SAFE |
| :192–201 | New Effect 3: reads `?open=promotions` into `isPromotionsQueryOpen` (only for sidebar highlight and title). | SAFE |
| :204–221 | New Effect 4: passive `window.scroll` listener for the inline title. | SAFE |
| :229–244 | Sidebar toggle persists `rabbitpos_sidebar_collapsed`. Glass toggle calls `setGlassEffectsEnabled`. | SAFE |
| :247–263 | `handleNavigatePromotions` (see §3). | SAFE |
| :282–370 | `primaryOpsItems` and `managementItems` (visibility rules, see §2). | NEEDS-OWNER-REVIEW only for the role-visibility table in §2. There are no logic differences. |
| :380 | `isServerOnline = network.isOnline && (!error || health?.db_connected)` is display only. | SAFE |

- **Auth/role logic is identical to main (VERIFIED):**
  ```
  diff <(sed -n 97,120p main:AppShell) <(sed -n 166,189p T3)   -> GUARD_BLOCK_IDENTICAL
  diff main 54-57 vs T3 85-88                                   -> ROLEFLAGS_IDENTICAL
  diff main 122-126 vs T3 223-227 (handleLogout)                -> LOGOUT_IDENTICAL
  ```
- `key={activeStore?.id ?? 'default'}` is kept (:825).

`StoreSwitcher.tsx` (VERIFIED from diff): the only non-markup hunks are removal of unused `useRouter`, `router`, `isLoading` and icons (all unused in main), and `|| 'fallback'` strings → `t()`. `switchStore` and the list logic are untouched.

`InstallPWABanner.tsx`: `useOverlayLayer(show && isVisible, 75, false)` at :23; dismiss timeout 350 → 260 ms (animation only, :48). The `pwa_install_banner_dismissed` read/write is unchanged (:8, 32, 47). SAFE.

### 1.4 Outside the listed files, noted only

- `lib/StoreContext.tsx`: the temporary `[TEMP G1-D3]` `/ui-gallery` fetch skip. It is guarded by `NODE_ENV !== 'production'` AND `NEXT_PUBLIC_ENABLE_UI_GALLERY === 'true'`. Role logic is untouched. Must be reverted in T6.
- `context/ConfirmContext.tsx`: resolver refactor only.

---

## 2. Role audit

Guard in both main and T3 (identical, VERIFIED): if `!canManageStore`, `startsWith` on `['/products','/purchases','/promotions','/funds','/settings','/stores','/users']` → `router.push('/')`. Also `/stores` and `!isSuperAdmin` → `/`. **Not guarded in either:** `/transactions`, `/dashboard`, `/login`.

| Route | staff, main | staff, T3 | admin, main | admin, T3 | SuperAdmin, main | SuperAdmin, T3 |
|---|---|---|---|---|---|---|
| `/` | nav | header capsule "POS" | nav | tab / sidebar | nav | tab / sidebar |
| `/transactions` (+`?tab=funds`, `?tab=orders`) | **nav item (`visible: true`, main:132) and not guarded** | **header capsule "Thu chi"** | nav | tab / sidebar | nav | tab / sidebar |
| `/funds` → `/transactions?tab=funds` | blocked → `/` | blocked → `/` (same guard); the funds tab stays reachable via `/transactions` | no nav entry; reached via the segmented tab on `/transactions` | same | same | same |
| `/purchases` | blocked | blocked | nav | tab / sidebar | nav | tab / sidebar |
| `/dashboard` | URL-reachable, not in nav (guard omits it; `dashboard/page.tsx` has an `isStaff` view) | **same: URL-reachable, not in nav** | nav | tab / sidebar | nav | tab / sidebar |
| `/products` | blocked | blocked | nav | More sheet / sidebar | nav | More sheet / sidebar |
| `/promotions` → `/products?open=promotions` | blocked (via `/products`) | blocked | no nav entry (only via the Products page button or URL) | More sheet / sidebar (new entry point) | same as admin | same |
| `/users`, `/settings` | blocked | blocked | avatar menu | More sheet / sidebar / avatar menu | avatar menu | same |
| `/stores` | blocked | blocked | blocked | blocked | nav / avatar menu | More sheet / sidebar / avatar menu |

- **Newly visible or reachable for staff: none (VERIFIED).**
  - Guard block identical. The staff nav was already POS + Thu chi in main (`allNavItems` main:129–135). T3 shows the same two links (AppShell.tsx:446–477).
  - `/transactions` is **not** newly exposed. Main already showed it with `visible: true` and did not guard it. `transactions/page.tsx` hides admin controls via `isStaff` (pre-existing).
- Pre-existing observations, unchanged by T3:
  - `/dashboard` is URL-reachable by staff in both versions.
  - The guard is client-side only (UNVERIFIED whether the backend also blocks).
- Changes for admin and SuperAdmin:
  - `/products` and `/stores` moved out of the mobile bottom bar into the More sheet.
  - Promotions gained a direct entry.
  - All routes remain reachable on both breakpoints.
- Correction to my earlier T3 chat report: it listed "Quỹ tiền" in the More sheet. **There is no `/funds` item in `managementItems`** (AppShell.tsx:321–370), same as main. Funds are reached through the `/transactions` Quản lý quỹ tab (`transactions/page.tsx:1472`). It also described a horizontal category rail on mobile. The real layout is a vertical `w-[33%]` rail (`page.tsx:1514`).

---

## 3. Route integrity

- `/promotions` → `/products?open=promotions` (VERIFIED by code read):
  - `app/promotions/page.tsx` is a client redirect via `router.replace('/products?open=promotions')`. It is unchanged from main (`git diff --stat` empty) and has no AppShell.
  - `products/page.tsx:278–287` reads `window.location.search` in a mount-only `useEffect(..., [])` and calls `setIsPromotionsModalOpen(true)`. That state is wired to the modal's `isOpen` at :1230. `products/` is unchanged from main.
  - The shell works around the mount-only read (AppShell.tsx:247–263):
    - From another route: the sidebar `Link` navigates to `/products?open=promotions` (fresh mount, modal opens). The More sheet calls `router.push('/products?open=promotions')`.
    - While already on `/products`: it routes `router.push('/promotions')`, which bounces back and remounts Products. The modal opens.
    - Not tested in a browser (UNVERIFIED).
- Cosmetic gap (UNVERIFIED in browser): after closing the promotions modal the URL keeps `?open=promotions`. `isPromotionsQueryOpen` only re-syncs on `pathname` change or `popstate`, so the sidebar may keep "Promotions" highlighted until another link is clicked.
- Other targets the shell, sheet and menus rely on (VERIFIED, `ls app` and grep): all of `/`, `/transactions`, `/purchases`, `/dashboard`, `/products`, `/users`, `/settings`, `/stores`, `/promotions`, `/funds`, `/login` exist as `app/*/page.tsx`.
  - Query params used: `open=promotions` (products page); `tab=funds|orders|ledger` (`transactions/page.tsx:372–385`, reached through the `/funds` redirect at `funds/page.tsx`).
  - The `StoreSwitcher` link `/stores` exists in main too.
- Unreachable routes: none found. Every route has an entry point for the roles allowed to see it, except `/dashboard`, `/funds` and `/promotions`, which have no direct nav entry for some roles (same as main).
- Each page wraps its own `<AppShell>` (grep: every `app/*/page.tsx` imports and uses it), so the shell remounts on every navigation. `isPromotionsQueryOpen` is re-derived by Effect 3 on each mount.

---

## 4. Bottom-stack check at 390 px

- What scrolls (VERIFIED): `body` is `min-h-screen flex flex-col` and the layout `main` has no fixed height, so the **document scrolls**. `AppShell` `main` has `overflow-x-hidden` but no height clamp, so it does not become the scroller. Total bottom space = AppShell `main` padding + the PosPage wrapper padding.
- Element heights (from code):
  - Cart bar: `p-1.5` (6 px × 2) + 44 px buttons = **56 px**.
  - Tab bar: `h-14` = **56 px**, at `bottom: max(0.5rem, safe)`.
  - Admin cart bar: `bottom: 3.5rem + max(0.5rem, safe) + 0.625rem` (`page.tsx:1592`). Gap above the tab bar is 10 px.
  - Staff cart bar: `bottom: max(0.75rem, safe)`.
  - `safe` = `env(safe-area-inset-bottom)`. Shown for 0 px and a typical 34 px iPhone inset.

| Case (390 px) | Padding below the last product row | Obstruction height from the viewport bottom | Clearance | Last row hidden? |
|---|---|---|---|---|
| **admin/SA, cart non-empty** | `main pb-24` 96 + wrapper `pb-36` 144 = **240 px** | cart-bar top = 56 + max(8, safe) + 10 + 56 = **130 px (safe 0)** / **156 px (safe 34)** | +110 / +84 px | No |
| **admin/SA, cart empty** | 96 + `pb-12` 48 = **144 px** | tab-bar top = 56 + max(8, safe) = **64** / **90 px** | +80 / +54 px | No |
| **staff, cart non-empty** | `main pb-6` 24 + wrapper `pb-24` 96 = **120 px** | cart-bar top = max(12, safe) + 56 = **68** / **90 px** | +52 / +30 px | No |
| **staff, cart empty** | 24 + `pb-4` 16 = **40 px** | no fixed bars | n/a | No |

- Conclusion (VERIFIED arithmetic, UNVERIFIED on a device): the last row cannot be hidden by the cart bar or tab bar in these four cases.
- Caveats:
  - The tightest case is staff with items in the cart on a 34 px inset device (30 px of clearance).
  - Not accounted for: the iOS `InstallPWABanner` (z-75, dismissible) and the virtual keyboard.
  - `twMerge` keeps `md:pb-6` only at ≥768 px.
- Possible issue (UNVERIFIED visually): the category rail uses `sticky top-2` (8 px) under the sticky header (52 px + safe-top). When stuck, its top could sit under the header. Main had the same `sticky top-2` (main:1490), so this is pre-existing.

---

## Open items for the owner

1. Backdrop-tap and Escape dismissal are new on all POS modals and the cart drawer. Decide whether to keep them, or disable the backdrop-tap on VietQR, Checkout and CartDrawer.
2. Staff can still reach `/dashboard` by URL (pre-existing in main). Decide whether to add it to the guard.
3. Confirm the promotions modal and the sidebar highlight in a browser.
4. Confirm that backend RBAC covers the client-only guard.

