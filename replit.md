# Bowers - Tezos NFT Studio

## Overview
Bowers is a no-code Tezos NFT collection contract deployment dApp. Artists can create, configure, and deploy FA2-compliant NFT contracts on the Tezos blockchain without writing any code.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Routing**: wouter (client-side)
- **Tezos**: @taquito/taquito + @airgap/beacon-sdk (lazy-loaded to avoid polyfill issues)
- **State**: @tanstack/react-query

## Key Files

### Shared (barrel: `shared/schema.ts`)
- `shared/schema.ts` - Barrel re-export of all shared modules
- `shared/db.ts` - Drizzle table definition, insert schema, types (Contract, InsertContract)
- `shared/contract-styles.ts` - CONTRACT_STYLES array, ContractStyle type/schema
- `shared/validation.ts` - MintRequest Zod schema

### Server
- `server/routes.ts` - API routes for contracts CRUD, minting, config download
- `server/storage.ts` - Database storage layer (IStorage interface)
- `server/db.ts` - PostgreSQL connection
- `server/seed.ts` - Seed data for demo contracts

### Client - Tezos Integration (barrel: `client/src/lib/tezos/index.ts`)
- `client/src/lib/tezos/loaders.ts` - Lazy-load Taquito, Beacon, michel-codec, tzip12/16, utils
- `client/src/lib/tezos/wallet.ts` - getTezos, getWallet, connectWallet, disconnectWallet, getActiveAccount, shortenAddress
- `client/src/lib/tezos/originate.ts` - buildFA2Storage, originateContract (contract deployment)
- `client/src/lib/tezos/mint.ts` - mintToken (token minting via wallet)
- `client/src/lib/tezos/metadata.ts` - getTokenMetadata, getContractMetadata, parseMichelson

### Client - FA2 Michelson (barrel: `client/src/lib/fa2/index.ts`)
- `client/src/lib/fa2/types.ts` - FA2_TYPES (tokenMetadataValue, transferParam, updateOperatorsParam, balanceOfParam)
- `client/src/lib/fa2/parameter.ts` - buildMintParam, buildParameter (Michelson parameter section)
- `client/src/lib/fa2/storage.ts` - buildStorageType (Michelson storage section)
- `client/src/lib/fa2/code.ts` - buildCode, buildIfLeftTree (Michelson code section)
- `client/src/lib/fa2/validation.ts` - getFA2Michelson, getFA2MichelineString, validateMichelson

### Client - Pages
- `client/src/App.tsx` - Root layout with sidebar
- `client/src/lib/wallet-context.tsx` - React wallet state context
- `client/src/pages/dashboard.tsx` - My Contracts view
- `client/src/pages/create-collection/index.tsx` - Wizard orchestration (state, navigation, deploy)
- `client/src/pages/create-collection/types.ts` - WizardState, STEPS, styleIcons, defaultState
- `client/src/pages/create-collection/step-indicator.tsx` - Step progress bar component
- `client/src/pages/create-collection/style-card.tsx` - Contract style selection card
- `client/src/pages/create-collection/step-select-style.tsx` - Step 1: Choose contract style
- `client/src/pages/create-collection/step-configure.tsx` - Step 2: Configure collection details
- `client/src/pages/create-collection/step-review.tsx` - Step 3: Review summary
- `client/src/pages/create-collection/step-deploy.tsx` - Step 4: Deploy with wallet
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
- All barrel files (schema.ts, tezos/index.ts, fa2/index.ts, create-collection/index.ts) maintain backward-compatible imports

## Recent Changes
- Initial MVP build (Feb 2026): Full wizard flow, dashboard, mint page, config download
- Modularization (Feb 2026): Split monolithic files into focused modules with barrel exports for better AI agent discoverability
