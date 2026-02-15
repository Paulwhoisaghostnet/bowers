# MintCapsule - Tezos NFT Studio

## Overview
MintCapsule is a no-code Tezos NFT collection contract deployment dApp. Artists can create, configure, and deploy FA2-compliant NFT contracts on the Tezos blockchain without writing any code.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Routing**: wouter (client-side)
- **Tezos**: @taquito/taquito + @airgap/beacon-sdk (lazy-loaded to avoid polyfill issues)
- **State**: @tanstack/react-query

## Key Files
- `shared/schema.ts` - Database schema, contract styles, Zod validation
- `server/routes.ts` - API routes for contracts CRUD, minting, config download
- `server/storage.ts` - Database storage layer
- `server/db.ts` - PostgreSQL connection
- `server/seed.ts` - Seed data for demo contracts
- `client/src/App.tsx` - Root layout with sidebar
- `client/src/lib/tezos.ts` - Tezos wallet & contract adapter (lazy imports)
- `client/src/lib/wallet-context.tsx` - React wallet state context
- `client/src/pages/dashboard.tsx` - My Contracts view
- `client/src/pages/create-collection.tsx` - Wizard for deploying new contracts
- `client/src/pages/mint-token.tsx` - Token minting UI

## API Routes
- `GET /api/contracts/:ownerAddress` - List contracts by owner
- `GET /api/contracts/detail/:id` - Get single contract
- `POST /api/contracts` - Create contract record
- `POST /api/contracts/:id/mint` - Record mint (increment token count)
- `GET /api/contracts/:id/config` - Download contract config JSON
- `GET /api/styles` - List available contract styles

## Important Notes
- Beacon SDK and Taquito are lazy-loaded via dynamic import() to avoid "global is not defined" errors in Vite
- index.html includes polyfill script for global/Buffer/process
- 4 contract styles: FA2 Basic, FA2 + Royalties, FA2 Multi-Minter, FA2 Complete
- Default network: Ghostnet (testnet)
- Seed data uses demo wallet address: tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb

## Recent Changes
- Initial MVP build (Feb 2026): Full wizard flow, dashboard, mint page, config download
