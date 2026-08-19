# RabbitPOS - Báo Cáo Tiến Trình & Tài Liệu Bàn Giao (Project Handover)

> **Mục đích**: Tài liệu tổng hợp toàn bộ hiện trạng kỹ thuật, kiến trúc, cơ sở dữ liệu, API, giao diện và các tính năng đã hoàn thành qua **Phase 1, Phase 2, Phase 3, Phase 4** và chuẩn bị cho **Phase 5** để tiếp tục phát triển liền mạch trong phiên chat mới.

---

## 1. Tổng Quan Kiến Trúc Hệ Thống (Architecture Overview)

- **Backend**: Golang Clean Architecture, Gin Framework, GORM ORM, JWT Authentication, Bcrypt password hashing.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React Icons, Context-based Custom i18n (Tiếng Việt & English).
- **Cơ sở dữ liệu**: PostgreSQL 16 Alpine với GORM AutoMigrate kết hợp SQL Migrations (`backend/migrations/`).
- **Triển khai & Mạng (DevOps & Networking)**:
  - **Docker Compose** (`docker-compose.prod.yml`): `rabbitpos-postgres`, `rabbitpos-backend`, `rabbitpos-frontend`, `rabbitpos-npm` (Nginx Proxy Manager), `rabbitpos-tunnel` (Cloudflare Zero Trust Tunnel).
  - **Persistent Volumes**: `postgres_data` (DB data), `backend_uploads` (Image uploads directory `/app/uploads`).
  - **Frontend Production URL**: `https://rabbitpos.ndnworks.com`
  - **Backend Production API URL**: `https://rabbitpos-api.ndnworks.com/api/v1`
  - **Admin Mặc định**: `admin` / `admin123` (tùy chỉnh qua `.env` `INITIAL_ADMIN_PASSWORD`).

---

## 2. Chi Tiết Các Phase Đã Hoàn Thành (100% Verified)

### ✅ Phase 1: Xác Thực, Phân Quyền Thu Ngân & Cài Đặt Hệ Thống
1. **Quy trình Đổi mật khẩu lần đầu (First-time Password Setup Flow)**:
   - Thêm cột `needs_password_setup` và `is_active` vào bảng `users`.
   - Seed sẵn 3 tài khoản Thu ngân: `NDN`, `NHUNG`, `DAT` (mật khẩu tạm mặc định tương ứng: `ndn`, `nhung`, `dat`).
   - Bắt buộc đổi mật khẩu khi đăng nhập lần đầu trước khi vào màn hình POS.
   - Endpoint: `POST /api/v1/auth/setup-password`.
2. **Gắn định danh Thu ngân vào Đơn hàng & Giao dịch**:
   - Bảng `orders` và `transactions` có cột `cashier_id` (BIGINT) và `cashier_name` (VARCHAR).
   - Tự động trích xuất từ JWT Claims khi tạo đơn hoặc thu/chi.
3. **Quản lý Cài đặt Cửa hàng & Logo**:
   - Cài đặt hỗ trợ upload logo (`store_logo_url`) lưu vào `/uploads/`.
   - Tiêu đề đa ngôn ngữ theo cài đặt: `"Rabbit POS"` (EN) / `"Thỏ POS"` (VI).
4. **Fix lỗi nhập liệu số (Number Input UX Glitch)**:
   - Xử lý triệt để lỗi dính số `0` ở đầu và lỗi xóa ô nhập liệu (Leading Zero & Backspace Sticking) trên toàn bộ ứng dụng.

---

### ✅ Phase 2: Mức Đường/Đá Chuẩn Hóa & Quản Lý Topping Động
1. **Chuẩn hóa 5 Mức Đường & Đá (Sugar / Ice Tiers)**:
   - Presets cố định: `100%`, `70%`, `50%`, `30%`, `0%` (Không đường / Không đá / Đá riêng).
   - Component `VariantSelectorModal.tsx` cho phép chọn nhanh 1-Click.
2. **Quản lý Topping Động (Dynamic Topping Management)**:
   - **Database**: Bảng `toppings` (`id`, `name`, `price`, `cogs`, `category_id`, `is_active`, `created_at`, `updated_at`).
   - **Phạm vi Topping**: Áp dụng theo danh mục cụ thể hoặc Toàn cục (Global) nếu `category_id = NULL`.
   - **Snapshot Order**: `order_items` lưu trữ snapshot `selected_toppings` (JSONB) và `toppings_price` để đảm bảo lịch sử in hóa đơn không bị biến động khi giá topping thay đổi sau này.
   - **Backend Handlers**: `topping.go` hỗ trợ CRUD `GET /toppings`, `POST /toppings`, `PUT /toppings/:id`, `DELETE /toppings/:id`.
