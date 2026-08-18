# RabbitPOS - Báo Cáo Tiến Trình & Tài Liệu Bàn Giao (Project Handover)

> **Mục đích**: Tài liệu tổng hợp toàn bộ hiện trạng kỹ thuật, kiến trúc, cơ sở dữ liệu, API, giao diện và các tính năng đã hoàn thành qua **Phase 1, Phase 2 & Phase 3** để tiếp tục phát triển các Phase tiếp theo trong phiên chat mới.

---

## 1. Tổng Quan Kiến Trúc Hệ Thống (Architecture Overview)

- **Backend**: Golang Clean Architecture, Gin Framework, GORM ORM, JWT Authentication, Bcrypt password hashing.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React Icons, Context-based Custom i18n (Tiếng Việt & English).
- **Cơ sở dữ liệu**: PostgreSQL 16 Alpine với GORM AutoMigrate kết hợp SQL Migrations (`backend/migrations/`).
- **Triển khai & Mạng (DevOps & Networking)**:
  - **Docker Compose** (`docker-compose.prod.yml`): `rabbitpos-postgres`, `rabbitpos-backend`, `rabbitpos-frontend`, `rabbitpos-npm` (Nginx Proxy Manager), `rabbitpos-tunnel` (Cloudflare Zero Trust Tunnel).
  - **Frontend URL**: `https://rabbitpos.ndnworks.com`
  - **Backend API URL**: `https://rabbitpos-api.ndnworks.com/api/v1`

---

## 2. Các Tính Năng Đã Hoàn Thành

### ✅ Phase 1: Xác Thực, Phân Quyền Thu Ngân & Cài Đặt Hệ Thống
1. **Quy trình Đổi mật khẩu lần đầu (First-time Password Setup Flow)**:
   - Thêm cột `needs_password_setup` và `is_active` vào bảng `users`.
   - Seed sẵn 3 tài khoản Thu ngân / Quản trị viên:
     - Usernames: `NDN`, `NHUNG`, `DAT` (mật khẩu tạm mặc định tương ứng: `ndn`, `nhung`, `dat`).
     - Khi đăng nhập lần đầu, hệ thống bắt buộc mở modal **Thiết lập mật khẩu mới** trước khi truy cập trang POS.
   - Endpoint: `POST /api/v1/auth/setup-password`.
2. **Gắn định danh Thu ngân vào Đơn hàng & Giao dịch**:
   - Các bảng `orders` và `transactions` đã có cột `cashier_id` (BIGINT) và `cashier_name` (VARCHAR).
   - Backend tự động trích xuất thông tin thu ngân từ JWT Claims khi tạo đơn hàng hoặc ghi nhận thu/chi.
3. **Quản lý Cài đặt Cửa hàng & Logo**:
   - Cài đặt hỗ trợ upload logo cửa hàng (`store_logo_url`) lưu vào `/uploads/`.
   - Logo hiển thị cân đối, hỗ trợ nền trong suốt cạnh tiêu đề.
   - Tiêu đề đa ngôn ngữ theo cài đặt: `"Rabbit POS"` (Tiếng Anh) / `"Thỏ POS"` (Tiếng Việt).
4. **Fix lỗi nhập liệu số (Number Input UX Glitch)**:
   - Đã xử lý triệt để lỗi dính số `0` ở đầu và lỗi xóa trống ô nhập liệu (Leading Zero & Backspace Sticking) trên toàn bộ các trang: Sản phẩm, Cài đặt, Sổ thu chi, Sổ quỹ.

---

