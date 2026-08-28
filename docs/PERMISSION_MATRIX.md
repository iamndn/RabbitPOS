# RabbitPOS - Permission Matrix Specification (Phase 0)

> **Tài liệu đặc tả Ma Trận Phân Quyền Hệ Thống (RBAC Permission Matrix)**  
> **Áp dụng cho các vai trò**: `admin` (Quản trị viên / Chủ quán), `staff` (Thu ngân / Nhân viên đứng quầy)  
> **Cập nhật**: 2026-08-28

---

## 1. Tổng Quan Về Vai Trò (Roles)

Hệ thống RabbitPOS phân tách người dùng thành 2 vai trò chính:
1. **`admin`**: Toàn quyền cấu hình, quản trị danh mục thực đơn, công thức định lượng (BOM), kiểm soát sổ cái tài chính, xem báo cáo phân tích kinh doanh (BI), xuất/nhập dữ liệu và sao lưu/khôi phục hệ thống.
2. **`staff`**: Nhân viên thu ngân đứng quầy POS. Thực hiện các thao tác bán hàng, tính tiền, in hóa đơn, áp dụng khuyến mãi hiện hành, xem danh mục và thực hiện các giao dịch trong ca làm việc.

---

## 2. Ma Trận Phân Quyền Chi Tiết (8 Nhóm Nghiệp Vụ Trọng Tâm)

| STT | Nhóm Nghiệp Vụ / Hành Động | Vai Trò `staff` | Vai Trò `admin` | Cơ Chế Thực Thi & Ghi Nhận Audit Trail |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Tạo đơn hàng (Create Order)** | ✅ Cho phép | ✅ Cho phép | `POST /api/v1/orders`. Tự động gắn `cashier_id` & `cashier_name` từ JWT context. Cập nhật số dư Quỹ thanh toán và tạo giao dịch thu (`inflow`) tương ứng. |
| **2** | **Sửa đơn giá / Giảm giá (Price Override / Custom Discount)** | ⚠️ Có điều kiện | ✅ Toàn quyền | - **Hiện tại**: Staff có thể nhập `discount_amount` hoặc sửa giá từng món.<br>- **Đề xuất Phase sau**: Staff chỉ được giảm giá $\le 20\%$ hoặc tối đa $100.000$đ/đơn; nếu vượt quá cần **Admin Approval PIN**. Admin không bị giới hạn. |
| **3** | **Tạo đơn lùi ngày (Backdate Order / Transaction)** | ❌ Không cho phép (hoặc giới hạn trong ca) | ✅ Toàn quyền | - Staff chỉ được ghi nhận đơn với thời gian thực (`created_at` tự động lấy `NOW()`) hoặc chênh lệch tối đa 15 phút nếu có độ trễ mạng.<br>- Admin được quyền gửi `created_at` tùy ý để nhập bù sổ sách/hóa đơn quá khứ. |
| **4** | **Hủy đơn hàng (Cancel Order)** | ⚠️ Giới hạn trong ca | ✅ Toàn quyền | - `POST /api/v1/orders/:id/cancel`.<br>- Bắt buộc phải có lý do hủy (`cancel_reason`).<br>- Staff chỉ được hủy các đơn do chính mình tạo ra trong ngày/ca làm việc hiện tại.<br>- Admin có thể hủy đơn bất kỳ ngày nào. |
| **5** | **Hoàn tiền đơn hàng (Refund Order)** | ⚠️ Yêu cầu quyền Admin | ✅ Toàn quyền | - Hủy kèm cờ `refund: true` sẽ tạo giao dịch chi hoàn tiền (`outflow` với category `Hủy đơn / Trả hàng`) và trừ tiền khỏi Quỹ thanh toán.<br>- Staff khi thực hiện hoàn tiền cần ghi rõ lý do và bị ghi nhận audit log chặt chẽ. |
| **6** | **Xem cấu hình (View Settings)** | ✅ Cho phép (Read-only) | ✅ Cho phép | `GET /api/v1/settings`. Staff xem các cấu hình hiển thị giao diện: Tên cửa hàng (`store_name`), logo (`store_logo_url`), thông tin tài khoản ngân hàng VietQR. |
| **7** | **Thay đổi cấu hình (Update Settings)** | ❌ Cấm (403 Forbidden) | ✅ Toàn quyền | `PUT /api/v1/settings`. Chỉ Admin được thay đổi cấu hình kết nối SMTP, Google Sheets Sync, Auto-Tagging, thông số cửa hàng. |
| **8** | **Sao lưu & Khôi phục (Backup & Restore)** | ❌ Cấm (403 Forbidden) | ✅ Toàn quyền | - `GET /api/v1/backup/export` & `POST /api/v1/backup/restore`.<br>- Thuộc nhóm Endpoint bảo vệ nghiêm ngặt `RequireRole(models.RoleAdmin)`. |

---

## 3. Ma Trận Quyền Toàn Diện Theo Endpoint API

