# Bowers - Tezos NFT Studio

## Overview
Bowers is a Tezos NFT marketplace with social features. Artists can deploy FA2-compliant NFT contracts on Tezos without writing code, create a custom "bower" showcase, connect multiple wallets, and build social connections via friends (mutual) and followers (unidirectional). Public users can browse the marketplace and view bowers.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Auth**: Replit Auth (OIDC via passport.js) with session storage in PostgreSQL
- **Routing**: wouter (client-side)
- **Tezos**: @taquito/taquito + @airgap/beacon-sdk (lazy-loaded to avoid polyfill issues)
- **State**: @tanstack/react-query

## Key Files

### Shared
- `shared/schema.ts` - Barrel re-export of all shared modules
- `shared/db.ts` - Drizzle tables: contracts, wallets, bowers, friendships, followers
- `shared/models/auth.ts` - Users + sessions tables (Replit Auth)
- `shared/contract-styles.ts` - CONTRACT_STYLES array, ContractStyle type/schema
- `shared/validation.ts` - MintRequest Zod schema

### Server
- `server/routes.ts` - API routes for all features (contracts, bowers, wallets, friends, followers, users)
- `server/storage.ts` - IStorage interface + DatabaseStorage class with all CRUD operations
- `server/db.ts` - PostgreSQL connection
- `server/replit_integrations/auth/index.ts` - Replit Auth setup (passport, OIDC, session middleware)

### Client - Auth & Context
- `client/src/hooks/use-auth.ts` - useAuth hook (user, isAuthenticated, isLoading, logout)
- `client/src/lib/auth-utils.ts` - isUnauthorizedError utility
- `client/src/lib/wallet-context.tsx` - React wallet state context (Beacon SDK)
- `client/src/lib/theme-provider.tsx` - Dark/light theme provider
- `client/src/components/theme-toggle.tsx` - Theme toggle button

### Client - Tezos Integration (barrel: `client/src/lib/tezos/index.ts`)
- `client/src/lib/tezos/loaders.ts` - Lazy-load Taquito, Beacon, michel-codec, tzip12/16, utils
- `client/src/lib/tezos/wallet.ts` - getTezos, getWallet, connectWallet, disconnectWallet, getActiveAccount, shortenAddress
- `client/src/lib/tezos/originate.ts` - buildFA2Storage, originateContract (contract deployment)
- `client/src/lib/tezos/mint.ts` - mintToken (token minting via wallet)
- `client/src/lib/tezos/metadata.ts` - getTokenMetadata, getContractMetadata, parseMichelson

### Client - FA2 Michelson (barrel: `client/src/lib/fa2/index.ts`)
- `client/src/lib/fa2/types.ts` - FA2_TYPES
- `client/src/lib/fa2/parameter.ts` - buildMintParam, buildParameter
- `client/src/lib/fa2/storage.ts` - buildStorageType
- `client/src/lib/fa2/code.ts` - buildCode, buildIfLeftTree
- `client/src/lib/fa2/validation.ts` - getFA2Michelson, getFA2MichelineString, validateMichelson

### Client - Pages
- `client/src/App.tsx` - Root layout with auth-aware routing (Landing for logged-out, sidebar for auth)
- `client/src/components/app-sidebar.tsx` - Sidebar with Browse (Marketplace) + My Studio (Dashboard, New Collection, My Bower, Wallets, Friends)
- `client/src/pages/landing.tsx` - Public landing page with hero image and feature cards
- `client/src/pages/marketplace.tsx` - Public bower grid (browse all public bowers)
- `client/src/pages/bower-detail.tsx` - Public bower view with follow/friend actions
- `client/src/pages/bower-editor.tsx` - Auth-only: create/edit your one bower
- `client/src/pages/wallets-page.tsx` - Auth-only: link/manage Tezos wallets
- `client/src/pages/friends-page.tsx` - Auth-only: friends/followers with tabs and user search
- `client/src/pages/dashboard.tsx` - Auth-only: my contracts across all linked wallets
- `client/src/pages/create-collection/index.tsx` - Wizard orchestration (state, navigation, deploy)
- `client/src/pages/mint-token.tsx` - Token minting UI