3. **Giao diện Quản lý Topping & POS**:
   - Trang `products/page.tsx` tích hợp panel Quản lý Topping với công tắc On/Off nhanh 1-Click.
   - Hóa đơn in nhiệt (`ReceiptModal.tsx`) hiển thị rõ ràng từng loại topping và mức đường/đá.

---

### ✅ Phase 3: Công Cụ Khuyến Mãi, Điều Chỉnh Giỏ Hàng POS & Hủy Đơn / Đặt Lại
1. **Động cơ Khuyến mãi Toàn diện (Promotion Engine)**:
   - **Database**: Bảng `promotions` (`id`, `name`, `promo_type`, `discount_value`, `min_order_amount`, `min_quantity`, `scope`, `target_ids`, `gift_product_variant_id`, `start_date`, `end_date`, `usage_limit`, `usage_count`, `is_active`).
   - **Loại hình**: Giảm tiền cố định (`discount_amount`), Giảm % (`discount_percent`), Tặng quà (`gift_item`).
   - **Phạm vi**: Toàn bộ menu (`all`), theo danh mục (`category`), hoặc theo món (`product`).
   - **Tăng số lượt dùng nguyên tử**: Backend cập nhật `usage_count` nguyên tử trong transaction tạo đơn hàng (`gorm.Expr("usage_count + 1")`).
   - **Trang Quản lý Khuyến mãi**: `frontend/src/app/promotions/page.tsx` với KPI cards, bộ lọc tìm kiếm/loại/trạng thái, nút On/Off 1-click, modal thêm/sửa trực quan.
2. **Điều chỉnh Giỏ hàng POS Động (POS Cart Dynamic Adjustments)**:
   - **Sửa Đơn Giá Trực Tiếp (Inline Price Override)**: Thu ngân bấm trực tiếp vào đơn giá từng món trong giỏ để sửa giá bán nhanh.
   - **Dropdown Chọn Khuyến mãi Đang Chạy**: Tự động load `/promotions/active`, kiểm tra điều kiện áp dụng (đơn tối thiểu, số lượng tối thiểu) và tính toán giảm trừ tức thời.
   - **Bộ Tùy Chỉnh Phí Mở Rộng**: Giảm giá thủ công, Chiết khấu sàn đối tác, Phí giao hàng (Shipping fee), Phụ thu lễ/đêm (Surcharge).
   - **Công thức tính tổng tiền động**:
     $$\text{final\_total} = \text{subtotal} - \text{discount\_amount} - \text{promotion\_discount} - \text{platform\_fee\_discount} + \text{shipping\_fee} + \text{surcharge}$$
3. **Quy trình Hủy Đơn Hàng & Đặt Lại 1-Click (Order Cancellation & Re-order Flow)**:
   - **Tab Lịch sử Đơn hàng**: Trang `transactions/page.tsx` hỗ trợ Tab Sổ Thu Chi và Tab Lịch sử Đơn hàng.
   - **Modal Hủy Đơn**: Nhập lý do hủy, checkbox tùy chọn hoàn tiền vào quỹ thanh toán (tự động ghi giao dịch chi `outflow` hoàn tiền).
   - **Nút "Đặt lại đơn này" (Re-order)**: 1-Click khôi phục nguyên vẹn giỏ hàng vào `localStorage` và chuyển về màn hình POS.

---

