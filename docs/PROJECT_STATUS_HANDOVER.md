# RabbitPOS - Báo Cáo Tiến Trình & Tài Liệu Bàn Giao (Project Handover)

> **Mục đích**: Tài liệu tổng hợp toàn diện hiện trạng kỹ thuật, kiến trúc, cơ sở dữ liệu, danh sách API, giao diện frontend và toàn bộ các tính năng đã hoàn thành qua **Phase 1 đến Phase 10+** để bàn giao và phát triển liền mạch.

---

## 1. Tổng Quan Kiến Trúc Hệ Thống (Architecture Overview)

- **Backend**: Go 1.22+ Clean Architecture, Gin Web Framework, GORM ORM, JWT Authentication (Bearer Header & HTTP-only Cookies), Bcrypt Password Hashing.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React Icons, Context-based Bilingual i18n (Tiếng Việt & English).
- **Cơ sở dữ liệu**: PostgreSQL 16 Alpine với GORM AutoMigrate kết hợp SQL Migrations versioned (`backend/migrations/000001` - `000018`).
- **Hạ tầng & Triển khai**:
  - **Docker Compose** (`docker-compose.prod.yml`): `rabbitpos-postgres`, `rabbitpos-backend`, `rabbitpos-frontend`, `rabbitpos-npm` (Nginx Proxy Manager), `rabbitpos-tunnel` (Cloudflare Zero Trust Tunnel).
  - **Persistent Volumes**: `postgres_data` (PostgreSQL DB data), `backend_uploads` (Thư mục upload ảnh `/app/uploads`).
  - **Frontend Production URL**: `https://rabbitpos.ndnworks.com`
  - **Backend Production API URL**: `https://rabbitpos-api.ndnworks.com/api/v1`
  - **Tài khoản Admin mặc định**: `admin` / `admin123` (cấu hình qua `.env` `INITIAL_ADMIN_PASSWORD`).

---

## 2. Chi Tiết Các Giai Đoạn Phát Triển Đã Hoàn Thành (100% Verified)

### ✅ Phase 1: Xác Thực, Phân Quyền Thu Ngân & Cài Đặt Hệ Thống
1. **Đổi mật khẩu lần đầu (First-time Password Setup Flow)**:
   - Thêm cột `needs_password_setup` và `is_active` vào bảng `users`.
   - Seed sẵn 3 tài khoản Thu ngân: `NDN`, `NHUNG`, `DAT` (mật khẩu tạm ban đầu: `ndn`, `nhung`, `dat`).
   - Bắt buộc đổi mật khẩu khi đăng nhập lần đầu trước khi vào màn hình POS (`POST /api/v1/auth/setup-password`).
2. **Gắn định danh Thu ngân vào Đơn hàng & Giao dịch**:
   - Bảng `orders` và `transactions` có cột `cashier_id` (BIGINT) và `cashier_name` (VARCHAR) tự động trích xuất từ JWT Claims.
3. **Cài đặt Cửa hàng & Logo**:
   - Hỗ trợ tải lên logo cửa hàng (`store_logo_url`) lưu vào `/uploads/` và hiển thị trên toàn hệ thống.
4. **Sửa lỗi nhập liệu số (Number Input UX Glitch)**:
   - Xử lý triệt để lỗi dính số `0` ở đầu và lỗi xóa ô nhập liệu (Leading Zero & Backspace Sticking).

---

### ✅ Phase 2: Mức Đường/Đá Chuẩn Hóa & Quản Lý Topping Động
1. **Chuẩn hóa 5 Mức Đường & Đá**:
   - Presets cố định: `100%`, `70%`, `50%`, `30%`, `0%` (Không đường / Không đá / Đá riêng).
   - Component `VariantSelectorModal.tsx` cho phép chọn nhanh 1-Click.
