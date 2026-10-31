Task: Architectural Planning & Creative UI/UX Consolidation of the "Sổ thu chi" (Cash Flow Ledger) and "Nhập hàng & Giá vốn" (Ingredients, Purchases & Recipe BOM Costing) tabs in `/transactions`.

SKILL & DESIGN SYSTEM ACTIVATION:
1. Activate and apply `impeccable`, `taste-skill`, `ui-ux-promax`, and `hallmark`.
2. Read `PRODUCT.md`, `docs/3_AI_CODING_RULES.md`, and `docs/6_FRONTEND_COMPONENTS.md` to maintain 100% adherence to the "Tactile Botanical & Precision F&B POS" design language (`botanical-50` to `950`, `#F8FAFC` canvas, `shadow-card`, `shadow-modal`, `.app-input`, `.app-btn`, `.price-tag`, `.counter`, `.queue-number`, `tabular-nums`).

CRITICAL GUARDRAIL — DO NOT OMIT ANY ESSENTIAL FEATURE:
Every core capability MUST be preserved 100%:
1. Logging manual Inflows & Outflows (with fund selection & transaction category management).
2. Logging itemized Ingredient/Fruit/Packaging purchases inside Outflow transactions (auto-updating `latest_purchase_price`, `average_purchase_price`, and deducting fund balance).
3. Ingredient catalog management (Name, Category, Unit, Yield Rate %, Latest Price, Average WAC Price, Price History).
4. Recipe BOM (Định lượng công thức) editor for Product Variants & Toppings.
5. Pricing basis toggle (Latest Purchase Price vs. Moving Average WAC).
6. BOM Calculated COGS vs. Current Menu COGS comparison, Margin % calculation, single-item "Cập nhật giá vốn", and bulk "Đồng bộ toàn bộ giá vốn".
7. Income/Outflow Category Breakdown chart (`ModernDateRangePicker`), Order History tab (`orders`), and RBAC rules (`staff` cannot view COGS/BOM tab and can only log operational outflows).

---

### STEP 1: AUDIT & ARCHITECTURAL DEDUPLICATION PLAN
Inspect `frontend/src/app/transactions/page.tsx`, `frontend/src/components/transactions/PurchasesCostTab.tsx`, `TransactionModal.tsx`, and `TransactionCategoryModal.tsx`.
Identify and eliminate all redundant UI blocks between "Sổ thu chi" and "Nhập hàng & Giá vốn":

1. **Eliminate Duplicate Purchase Transaction History Tables**:
   - Currently, purchase outflows appear in the "Sổ thu chi" ledger AND in a separate "Lịch sử nhập hàng" sub-tab inside `PurchasesCostTab`.
   - **Consolidation**:
     * **"Sổ thu chi" (`ledger`)** becomes the SINGLE authoritative timeline for all cash/bank movements (Inflows, General Outflows, and Itemized Ingredient Purchase Outflows).
     * Enhance ledger rows in "Sổ thu chi": when a transaction contains `purchase_items` (phiếu chi mua nguyên liệu), display a sleek **"📦 Phiếu nhập nguyên liệu ({count} mặt hàng)"** badge and allow 1-click inline expansion (or drawer preview) right on the ledger row/card to inspect the exact items, quantities, unit prices, and yield rates bought in that transaction!
     * Add a quick filter pill in "Sổ thu chi": `[ Tất cả | Khoản thu | Khoản chi | 📦 Phiếu nhập nguyên liệu ]`.

2. **Eliminate Duplicate Action Triggers ("Tạo khoản chi" vs "Ghi nhận mua hàng")**:
   - Unify into a cohesive header action bar where creating an Outflow (`Khoản chi`) or Ingredient Purchase (`Nhập nguyên liệu`) uses the single unified `TransactionModal` (can pre-toggle the *"📦 Chi mua hàng hóa / Nguyên liệu"* switch when triggered from the Costing tab or quick button).

3. **Eliminate Nested 3-Level Sub-Tabs Inside `PurchasesCostTab.tsx`**:
   - Having 3 top-level tabs (`Sổ thu chi`, `Nhập hàng & Giá vốn`, `Lịch sử đơn hàng`) AND 3 nested sub-tabs inside `PurchasesCostTab` creates navigation fatigue on mobile and desktop.
   - **Redesign Tab 2 ("Nguyên liệu & Định lượng Giá vốn" / `purchases`) into a Streamlined, Scannable Workspace**:
     * **Compact KPI & Control Strip**:
       - Key metrics (Tổng nguyên liệu, Số món lệch giá vốn cần cập nhật, Biên lãi gộp TB) + Pricing Basis Segmented Toggle (**Giá nhập gần nhất** vs **Giá bình quân WAC**) + **"🔄 Đồng bộ toàn bộ giá vốn"** action + **"+ Thêm / Nhập nguyên liệu"** trigger.
     * **Clean 2-View Segmented Mode (or Asymmetric Split Layout on Desktop `lg:grid-cols-12` / Segmented Pill on Mobile)**:
       1. **Định lượng Món & Đối chiếu Giá vốn (BOM vs. Menu COGS)** (Primary focus):
          - Search + Category filter + Filter pill (`Tất cả món` | `⚠️ Có biến động giá vốn` | `Chưa có công thức`).
          - Desktop precision table & Mobile tactile cards showing: Product/Variant, Retail Price, Menu COGS, BOM Cost, Delta Badge (`+1.400đ` Rose / `-800đ` Emerald), Gross Margin %, **"🧪 Công thức (BOM)"** button, and 1-click **"Cập nhật giá"** button.
       2. **Kho Nguyên liệu & Biến động Giá nhập (Ingredients & Yield Rates)**:
          - Manage ingredients (Fruit, Ingredient, Packaging), unit, Yield Rate % (Tỷ lệ thu hồi), Latest Price vs. Average Price (WAC), and click an ingredient to view its compact purchase price timeline.

---

### STEP 2: EXECUTE THE REDESIGN & OPTIMIZATION
1. Refactor `frontend/src/app/transactions/page.tsx`, `PurchasesCostTab.tsx`, and `TransactionModal.tsx` following the deduplicated architecture above.
2. Ensure tab navigation order and URL query sync (`?tab=ledger|purchases|orders`) work seamlessly, and when a user records a new itemized ingredient purchase in `TransactionModal`, both the `ledger` state and `purchases` cost-comparison state refresh automatically.
3. Update `vi.json` and `en.json` with any refined labels or filter chips.

---

### STEP 3: VERIFICATION & CONTAINER DEPLOYMENT
1. Run `npx --no-install tsc --noEmit` (must exit 0 with 0 errors).
2. Run `/root/.gemini/skills/impeccable/scripts/impeccable detect --json` on `frontend/src/app/transactions` and `frontend/src/components/transactions` (must return `[]` with 0 warnings).
3. Run `CI=true NEXT_TELEMETRY_DISABLED=1 npm run build` (must compile cleanly).
4. Rebuild and restart the frontend Docker container: `docker compose up -d --build frontend`.
5. Provide a structured summary in Vietnamese explaining:
   - Các phần trùng lặp đã được gộp/loại bỏ.
   - Cấu trúc mới của Tab **Sổ thu chi** và Tab **Nguyên liệu & Định lượng Giá vốn**.
   - Xác nhận toàn bộ tính năng quan trọng được giữ nguyên 100%.
