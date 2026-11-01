# Tahoe Liquid Glass — Live `backdrop-filter` Layer Audit (`Amendment A1`)

- **Hard Budget (`Amendment A1`)**: At most **`3` simultaneously visible `backdrop-filter` layers** anywhere in the viewport at any instant (`ACTIVE_BLUR_LAYERS <= 3`).
- **Zero App Code Rule**: No dev-only measurement scripts are bundled into `frontend/src/`. Run the self-contained snippet below directly in Chrome, Safari, or Firefox DevTools Console on the test dev server.

---

## 1. Browser DevTools Console Snippet

Open DevTools (`F12` or `Cmd+Option+I` -> **Console**), paste the snippet below, and press **Enter**:

```js
(() => {
  const MAX_BUDGET = 3;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const isElementVisibleInViewport = (el, style, rect) => {
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity || '1') <= 0.01) return false;
    if (rect.width <= 0 || rect.height <= 0) return false;
    // Exclude elements completely scrolled or positioned outside the viewport
    if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) {
      return false;
    }
    return el.getClientRects().length > 0;
  };

  const blurredLayers = [];
  for (const el of document.querySelectorAll('*')) {
    const style = window.getComputedStyle(el);
    const bf =
      style.backdropFilter && style.backdropFilter !== 'none'
        ? style.backdropFilter
        : style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none'
        ? style.webkitBackdropFilter
        : null;

    if (!bf) continue;

    const rect = el.getBoundingClientRect();
    if (!isElementVisibleInViewport(el, style, rect)) continue;

    const classPreview =
      typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.')
        : '';
    const idPreview = el.id ? `#${el.id}` : '';

    blurredLayers.push({
      selector: `${el.tagName.toLowerCase()}${idPreview}${classPreview}`,
      zIndex: style.zIndex,
      position: style.position,
      backdropFilter: bf,
      bounds: `${Math.round(rect.width)}x${Math.round(rect.height)} @ (${Math.round(rect.left)},${Math.round(rect.top)})`,
      label: el.getAttribute('aria-label') || el.getAttribute('role') || '-',
      underNested: el.getAttribute('data-under-nested-overlay') || '-',
    });
  }

  const count = blurredLayers.length;
  const pass = count <= MAX_BUDGET;
  const overlayOpenAttr = document.documentElement.getAttribute('data-overlay-open') || 'false';
  const noGlassClass = document.documentElement.classList.contains('no-glass');

  console.group(
    `%c[Tahoe Blur Audit] ACTIVE_BLUR_LAYERS: ${count} / ${MAX_BUDGET} (${pass ? 'PASS' : 'FAIL'})`,
    `font-weight:bold;font-size:13px;color:${pass ? '#047857' : '#be123c'};`
  );
  console.log({
    viewport: `${vw}x${vh}`,
    activeBlurLayers: count,
    budgetMax: MAX_BUDGET,
    status: pass ? 'PASS' : 'FAIL',
    htmlDataOverlayOpen: overlayOpenAttr,
    htmlNoGlass: noGlassClass,
  });
  if (count > 0) {
    console.table(blurredLayers);
  } else {
    console.log('0 active backdrop-filter layers currently visible in viewport.');
  }
  console.groupEnd();

  return { pass, count, maxBudget: MAX_BUDGET, overlayOpenAttr, noGlassClass, layers: blurredLayers };
})();
```

---

## 2. Four Required Verification Scenarios (Gate G2 & Subsequent Gates)

Run the snippet above in each of the 4 scenarios below at mobile (`390x844`) and desktop (`1280x800`) viewports:

| # | Scenario | How to Trigger | Expected `htmlDataOverlayOpen` | Expected `ACTIVE_BLUR_LAYERS` | Budget Result |
| :- | :--- | :--- | :---: | :---: | :---: |
| **1** | **POS `/` Idle & Scrolling (with Quick-Cart Bar visible)** | Log in, add `>= 1` drink so the `#2E1065` Quick-Cart Bar appears, scroll product grid | `'false'` | **`1`** (`staff`: Top Header only)<br>**`2`** (`admin`/`SuperAdmin`: Top Header + Floating Tab Bar on `<768px`, or Top Header + Left Glass Sidebar on `>=768px`).<br>*Note*: Product cards, category pills, and `#2E1065` Quick-Cart Bar all have **`0` blur**. | `<= 3` **PASS** |
| **2** | **Management Page with Sticky `FilterBar`** | Visit `/ui-gallery` (`FilterBar` specimen) now, or `/transactions` / `/products` / `/purchases` after Phases T4–T5 | `'false'` | **`2` to `3`** (Shell bars + sticky `FilterBar` platter) | `<= 3` **PASS** |
| **3** | **Sheet, Drawer, Modal, or Nested Modal Open** | Open `Thêm` sheet (`<768px`), POS Sort/Filter sheet, `VariantSelectorModal`, `CartDrawer`, or open `CheckoutModal` / `VietQRModal` / `GiftItemSelectorModal` on top of `CartDrawer` | `'true'` | **`1`** (`z-30` shell bars demote to `backdrop-filter: none`, and lower `z-50` `CartDrawer` demotes via `data-under-nested-overlay="true"` when a `z-60+` modal opens above it) | `<= 3` **PASS** |
| **4** | **Open Sheet / Modal + Active `z-90` Toast** | While `CartDrawer`, `VietQRModal`, `ReceiptModal`, or `OfflineQueueModal` is open, trigger a toast (e.g., copy bank account in `VietQRModal`, complete a 1-tap Cash order, or tap `Đồng bộ ngay` while offline) | `'true'` (or `'false'` on idle POS + toast) | **`2`** (1 topmost overlay + 1 `glass-toast`), or **`3`** on idle `admin` POS (`2` shell bars + `1` `glass-toast`) | `<= 3` **PASS** |

### Accessibility / Reduced-Transparency Check (`Override Q3`)
- Open the Top Bar User Menu and toggle **`Hiệu ứng kính`** (`Glass effects`) **OFF** (`localStorage['rabbitpos_glass_enabled'] = 'false'`, adds `html.no-glass`), then re-run the snippet:
  - Expected: `htmlNoGlass: true` and **`ACTIVE_BLUR_LAYERS: 0 / 3 (PASS)`** across every screen and modal.