## API Routes

### Public
- `GET /api/styles` - List available contract styles
- `GET /api/bowers` - List all public bowers with user info
- `GET /api/bowers/:id` - Get single bower with user info
- `GET /api/contracts/detail/:id` - Get single contract
- `GET /api/contracts/:id/config` - Download contract config JSON
- `GET /api/contracts/:ownerAddress` - List contracts by owner wallet
- `GET /api/users/:id` - Get public user profile (limited fields)

### Auth Required
- `GET /api/contracts/user/me` - My contracts (across all linked wallets)
- `POST /api/contracts` - Create contract record
- `POST /api/contracts/:id/mint` - Record mint
- `GET /api/wallets` - List my wallets
- `POST /api/wallets` - Link a wallet
- `DELETE /api/wallets/:id` - Remove a wallet
- `PUT /api/wallets/:id/primary` - Set primary wallet
- `GET /api/bowers/me` - Get my bower
- `POST /api/bowers` - Create my bower
- `PUT /api/bowers/:id` - Update my bower
- `GET /api/friends` - List my friends (accepted)
- `GET /api/friends/pending` - List pending incoming requests
- `POST /api/friends/request` - Send friend request
- `PUT /api/friends/:id/accept` - Accept friend request
- `DELETE /api/friends/:id` - Remove friendship
- `GET /api/followers` - My followers
- `GET /api/following` - Who I follow
- `POST /api/follow` - Follow a user
- `DELETE /api/follow/:followedId` - Unfollow a user
- `GET /api/users/search?q=query` - Search users by name/email

## Data Model
- **Users**: Replit Auth managed (id, email, firstName, lastName, profileImageUrl)
- **Wallets**: Many-to-one with User (address, label, isPrimary). One wallet can only belong to one user.
- **Contracts**: Linked to ownerAddress (backward-compat), optionally to userId + walletId
- **Bowers**: One per user (unique userId constraint). Has title, description, themeColor, layout, optional contractId for featured collection
- **Friendships**: Mutual relationship with request/accept flow (pending → accepted)
- **Followers**: Unidirectional follow (follower → followed)

## Important Notes
- Beacon SDK and Taquito are lazy-loaded via dynamic import() to avoid "global is not defined" errors in Vite
- index.html includes polyfill script for global/Buffer/process
- 5 contract styles: FA2 Basic, FA2 + Royalties, FA2 Multi-Minter, FA2 Complete, Bowers Marketplace (recommended)
- BowersFA2 Marketplace contract has marketplace-specific config: royaltyBps (basis points), royaltyRecipient (tez address), minOfferPerUnitMutez
- BowersFA2 entrypoints include: set_price, clear_price, buy, make_offer, accept_offer, reject_offer, cancel_offer, sweep_expired_offer, withdraw, blacklist_address, unblacklist_address, set_max_buy_qty, set_min_offer_percent_of_list
- BowersFA2 origination builds custom storage with marketplace big_maps (prices, offers, claimable, blacklist, etc.)
- Default network: Ghostnet (testnet)
- Auth routes handled by Replit integration: /api/login, /api/logout, /api/callback, /api/auth/user
- Default queryFn in queryClient uses queryKey.join("/") as the fetch URL — queryKeys with path segments work, but query params need custom queryFn
- @assets alias in Vite points to attached_assets/, NOT client/src/assets/
- All barrel files maintain backward-compatible imports

## Recent Changes
- Initial MVP build (Feb 2026): Full wizard flow, dashboard, mint page, config download
- Modularization (Feb 2026): Split monolithic files into focused modules with barrel exports
- Social features (Feb 2026): Added Replit Auth, bowers, wallets, friendships, followers, landing page, marketplace
- BowersFA2 Integration (Feb 2026): Added Bowers Marketplace as recommended contract style with marketplace-specific config (royaltyBps, royaltyRecipient, minOfferPerUnitMutez), Tezos address validation, expanded origination with BowersFA2-specific storage
