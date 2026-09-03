# Deploy CBT Platform on Ubuntu with Nginx

This runbook deploys the application as four Docker Compose services:

- `web`: production React build behind an internal Nginx container
- `api`: NestJS API bound to `127.0.0.1:3000`
- `postgres`: private Docker network only
- `redis`: password-protected and private Docker network only

The Ubuntu host's existing Nginx is the public entry point and terminates TLS.

## 1. Point the domain

At the DNS management page for `demoserver.io.vn`, create:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<SERVER_PUBLIC_IPV4>` | 300 |

If the provider asks for a full hostname instead of `@`, enter
`demoserver.io.vn`.
Do not add an AAAA record unless IPv6 is configured on the server and firewall.

Verify from your workstation:

```bash
dig +short demoserver.io.vn A
```

The returned address must equal the Ubuntu server's public IPv4 before requesting TLS.

## 2. Prepare Ubuntu

Keep SSH open before enabling the firewall:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git curl
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Install Docker Engine and the Docker Compose plugin from Docker's official Ubuntu
repository:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Verify and enable it at boot:

```bash
docker --version
docker compose version
sudo systemctl enable --now docker
```

The remaining commands assume your SSH user can run Docker. Either keep `sudo`
before every `docker` command, or add the user to Docker's group and reconnect:

```bash
sudo usermod -aG docker "$USER"
```

## 3. Pull the application

```bash
sudo mkdir -p /opt/cbt-platform
sudo chown "$USER":"$USER" /opt/cbt-platform
git clone https://github.com/tuankiet-4200/cbt-platform.git /opt/cbt-platform
cd /opt/cbt-platform
git switch develop
```

For a real release, use a tagged commit or a dedicated production branch instead
of deploying a moving branch.

## 4. Configure production secrets

```bash
cd /opt/cbt-platform
cp deploy/.env.production.example deploy/.env.production
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 64
openssl rand -hex 64
nano deploy/.env.production
chmod 600 deploy/.env.production
```

Use the generated values for PostgreSQL, Redis, JWT access, and JWT refresh.
Use hexadecimal secrets so the PostgreSQL/Redis URLs do not require URL encoding.

Required checks:

- `FRONTEND_URL=https://demoserver.io.vn`
- `DATABASE_URL` uses host `postgres`, not `localhost`
- `REDIS_URL` uses host `redis`, not `localhost`
- The password inside `DATABASE_URL` exactly matches `POSTGRES_PASSWORD`
- The password inside `REDIS_URL` exactly matches `REDIS_PASSWORD`
- Real `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for API startup
- Never commit `deploy/.env.production`

## 5. Build, migrate, and start

```bash
cd /opt/cbt-platform
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build
```

The `migrate` service runs `prisma migrate deploy` before the API starts.

Verify containers and internal endpoints:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  ps -a

curl http://127.0.0.1:3000/api/v1/health
curl -I http://127.0.0.1:8080/healthz
```

The API health response must report both database and Redis as `healthy`.

## 6. Configure host Nginx

```bash
sudo cp deploy/nginx-demoserver.io.vn.conf \
  /etc/nginx/sites-available/demoserver.io.vn
sudo ln -sfn /etc/nginx/sites-available/demoserver.io.vn \
  /etc/nginx/sites-enabled/demoserver.io.vn
sudo nginx -t
sudo systemctl reload nginx
```

Before DNS propagation completes, test locally on the server:

```bash
curl -I -H 'Host: demoserver.io.vn' http://127.0.0.1
```

## 7. Enable HTTPS

Only run this after `dig +short demoserver.io.vn A` returns the server IP:

```bash
sudo certbot --nginx -d demoserver.io.vn
sudo certbot renew --dry-run
```

Then verify:

```bash
curl https://demoserver.io.vn/api/v1/health
curl -I https://demoserver.io.vn
```

## 8. Create production users

Local database users are not copied into a fresh production database. After HTTPS
works, open `https://demoserver.io.vn/register` and create the required customer
accounts through the normal registration flow. This preserves password hashing,
default-exam access, validation, and audit behavior without placing passwords in
Git or shell history.

If production must contain the complete local question/exam dataset, perform an
explicit PostgreSQL backup/restore instead of running the development seed blindly.

## 9. Deploy updates

```bash
cd /opt/cbt-platform
git fetch origin
git pull --ff-only
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build
docker image prune -f
```

## 10. Operations

View logs:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  logs -f --tail=200 api web
```

Create a database backup:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "cbt-platform-$(date +%F-%H%M).sql"
```

Do not expose ports `3000`, `5432`, `6379`, or `8080` through UFW or the cloud
firewall. Public traffic should enter only through Nginx on ports 80 and 443.
