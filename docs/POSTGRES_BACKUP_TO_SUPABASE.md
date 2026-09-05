# Backup PostgreSQL từ server lên Supabase Storage

> Đây là phương án được khuyến nghị cho CBT Platform ở quy mô hiện tại: cứ 6 giờ tạo một PostgreSQL dump, mã hóa trên server rồi tải lên bucket private trong Supabase.
>
> File này được phép đẩy lên GitHub. Không điền secret, private key, database dump hoặc file `.env.production` vào repository.

## 1. Phương án đề xuất

Dữ liệu câu hỏi, đáp án, lời giải, tag, bundle, đề thi, user và lịch sử làm bài đều nằm trong PostgreSQL trên server. Vì vậy luồng backup tối thiểu là:

```text
PostgreSQL trên server
        │
        ├── pg_dump định dạng custom (đã nén)
        ├── kiểm tra archive bằng pg_restore --list
        ├── mã hóa bằng age public key
        └── upload vào Supabase bucket private database-backups
```

Lịch phù hợp khi hệ thống còn nhỏ:

- chạy tự động mỗi 6 giờ;
- giữ 8 ngày gần nhất trên Supabase, tương đương khoảng 32 bản;
- sau mỗi đợt nhập nhiều câu hỏi, chạy thêm một bản thủ công;
- mỗi tháng tải một bản về máy cá nhân và restore thử.

Supabase Free hiện có 1 GB tổng File Storage và giới hạn 50 MB cho mỗi file. Dung lượng này dùng chung với `images` và `contributions`. Script bên dưới sẽ từ chối upload nếu file backup mã hóa vượt 50 MB; cần theo dõi tổng dung lượng trong Supabase Dashboard.

Lưu backup cùng Supabase đủ để xử lý rủi ro server chết hoặc mất quyền server. Tuy nhiên, nó không bảo vệ khỏi việc mất cả tài khoản Supabase, nên vẫn nên tải một bản hằng tháng về máy cá nhân/ổ cứng ngoài.

## 2. Chuẩn bị khóa mã hóa trên máy cá nhân

Database có email, password hash, refresh token và dữ liệu người dùng. Không upload database dump dạng đọc được trực tiếp.

Cài `age` trên máy cá nhân, sau đó tạo private key:

```bash
age-keygen -o cbt-backup-age.key
age-keygen -y cbt-backup-age.key
```

Lệnh thứ hai in ra public recipient có dạng:

```text
age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Thực hiện như sau:

1. Giữ file `cbt-backup-age.key` trên máy cá nhân và thêm một bản vào password manager/USB an toàn.
2. Không upload private key lên server, Supabase hoặc GitHub.
3. Chỉ copy chuỗi public recipient `age1...` lên server. Public recipient chỉ mã hóa được, không giải mã được backup.

Mất private key đồng nghĩa không thể khôi phục các file backup đã mã hóa.

## 3. Tạo bucket private trên Supabase

Trong Supabase Dashboard:

1. Vào **Storage**.
2. Chọn **New bucket**.
3. Đặt tên chính xác: `database-backups`.
4. Giữ bucket ở chế độ **Private**.
5. Có thể giới hạn MIME type là `application/octet-stream`.
6. Không tạo public read policy cho bucket này.

Trong **Storage → Configuration → S3**:

1. bật S3 protocol;
2. tạo S3 Access Key ID và Secret Access Key;
3. ghi lại endpoint dạng `https://PROJECT_REF.storage.supabase.co/storage/v1/s3`;
4. ghi lại region của project.

S3 key chỉ được lưu trong password manager và file root-only trên server. Key này có quyền lớn đối với Storage nên phải thay ngay khi nghi ngờ bị lộ.

## 4. Cài công cụ trên server

SSH vào server:

```bash
sudo apt update
sudo apt install -y age rclone
sudo install -d -m 700 /etc/cbt-backup
sudo install -d -m 700 /var/backups/cbt-platform
```

Tạo `/etc/cbt-backup/rclone.conf`:

```ini
[supabase-cbt]
type = s3
provider = Other
access_key_id = REPLACE_WITH_SUPABASE_S3_ACCESS_KEY_ID
secret_access_key = REPLACE_WITH_SUPABASE_S3_SECRET_ACCESS_KEY
endpoint = https://PROJECT_REF.storage.supabase.co/storage/v1/s3
region = REPLACE_WITH_PROJECT_REGION
force_path_style = true
```

Khóa quyền đọc:

```bash
sudo chown root:root /etc/cbt-backup/rclone.conf
sudo chmod 600 /etc/cbt-backup/rclone.conf
```

Kiểm tra kết nối:

```bash
sudo rclone lsd --config /etc/cbt-backup/rclone.conf supabase-cbt:
sudo rclone lsf --config /etc/cbt-backup/rclone.conf supabase-cbt:database-backups
```

Kết quả phải nhìn thấy bucket `database-backups` và lệnh thứ hai không báo lỗi.

## 5. Kiểm tra dung lượng database hiện tại

