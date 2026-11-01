# Design Brief — Phase 5: POS Screen Group

## Target Files
1. `frontend/src/app/page.tsx` (Main POS catalog, search/filter bar, left category sidebar, product grid, bottom sticky cart bar)
2. `frontend/src/components/pos/VariantSelectorModal.tsx` (Product sizing, sugar/ice presets, dynamic toppings, sticky stepper footer)
3. `frontend/src/components/pos/CartDrawer.tsx` (Slide-over / bottom sheet for cart line items, discounts, customer notes, checkout)
4. `frontend/src/components/pos/CheckoutModal.tsx` (Target fund & payment method selector)
5. `frontend/src/components/pos/VietQRModal.tsx` (Dynamic VietQR display & copy account number)
6. `frontend/src/components/pos/ReceiptModal.tsx` (Order confirmation & thermal print receipt)
7. `frontend/src/components/pos/OfflineQueueModal.tsx` (Offline orders queue manager & FIFO sync)
8. `frontend/src/components/pos/GiftItemSelectorModal.tsx` (Promotional gift item selection modal)

---

## 390px Mobile POS Critique & UX Checklist

### Identified Pain Points at 390px Viewport:
1. **Typography Under-scaling**: Numerous `text-[8px]`, `text-[9px]`, `text-[10px]` tags in badges, small prices, and helper notes cause eye strain under busy shop lighting.
2. **Modal Footers on Mobile**: In `VariantSelectorModal` and other dialogs, the submit button scrolled out of view when items had multiple toppings, requiring users to scroll down just to tap "Thêm vào đơn".
3. **Competing Chrome Colors**: Indigo and violet mixed with purple across tags, sort buttons, and drawer sections without semantic reason.
4. **Touch Targets**: Several ad-hoc icon buttons and steppers were below 40px touch boundaries.

### Phase 5 Implemented Improvements:
- **One Visual Emphasis per Screen**:
  - Main POS: High-contrast product cards with clear pricing + sticky floating quick cart bar (`bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4`).
  - Variant Modal: Sticky footer holding quantity stepper and prominent "+ Thêm vào đơn [Giá]".
  - Cart Drawer: Large bold Total & one-tap payment buttons (Cash / VietQR).
  - Checkout & VietQR: Clear payment summary & large primary action button.
- **Button Primitives**: Replaced ad-hoc button strings with `Button` / `IconButton` from `@/components/ui` across headers, footers, steppers, and floating bars.
- **Tokens & Radius per D3**:
  - Controls: `rounded-xl`
  - Cards & panels: `rounded-2xl`
  - Mobile sheets: `rounded-t-3xl`
  - Badges: `rounded-lg`
  - Chips/pills: `rounded-full`
  - Replaced raw `indigo` and `violet` in chrome with `brand` (purple).
  - Upgraded `text-[8px]`, `text-[9px]`, `text-[10px]` to standard tokens (`text-caption` / 11px+ font size).
- **Cart & Offline Guardrails**:
  - Preserved 100% of cart calculation formulas, offline IndexedDB queueing, API payloads, and checkout submission logic.
  - Quick cart bar retains exact offset `bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4` above bottom navigation.

---

## Changes per File

1. `frontend/src/components/pos/VariantSelectorModal.tsx`:
   - Imported `Button`, `IconButton` from `@/components/ui`.
   - Replaced custom close button with `IconButton` (`variant="ghost"`, `size="sm"`).
   - Replaced quantity stepper buttons with `IconButton` (`variant="outline"`, `size="sm"`).
   - Upgraded submit button to `Button` (`variant="primary"`, `size="lg"`, `fullWidth`).
   - Sticky footer on mobile with `bg-white/95 backdrop-blur-xs` so action is always within 1 tap.
   - Upgraded micro-badges and sugar/ice subtext from `text-[9px]`/`text-[10px]` to `text-caption text-[11px] font-bold`.

2. `frontend/src/components/pos/CheckoutModal.tsx`:
   - Imported `Button`, `IconButton` from `@/components/ui`.
   - Header close converted to `IconButton`.
   - Payment submit action upgraded to `Button` (`variant="primary"`, `size="lg"`, `fullWidth`, `isLoading={isSubmitting}`).

3. `frontend/src/components/pos/VietQRModal.tsx`:
   - Imported `Button`, `IconButton` from `@/components/ui`.
   - Replaced raw indigo chrome with brand purple (`text-brand-700`, `text-brand-600`).
   - Upgraded channel badge and copied pill from `text-[10px]` to `text-caption font-bold`.
   - Upgraded payment confirmation button to `Button` (`variant="primary"`, `size="lg"`, `fullWidth`, `isLoading={isSubmitting}`).

4. `frontend/src/components/pos/ReceiptModal.tsx`:
   - Imported `Button`, `IconButton` from `@/components/ui`.
   - Converted close button to `IconButton`.
   - Upgraded thermal receipt print and close buttons to `Button` (`variant="primary"`, `variant="secondary"`).
   - Upgraded offline warning text from `text-[9px]` to `text-caption text-[11px] font-bold`.

5. `frontend/src/components/pos/OfflineQueueModal.tsx`:
   - Converted container to mobile bottom sheet (`items-end sm:items-center`, `rounded-t-3xl sm:rounded-2xl`, `pb-safe`, drag indicator).
   - Header sync button upgraded to `Button` (`size="sm"`, `isLoading={isSyncing}`).
   - Modal actions upgraded to `Button` and `IconButton`.
   - Micro text `text-[10px]` upgraded to `text-caption`.

6. `frontend/src/components/pos/GiftItemSelectorModal.tsx`:
   - Converted modal to mobile bottom sheet (`items-end sm:items-center`, `rounded-t-3xl sm:rounded-3xl`, `pb-safe`, drag indicator).
   - Header close upgraded to `IconButton`.
   - Subtext and 0đ badges upgraded from `text-[9px]`/`text-[10px]` to `text-caption font-black`.

7. `frontend/src/components/pos/CartDrawer.tsx`:
   - Imported `Button`, `IconButton` from `@/components/ui`.
   - Header close upgraded to `IconButton`.
   - Sales channel default styling updated to brand purple.
   - Commission editor inputs and quick buttons migrated from indigo to brand purple (`border-purple-300`, `bg-purple-600`).
   - Surcharge and time chips and expanded panels migrated from violet/indigo to brand purple.
   - Upgraded all `text-[10px]` badges and helper text to `text-caption`.
   - Side-by-side 1-Tap Cash and 1-Tap VietQR actions upgraded to `Button` (`variant="primary"`, `size="lg"`), and secondary change calculation to `Button` (`variant="secondary"`, `size="sm"`).

8. `frontend/src/app/page.tsx`:
   - Imported `Button`, `IconButton` from `@/components/ui`.
   - Sort icons and active tag chips migrated from indigo to brand purple.
   - Filter popup modal close upgraded to `IconButton`, sort selection to brand purple, and footer reset / apply to `Button`.
   - Category sidebar and product cards badges upgraded from `text-[9px]`/`text-[10px]` to `text-caption font-bold`.
   - Bottom quick cart bar retained exact position `fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4`, with buttons upgraded to `Button` primitives and badges upgraded to `text-caption`.

---

## Validation
- `cd /opt/RabbitPOS/frontend && npx --no-install tsc --noEmit`: 0 errors.