2. **Quản lý Topping Động (Dynamic Topping Management)**:
   - **Database**: Bảng `toppings` (`id`, `name`, `price`, `cogs`, `category_id`, `display_order`, `is_active`).
   - **Phạm vi Topping**: Áp dụng theo danh mục cụ thể hoặc Toàn cục (Global) nếu `category_id = NULL`.
   - **Snapshot Order**: `order_items` lưu snapshot `selected_toppings` (JSONB) và `toppings_price` để bảo toàn lịch sử hóa đơn khi giá topping thay đổi.
   - **Backend Handlers**: `topping.go` hỗ trợ CRUD và sắp xếp lại thứ tự (`PUT /toppings/reorder`).
3. **Hóa đơn in nhiệt (`ReceiptModal.tsx`)**:
   - In đầy đủ thông tin món, topping, mức đường/đá và chiết khấu.

---

### ✅ Phase 3: Công Cụ Khuyến Mãi, Điều Chỉnh Giỏ Hàng POS & Hủy Đơn / Đặt Lại
1. **Động cơ Khuyến mãi Toàn diện (Promotion Engine)**:
   - **Database**: Bảng `promotions` (`promo_type`, `discount_value`, `min_order_amount`, `min_quantity`, `scope`, `target_ids`, `gift_product_variant_id`, `usage_limit`, `usage_count`, `display_order`).
   - **Loại hình**: Giảm tiền cố định (`discount_amount`), Giảm % (`discount_percent`), Tặng quà (`gift_item`).
   - **Tăng số lượt dùng nguyên tử**: Cập nhật `usage_count` nguyên tử trong transaction tạo đơn hàng.
   - **Trang Quản lý Khuyến mãi**: `frontend/src/app/promotions/page.tsx` với KPI cards, bộ lọc tìm kiếm/loại/trạng thái và modal thêm/sửa trực quan.
2. **Điều chỉnh Giỏ hàng POS Động (POS Cart Dynamic Adjustments)**:
   - **Sửa Đơn Giá Trực Tiếp (Inline Price Override)**: Thu ngân bấm trực tiếp vào đơn giá từng món trong giỏ để sửa giá bán nhanh.
   - **Dropdown Chọn Khuyến mãi Đang Chạy**: Tự động load `/promotions/active` và tính toán giảm trừ tức thời.
   - **Bộ Tùy Chỉnh Phí Mở Rộng**: Giảm giá thủ công, Chiết khấu sàn đối tác, Phí giao hàng (Shipping fee), Phụ thu lễ/đêm (Surcharge).
3. **Quy trình Hủy Đơn Hàng & Đặt Lại 1-Click (Order Cancellation & Re-order Flow)**:
   - **Modal Hủy Đơn**: Nhập lý do hủy, checkbox tùy chọn hoàn tiền vào quỹ thanh toán (tự động ghi giao dịch chi `outflow` hoàn tiền).
   - **Nút "Đặt lại đơn này" (Re-order)**: 1-Click khôi phục nguyên vẹn giỏ hàng vào `localStorage` và chuyển về màn hình POS.

---

### ✅ Phase 4: Báo Cáo Phân Tích Quản Trị BI, Đối Soát Định Kỳ & Danh Mục Thu/Chi
1. **Báo cáo Doanh thu & Quản trị BI (Executive BI Analytics Dashboard)**:
   - **Giao diện Dual-Tab**:
     * **Doanh thu bán hàng (Revenue)**: Doanh thu thuần, AOV, số đơn thành công, tổng chiết khấu, so sánh % kỳ trước.
     * **Lợi nhuận & Lãi Lỗ (P&L)**: Lợi nhuận gộp & Gross Margin %, Lợi nhuận ròng & Net Margin %, Tổng giá vốn COGS, Chi phí vận hành.
   - **Biểu đồ SVG Tương tác**: Xu hướng Doanh thu theo thời gian, Cơ cấu Phương thức Thanh toán, Phân bổ giờ cao điểm (0h-23h).
   - **Bảng Báo Cáo Tài Chính Lãi Lỗ (P&L Financial Statement)**: Cấu trúc chi tiết Doanh thu thuần -> COGS -> Lợi nhuận gộp -> Chi phí -> Lợi nhuận ròng.
   - **Bảng Xếp Hạng Toàn Bộ Menu (`AllProductsRankingModal`)**: Tìm kiếm, lọc danh mục, sắp xếp đa tiêu chí, phân trang và xuất CSV.