### ✅ Phase 4: Báo Cáo Phân Tích Quản Trị BI, Đối Soát Định Kỳ & Danh Mục Thu/Chi
1. **Báo cáo Doanh thu & Quản trị BI (Executive BI Analytics Dashboard)**:
   - **Giao diện Dual-Tab**:
     * **Doanh thu bán hàng (Revenue)**: Doanh thu thuần, AOV, số đơn thành công, tổng chiết khấu, so sánh % kỳ trước.
     * **Lợi nhuận & Lãi Lỗ (P&L)**: Lợi nhuận gộp & Gross Margin %, Lợi nhuận ròng & Net Margin %, Tổng giá vốn COGS, Chi phí vận hành.
   - **Biểu đồ SVG Tương tác**: Xu hướng Doanh thu/Thời gian, Cơ cấu Phương thức Thanh toán (Tiền mặt/VietQR), Tương quan Doanh thu - COGS - Lợi nhuận.
   - **Bảng Báo Cáo Tài Chính Lãi Lỗ (P&L Financial Statement)**: Cấu trúc chi tiết Doanh thu thuần -> COGS -> Lợi nhuận gộp -> Chi phí -> Lợi nhuận ròng.
   - **Bảng Xếp Hạng Toàn Bộ Menu (`AllProductsRankingModal`)**: Tìm kiếm, lọc danh mục, sắp xếp đa tiêu chí, phân trang và xuất CSV.
2. **Báo Cáo Đối Soát Số Dư Quỹ Định Kỳ (Funds Periodic Balance Audit)**:
   - Thêm bảng đối soát tại `funds/page.tsx`: Đối chiếu Số dư Đầu kỳ, Tổng Thu, Tổng Chi, Số dư Cuối kỳ, Chênh lệch ròng và Tỷ lệ tăng trưởng so với kỳ trước.
3. **Phân Loại Cơ Cấu Chi Phí & Doanh Thu (Expense Category Breakdown)**:
   - Biểu đồ phân loại tỷ trọng chi phí/thu nhập trên đầu trang `transactions/page.tsx`.
4. **Quản Lý Danh Mục Thu / Chi Thủ Công Động (Dynamic Transaction Categories CRUD)**:
   - **Database**: Bảng `transaction_categories` (`id`, `name`, `type`, `code`, `is_system`).
   - **Backend API**: `GET|POST|PUT|DELETE /api/v1/transaction-categories`. Bảo vệ danh mục hệ thống (`is_system = true`) chống xóa nhầm.
   - **Frontend**: Component `TransactionCategoryModal.tsx` quản lý danh mục toàn diện.
5. **Chỉnh Sửa & Xóa Khoản Thu / Chi Thủ Công (Manual Transactions Edit / Delete)**:
   - **Bảo Vệ Tính Toàn Vẹn Số Dư Quỹ (Fund Balance Integrity)**:
     * `PUT /api/v1/transactions/:id`: Hoàn tác số dư quỹ cũ và áp dụng số dư quỹ mới trong 1 DB Transaction.
     * `DELETE /api/v1/transactions/:id`: Hoàn tác số dư quỹ tương ứng trong 1 DB Transaction.
     * Chặn sửa/xóa giao dịch gắn với đơn hàng hoặc kiểm quỹ đối soát (trả về `403 Forbidden`).
   - **Giao diện**: Thêm cột "Thao tác" với nút Sửa (Bút chì) và Xóa (Thùng rác).

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
  - `transaction.go`: `GET /transactions/category-breakdown`, `GET /transactions`, `POST /transactions`, `PUT /transactions/:id`, `DELETE /transactions/:id`.
  - `promotion.go`, `order.go`, `topping.go`, `auth.go`, `product.go`, `category.go`, `setting.go`, `upload.go`.
- `internal/routes/routes.go`: Định tuyến toàn bộ RESTful API.
- `migrations/`:
  - `000008_create_toppings.up.sql`
  - `000009_create_promotions.up.sql`
  - `000010_fix_promotions_foreign_key.up.sql`
  - `000011_create_transaction_categories.up.sql`

### Frontend (`/opt/RabbitPOS/frontend/src/`)
- `types/transaction_category.ts`: Interfaces cho Transaction Categories.
- `types/analytics.ts`: Interfaces cho Analytics, P&L, Period Summary & Category Breakdown.
- `components/transactions/TransactionCategoryModal.tsx`: Modal CRUD Danh mục Thu Chi.
- `components/dashboard/AllProductsRankingModal.tsx`: Modal xếp hạng món bán chạy với tìm kiếm, sắp xếp, xuất CSV.
- `app/`:
  - `transactions/page.tsx`: Sổ Thu Chi & Lịch sử Đơn hàng, Quản lý danh mục, Hủy đơn & Đặt lại 1-click, Sửa/Xóa thu chi thủ công.
  - `funds/page.tsx`: Quản lý Quỹ tiền mặt & VietQR, Đối soát số dư định kỳ.
  - `dashboard/page.tsx`: Báo cáo BI Doanh thu, Lợi nhuận gộp & ròng, COGS.
  - `promotions/page.tsx`: Quản lý Chương trình Khuyến mãi & Chiết khấu.
  - `settings/page.tsx`: Cài đặt Cửa hàng, Logo, Tiền tệ, Tài khoản VietQR.
  - `login/page.tsx`: Đăng nhập & Modal Thiết lập mật khẩu mới.
