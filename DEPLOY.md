# Bowers Deployment Guide

Three routes to deploy Bowers to a live web state, each with free tiers suitable for testing.

## Prerequisites (all routes)

1. **Build the production bundle:**
   ```bash
   npm install
   npm run build
   ```
   This produces `dist/index.cjs` (server) and `dist/public/` (client assets).

2. **Database:** You need a PostgreSQL instance. Options:
   - [Neon](https://neon.tech) — free tier, serverless Postgres, zero config
   - [Supabase](https://supabase.com) — free tier with Postgres
   - [Railway](https://railway.app) — free starter plan with Postgres add-on

3. **Environment variables** (set these in your deployment platform):
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/bowers
   SESSION_SECRET=<random-64+-char-string>
   NODE_ENV=production
   PORT=3000
   ALLOWED_ORIGINS=https://yourdomain.com
   PINATA_JWT=<your-pinata-jwt-for-ipfs>
   ```

4. **IPFS:** Get a free Pinata JWT at https://app.pinata.cloud (free tier: 1GB storage, 100 pins).

---

## Route 1: Cloudflare Pages + Workers (Recommended)

Cloudflare offers a generous free tier with global edge deployment, SSL, and custom domains.

### Steps

1. **Install Wrangler:**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Create a `wrangler.toml`** in the project root:
   ```toml
   name = "bowers"
   compatibility_date = "2024-01-01"
   main = "dist/index.cjs"

   [vars]
   NODE_ENV = "production"

   [site]
   bucket = "dist/public"
   ```

3. **Deploy:**
   ```bash
   # Set secrets (one-time)
   wrangler secret put DATABASE_URL
   wrangler secret put SESSION_SECRET
   wrangler secret put PINATA_JWT
   wrangler secret put ALLOWED_ORIGINS

   # Deploy
   wrangler deploy
   ```

4. **Custom domain:** In the Cloudflare dashboard, go to Workers & Pages > your project > Settings > Domains, and add your domain.

### Free tier includes
- 100,000 requests/day
- Global edge network
- Free SSL
- Custom domains

### Alternative: Cloudflare Pages (static + Functions)
If you prefer to separate the frontend from the backend, deploy the `dist/public/` folder as a Cloudflare Pages site and run the server separately on another platform.

---

## Route 2: Render

Render provides a straightforward free tier for web services with automatic deploys and managed PostgreSQL.

### Steps

1. **Create a Render account** at https://render.com

2. **Create a PostgreSQL database:**
   - Dashboard > New > PostgreSQL
   - Choose the free tier
   - Copy the Internal Database URL

3. **Create a Web Service:**
   - Dashboard > New > Web Service
   - Connect your repo or use "Deploy from existing image"
   - Settings:
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `npm start`
     - **Environment:** Node
     - **Instance Type:** Free

4. **Set environment variables** in the Render dashboard:
   ```
   DATABASE_URL=<internal-db-url-from-step-2>
   SESSION_SECRET=<random-string>
   NODE_ENV=production
   PINATA_JWT=<your-jwt>
   ALLOWED_ORIGINS=https://your-service.onrender.com
   ```

5. **Deploy:** Push to your connected repo or trigger a manual deploy.

### Free tier includes
- 750 hours/month of web service runtime
- Free managed PostgreSQL (90-day retention on free tier)
- Automatic SSL
- Custom domains
- Auto-deploy from Git

---

## Route 3: Fly.io

Fly.io deploys Docker containers to edge locations worldwide. Their free tier includes enough resources for a production app.

### Steps

1. **Install flyctl:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Create a `Dockerfile`** in the project root:
   ```dockerfile
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM node:20-alpine
   WORKDIR /app
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/package.json ./
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

3. **Launch the app:**
   ```bash
   fly launch --name bowers --region iad
   ```
   When prompted, say yes to creating a Postgres database (free tier).

4. **Set secrets:**
   ```bash
   fly secrets set SESSION_SECRET="<random-string>"
   fly secrets set PINATA_JWT="<your-jwt>"
   fly secrets set ALLOWED_ORIGINS="https://bowers.fly.dev"
   ```
   Note: `DATABASE_URL` is automatically set when you attach a Fly Postgres database.

5. **Deploy:**
   ```bash
   fly deploy
   ```

6. **Custom domain:**
   ```bash
   fly certs add yourdomain.com
   ```
   Then point your DNS to the provided CNAME.

### Free tier includes
- 3 shared-cpu-1x VMs (256MB RAM each)
- 3GB persistent storage
- Free Postgres (1GB)
- Automatic SSL
- Global edge deployment

---

## Switching to Mainnet

The app ships with Ghostnet (testnet) as the default. To switch to Mainnet:

1. **In the UI:** Click the network badge in the sidebar to toggle between Ghostnet and Mainnet. The wallet, RPC, and explorer links all switch automatically.

2. **CSP headers:** The server already allows both `ghostnet.ecadinfra.com` and `mainnet.ecadinfra.com` in its Content Security Policy.

3. **Wallet reconnection:** When switching networks, users need to reconnect their wallet — the Beacon SDK creates network-specific sessions.

4. **No code changes required** — the network context propagates through the entire stack.

---

## Post-Deployment Checklist

- [ ] Verify the site loads at your deployment URL
- [ ] Test wallet connection (install Temple or Kukai wallet extension)
- [ ] Create a test collection on Ghostnet
- [ ] Verify the contract appears on [ghostnet.tzkt.io](https://ghostnet.tzkt.io)
- [ ] Test minting a token
- [ ] Test the blocklist feature (block/unblock an address)
- [ ] Test withdrawal of claimable balance
- [ ] Verify IPFS uploads work (check Pinata dashboard)