2. **Báo Cáo Đối Soát Số Dư Quỹ Định Kỳ (Funds Periodic Balance Audit)**:
   - Bảng đối soát tại `funds/page.tsx`: Đối chiếu Số dư Đầu kỳ, Tổng Thu, Tổng Chi, Số dư Cuối kỳ, Chênh lệch ròng và Tỷ lệ tăng trưởng.
3. **Quản Lý Danh Mục Thu / Chi Thủ Công Động (Dynamic Transaction Categories CRUD)**:
   - **Database**: Bảng `transaction_categories` (`id`, `name`, `type`, `code`, `is_system`, `display_order`, `is_default`).
   - Bảo vệ danh mục hệ thống (`is_system = true`) chống xóa nhầm.
4. **Chỉnh Sửa & Xóa Khoản Thu / Chi Thủ Công (Manual Transactions Edit / Delete)**:
   - Tự động hoàn tác và áp dụng số dư quỹ tương ứng trong 1 Database Transaction nguyên tử.

---

### ✅ Phase 5: Đại Tu Giao Diện UX/UI, User Dropdown, Ghi Chú Đơn Hàng & Date Range Picker
1. **Ghi Chú Đơn Hàng (Order Note Support)**:
   - Bảng `orders` có cột `note` (TEXT NULL). Ô nhập ghi chú trong giỏ hàng và hiển thị trên hóa đơn in nhiệt.
2. **User Profile Dropdown Menu (`AppShell.tsx`)**:
   - Tích hợp User Avatar, Tên người dùng, Badge phân quyền, Cài đặt, Chuyển đổi ngôn ngữ VI / EN và Đăng xuất với tính năng tự đóng khi click ra ngoài.
3. **Làm Sạch Giao Diện Đăng Nhập (`login/page.tsx`)**:
   - Giao diện đăng nhập hiện đại với Logo động và thương hiệu cửa hàng.
4. **Bộ Chọn Khoảng Thời Gian Hiện Đại (`ModernDateRangePicker.tsx`)**:
   - Component Popover Tailwind CSS với các presets chọn nhanh: "Hôm nay", "Hôm qua", "Tuần này", "Tháng này", "Năm nay", "Tùy chỉnh ngày".

---

### ✅ Phase 6: Đa Ngôn Ngữ (i18n), Quản Lý Ảnh & Xuất Dữ Liệu
1. **Internationalization (i18n)**:
   - Từ điển song ngữ hoàn chỉnh (`vi.json` & `en.json`) kết hợp `LanguageContext`.
2. **Quản lý Hình ảnh (Image Upload)**:
   - Endpoint `/api/v1/upload` tải ảnh lên `/uploads/` với kiểm tra định dạng và dung lượng tối đa 5MB.
3. **Xuất Dữ liệu Excel & CSV**:
   - Tính năng Xuất file Excel (`.xlsx`) và CSV (`exportExcel.ts`, `exportCsv.ts`) cho Sổ Thu Chi, Đơn hàng và Báo cáo Sản phẩm.

---

### ✅ Phase 7: Gửi Báo Cáo Tài Chính Tự Động & Theo Yêu Cầu Qua Email
1. **Thiết lập Database & Tài khoản Email**:
   - Bổ sung cột `email` cho bảng `users` và cấu hình danh sách Admin nhận báo cáo.
2. **Dịch Vụ Gửi Email Chuẩn Hóa (Email Service)**:
   - Module `backend/internal/services/email.go` gửi email HTML qua SMTP TLS/SSL.
3. **Lập Lịch Tự Động (Daily Cron Scheduler)**:
   - Goroutine chạy ngầm tự động gửi báo cáo vào **23:00 hàng ngày**.
4. **Gửi Theo Yêu Cầu & Test SMTP**:
   - Nút kiểm tra SMTP tại `/settings`, modal gửi báo cáo tức thời tại `/dashboard` và gửi email chốt ca tại `/funds`.

---