### ✅ Phase 2: Mức Đường/Đá Chuẩn Hóa & Quản Lý Topping Động
1. **Chuẩn hóa 5 Mức Đường & Đá (Sugar / Ice Tiers)**:
   - Chuẩn hóa các preset cố định: `100%`, `70%`, `50%`, `30%`, `0%` (Không đường / Không đá / Đá riêng).
   - Component [VariantSelectorModal.tsx](file:///opt/RabbitPOS/frontend/src/components/pos/VariantSelectorModal.tsx) cho phép chọn nhanh bằng 1 click.
2. **Quản lý Topping Động (Dynamic Topping Management)**:
   - **Database**: Tạo bảng `toppings` (`id`, `name`, `price`, `cogs`, `category_id`, `is_active`, `created_at`, `updated_at`).
   - **Phạm vi Topping**: Hỗ trợ topping theo từng danh mục cụ thể hoặc **Toàn cục (Global)** áp dụng cho tất cả sản phẩm (`category_id = NULL`).
   - **Snapshot Order**: `order_items` lưu trữ snapshot `selected_toppings` (JSONB) và `toppings_price` để đảm bảo lịch sử in hóa đơn không bị ảnh hưởng nếu sau này giá/tên topping thay đổi.
   - **Backend Handlers**: [topping.go](file:///opt/RabbitPOS/backend/internal/handlers/topping.go) hỗ trợ đầy đủ `GET /toppings`, `GET /toppings/all`, `POST /toppings`, `PUT /toppings/:id`, `DELETE /toppings/:id`.
3. **Giao diện Quản lý Topping & POS**:
   - Trang [products/page.tsx](file:///opt/RabbitPOS/frontend/src/app/products/page.tsx) tích hợp panel **Quản lý Topping**:
     - Modal thêm/sửa topping với công tắc Bật/Tắt (On/Off) chuẩn iOS.
     - Nút gạt nhanh On/Off 1-Click trực tiếp trong bảng danh sách topping (bật/tắt nhanh khi hết hàng).
   - Hóa đơn in nhiệt ([ReceiptModal.tsx](file:///opt/RabbitPOS/frontend/src/components/pos/ReceiptModal.tsx)) thể hiện rõ ràng các topping đã chọn và mức đường/đá.
4. **Bản địa hóa 100% Tiếng Việt & Tiếng Anh**:
   - Đã đồng bộ toàn bộ từ khóa i18n trong [vi.json](file:///opt/RabbitPOS/frontend/src/lib/i18n/locales/vi.json) và [en.json](file:///opt/RabbitPOS/frontend/src/lib/i18n/locales/en.json).

---

### ✅ Phase 3: Công Cụ Khuyến Mãi, Điều Chỉnh Giỏ Hàng POS & Quy Trình Hủy Đơn / Đặt Lại
1. **Động cơ Khuyến mãi Toàn diện (Promotion Engine)**:
   - **Database**: Tạo bảng `promotions` (`id`, `name`, `promo_type`, `discount_value`, `min_order_amount`, `min_quantity`, `scope`, `target_ids`, `gift_product_variant_id`, `start_date`, `end_date`, `usage_limit`, `usage_count`, `is_active`).
   - **Loại hình khuyến mãi**: Giảm tiền cố định (`discount_amount`), Giảm theo % (`discount_percent`), Tặng quà (`gift_item`).
   - **Phạm vi**: Áp dụng toàn bộ menu (`all`), theo danh mục (`category`), hoặc món cụ thể (`product`).
   - **Tăng số lượt dùng nguyên tử**: Backend cập nhật `usage_count` nguyên tử trong transaction tạo đơn hàng (`gorm.Expr("usage_count + 1")`).
   - **Trang Quản lý Khuyến mãi**: `frontend/src/app/promotions/page.tsx` với KPI cards, bộ lọc tìm kiếm/loại/trạng thái, nút On/Off 1-click, modal thêm/sửa trực quan.
2. **Điều chỉnh Giỏ hàng POS Động (POS Cart Dynamic Adjustments)**:
   - **Sửa Đơn Giá Trực Tiếp (Inline Unit Price Override)**: Cho phép thu ngân bấm trực tiếp vào đơn giá từng món trong giỏ hàng để sửa nhanh giá tiền.
   - **Dropdown Chọn Khuyến mãi Đang Chạy**: Tự động load `/promotions/active`, kiểm tra điều kiện áp dụng (đơn tối thiểu, số lượng tối thiểu) và tính toán giảm trừ tức thời.
   - **Bộ Tùy Chỉnh Phí Mở Rộng**: Hỗ trợ nhập trực tiếp Giảm giá thủ công, Chiết khấu sàn đối tác (ShopeeFood/GrabFood), Phí giao hàng (Shipping fee), Phụ thu lễ/đêm (Surcharge).
   - **Công thức tính tổng tiền động**:
     $$\text{final\_total} = \text{subtotal} - \text{discount\_amount} - \text{promotion\_discount} - \text{platform\_fee\_discount} + \text{shipping\_fee} + \text{surcharge}$$
   - **Hóa đơn in nhiệt chi tiết**: Thể hiện đầy đủ từng dòng giảm giá, chiết khấu và phụ phí.
3. **Quy trình Hủy Đơn Hàng & Đặt Lại 1-Click (Order Cancellation & Re-order Flow)**:
   - **Chuyển đổi Tab trong Sổ Thu Chi**: Trang `transactions/page.tsx` hỗ trợ 2 Tab song song: **Sổ Thu Chi (Ledger)** và **Lịch sử Đơn hàng (Orders)**.
   - **Modal Hủy Đơn**: Cho phép thu ngân nhập lý do hủy đơn, tùy chọn checkbox **"Hoàn trả tiền vào quỹ [Tên quỹ]"**.
   - **Tự động ghi nhận Sổ Thu Chi**: Backend tự động ghi nhận giao dịch chi (`outflow`) hoàn tiền và khấu trừ số dư khả dụng của quỹ tương ứng.
   - **Nút "Đặt lại đơn này" (Re-order)**: 1-Click khôi phục nguyên vẹn danh sách món, biến thể, topping và ghi chú từ đơn hủy vào giỏ hàng POS (`rabbitpos_active_cart` trong `localStorage`) và tự động chuyển hướng về màn hình POS.

---

### ✅ Phase 4: Báo Cáo Phân Tích Quản Trị BI, Đối Soát Số Dư Định Kỳ & Phân Loại Chi Phí
1. **Báo cáo Doanh thu & Quản trị BI (Executive BI Analytics Dashboard)**:
   - **Giao diện Dual-Tab**: Hỗ trợ 2 góc nhìn chuyên sâu:
     * **Doanh thu bán hàng (Revenue)**: Tổng doanh thu thuần, Giá trị trung bình/đơn (AOV), Số lượng đơn thành công, Tổng giảm giá & chiết khấu; kèm nhãn so sánh tăng/giảm (%) so với kỳ trước.
     * **Lợi nhuận & Lãi Lỗ (Profit & Loss / P&L)**: Lợi nhuận gộp & Biên LN gộp (Gross Margin %), Lợi nhuận ròng & Biên LN ròng (Net Margin %), Tổng giá vốn hàng bán (COGS), Chi phí vận hành & chi ngoài (Operating Expenses).
   - **Bộ lọc Khung thời gian Linh hoạt**: Hôm nay, Hôm qua, Tuần này, Tháng này, Năm nay, Tùy chỉnh khoảng ngày (Custom Date Range).
   - **Biểu đồ Trực quan Tương tác (Interactive SVG Charts)**:
     * Biểu đồ Xu hướng Doanh thu theo từng mốc thời gian kèm hover tooltip.
     * Biểu đồ Cơ cấu Phương thức Thanh toán (Tiền mặt, VietQR, Khác) với tỷ trọng % và số lượng đơn.
     * Biểu đồ Tương quan Doanh thu - Giá vốn - Lợi nhuận (Multi-Series Trend).
   - **Bảng Báo Cáo Tài Chính Lãi Lỗ (P&L Financial Statement)**: Thể hiện chi tiết cấu trúc kết quả kinh doanh từ Doanh thu thuần, (-) Giá vốn COGS, (=) Lợi nhuận gộp, (-) Chi phí vận hành, (+) Thu nhập khác, (=) Lợi nhuận ròng kèm tỷ trọng %.
   - **Bảng Xếp Hạng Toàn Bộ Menu (`AllProductsRankingModal`)**: Tìm kiếm theo tên món/danh mục, lọc theo danh mục, sắp xếp đa tiêu chí (Doanh thu, Lợi nhuận, Số lượng bán, Biên LN %), phân trang và nút xuất file CSV.
2. **Báo Cáo Đối Soát Số Dư Quỹ Định Kỳ (Funds Periodic Balance Audit)**:
   - Thêm bảng **Báo cáo Đối soát Số dư Định kỳ** tại trang `funds/page.tsx`.
   - Đối chiếu chi tiết từng quỹ thanh toán giữa **Tháng này** và **Tháng trước**: Số dư Đầu kỳ, (+) Tổng Thu trong kỳ, (-) Tổng Chi trong kỳ, (=) Số dư Cuối kỳ, Chênh lệch ròng và Tỷ lệ tăng trưởng (Growth %).
   - Dòng tổng hợp toàn bộ các quỹ (Totals Row).
3. **Phân Loại Cơ Cấu Chi Phí & Doanh Thu (Expense Category Breakdown)**:
   - Tích hợp biểu đồ phân loại tỷ trọng chi phí/thu nhập ngay trên đầu trang `transactions/page.tsx`.
   - Phân nhóm trực quan: Mua nguyên liệu, Chi phí vận hành, Chênh lệch đối soát, Khác kèm số tiền, tỷ trọng % và số lượng giao dịch.
4. **Quản Lý Danh Mục Thu / Chi Thủ Công Động (Dynamic Transaction Categories CRUD)**:
   - **Database**: Bảng `transaction_categories` (`id`, `name`, `type` [outflow/inflow/both], `code`, `is_system`, `created_at`, `updated_at`).
   - **Bảo vệ Danh mục Mặc định**: Các danh mục cốt lõi của hệ thống (`ingredient_purchase`, `utility_bill`, `reconciliation_variance`, `sale`, `other`) được gán `is_system = true` để chống xóa nhầm gây lỗi luồng tài chính.
   - **Backend CRUD API**:
     * `GET /api/v1/transaction-categories`: Lấy danh sách danh mục (hỗ trợ lọc `?type=outflow|inflow`).
     * `POST /api/v1/transaction-categories`: Thêm danh mục tùy chỉnh mới (chống trùng tên trong cùng loại).
     * `PUT /api/v1/transaction-categories/:id`: Sửa tên hoặc loại danh mục.
     * `DELETE /api/v1/transaction-categories/:id`: Xóa danh mục tùy chỉnh (chặn xóa danh mục hệ thống với 403 Forbidden).
   - **Frontend UI & Modal**:
     * Component [TransactionCategoryModal.tsx](file:///opt/RabbitPOS/frontend/src/components/transactions/TransactionCategoryModal.tsx) quản lý danh mục toàn diện (Thêm/Sửa/Xóa, bộ lọc Khoản chi/Khoản thu/Tất cả).
     * Nút **"Quản lý danh mục"** trên thanh công cụ trang Sổ Thu Chi (`transactions/page.tsx`).
     * Tự động load danh mục động vào dropdown chọn danh mục khi **Ghi nhận thu/chi thủ công** và **Bộ lọc Sổ thu chi**.
     * Tích hợp nút tắt **"Quản lý danh mục"** ngay trong modal ghi nhận thu chi để thêm nhanh mà không cần rời khỏi form.
5. **Chỉnh Sửa & Xóa Khoản Thu / Chi Thủ Công (Manual Transactions Edit / Delete)**:
   - **Bảo Vệ Tính Toàn Vẹn Số Dư Quỹ (Fund Balance Integrity)**:
     * **Khi Chỉnh sửa (`PUT /api/v1/transactions/:id`)**: Tự động hoàn tác (revert) số tiền của giao dịch cũ trên quỹ cũ và áp dụng số tiền & loại giao dịch mới trên quỹ mới trong một DB Transaction duy nhất.
     * **Khi Xóa (`DELETE /api/v1/transactions/:id`)**: Tự động hoàn tác (revert) số dư quỹ tương ứng (khoản thu thì trừ bớt lại, khoản chi thì cộng bù lại) trong một DB Transaction.
     * **Chặn Sửa/Xóa Giao Dịch Đơn Hàng & Đối Soát**: Giao dịch phát sinh từ đơn hàng POS (`reference_order_id != nil`) hoặc kiểm quỹ (`reconciliation_variance`) được bảo vệ nghiêm ngặt chống can thiệp thủ công (trả về mã lỗi 403 Forbidden).
   - **Giao Diện Bảng Sổ Thu Chi ([transactions/page.tsx](file:///opt/RabbitPOS/frontend/src/app/transactions/page.tsx))**:
     * Cột **"Thao tác"**: Hiển thị nút **Chỉnh sửa (Bút chì)** và **Xóa (Thùng rác)** đối với từng giao dịch thủ công.
     * Giao dịch hệ thống/đơn hàng tự động hiển thị nhãn `Tự động`.
     * Modal Chỉnh sửa giao dịch nạp sẵn dữ liệu cũ (Quỹ, Loại thu/chi, Danh mục, Số tiền, Diễn giải).
     * Modal Xóa giao dịch hiển thị tóm tắt thông tin chi tiết và cảnh báo hoàn trả số dư quỹ tự động.

---

## 3. Bản Đồ File Mã Nguồn Quan Trọng (File Map)

### Backend (`/opt/RabbitPOS/backend/`)
- `cmd/server/main.go`: Khởi chạy API server & Router.
- `internal/database/postgres.go`: Kết nối PostgreSQL, AutoMigrate, Seed dữ liệu mặc định.
- `internal/models/`:
  - `transaction_category.go`: TransactionCategoryItem Model & Request DTOs.
  - `analytics.go`: Revenue, Profit, Product Ranking, Fund Period Summary & Category Breakdown DTOs.
  - `promotion.go`: Promotion Model & DTOs.
  - `order.go`: Order, OrderItem, CancelOrderRequest DTO.
  - `topping.go`, `user.go`, `product.go`, `category.go`, `transaction.go`, `fund.go`, `setting.go`.
- `internal/handlers/`:
  - `transaction_category.go`: CRUD Danh mục Thu / Chi.
  - `analytics.go`: `GET /analytics/revenue`, `GET /analytics/profit`, `GET /analytics/products-ranking`.
  - `fund.go`: `GET /funds/period-summary`, `GET /funds/:id/balance`, `POST /funds/:id/reconcile`.
  - `transaction.go`: `GET /transactions/category-breakdown`, `GET /transactions`, `POST /transactions`.
  - `promotion.go`, `order.go`, `topping.go`, `auth.go`, `product.go`, `category.go`, `setting.go`, `upload.go`.
- `internal/routes/routes.go`: Định tuyến toàn bộ RESTful API.
- `migrations/`:
  - `000008_create_toppings.up.sql` / `000008_create_toppings.down.sql`
  - `000009_create_promotions.up.sql` / `000009_create_promotions.down.sql`
  - `000010_fix_promotions_foreign_key.up.sql` / `000010_fix_promotions_foreign_key.down.sql`
  - `000011_create_transaction_categories.up.sql` / `000011_create_transaction_categories.down.sql`

### Frontend (`/opt/RabbitPOS/frontend/src/`)
- `types/transaction_category.ts`: TypeScript interfaces cho Transaction Categories.
- `types/analytics.ts`: TypeScript interfaces cho Analytics, P&L, Period Summary & Category Breakdown.
- `components/transactions/TransactionCategoryModal.tsx`: Modal CRUD Danh mục Thu Chi động.
- `components/dashboard/AllProductsRankingModal.tsx`: Modal bảng xếp hạng hiệu suất món toàn diện với tìm kiếm, lọc danh mục, sắp xếp và xuất CSV.
- `app/`:
  - `transactions/page.tsx`: Sổ Thu Chi (Ledger) & Lịch sử Đơn hàng (Orders) với tính năng Quản lý danh mục động, Hủy đơn & Đặt lại 1-click.
  - `funds/page.tsx`: Quản lý Quỹ tiền mặt & Ngân hàng VietQR, Đối soát số dư định kỳ.
  - `dashboard/page.tsx`: Báo cáo Doanh thu, Lợi nhuận gộp, COGS.
  - `settings/page.tsx`: Cài đặt Cửa hàng, Logo, Tiền tệ, Tài khoản VietQR.
  - `login/page.tsx`: Đăng nhập & Modal Thiết lập mật khẩu mới.
- `components/`:
  - `AppShell.tsx`: Navigation bar, Admin role guard, Logo & Tiêu đề cửa hàng.
  - `pos/VariantSelectorModal.tsx`: Modal chọn Size, 5 mức Đường/Đá, Topping đa chọn.
  - `pos/CartDrawer.tsx`: Giỏ hàng POS với sửa đơn giá trực tiếp, chọn khuyến mãi, drawer phụ phí.
  - `pos/ReceiptModal.tsx`: Hóa đơn in nhiệt tiêu chuẩn hiển thị chi tiết mọi khoản chiết khấu/phụ phí.
  - `pos/CheckoutModal.tsx`: Modal Thanh toán Tiền mặt / VietQR động.
- `lib/i18n/`:
  - `locales/vi.json` & `locales/en.json`: Từ điển hoàn chỉnh 100%.

---

## 4. Lệnh Vận Hành & Build (Cheat Sheet)

```bash
# Kiểm tra trạng thái toàn bộ containers
docker compose -f docker-compose.prod.yml ps

# Build và khởi động lại Backend & Frontend khi có thay đổi code
docker compose -f docker-compose.prod.yml build backend frontend && docker compose -f docker-compose.prod.yml up -d

# Xem log thời gian thực của backend hoặc frontend
docker logs -f rabbitpos-backend
docker logs -f rabbitpos-frontend

# Kiểm tra cú pháp Go Backend trước khi build
cd /opt/RabbitPOS/backend && go build ./...
```

---

## 5. Trạng Thái Sẵn Sàng Cho Phase Tiếp Theo

- Toàn bộ cơ sở dữ liệu, API, Frontend và quy trình E2E kiểm thử đều đã vượt qua 100% không có lỗi.
- Dự án sẵn sàng cho các tính năng tiếp theo như: Quản lý ca làm việc (Shift Management) & Bàn giao ca thu ngân, Quản lý kho nguyên vật liệu tồn kho (Raw Inventory Deduction), hoặc Tích hợp in hóa đơn qua máy in nhiệt Bluetooth/LAN/ESC-POS.
