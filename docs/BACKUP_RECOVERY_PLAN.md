# Kế hoạch backup và khôi phục CBT Platform

> Mục tiêu: vẫn khôi phục được toàn bộ ngân hàng câu hỏi, ảnh, đề thi và dữ liệu người dùng khi server production hỏng hoàn toàn hoặc chủ sở hữu mất quyền truy cập server.
>
> Tài liệu này được phép commit lên GitHub. **Không đưa mật khẩu, khóa Supabase, file `.env.production`, database dump hoặc mã hóa key vào repository.**

## 1. Điều cần hiểu trước tiên

GitHub chỉ bảo vệ source code và migration. Dữ liệu thật của hệ thống nằm ở các nơi khác:

| Thành phần | Nơi lưu hiện tại | Mức độ quan trọng | Cách backup |
|---|---|---:|---|
| Câu hỏi, lời giải, tag, bundle, đề thi, lượt thi, user | PostgreSQL container, volume `postgres_data` | Tối quan trọng | `pg_dump` định dạng custom |
| Ảnh câu hỏi | Supabase Storage bucket `images` | Tối quan trọng | Tải toàn bộ object qua S3 API/rclone |
| PDF/DOCX đóng góp | Supabase Storage bucket `contributions` | Quan trọng | Tải toàn bộ object qua S3 API/rclone |
| Source code và Prisma migrations | GitHub | Tối quan trọng | GitHub + mirror định kỳ |
| Production secrets | `deploy/.env.production` và Supabase credentials | Tối quan trọng | Password manager + bản recovery mã hóa ngoại tuyến |
| Redis | Docker volume `redis_data` | Ngắn hạn | Không phải bản lưu chuẩn; chỉ chứa queue/cache và trạng thái phiên đang làm |

Không được coi Docker volume trên cùng server là backup. Khi mất server hoặc tài khoản nhà cung cấp, volume cũng có thể mất theo.

## 2. Mục tiêu phục hồi

- **RPO ngân hàng câu hỏi: tối đa 6 giờ** — trường hợp xấu nhất chỉ mất nội dung nhập trong 6 giờ gần nhất.
- **RPO ảnh/file: tối đa 6 giờ** với lịch full backup ban đầu; có thể tách Storage về lịch hằng ngày khi dữ liệu lớn hơn.
- **RTO: tối đa 4 giờ** để dựng server mới và mở lại hệ thống với bản backup đã xác minh gần nhất.
- Giữ tối thiểu:
  - các bản backup 6 giờ gần nhất trong 7 ngày;
  - 14 bản hằng ngày;
  - 8 bản hằng tuần;
  - 12 bản hằng tháng.

## 3. Chiến lược 3-2-1

Luôn duy trì:

1. Dữ liệu đang chạy trên PostgreSQL/Supabase.
2. Một bản backup **được mã hóa** trên dịch vụ lưu trữ độc lập với server production và độc lập với tài khoản Supabase.
3. Một bản hằng tháng trên ổ cứng/SSD ngoại tuyến hoặc dịch vụ cloud thứ hai.

Khuyến nghị bật versioning/Object Lock nếu nơi lưu backup hỗ trợ. Tài khoản backup phải bật MFA và lưu recovery code ngoại tuyến. Không dùng cùng một mật khẩu hoặc cùng một tài khoản quản trị với server production.

## 4. Lịch backup

| Lịch | Nội dung | Đích |
|---|---|---|
| Mỗi 6 giờ | PostgreSQL + `images` + `contributions` + manifest | Kho backup mã hóa bên ngoài |
| Hằng ngày | Giữ tối thiểu một snapshot hoàn chỉnh trong nhóm retention hằng ngày | Kho backup mã hóa bên ngoài |
| Sau mỗi đợt nhập/sửa câu hỏi lớn | Chạy backup thủ công ngay | Kho backup mã hóa bên ngoài |
| Hằng tuần | Giữ một snapshot bất biến | Kho backup bên ngoài |
| Hằng tháng | Tải snapshot đã kiểm tra sang ổ ngoại tuyến/cloud thứ hai | Ngoài server và ngoài tài khoản production |
| Hằng tháng | Restore thử vào database tạm | Máy kiểm tra hoặc server staging |
| Hằng quý | Diễn tập mất toàn bộ server | Hạ tầng staging sạch |