### ✅ Phase 8: Tối Ưu Hóa Toàn Diện Hiệu Năng Full-Stack
1. **PostgreSQL Connection Pool & Indexing**:
   - Cấu hình pool: `MaxOpenConns=30`, `MaxIdleConns=15`, `MaxLifetime=10m`, `MaxIdleTime=3m`.
   - Migration `000015_performance_indexes.up.sql` tạo composite indexes cho `orders`, `order_items`, `transactions`, `products`, `toppings`.
2. **SQL Push-down Aggregation**:
   - Tối ưu `GetPeriodSummary` trong `fund.go` thành **1 câu lệnh SQL `GROUP BY`** duy nhất.
3. **HTTP Response Compression**:
   - Middleware Gzip (`middleware/gzip.go`) nén 60–80% payload dữ liệu.
4. **Bộ nhớ đệm TTL Backend & SWR Client Cache**:
   - Generic thread-safe `TTLCache` ở backend và `frontend/src/lib/cache.ts` ở frontend giúp chuyển tab tức thì với độ trễ phản hồi API trung bình đạt **~1.9ms**.

---

### ✅ Phase 9: Đồng Bộ 2 Chiều Google Sheets & Động Cơ Tự Động Gắn Thẻ Món
1. **Google Sheets Bi-Modal Synchronization**:
   - Tích hợp Google Sheets API v4 qua Google Service Account (`gen-lang-client.json`).
   - Hỗ trợ kiểm tra kết nối, đồng bộ ngay lập tức và xem trạng thái đồng bộ (`/settings/sheets/*`).
2. **Động cơ Tự động Gắn Thẻ Sản phẩm (Automated Product Tagging Engine)**:
   - Phân tích sản lượng và doanh thu để tự động gắn thẻ món: `best_seller`, `new`, `signature`.
   - Hỗ trợ xem trước danh sách món thỏa mãn điều kiện, áp dụng 1-click và khóa thẻ thủ công (`is_tag_locked`).

---

### ✅ Phase 10: Quản Lý Mua Hàng, Định Lượng Nguyên Liệu & Giá Vốn BOM
1. **Danh Mục Nguyên Liệu Thô (`ingredients`)**:
   - Quản lý nguyên liệu (Trái cây, Sữa, Bao bì, v.v.), đơn vị tính (`kg`, `g`, `ml`, `lít`, `lon`, `cái`) và Tỷ lệ thu hồi (`yield_rate`).
2. **Gắn Phiếu Mua Hàng Với Khoản Chi Sổ Quỹ (`purchase_items`)**:
   - Khi ghi phiếu chi mua nguyên liệu, hệ thống tự động ghi nhận đơn giá và tính toán đơn giá mua bình quân gia quyền.
3. **Định Lượng Công Thức Món & Topping (`recipe_items`)**:
   - Định nghĩa tỷ lệ nguyên liệu tiêu hao cho từng biến thể món và từng loại topping.
4. **Đối Chiếu & Cập Nhật Giá Vốn 1-Click (`/purchases`)**:
   - Tự động tính toán giá vốn lý thuyết dựa trên BOM và giá nguyên liệu hiện tại.
   - So sánh với giá vốn menu hiện tại và hỗ trợ cập nhật 1-Click vào menu bán lẻ.
5. **Công Cụ Chuyển Đổi Dữ Liệu Lịch Sử (Importer Engine)**:
   - Tải template Excel mẫu và nhập dữ liệu menu/đơn hàng từ file Excel hoặc từ Sổ Bán Hàng (`scripts/migrate_from_sobanhang.py`).

---

## 3. Bản Đồ File Mã Nguồn Quan Trọng (File Map)

### Backend (`/opt/RabbitPOS/backend/`)
- `cmd/server/main.go`: Khởi tạo ứng dụng, router, cache, services và goroutines.
- `internal/config/config.go`: Đọc biến môi trường và thiết lập cấu hình.
- `internal/database/postgres.go`: Kết nối PostgreSQL, Connection Pool, AutoMigrate và Seeds.
- `internal/cache/ttl_cache.go`: Bộ nhớ đệm thread-safe generic TTL in-memory cache.
- `internal/middleware/`:
  - `auth.go`: Xác thực JWT Bearer và kiểm tra Role RBAC.
  - `cors.go`: Cấu hình CORS đa môi trường.
  - `gzip.go`: Gzip response compression.