- `components/`:
  - `AppShell.tsx`: Navigation bar, Admin role guard, Logo & Tiêu đề cửa hàng.
  - `pos/VariantSelectorModal.tsx`: Modal chọn Size, 5 mức Đường/Đá, Topping đa chọn.
  - `pos/CartDrawer.tsx`: Giỏ hàng POS với sửa đơn giá, chọn khuyến mãi, phụ phí mở rộng.
  - `pos/ReceiptModal.tsx`: Hóa đơn in nhiệt tiêu chuẩn.
  - `pos/CheckoutModal.tsx`: Thanh toán Tiền mặt / VietQR động.
- `lib/`:
  - `api.ts`: API client helper, uploadImage, getImageUrl, getApiBaseUrl.
  - `auth.ts`: Authentication & token management.
  - `utils.ts`: formatCurrency, date helpers.
  - `i18n/locales/vi.json` & `locales/en.json`: Từ điển song ngữ 100%.

---

### ✅ Phase 5: Đại Tu Giao Diện UX/UI, User Dropdown, Ghi Chú Đơn Hàng, Reset Giỏ Hàng & Modern Date Range Picker
1. **Ghi Chú Đơn Hàng (Order Note Support)**:
   - **Database Migration**: `000012_add_order_note.up.sql` và rollback `000012_add_order_note.down.sql` thêm cột `note` (TEXT NULL) vào bảng `orders`.
   - **Backend**: Update `Order` model, `CreateOrderRequest` và `OrderResponse` DTO; lưu và trả về ghi chú đơn hàng trong `POST /api/v1/orders`.
2. **User Profile Dropdown Menu (`AppShell.tsx`)**:
   - Tích hợp User Avatar, Tên người dùng, Badge phân quyền, Cài đặt hệ thống, Chuyển đổi ngôn ngữ VI / EN và Đăng xuất vào Dropdown menu góc trên bên phải với tính năng tự động đóng khi click ra ngoài (click-outside dismiss).
3. **Làm Sạch Giao Diện Đăng Nhập (`login/page.tsx`)**:
   - Gỡ bỏ hoàn toàn các nút/badge tài khoản mẫu cố định (`admin`, `staff`, `NDN`, `NHUNG`, `DAT`), hiển thị Logo cửa hàng và tên thương hiệu động.
4. **Nâng Cấp Giỏ Hàng POS & Full State Reset (`CartDrawer.tsx`, `page.tsx`, `ReceiptModal.tsx`)**:
   - Ô nhập Ghi chú đơn hàng kèm nút xóa nhanh trong ngăn kéo giỏ hàng.
   - Đồng bộ hóa ghi chú đơn hàng với `localStorage` (`rabbitpos_active_cart`).
   - Khi hoàn tất đơn hàng: thực hiện **Full State Reset** (làm sạch toàn bộ items, note, discount amount, selected promotion, shipping fee, platform fee discount, surcharge và xóa `localStorage`).
   - In hóa đơn nhiệt (`ReceiptModal.tsx`) hiển thị trực quan phần Ghi chú đơn hàng.
5. **Bộ Chọn Khoảng Thời Gian Hiện Đại (`ModernDateRangePicker.tsx`)**:
   - Component Popover Tailwind CSS tái sử dụng với các presets chọn nhanh: "Hôm nay", "Hôm qua", "Tuần này", "Tháng này", "Năm nay", "Tùy chỉnh ngày".
   - Tích hợp liền mạch trên `/dashboard`, `/transactions` và `/funds`.

---

## 5. Lệnh Vận Hành & Cheat Sheet

```bash
# Kiểm tra trạng thái containers
docker compose -f docker-compose.prod.yml ps

# Rebuild và khởi động lại Backend & Frontend
docker compose -f docker-compose.prod.yml up -d --build backend frontend

# Xem logs backend hoặc frontend
docker logs -f rabbitpos-backend
docker logs -f rabbitpos-frontend

# Kiểm tra cú pháp Go Backend
cd /opt/RabbitPOS/backend && go build ./...
```