## 5. Thiết lập một lần

### 5.1 Chọn kho backup độc lập

Có thể dùng Backblaze B2, AWS S3, Cloudflare R2 hoặc một nhà cung cấp object storage khác. Tạo bucket riêng, ví dụ `cbt-platform-backups`, sau đó cấu hình `rclone crypt` để dữ liệu và tên file được mã hóa phía client.

Trên server, file cấu hình nên đặt tại:

```text
/etc/cbt-backup/rclone.conf
```

Quyền file:

```bash
sudo chown root:root /etc/cbt-backup/rclone.conf
sudo chmod 600 /etc/cbt-backup/rclone.conf
```

Tên remote dùng trong các ví dụ dưới đây:

- `supabase-cbt`: remote đọc dữ liệu từ Supabase Storage;
- `backup-crypt`: remote mã hóa trỏ tới kho backup độc lập.

### 5.2 Bật S3 cho Supabase Storage

Trong Supabase Dashboard:

1. Mở **Storage → Configuration → S3**.
2. Bật S3 protocol.
3. Tạo Access Key ID và Secret Access Key dành riêng cho backup.
4. Lưu endpoint trực tiếp dạng `https://PROJECT_REF.storage.supabase.co/storage/v1/s3` và region.
5. Lưu credentials trong password manager và `/etc/cbt-backup/rclone.conf`, không lưu trong GitHub.

Hai bucket cần sao lưu:

- `images` — public;
- `contributions` — private.

S3 access key của Supabase có quyền rất lớn và bỏ qua RLS, vì vậy chỉ dùng phía server, giới hạn quyền đọc file cấu hình và thay key ngay nếu nghi ngờ bị lộ.

### 5.3 Lưu bộ recovery secrets

Password manager và bản mã hóa ngoại tuyến phải có:

- tài khoản GitHub và recovery codes;
- quyền truy cập domain/DNS;
- tài khoản nhà cung cấp server;
- PostgreSQL username/password;
- `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`;
- Redis password;
- Supabase project access, service-role key, S3 keys, endpoint và region;
- thông tin bucket backup, rclone crypt password/salt;
- mail credentials và Sentry DSN nếu đang sử dụng.

Không có rclone crypt password thì bản backup mã hóa không thể phục hồi. Nên lưu ít nhất hai bản recovery key ở hai vị trí vật lý khác nhau.

## 6. Template tạo full backup thủ công

Chạy từ server production. Thay `/opt/cbt-platform` nếu repository nằm ở nơi khác.

```bash
sudo install -d -m 700 /var/backups/cbt-platform
sudo -i
```

Tạo script `/usr/local/sbin/cbt-full-backup` từ template sau. Script không chứa secret; secret nằm trong `.env.production` và file rclone riêng.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR=/opt/cbt-platform
COMPOSE_FILE="$PROJECT_DIR/deploy/docker-compose.production.yml"
ENV_FILE="$PROJECT_DIR/deploy/.env.production"
RCLONE_CONFIG=/etc/cbt-backup/rclone.conf
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$(mktemp -d "/var/backups/cbt-platform/run-${STAMP}-XXXXXX")"

cleanup() {
  rm -rf -- "$RUN_DIR"
}
trap cleanup EXIT

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres sh -c \
  'pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$RUN_DIR/postgres.dump"

test -s "$RUN_DIR/postgres.dump"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres pg_restore --list \
  < "$RUN_DIR/postgres.dump" \
  > "$RUN_DIR/postgres.contents.txt"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' \
  > "$RUN_DIR/row-counts.json" <<'SQL'
