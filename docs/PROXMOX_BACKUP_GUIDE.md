# Hướng dẫn Thiết lập Sao lưu (Backup) Định kỳ trên Máy chủ Proxmox VE cho RabbitPOS

Tài liệu này hướng dẫn chi tiết cách thiết lập hệ thống sao lưu đa tầng (3-2-1 Backup Strategy) cho RabbitPOS, bảo đảm an toàn dữ liệu 100%, không gián đoạn hoạt động (Zero Downtime) và khôi phục nhanh chóng khi có sự cố.

---

## 1. Tổng quan Kiến trúc Sao lưu 2 Tầng

| Tầng | Cấp độ | Đối tượng sao lưu | Tần suất | Thời gian | Phương pháp | Thời gian khôi phục (RTO) |
|---|---|---|---|---|---|---|
| **Tầng 1** | **Proxmox VE (Host)** | Toàn bộ LXC Container (CT 1000: OS, Docker, Config, DB, Web) | Hàng ngày / Hàng tuần | 02:00 AM | `vzdump` (Snapshot Mode) | < 2 phút |
| **Tầng 2** | **Nội bộ Container (Guest)** | Database PostgreSQL (`.sql.gz`) + Media Uploads (`.tar.gz`) | Hàng ngày | 03:00 AM | `scripts/backup.sh` (Cron job) | < 30 giây |

---

## 2. Tầng 1: Cấu hình Backup định kỳ trên Proxmox VE (Host)

### Cách A: Cấu hình qua Giao diện Web Proxmox VE (Khuyến nghị ⭐)

1. Đăng nhập vào trang quản trị **Proxmox VE Web GUI** (`https://<IP-Proxmox>:8006`).
2. Ở menu bên trái, chọn **Datacenter** → chọn tab **Backup** → bấm **Add**.
3. Điền các thông số cấu hình như sau:
   - **Node:** Chọn `All` (hoặc tên node Proxmox hiện tại của bạn).
   - **Storage:** Chọn nơi lưu trữ bản backup (ví dụ: `local`, `backup-drive`, `NFS`, hoặc `PBS`).
   - **Day of week:** Chọn các ngày muốn backup (khuyến nghị chọn **Tất cả các ngày** / `Everyday`).
   - **Start Time:** `02:00` (Khung giờ vắng khách, ít giao dịch).
   - **Selection Mode:** Chọn `Include selected VMs`.
   - **VMs:** Tích chọn Container **`1000 (rabbitpos)`**.
   - **Mode:** Chọn **`Snapshot`** *(Rất quan trọng: Chế độ Snapshot giúp sao lưu trực tiếp khi container đang chạy mà KHÔNG cần tắt hay tạm dừng hệ thống)*.
   - **Compression:** Chọn **`ZSTD (fast and good)`** (Tối ưu tốc độ nén và dung lượng).
   - **Send email to:** Nhập email nhận thông báo (tùy chọn).
   - **Email notification:** Chọn `On failure only` hoặc `Always`.
4. Chuyển sang tab **Retention** (Chính sách giữ bản sao lưu cũ):
   - **Keep Last:** `7` (Giữ 7 bản gần nhất).
   - **Keep Daily:** `7` (Giữ 7 ngày gần nhất).
   - **Keep Weekly:** `4` (Giữ 4 tuần gần nhất).
   - **Keep Monthly:** `3` (Giữ 3 tháng gần nhất).
5. Bấm **Create** để hoàn tất.

---

### Cách B: Cấu hình bằng Dòng lệnh trên Proxmox VE Host (CLI)

Nếu truy cập SSH trực tiếp vào máy chủ Proxmox Host, bạn có thể thiết lập nhanh bằng lệnh:

1. **Chạy backup thủ công kiểm tra thử:**
   ```bash
   vzdump 1000 --mode snapshot --compress zstd --storage local --prune-backups keep-last=7
   ```

2. **Thêm lịch Cron tự động trên Proxmox Host:**
   Mở file `/etc/crontab` trên Host:
   ```bash
   nano /etc/crontab
   ```
   Thêm dòng sau (chạy lúc 02:00 sáng mỗi ngày):
   ```cron
   0 2 * * * root vzdump 1000 --mode snapshot --compress zstd --storage local --prune-backups keep-last=7 --quiet 1
   ```

---

## 3. Tầng 2: Cấu hình Backup Database & Media tự động trong Container

Bên trong Container RabbitPOS (`/opt/RabbitPOS`), script `scripts/backup.sh` đã được cấu hình tự động trích xuất toàn bộ dữ liệu PostgreSQL và thư mục hình ảnh sản phẩm.

### Cấu hình Cron Job trong Container:
Cron job đã được kích hoạt chạy lúc **03:00 AM** mỗi ngày:
```bash
0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
```

- **Vị trí lưu trữ:** `/opt/RabbitPOS/backups/`
  - `backup_db_YYYYMMDD_HHMMSS.sql.gz`: Toàn bộ dữ liệu PostgreSQL
  - `backup_uploads_YYYYMMDD_HHMMSS.tar.gz`: Toàn bộ hình ảnh, logo sản phẩm
- **Chính sách dọn dẹp:** Tự động xóa các file backup quá 14 ngày để tiết kiệm dung lượng đĩa.

---

## 4. Hướng dẫn Khôi phục Dữ liệu (Restore)

### Trường hợp 1: Khôi phục toàn bộ Container từ Proxmox VE
Khi máy chủ gặp sự cố phần cứng hoặc lỗi toàn bộ hệ điều hành:
1. Trên Proxmox GUI: Chọn Storage chứa bản backup (ví dụ: `local` / `local-zfs`) → Tab **Backups**.
2. Chọn bản backup của CT 1000 theo ngày muốn khôi phục → Bấm **Restore**.
3. Chọn ID container (1000) và Storage đích → Bấm **Restore**. Container sẽ phục hồi nguyên trạng trong vòng 1-2 phút.

### Trường hợp 2: Khôi phục riêng Database PostgreSQL bên trong Container
Khi nhân viên lỡ thao tác xóa nhầm dữ liệu hoặc muốn quay lại dữ liệu ngày hôm trước:
1. Truy cập vào container:
   ```bash
   cd /opt/RabbitPOS
   ```
2. Chạy lệnh phục hồi:
   ```bash
   ./scripts/restore.sh
   ```
3. Danh sách các bản backup sẽ hiện ra để bạn chọn số thứ tự muốn khôi phục. Hoặc chỉ định trực tiếp:
   ```bash
   ./scripts/restore.sh /opt/RabbitPOS/backups/backup_db_20260821_003357.sql.gz -y
   ```