| Nhóm API | Endpoint | Method | `staff` | `admin` | Middleware / Logic |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Auth** | `/auth/login` | POST | ✅ | ✅ | Public |
| | `/auth/setup-password` | POST | ✅ | ✅ | Đổi mật khẩu lần đầu |
| | `/auth/me` | GET | ✅ | ✅ | `AuthMiddleware` |
| **POS Catalog** | `/categories` | GET | ✅ | ✅ | Đọc danh mục món |
| | `/categories` (CRUD) | POST/PUT/DEL | ❌ | ✅ | `RequireRole("admin")` |
| | `/products` | GET | ✅ | ✅ | Đọc danh sách món & biến thể |
| | `/products` (CRUD) | POST/PUT/DEL | ❌ | ✅ | `RequireRole("admin")` |
| | `/toppings` | GET | ✅ | ✅ | Đọc danh sách topping |
| | `/toppings` (CRUD) | POST/PUT/DEL | ❌ | ✅ | `RequireRole("admin")` |
| **Promotions** | `/promotions/active` | GET | ✅ | ✅ | Áp dụng khuyến mãi tại quầy POS |
| | `/promotions` (CRUD) | POST/PUT/DEL | ❌ | ✅ | `RequireRole("admin")` |
| **Orders** | `/orders` | GET | ✅ | ✅ | Lọc theo ca / ngày |
| | `/orders` | POST | ✅ | ✅ | Tạo đơn hàng mới |
| | `/orders/:id` | GET | ✅ | ✅ | Chi tiết đơn hàng |
| | `/orders/:id/cancel` | POST | ✅ | ✅ | Hủy đơn / Hoàn tiền |
| | `/vietqr/generate` | GET | ✅ | ✅ | Sinh mã VietQR chuyển khoản |
| **Sổ Quỹ (Funds)** | `/funds` | GET | ✅ | ✅ | Xem danh sách quỹ thanh toán |
| | `/funds/:id/balance` | GET | ✅ | ✅ | Xem số dư lý thuyết |
| | `/funds/cashier-shift-summary`| GET | ✅ | ✅ | Xem tổng kết ca của thu ngân |
| | `/funds/:id/reconcile` | POST | ❌ | ✅ | Kiểm quỹ / Đối soát thực tế |
| | `/funds/period-summary` | GET | ❌ | ✅ | Báo cáo quỹ định kỳ |
| **Sổ Cái Thu/Chi** | `/transactions` | GET | ❌ | ✅ | Xem toàn bộ nhật ký thu chi |
| | `/transactions` | POST | ❌ | ✅ | Tạo phiếu thu/chi thủ công |
| | `/transactions/:id` | PUT/DELETE | ❌ | ✅ | Sửa/Xóa phiếu thu chi |
| **NVL & BOM** | `/purchases/ingredients` | GET | ✅ | ✅ | Autocomplete tên NVL khi chi |
| | `/purchases/ingredients` (CRUD)| POST/PUT/DEL | ❌ | ✅ | Quản lý danh mục NVL & quy đổi |
| | `/purchases/recipes/*` | GET/POST | ❌ | ✅ | Quản lý định lượng công thức |
| | `/purchases/cost-comparison` | GET | ❌ | ✅ | So sánh giá vốn thực tế vs COGS |
| | `/purchases/apply-cost` | POST | ❌ | ✅ | Cập nhật COGS vào thực đơn |
| **Báo Cáo (BI)** | `/analytics/*` | GET/POST | ❌ | ✅ | Doanh thu, Lợi nhuận, Top món |
| **Hệ Thống** | `/settings` | GET | ✅ | ✅ | Xem cấu hình chung |
| | `/settings` | PUT | ❌ | ✅ | Lưu cấu hình |
| | `/backup/export` | GET | ❌ | ✅ | Xuất file sao lưu dữ liệu |
| | `/backup/restore` | POST | ❌ | ✅ | Khôi phục cơ sở dữ liệu |
| | `/import/*` | GET/POST | ❌ | ✅ | Nhập dữ liệu từ Excel |

---

## 4. Quy Tắc Bảo Mật Bổ Sung (Security Hardening Rules)

1. **JWT Expiration & Revocation**: Token JWT được cấp khi đăng nhập; hết hạn sẽ tự động yêu cầu đăng nhập lại (Frontend xử lý tự động chuyển trang `/login` khi nhận mã `401`).
2. **First-time Password Enforcement**: Tài khoản mới tạo hoặc seeded có cờ `needs_password_setup = true`. Người dùng bị chặn mọi thao tác POS cho đến khi hoàn tất bước đặt mật khẩu mới qua `/auth/setup-password`.
3. **Cashier Attribution**: Tất cả đơn hàng (`orders`) và giao dịch phát sinh từ bán hàng (`transactions`) đều ghi nhận chính xác `cashier_id` và `cashier_name` của nhân viên đăng nhập.