Các lệnh dưới đây giả định repository production nằm tại `/opt/cbt-platform`. Nếu server dùng đường dẫn khác, thay lại cho đúng.

```bash
cd /opt/cbt-platform

docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_size_pretty(pg_database_size(current_database()));"'
```

Đây là dung lượng database chưa nén. File `pg_dump -Fc` thường nhỏ hơn, nhưng phải đo file backup thật thay vì ước lượng.

## 6. Script backup

Trên server, tạo file `/usr/local/sbin/cbt-postgres-backup` từ nội dung dưới đây.

Chỉ thay hai giá trị:

- `PROJECT_DIR` nếu repository không ở `/opt/cbt-platform`;
- `AGE_RECIPIENT` bằng public recipient `age1...` ở bước 2.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR=/opt/cbt-platform
COMPOSE_FILE="$PROJECT_DIR/deploy/docker-compose.production.yml"
ENV_FILE="$PROJECT_DIR/deploy/.env.production"
RCLONE_CONFIG=/etc/cbt-backup/rclone.conf
REMOTE_DIR=supabase-cbt:database-backups
AGE_RECIPIENT=age1_REPLACE_WITH_YOUR_PUBLIC_RECIPIENT
# Leave headroom below the Free plan's 50 MB per-file limit.
MAX_FILE_BYTES=$((49 * 1024 * 1024))
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$(mktemp -d "/var/backups/cbt-platform/run-${STAMP}-XXXXXX")"
UPLOAD_DIR="$RUN_DIR/upload"
DUMP_FILE="$RUN_DIR/cbt-postgres-${STAMP}.dump"
ENCRYPTED_NAME="cbt-postgres-${STAMP}.dump.age"
ENCRYPTED_FILE="$UPLOAD_DIR/$ENCRYPTED_NAME"

cleanup() {
  rm -rf -- "$RUN_DIR"
}
trap cleanup EXIT

mkdir -p "$UPLOAD_DIR"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres sh -c \
  'pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$DUMP_FILE"

test -s "$DUMP_FILE"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres pg_restore --list \
  < "$DUMP_FILE" \
  > /dev/null

age \
  --recipient "$AGE_RECIPIENT" \
  --output "$ENCRYPTED_FILE" \
  "$DUMP_FILE"

ENCRYPTED_BYTES="$(stat -c %s "$ENCRYPTED_FILE")"
if (( ENCRYPTED_BYTES > MAX_FILE_BYTES )); then
  echo "Backup is too close to or exceeds the Supabase Free 50 MB file limit" >&2
  exit 1
fi

(
  cd "$UPLOAD_DIR"
  sha256sum "$ENCRYPTED_NAME" > "$ENCRYPTED_NAME.sha256"
)

rclone copy \
  --config "$RCLONE_CONFIG" \
  --immutable \
  "$UPLOAD_DIR/" \
  "$REMOTE_DIR/"

rclone check \
  --config "$RCLONE_CONFIG" \
  --one-way \
  "$UPLOAD_DIR/" \
  "$REMOTE_DIR/"

rclone delete \
  --config "$RCLONE_CONFIG" \
  --min-age 8d \
  --include '*.dump.age' \
  --include '*.dump.age.sha256' \
  "$REMOTE_DIR/"

echo "PostgreSQL backup $STAMP uploaded and verified"
```

Script có các chốt an toàn:

- `pg_dump -Fc` tạo archive có nén;
- `pg_restore --list` xác nhận archive đọc được trước khi upload;
- dump gốc chỉ nằm trong thư mục tạm với quyền riêng;
- Supabase chỉ nhận file đã mã hóa;
- checksum được upload cùng backup;
- upload được kiểm tra trước khi xóa bản quá 8 ngày;
- chỉ xóa file đúng mẫu trong bucket `database-backups`;
- thư mục tạm được tạo bằng `mktemp` và xóa khi script kết thúc.

Cài script:

```bash
sudo chown root:root /usr/local/sbin/cbt-postgres-backup
sudo chmod 700 /usr/local/sbin/cbt-postgres-backup
sudo /usr/local/sbin/cbt-postgres-backup
```

Sau lần chạy đầu, mở Supabase Storage → `database-backups`. Phải có hai file cùng timestamp:

```text
cbt-postgres-YYYYMMDDTHHMMSSZ.dump.age
cbt-postgres-YYYYMMDDTHHMMSSZ.dump.age.sha256
```

## 7. Chạy tự động mỗi 6 giờ

Tạo `/etc/systemd/system/cbt-postgres-backup.service`:

```ini
[Unit]
Description=Backup CBT PostgreSQL to Supabase Storage
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/sbin/cbt-postgres-backup
```

Tạo `/etc/systemd/system/cbt-postgres-backup.timer`:

```ini
[Unit]
Description=Run CBT PostgreSQL backup every 6 hours

[Timer]
OnCalendar=*-*-* 00,06,12,18:15:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
```

Kích hoạt:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cbt-postgres-backup.timer
sudo systemctl list-timers cbt-postgres-backup.timer
```

Kiểm tra log:

```bash
sudo systemctl status cbt-postgres-backup.service
sudo journalctl -u cbt-postgres-backup.service -n 100 --no-pager
```

Chạy thủ công ngay sau khi vừa nhập một loạt câu hỏi:

```bash
sudo systemctl start cbt-postgres-backup.service
```

## 8. Tải và giải mã một bản backup

Thực hiện trên máy cá nhân có private key, không thực hiện trên server production nếu không cần.

Tải file `.age` và `.sha256` từ Supabase Dashboard, đặt trong cùng thư mục rồi chạy:

```bash
sha256sum --check cbt-postgres-YYYYMMDDTHHMMSSZ.dump.age.sha256

age \
  --decrypt \
  --identity cbt-backup-age.key \
  --output cbt-postgres.dump \
  cbt-postgres-YYYYMMDDTHHMMSSZ.dump.age
```

Nếu checksum báo lỗi, không dùng bản đó để restore.

## 9. Restore thử trên máy cá nhân

Không thử restore đè lên production. Dùng PostgreSQL 16 tạm:

```bash
docker run \
  --name cbt-postgres-restore-test \
  -e POSTGRES_PASSWORD=temporary_restore_password \
  -e POSTGRES_DB=cbt_restore \
  -d postgres:16-alpine
```

Chờ PostgreSQL sẵn sàng:

```bash
until docker exec cbt-postgres-restore-test \
  pg_isready --username postgres --dbname cbt_restore; do sleep 1; done
```

Restore:

```bash
docker exec -i cbt-postgres-restore-test \
  pg_restore \
  --username postgres \
  --dbname cbt_restore \
  --no-owner \
  --no-acl \
  --exit-on-error \
  < cbt-postgres.dump
```

Kiểm tra dữ liệu quan trọng:

```bash
docker exec cbt-postgres-restore-test \
  psql \
  --username postgres \
  --dbname cbt_restore \
  --command 'SELECT count(*) AS questions FROM questions;'

docker exec cbt-postgres-restore-test \
  psql \
  --username postgres \
  --dbname cbt_restore \
  --command 'SELECT count(*) AS users FROM users;'
```

Sau khi kiểm tra xong, xóa đúng container test:

```bash
docker rm -f cbt-postgres-restore-test
```

Backup chỉ được coi là hoạt động khi đã có ít nhất một lần restore thử thành công.

## 10. Restore khi server cũ đã chết

1. Tạo server Ubuntu mới và clone source từ GitHub.
2. Tạo `deploy/.env.production` mới.
3. Chạy riêng PostgreSQL/Redis:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d postgres redis
```

4. Tải file backup từ Supabase về máy có private key, kiểm tra checksum và giải mã.
5. Copy `cbt-postgres.dump` lên server mới.
6. Restore vào database mới:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  exec -T postgres sh -c \
  'pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < cbt-postgres.dump
```

7. Áp dụng migration và bật ứng dụng:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  run --rm migrate

docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build
```

8. Đăng nhập admin, kiểm tra số câu hỏi, user, bundle, đề thi và mở thử một đề.
9. Cài lại timer backup trên server mới.

## 11. Checklist ngắn

- [ ] Tạo private bucket `database-backups` trên Supabase.
- [ ] Tạo age private key trên máy cá nhân; chỉ đưa public recipient lên server.
- [ ] Cấu hình Supabase S3 trong `/etc/cbt-backup/rclone.conf`.
- [ ] Chạy script thủ công thành công.
- [ ] Xác nhận `.dump.age` và `.sha256` xuất hiện trên Supabase.
- [ ] Bật systemd timer 6 giờ.
- [ ] Restore thử một bản trên máy cá nhân.
- [ ] Mỗi tháng tải một backup về máy/ổ ngoài.
- [ ] Theo dõi tổng Storage để không vượt 1 GB Free quota.

## 12. Khi nào phải đổi phương án

Chuyển backup sang kho khác hoặc nâng cấp khi có một trong các dấu hiệu:

- file `.dump.age` đạt gần 50 MB;
- tổng Storage Supabase đạt 70–80% của 1 GB;
- cần giữ backup lâu hơn 8 ngày;
- cần bảo vệ cả trường hợp mất tài khoản Supabase;
- hệ thống có lượng user/lượt thi đủ lớn để RPO 6 giờ không còn chấp nhận được.

Khi đó dùng hướng dẫn đầy đủ tại [`BACKUP_RECOVERY_PLAN.md`](./BACKUP_RECOVERY_PLAN.md) với kho offsite độc lập, retention nhiều tầng và restore drill định kỳ.

## 13. Tài liệu chính thức

- Supabase pricing/free quota: https://supabase.com/pricing
- Supabase Storage file limits: https://supabase.com/docs/guides/storage/uploads/file-limits
- Supabase private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase S3 authentication: https://supabase.com/docs/guides/storage/s3/authentication
- PostgreSQL `pg_dump`: https://www.postgresql.org/docs/16/app-pgdump.html
- PostgreSQL `pg_restore`: https://www.postgresql.org/docs/current/app-pgrestore.html
