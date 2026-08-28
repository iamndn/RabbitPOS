# Quy Chuẩn Thực Thi Cho AI Agents (Agent Execution Guidelines)

Tài liệu này quy định các quy chuẩn bắt buộc để các Agent khi làm việc với codebase **RabbitPOS** không bao giờ bị treo (stuck), vượt timeout hoặc vi phạm phạm vi dự án.

---

## 1. Quy Chuẩn Lệnh Backend (Go)

### ⚠️ Điều cấm kỵ:
1. **KHÔNG ĐƯỢC CHẠY** `go build ./...` hoặc `go test ./...` từ thư mục gốc `backend/`.
   - **Lý do**: Biến môi trường hệ thống cấu hình `GOMODCACHE=/opt/RabbitPOS/backend/.gomodcache`. Cú pháp đệ quy `./...` sẽ duyệt qua hàng chục nghìn file mã nguồn thư viện trong cache, gây treo hoặc timeout.
2. **KHÔNG ĐƯỢC CHẠY** `go build` thiếu cờ `-mod=readonly`.
   - **Lý do**: Biến môi trường OS cài đặt `GOFLAGS='-mod=mod'`. Nếu không có `-mod=readonly`, Go sẽ cố gắng gửi request mạng đến `sum.golang.org` để kiểm tra checksum, gây nghẽn và timeout (120s).

### ✅ Quy chuẩn bắt buộc:
1. **Kiểm tra build Backend**:
   ```bash
   # Trong thư mục /opt/RabbitPOS/backend
   go build -mod=readonly -o /dev/null ./cmd/server ./internal/...
   ```
2. **Chạy Unit Test Backend**:
   ```bash
   # Chạy test trong internal/handlers hoặc package cụ thể
   go test -mod=readonly -v ./internal/handlers -run "TestPurchaseUnitConversion_PureMath"
   ```

---

## 2. Quy Chuẩn Lệnh Frontend (Node / Next.js)

### ⚠️ Điều cấm kỵ:
- Không chạy các lệnh npm/npx ở chế độ tương tác (interactive mode).
- Tránh build toàn bộ bundle production (`npm run build`) khi chỉ cần kiểm tra lỗi cú pháp/typecheck.

### ✅ Quy chuẩn bắt buộc:
1. **Kiểm tra Type và Syntax (nhanh nhất, 0 side-effect)**:
   ```bash
   # Trong thư mục /opt/RabbitPOS/frontend
   npx tsc --noEmit
   ```
2. **Khi cần build frontend**:
   ```bash
   CI=true NEXT_TELEMETRY_DISABLED=1 npm run build
   ```
3. **Khi cài đặt package mới**:
   ```bash
   npm install --no-audit --no-fund
   ```

---

## 3. Quy Chuẩn Phạm Vi Nghiệp Vụ (Business Scope)

- **Trọng tâm**: Nhập hàng $\to$ Quy đổi đơn vị đa cấp/hao hụt $\to$ Định lượng công thức món (BOM) $\to$ Tính Cost & Theo dõi Lợi nhuận thu hồi.
- **TUYỆT ĐỐI KHÔNG**:
  - Không xây dựng module tồn kho (Inventory/Stock).
  - Không trừ kho khi bán hàng trên POS.
  - Không cảnh báo hết hàng, không kiểm kho, không báo cáo tồn.