SELECT json_build_object(
  'questions', (SELECT count(*) FROM questions),
  'bundles', (SELECT count(*) FROM passage_bundles),
  'tags', (SELECT count(*) FROM tags),
  'exams', (SELECT count(*) FROM exams),
  'users', (SELECT count(*) FROM users)
);
SQL

mkdir -p "$RUN_DIR/storage/images" "$RUN_DIR/storage/contributions"

rclone copy \
  --config "$RCLONE_CONFIG" \
  "supabase-cbt:images" \
  "$RUN_DIR/storage/images"

rclone copy \
  --config "$RCLONE_CONFIG" \
  "supabase-cbt:contributions" \
  "$RUN_DIR/storage/contributions"

git -C "$PROJECT_DIR" rev-parse HEAD > "$RUN_DIR/git-commit.txt"
date -u --iso-8601=seconds > "$RUN_DIR/created-at.txt"

(
  cd "$RUN_DIR"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    > SHA256SUMS
)

rclone copy \
  --config "$RCLONE_CONFIG" \
  --immutable \
  "$RUN_DIR/" \
  "backup-crypt:cbt-platform/snapshots/$STAMP/"

rclone check \
  --config "$RCLONE_CONFIG" \
  --one-way \
  "$RUN_DIR/" \
  "backup-crypt:cbt-platform/snapshots/$STAMP/"

echo "Backup $STAMP uploaded and verified successfully"
```

Sau khi tạo file:

```bash
sudo chown root:root /usr/local/sbin/cbt-full-backup
sudo chmod 700 /usr/local/sbin/cbt-full-backup
sudo /usr/local/sbin/cbt-full-backup
```

Lưu ý:

- Dùng `copy` vào thư mục timestamp, không dùng `sync` vào một thư mục duy nhất; `sync` có thể lan truyền thao tác xóa nhầm sang backup.
- `pg_dump -Fc` tạo archive custom có thể kiểm tra và restore bằng `pg_restore`.
- Script chỉ xóa thư mục tạm do chính `mktemp` tạo sau khi upload/verify xong.
- Chính sách xóa bản cũ nên đặt ở lifecycle của kho backup, theo lịch retention tại mục 2. Không tự động xóa trước khi có ít nhất một lần restore thử thành công.

## 7. Tự động hóa và cảnh báo

Tạo systemd service `/etc/systemd/system/cbt-full-backup.service`:

```ini
[Unit]
Description=CBT Platform full offsite backup
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/cbt-full-backup
User=root
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
```

Tạo timer `/etc/systemd/system/cbt-full-backup.timer`:

```ini
[Unit]
Description=Run CBT Platform backup every 6 hours

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
sudo systemctl enable --now cbt-full-backup.timer
sudo systemctl list-timers cbt-full-backup.timer
```

Xem kết quả lần chạy gần nhất:

```bash
sudo systemctl status cbt-full-backup.service
sudo journalctl -u cbt-full-backup.service -n 200 --no-pager
```

Phải cấu hình cảnh báo ra email/Telegram/Sentry hoặc hệ thống giám sát độc lập nếu:

- job không chạy trong 7 giờ;
- `pg_dump`, tải Supabase, checksum hoặc `rclone check` thất bại;
- dung lượng backup thay đổi bất thường;
- số lượng `questions` hoặc `passage_bundles` giảm đột ngột.

Một job không có cảnh báo chưa được coi là hệ thống backup hoàn chỉnh.

## 8. Kiểm tra nhanh backup

Mỗi ngày kiểm tra tự động:

- file `postgres.dump` khác rỗng;
- `pg_restore --list` đọc được archive;
- checksum local và remote trùng;
- có `git-commit.txt`, `created-at.txt`, `row-counts.json`;
- có danh sách object ở cả `images` và `contributions`;
- snapshot mới xuất hiện đúng lịch ở kho ngoài.

Mỗi tháng phải restore thật vào database tạm. Chỉ kiểm tra file tồn tại là chưa đủ để chứng minh backup dùng được.

## 9. Restore thử PostgreSQL hằng tháng

Không restore thử đè lên production. Dùng PostgreSQL 16 sạch trên máy staging:

```bash
docker run --name cbt-restore-test \
  -e POSTGRES_PASSWORD=temporary_restore_password \
  -e POSTGRES_DB=cbt_restore \
  -d postgres:16-alpine
