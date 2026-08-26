# Hướng Dẫn Thiết Lập Sao Lưu (Backup) & Khôi Phục Dữ Liệu Cho RabbitPOS

> Hệ thống sao lưu đa tầng (3-2-1 Backup Strategy) bảo đảm an toàn dữ liệu 100%, không gián đoạn hoạt động (Zero Downtime) và khôi phục nhanh chóng khi có sự cố.

---

## 1. Tổng Quan Kiến Trúc Sao Lưu Đa Tầng

| Tầng | Cấp độ | Đối tượng sao lưu | Tần suất | Thời gian | Phương pháp | Thời gian khôi phục (RTO) |
|---|---|---|---|---|---|---|
| **Tầng 1** | **Proxmox VE (Host)** | Toàn bộ LXC Container (CT 200: OS, Docker, Config, DB, Media) | Hàng ngày / Hàng tuần | 02:00 AM | `vzdump` (Snapshot Mode) | < 2 phút |
| **Tầng 2** | **Container CLI (Guest)** | Database PostgreSQL (`.sql.gz`) + Media Uploads (`.tar.gz`) | Hàng ngày | 03:00 AM | `scripts/backup.sh` (Cron job) | < 30 giây |
| **Tầng 3** | **Web UI (Admin)** | Database PostgreSQL Dump Snapshot | Theo yêu cầu | Tức thì | `/api/v1/backup/export` | < 15 giây |

---

## 2. Tầng 1: Cấu Hình Backup Định Kỳ Trên Proxmox VE (Host)

### Cách A: Cấu hình qua Giao diện Web Proxmox VE GUI (Khuyến nghị ⭐)
1. Đăng nhập vào trang quản trị **Proxmox VE Web GUI** (`https://<IP-Proxmox>:8006`).
2. Ở menu bên trái, chọn **Datacenter** → chọn tab **Backup** → bấm **Add**.
3. Điền các thông số cấu hình:
   - **Node:** `All` (hoặc tên node Proxmox hiện tại của bạn).
   - **Storage:** Chọn nơi lưu trữ bản backup (ví dụ: `local`, `backup-drive`, `NFS`, hoặc `PBS`).
   - **Day of week:** Chọn **Tất cả các ngày** (`Everyday`).
   - **Start Time:** `02:00` (Khung giờ vắng khách, ít giao dịch).
   - **Selection Mode:** `Include selected VMs`.
   - **VMs:** Tích chọn Container **`200 (rabbitpos-lxc)`**.
   - **Mode:** Chọn **`Snapshot`** *(Sao lưu trực tiếp khi container đang chạy mà KHÔNG cần tắt hay tạm dừng hệ thống)*.
   - **Compression:** Chọn **`ZSTD (fast and good)`** (Tối ưu tốc độ nén và dung lượng).
   - **Email notification:** Nhập email nhận thông báo (tùy chọn).
4. Chuyển sang tab **Retention** (Chính sách giữ bản sao lưu):
   - **Keep Last:** `7`
   - **Keep Daily:** `7`
   - **Keep Weekly:** `4`
   - **Keep Monthly:** `3`
5. Bấm **Create** để hoàn tất.

### Cách B: Cấu hình bằng Dòng lệnh trên Proxmox Host (CLI)
Mở file `/etc/crontab` trên Host Proxmox:
```bash
nano /etc/crontab
```
Thêm dòng sau (chạy lúc 02:00 sáng mỗi ngày):
```cron
0 2 * * * root vzdump 200 --mode snapshot --compress zstd --storage local --prune-backups keep-last=7 --quiet 1
```

---

## 3. Tầng 2: Cấu Hình Backup Database & Media Tự Động Trong Container

Bên trong Container RabbitPOS (`/opt/RabbitPOS`), script `scripts/backup.sh` tự động trích xuất toàn bộ dữ liệu PostgreSQL và thư mục hình ảnh sản phẩm.

### Cấu hình Cron Job trong Container:
```bash
crontab -e
```
Thêm dòng lệnh chạy lúc **03:00 AM** mỗi ngày:
```bash
0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
```

- **Thư mục lưu trữ:** `/opt/RabbitPOS/backups/`
  - `backup_db_YYYYMMDD_HHMMSS.sql.gz`: Toàn bộ dữ liệu PostgreSQL
  - `backup_uploads_YYYYMMDD_HHMMSS.tar.gz`: Toàn bộ hình ảnh, logo sản phẩm
- **Chính sách dọn dẹp:** Tự động xóa các file backup quá **14 ngày** để bảo vệ dung lượng đĩa.

---

## 4. Tầng 3: Sao Lưu & Khôi Phục Nhanh Qua Web UI

1. Đăng nhập tài khoản Admin vào hệ thống: `https://rabbitpos.ndnworks.com`.
2. Truy cập menu **Cài Đặt Hệ Thống** (`/settings`) → Chuyển sang tab **Sao Lưu & Dữ Liệu**.
3. **Tải bản sao lưu**: Bấm nút **"Tải Bản Sao Lưu (.sql)"** để tải ngay snapshot cơ sở dữ liệu về máy tính cá nhân.
4. **Khôi phục bản sao lưu**: Chọn file `.sql` hoặc `.sql.gz` từ máy tính và bấm **"Khôi Phục Dữ Liệu"** để hệ thống tự động import lại.

---

## 5. Hướng Dẫn Khôi Phục Dữ Liệu Khi Có Sự Cố (Disaster Recovery)

### Kịch bản 1: Khôi phục toàn bộ Container từ Proxmox VE (Hỏng máy chủ / OS)
1. Trên Proxmox GUI: Chọn Storage chứa bản backup → Tab **Backups**.
2. Chọn bản backup của Container `200` theo ngày muốn khôi phục → Bấm **Restore**.
3. Container sẽ phục hồi nguyên trạng trong vòng **1-2 phút**.

### Kịch bản 2: Khôi phục riêng Database PostgreSQL bên trong Container
1. Truy cập vào container:
   ```bash
   cd /opt/RabbitPOS
   ```
2. Chạy lệnh phục hồi tương tác:
   ```bash
   bash scripts/restore.sh
   ```
3. Danh sách các bản backup sẽ hiện ra để bạn chọn số thứ tự. Hoặc chỉ định trực tiếp:
   ```bash
   bash scripts/restore.sh /opt/RabbitPOS/backups/backup_db_20260821_003357.sql.gz -y
   ```
