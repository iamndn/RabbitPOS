# RabbitPOS - Standardized API Error Code Specification (Phase 0)

> **Đề Xuất Chuẩn Hóa Cấu Trúc Mã Lỗi API (Standardized Error Envelope & Error Codes)**  
> **Áp dụng**: Thiết lập baseline chuẩn cho toàn bộ RESTful API v1 của RabbitPOS.

---

## 1. Cấu Trúc Response Chuẩn (Response Envelope)

Để giữ tính tương thích ngược hoàn toàn với hệ thống hiện tại, Response Envelope được mở rộng với trường `error_code` và `details` tùy chọn khi xảy ra lỗi:

```json
{
  "status": "error",
  "error_code": "ORDER_INVALID_PAYLOAD",
  "message": "Dữ liệu đơn hàng không hợp lệ: Số lượng món phải lớn hơn 0",
  "data": null,
  "details": [
    {
      "field": "items[0].quantity",
      "issue": "must_be_greater_than_zero",
      "message": "Số lượng món phải lớn hơn 0"
    }
  ]
}
```

---

## 2. Bảng Phân Nhóm Mã Lỗi Chuẩn Theo Domain

### A. Xác Thực & Phân Quyền (Auth & RBAC Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `AUTH_INVALID_CREDENTIALS` | 401 | Tên đăng nhập hoặc mật khẩu không chính xác |
| `AUTH_UNAUTHORIZED` | 401 | Thiếu JWT Token hoặc Token không hợp lệ / đã hết hạn |
| `AUTH_FORBIDDEN_ROLE` | 403 | Người dùng không đủ quyền thực hiện tác vụ (VD: Staff truy cập trang Quản trị) |
| `AUTH_PASSWORD_SETUP_REQUIRED` | 403 | Tài khoản bắt buộc phải đổi mật khẩu lần đầu trước khi tiếp tục |
| `AUTH_ACCOUNT_DISABLED` | 403 | Tài khoản đã bị vô hiệu hóa (`is_active = false`) |

### B. Bán Hàng & Đơn Hàng (Orders Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `ORDER_NOT_FOUND` | 404 | Không tìm thấy đơn hàng theo ID hoặc OrderCode |
| `ORDER_INVALID_PAYLOAD` | 400 | Dữ liệu đơn hàng không hợp lệ (thiếu món, số lượng âm...) |
| `ORDER_FUND_NOT_FOUND` | 400 | Quỹ thanh toán được chọn không tồn tại hoặc đã bị khóa |
| `ORDER_ALREADY_CANCELLED` | 400 | Đơn hàng đã ở trạng thái đã hủy, không thể hủy lại |
| `ORDER_CANCEL_REASON_REQUIRED` | 400 | Bắt buộc phải cung cấp lý do khi hủy đơn hàng |
| `ORDER_IDEMPOTENT_DUPLICATE` | 200/409 | Đơn hàng đã được xử lý bởi `Idempotency-Key` trước đó |

### C. Thực Đơn & Danh Mục (Catalog & Menu Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `CATEGORY_NOT_FOUND` | 404 | Danh mục không tồn tại |
| `PRODUCT_NOT_FOUND` | 404 | Sản phẩm không tồn tại |
| `VARIANT_NOT_FOUND` | 404 | Biến thể món (Size/Option) không tồn tại |
| `TOPPING_NOT_FOUND` | 404 | Topping không tồn tại |
| `PROMOTION_NOT_FOUND` | 404 | Chương trình khuyến mãi không tồn tại |
| `PROMOTION_EXPIRED` | 400 | Khuyến mãi đã hết hạn hoặc chưa đến ngày áp dụng |
| `PROMOTION_USAGE_EXCEEDED` | 400 | Khuyến mãi đã hết lượt sử dụng |

### D. Tài Chính & Sổ Quỹ (Finance & Funds Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `FUND_NOT_FOUND` | 404 | Quỹ tiền không tồn tại |
| `FUND_INSUFFICIENT_BALANCE` | 400 | Số dư quỹ không đủ để thực hiện giao dịch chi/hoàn tiền |
| `TRANSACTION_NOT_FOUND` | 404 | Giao dịch thu/chi không tồn tại |
| `TX_CATEGORY_SYSTEM_LOCKED` | 400 | Danh mục thu chi mặc định của hệ thống không thể xóa/sửa code |

### E. Nguyên Vật Liệu & Định Lượng (Purchases & BOM Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `INGREDIENT_NOT_FOUND` | 404 | Nguyên vật liệu không tồn tại trong danh mục |
| `INGREDIENT_NAME_DUPLICATE` | 409 | Tên nguyên vật liệu đã tồn tại trong hệ thống |
| `CONVERSION_SPEC_INVALID` | 400 | Quy cách quy đổi đơn vị không hợp lệ (hệ số $\le 0$) |
| `RECIPE_TARGET_INVALID` | 400 | Định lượng phải gắn với hoặc Biến thể món hoặc Topping |

### F. Sao Lưu & Khôi Phục (Backup & Restore Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `BACKUP_UNSUPPORTED_VERSION` | 400 | Phiên bản file backup không tương thích với phiên bản hệ thống |
| `BACKUP_INVALID_PAYLOAD` | 400 | Định dạng file JSON sao lưu bị hỏng hoặc sai cấu trúc |
| `BACKUP_CHECKSUM_MISMATCH` | 400 | Mã Checksum SHA-256 không khớp, dữ liệu có thể đã bị can thiệp |
| `RESTORE_EXECUTION_FAILED` | 500 | Lỗi trong quá trình thực thi khôi phục dữ liệu vào cơ sở dữ liệu |

### G. Hệ Thống & Máy Chủ (System Domain)
| Error Code | HTTP Status | Mô Tả & Trường Hợp Sử Dụng |
| :--- | :---: | :--- |
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi hệ thống nội bộ không lường trước (đã được ghi log server) |
| `DATABASE_CONNECTION_ERROR`| 503 | Mất kết nối tới cơ sở dữ liệu PostgreSQL |
| `SERVICE_UNAVAILABLE` | 503 | Dịch vụ bên ngoài (SMTP/Google Sheets) tạm thời không phản hồi |
| `VALIDATION_FAILED` | 422 | Lỗi validate dữ liệu đầu vào chung |

---

## 3. Quy Tắc Chuyển Đổi Từng Bước (Gradual Adoption)

- **Giai đoạn hiện tại (Phase 0)**: Giữ nguyên các hàm `models.SendSuccess`, `models.SendError`, `models.SendInternalError` trong `models/response.go` để bảo đảm 100% không ảnh hưởng đến bất kỳ API đang chạy nào.
- **Giai đoạn kế tiếp (Phase 1+)**: Bổ sung hàm overload `models.SendErrorCode(c, statusCode, errorCode, message)` để migrate dần các endpoint mà không làm gãy giao diện Frontend.