```

Chờ container healthy rồi restore:

```bash
docker exec -i cbt-restore-test \
  pg_restore \
  --username postgres \
  --dbname cbt_restore \
  --no-owner \
  --no-acl \
  --exit-on-error \
  < postgres.dump
```

Kiểm tra số lượng dữ liệu:

```bash
docker exec cbt-restore-test \
  psql \
  --username postgres \
  --dbname cbt_restore \
  --command 'SELECT count(*) AS questions FROM questions;'
```

Sau khi đối chiếu `row-counts.json`, xóa riêng container test:

```bash
docker rm -f cbt-restore-test
```

Ghi lại ngày test, snapshot, người thực hiện, kết quả và thời gian restore vào issue/log vận hành.

## 10. Quy trình khôi phục khi mất hoàn toàn server

### Bước 1 — Khóa và đánh giá sự cố

Nếu có khả năng bị chiếm quyền:

1. đổi mật khẩu nhà cung cấp, GitHub, domain và Supabase;
2. thu hồi Supabase service-role/S3 keys cũ;
3. thay JWT secrets, Redis password, PostgreSQL password và mail credential;
4. không đưa server cũ trở lại mạng trước khi điều tra.

### Bước 2 — Dựng hạ tầng sạch

1. Tạo Ubuntu server mới.
2. Clone repository từ GitHub.
3. Checkout đúng commit trong `git-commit.txt` của snapshot.
4. Cài Docker và Nginx theo `docs/DEPLOY_UBUNTU_NGINX.md`.
5. Khôi phục `deploy/.env.production` từ password manager, sử dụng secrets mới nếu đây là sự cố bảo mật.
6. Chỉ bật PostgreSQL trước; chưa bật API/Web.

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d postgres redis
```

### Bước 3 — Tải và xác minh snapshot

```bash
rclone copy \
  --config /etc/cbt-backup/rclone.conf \
  "backup-crypt:cbt-platform/snapshots/SNAPSHOT_ID/" \
  /var/restore/cbt-platform

cd /var/restore/cbt-platform
sha256sum --check SHA256SUMS
```

Không tiếp tục nếu checksum lỗi.

### Bước 4 — Restore PostgreSQL

Chỉ thực hiện trên database mới/rỗng hoặc sau khi đã xác nhận đúng mục tiêu:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  exec -T postgres sh -c \
  'pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < /var/restore/cbt-platform/postgres.dump
```

Sau đó áp dụng migration mới hơn snapshot, nếu có:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  run --rm migrate
```

### Bước 5 — Restore Supabase Storage

Nếu Supabase project cũ vẫn còn, chỉ upload các object bị thiếu. Nếu phải tạo project mới:

1. tạo bucket `images` ở chế độ public;
2. tạo bucket `contributions` ở chế độ private;
3. cấu hình S3 remote mới, ví dụ `supabase-cbt-new`;
4. upload lại object bằng S3/rclone.

```bash
rclone copy \
  --config /etc/cbt-backup/rclone.conf \
  /var/restore/cbt-platform/storage/images \
  "supabase-cbt-new:images"

rclone copy \
  --config /etc/cbt-backup/rclone.conf \
  /var/restore/cbt-platform/storage/contributions \
  "supabase-cbt-new:contributions"
```

Contribution files dùng URI `supabase://contributions/...`, nên giữ đúng tên bucket sẽ không cần sửa dữ liệu. Ảnh câu hỏi hiện chứa public URL của Supabase project; nếu project ref thay đổi, cần đổi URL cũ sang URL mới trong hai cột JSONB:

```sql
BEGIN;

UPDATE questions
SET content_json = replace(
  content_json::text,
  'https://OLD_PROJECT_REF.supabase.co/storage/v1/object/public/images/',
  'https://NEW_PROJECT_REF.supabase.co/storage/v1/object/public/images/'
)::jsonb
WHERE content_json::text LIKE '%OLD_PROJECT_REF%';

UPDATE passage_bundles
SET content_json = replace(
  content_json::text,
  'https://OLD_PROJECT_REF.supabase.co/storage/v1/object/public/images/',
  'https://NEW_PROJECT_REF.supabase.co/storage/v1/object/public/images/'
)::jsonb
WHERE content_json::text LIKE '%OLD_PROJECT_REF%';

COMMIT;
```

Chạy bản `SELECT count(*)` với cùng điều kiện trước khi `UPDATE`, và tạo thêm một database dump trước thao tác thay URL.

### Bước 6 — Bật ứng dụng và nghiệm thu

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build
```

Checklist nghiệm thu:

- health endpoint báo PostgreSQL và Redis healthy;
- đăng nhập admin được;
- số lượng question/bundle/tag/exam/user khớp `row-counts.json`;
- mở thử câu Toán, bundle Đọc hiểu và Khoa học;
- công thức KaTeX và ảnh hiển thị;
- preview một đề thi;
- tạo một lượt thi test, đồng bộ đáp án, nộp và xem kết quả;
- tải được một file contribution private;
- job backup mới chạy thành công từ server mới.

Redis không phải nguồn lưu trữ chuẩn của ngân hàng câu hỏi. Sau thảm họa, các lượt đang làm tại thời điểm mất server có thể không khôi phục đầy đủ trạng thái chưa flush; cần thông báo và cho thí sinh bắt đầu lượt mới thay vì âm thầm coi bài cũ là hoàn chỉnh.

## 11. Backup source code và tài khoản

- Repository GitHub nên là private, bật MFA và branch protection.
- Sau mỗi release, push commit/tag đã deploy.
- Hằng tháng tạo `git clone --mirror` vào kho backup mã hóa.
- Ít nhất hai người/tài khoản tin cậy phải có quyền phục hồi repository hoặc recovery procedure.
- Không commit `.env`, S3 keys, dump, file người dùng hoặc rclone config.

## 12. Checklist triển khai ban đầu

- [ ] Chọn kho backup độc lập và bật MFA/versioning/immutability.
- [ ] Tạo `backup-crypt` và lưu encryption key ở hai nơi an toàn.
- [ ] Bật Supabase S3, tạo `supabase-cbt` và thử list hai bucket.
- [ ] Chạy full backup đầu tiên.
- [ ] Tải snapshot về máy khác và xác minh checksum.
- [ ] Restore PostgreSQL vào container test.
- [ ] Restore thử một bản sao Storage vào bucket test.
- [ ] Bật systemd timer mỗi 6 giờ.
- [ ] Bật cảnh báo khi job lỗi hoặc trễ.
- [ ] Cấu hình retention 7 ngày/14 ngày/8 tuần/12 tháng.
- [ ] Lên lịch restore test hằng tháng và full DR drill hằng quý.
- [ ] Ghi tên/người chịu trách nhiệm xử lý khi cảnh báo backup xảy ra.

## 13. Tài liệu chính thức tham khảo

- PostgreSQL `pg_dump`: https://www.postgresql.org/docs/16/app-pgdump.html
- PostgreSQL `pg_restore`: https://www.postgresql.org/docs/current/app-pgrestore.html
- Supabase tải object: https://supabase.com/docs/guides/storage/management/download-objects
- Supabase S3 compatibility: https://supabase.com/docs/guides/storage/s3/compatibility
- Supabase S3 authentication: https://supabase.com/docs/guides/storage/s3/authentication