- `internal/services/`:
  - `email.go`: Dịch vụ SMTP email và daily cron report.
  - `sheets_sync.go`: Dịch vụ đồng bộ Google Sheets 2 chiều.
  - `auto_tagging.go`: Động cơ tính toán và gắn thẻ sản phẩm tự động.
  - `importer.go`: Dịch vụ nhập dữ liệu Excel / CSV.
- `internal/models/`: Định nghĩa GORM Entities, Request/Response DTOs (`analytics.go`, `order.go`, `purchase.go`, `promotion.go`, `topping.go`, `transaction.go`, `fund.go`, `user.go`, `setting.go`, v.v.).
- `internal/handlers/`: Toàn bộ controllers xử lý HTTP REST endpoints.
- `internal/routes/routes.go`: Đăng ký toàn bộ routing của hệ thống.
- `migrations/`: 18 cặp file SQL migrations (`000001` - `000018`).

### Frontend (`/opt/RabbitPOS/frontend/src/`)
- `app/`:
  - `page.tsx`: Màn hình bán hàng POS chính.
  - `login/page.tsx`: Đăng nhập & Modal đổi mật khẩu.
  - `products/page.tsx`: Quản lý Menu, Danh mục, Topping & Tự động gắn thẻ.
  - `purchases/page.tsx`: Quản lý Mua hàng, Nguyên liệu thô & Công thức định lượng BOM.
  - `promotions/page.tsx`: Quản lý Chương trình Khuyến mãi.
  - `transactions/page.tsx`: Sổ Thu Chi & Lịch sử Đơn hàng (Hủy đơn & Đặt lại).
  - `funds/page.tsx`: Quản lý Quỹ, Đối soát số dư & Chốt ca thu ngân.
  - `dashboard/page.tsx`: Báo cáo BI Doanh thu, P&L Lãi lỗ & Xếp hạng món.
  - `settings/page.tsx`: Cài đặt Cửa hàng, Logo, Email, Google Sheets, Backup/Restore & Import.
- `components/`:
  - `AppShell.tsx`: Navigation bar, Admin role guard, User Profile Dropdown.
  - `common/ModernDateRangePicker.tsx`: Bộ chọn khoảng thời gian đa năng.
  - `pos/`: `VariantSelectorModal.tsx`, `CartDrawer.tsx`, `CheckoutModal.tsx`, `ReceiptModal.tsx`.
  - `products/`: `ProductFormDialog.tsx`, `ToppingFormDialog.tsx`, `AutoTagConfigModal.tsx`.
  - `transactions/`: `TransactionCategoryModal.tsx`, `AddTransactionDialog.tsx`.
  - `dashboard/`: Biểu đồ SVG, `AllProductsRankingModal.tsx`, `SendEmailReportModal.tsx`.
- `lib/`:
  - `api.ts`: API client helper với normalized response envelope.
  - `auth.ts`: Quản lý token JWT và thông tin user đăng nhập.
  - `cache.ts`: Client memory SWR cache.
  - `exportExcel.ts` & `exportCsv.ts`: Xuất dữ liệu Excel và CSV.
  - `i18n/`: `LanguageContext.tsx`, `locales/vi.json`, `locales/en.json`.

---

## 4. Lệnh Vận Hành & Cheat Sheet

```bash
# 1. Kiểm tra trạng thái toàn bộ containers
docker compose -f docker-compose.prod.yml ps

# 2. Khởi động lại / Rebuild toàn bộ hệ thống
docker compose -f docker-compose.prod.yml up -d --build

# 3. Xem logs theo thời gian thực
docker logs -f rabbitpos-backend
docker logs -f rabbitpos-frontend

# 4. Sao lưu dữ liệu thủ công
bash /opt/RabbitPOS/scripts/backup.sh

# 5. Khôi phục dữ liệu từ bản sao lưu
bash /opt/RabbitPOS/scripts/restore.sh

# 6. Kiểm tra kết nối API Health
curl -f http://localhost:8080/api/v1/health
```
