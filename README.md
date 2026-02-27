# Bowers

FA2 NFT collections and marketplace on Tezos (Ghostnet).

## Database setup

The app uses PostgreSQL. Default dev credentials (in `.env`): **admin** / **password**.

### Option A: Docker (recommended)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if needed.
2. Start the database:
   ```bash
   npm run db:up
   ```
3. Create tables:
   ```bash
   npm run db:push
   ```

### Option B: Local PostgreSQL

1. Install and start PostgreSQL (e.g. `brew install postgresql@16 && brew services start postgresql@16`).
2. Create user and database:
   ```bash
   createuser -P admin   # set password to: password
   createdb -O admin bowers
   ```
3. Ensure `.env` has:
   ```
   DATABASE_URL=postgresql://admin:password@localhost:5432/bowers
   ```
4. Create tables:
   ```bash
   npm run db:push
   ```

## Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up or sign in once the database is running.
