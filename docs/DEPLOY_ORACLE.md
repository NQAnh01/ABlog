# Deploy Lumina on Oracle Cloud Free Tier

This deployment runs only Lumina and Caddy on the VM. MongoDB stays on Atlas and media stays on Cloudinary, so application data is not tied to the VM disk.

## 1. Create the VM

- Image: Ubuntu 24.04.
- Shape: an Always Free eligible Ampere A1 shape when available, or an eligible AMD Micro shape.
- Add your SSH public key.
- Reserve a public IPv4 address if Oracle offers one for the instance.

In the subnet Security List or Network Security Group, add ingress rules:

| Source | Protocol | Port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |
| Your IP, or temporarily `0.0.0.0/0` | TCP | `22` |

Do not expose MongoDB port `27017` or application port `8080`.

## 2. Connect and install Docker

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"
exit
```

Reconnect so the Docker group applies:

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

## 3. Clone and configure

```bash
git clone YOUR_GIT_REPOSITORY_URL lumina
cd lumina
cp .env.production.example .env.production
openssl rand -base64 64
nano .env.production
```

Set `JWT_SECRET` to the generated value. Never commit `.env.production`.

For a real domain, create an `A` record pointing to the Oracle public IP and set:

```env
DOMAIN=blog.example.com
CLIENT_ORIGIN=https://blog.example.com
```

For testing without buying a domain, use sslip.io. If the public IP is `129.146.10.20`:

```env
DOMAIN=129-146-10-20.sslip.io
CLIENT_ORIGIN=https://129-146-10-20.sslip.io
```

## 4. Configure Atlas

Create an Atlas database user and allow the Oracle VM public IP in Atlas Network Access. Avoid `0.0.0.0/0` when the VM has a reserved public IP.

Put the Atlas base URI, username, and password in `.env.production`.

## 5. Start Lumina

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs -f app caddy
```

Caddy obtains and renews the TLS certificate automatically. Verify:

```text
https://YOUR_DOMAIN/api/healthz
```

## 6. Point the mobile app to production

Set `mobile/.env` before creating a production build:

```env
EXPO_PUBLIC_API_URL=https://YOUR_DOMAIN/api
```

Restart Expo with a clean cache after changing it:

```bash
cd mobile
npm start -- --clear
```

## Updating

```bash
git pull --ff-only
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

## Backup

Atlas contains application data and Cloudinary contains uploaded media. Back up `.env.production` securely outside the VM. Caddy certificate state is stored in the `caddy_data` Docker volume and can be recreated if lost.
