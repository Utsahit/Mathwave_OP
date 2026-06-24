# Elixir & Oak — Production Deployment Checklist

Run this checklist on the production server after initial deployment.

---

## Pre-Deployment

- [ ] Server provisioned (Ubuntu 22.04, 4 vCPU, 8 GB RAM, 100 GB SSD)
- [ ] Domain DNS records pointed to server IP
- [ ] SSH access configured (key-based, no password)
- [ ] Firewall ports open: 22, 80, 443
- [ ] PostgreSQL 16 installed and running
- [ ] Redis 7 installed and running (with password)

## Deployment

- [ ] `sudo bash /var/www/elixir-oak/backend/deploy/deploy.sh`
- [ ] `.env.production` populated with real secrets
- [ ] `npx prisma migrate deploy` — migrations applied cleanly
- [ ] `npm run build` — TypeScript compiles without errors
- [ ] PM2 started: `pm2 start ecosystem.config.js --env production`
- [ ] PM2 saved: `pm2 save`
- [ ] PM2 startup enabled: `pm2 startup`

## SSL

- [ ] `certbot --nginx -d api.elixirandoak.com -d app.elixirandoak.com`
- [ ] `certbot renew --dry-run` — auto-renewal works
- [ ] HTTPS redirect works (HTTP → HTTPS)
- [ ] HSTS header present

## Verification

- [ ] `curl https://api.elixirandoak.com/api/v1/health` → 200
- [ ] `curl https://api.elixirandoak.com/api/v1/menu/public` → 200 with data
- [ ] `curl https://app.elixirandoak.com/` → 200 (serves index.html)
- [ ] Razorpay webhook reachable (POST from Razorpay dashboard test)

## Post-Deployment

- [ ] Daily backup cron job active
- [ ] Logrotate configured for all logs
- [ ] Sentry test event sent and received
- [ ] Razorpay test payment: success flow
- [ ] Razorpay test payment: failure flow
- [ ] WebSocket connection works (order tracking)
- [ ] Admin can log in and access dashboard
- [ ] Staff can log in and take orders

## Go Live

- [ ] All of the above complete
- [ ] Management sign-off received
- [ ] DNS TTL lowered before cutover
- [ ] Deployment monitored for 1 hour post-launch
