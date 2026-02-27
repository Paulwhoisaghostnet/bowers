# Bowers Project — Memory / Index

**Purpose:** FA2 NFT collections and marketplace on Tezos (Ghostnet). "Deploy your own NFT collection contracts on Tezos with no code. Choose a style, configure, and deploy."

---

## Current state

- **Contracts (SmartPy v2, in `attached_assets/`):**
  - **All-in-one (mint + marketplace):** All include `contract_blocklist` (admin-only `block_address` / `unblock_address`). Blocklist enforced in `transfer`, `buy`, `make_offer`, `accept_offer`, and `mint_editions` (to_).
  1. **BowersAllowlistFA2.py** — Open edition + allowlist phased minting + full marketplace (listings, offers, buy, per-owner blacklist, contract blocklist, withdraw).
  2. **BowersOpenEditionFA2_v5_fa2complete_1771143451660.py** — Open edition FA2 + marketplace + contract blocklist.
  3. **BowersUnifiedFA2.py** — Multi-mint (admin / OE / bonding curve per-token), allowlist, full marketplace + contract blocklist.
  4. **BowersBondingCurveFA2.py** — Bonding-curve mint + marketplace + contract blocklist.
  5. **BowersFA2_partial_fill_offer_1771139881452.py** — Marketplace-only ("BowersMarketplace") + contract blocklist.
  - **Mint-only (no marketplace; sell on objkt/teia):**
  6. **BowersMintOpenEdition.py** — Open edition mint, contract blocklist, withdraw. Style: `bowers-mint-oe`.
  7. **BowersMintAllowlist.py** — Open edition + allowlist phase, contract blocklist, withdraw. Style: `bowers-mint-allowlist`.
  8. **BowersMintBondingCurve.py** — Bonding-curve mint, contract blocklist, withdraw. Style: `bowers-mint-bonding-curve`.

- **Compilation:** Scripts in `scripts/`: `compile_marketplace.py`, `compile_open_edition.py`, `compile_allowlist.py`, `compile_bonding_curve.py`, `compile_unified.py`, `compile_mint_open_edition.py`, `compile_mint_allowlist.py`, `compile_mint_bonding_curve.py`. Run `bash scripts/compile-contracts.sh` (requires SmartPy with `@sp.module` support). Output: `build/smartpy/<ScenarioName>/`; JSON copied to `client/src/lib/tezos/michelson/`; `generate-michelson-ts.cjs` writes `.ts` modules.

- **Style resolution:** `shared/contract-styles.ts` — Presets include mint-only styles. `resolveStyleFromModules()` for custom: 2+ mint models → `bowers-unified`; else bonding-curve → `bowers-bonding-curve`; allowlist+open-edition → `bowers-allowlist`; open-edition only → `bowers-open-edition`; else → `bowers-marketplace`.

---

## Issues reported (user)

- UI not wired to all contract types; app not deployment-ready.
- Need Ghostnet default with Mainnet switching.
- Need deployment instructions (not GitHub+Netlify).

---

## Actions taken

- **Supervisor audit (full code review):** See changelog entry below for all fixes.

---

## How to use Ollama for audits (instruction for Cursor agent)

- **One terminal, one chat:** Run `ollama run qwen2.5-coder:7b-instruct-q4_K_M` **once** at the start. That terminal becomes the chat session with qwen.
- **Feeding content:** After that, do **not** call `ollama run` again in that terminal. Feed text by pasting whole files or using `echo` / redirecting a file into the process (e.g. prepare a prompt file, then in the same session you can pipe: `cat prompt.txt | ollama run ...` is one way—but that starts a *new* run). So for a **single** audit: run `ollama run qwen2.5-coder:7b-instruct-q4_K_M < scripts/ollama_audit_prompt.txt` (stdin from file = first user message; qwen replies; process exits when stdin closes). For a **multi-turn** chat you keep the process running and type/paste in that terminal.
- **Model:** Always use `qwen2.5-coder:7b-instruct-q4_K_M`.

---

## Ollama audit log

- **BowersAllowlistFA2.py** — Ran `ollama run qwen2.5-coder:7b-instruct-q4_K_M < scripts/ollama_audit_prompt.txt` (prompt = audit instructions + full contract). Qwen’s response (summary):
  - **Token creation:** `create_token` allows admin to create tokens (metadata, creator, mint price, max supply, allowlist end, royalty, min offer).
  - **Allowlisting:** `set_allowlist` lets admin set allowlist; listed addresses can mint at lower/no cost before allowlist end.
  - **Minting:** `mint_editions` checks allowlist when applicable and mints to the user.
  - **Marketplace:** Listing, buy, offers (make/accept/close), royalties on sale, withdraw.
  - **Views:** Balances, listings, offers, claimable, blacklist.
  - **Security:** Blacklisting, admin-only and allowlist checks. No COMPILE/BEHAVIOR/ISSUES/RECOMMENDATIONS section in the reply—it was a high-level breakdown. For stricter audit format, prompt can ask explicitly for COMPILE/BEHAVIOR/ISSUES/RECOMMENDATIONS.

---

## Contract rules (Tezos / SmartPy / FA2)

*From official Tezos docs and Trilitech-style patterns. Use these when writing or changing Bowers contracts.*

1. **FA2 (TZIP-12):**
   - Ledger: `(owner, token_id) -> balance`. Big_map for gas.
   - Operators: `(owner, operator, token_id) -> unit`. Only `owner` can add/remove.
   - `transfer`: batch of `{ from_, txs: [{ to_, token_id, amount }] }`. Check operator if `from_ != sp.sender`. Deduct from `from_`, add to `to_`; remove ledger key if balance 0.
   - `balance_of`: requests + callback contract; respond with list of `(request, balance)`; callback receives reversed list per spec.
   - Entrypoints that do not accept XTZ: `assert sp.amount == sp.mutez(0), "NO_TEZ"`.

2. **Marketplace (Trilitech-style):**
   - Listings/sells: key by seller + token_id (e.g. `(owner, token_id)`). Check seller balance before listing.
   - Buy: verify buyer payment >= price×qty; transfer XTZ to seller (or to contract then withdraw); transfer tokens seller→buyer; update/remove listing when qty exhausted.
   - Offers: store offer (buyer, token_id, unit_price, remaining_qty, expiry). On accept: seller sends tokens to buyer; buyer’s locked XTZ goes to seller (and royalty). Handle partial fill if design allows.
   - Contract as operator: marketplace often needs contract to be operator for seller to transfer on sale; add/remove as needed around listing/buy.

3. **SmartPy v2:**
   - Use `@sp.module` and `def main():` with types and class inside.
   - Types: `sp.record(...)`, `sp.variant(...)`, `sp.list[...]`, `sp.big_map[...]`. Use `sp.cast` for params and storage init.
   - Entrypoints: `@sp.entrypoint`; no `self` in param. Views: `@sp.onchain_view`.
   - Big_map key: use `sp.record(...)` for compound keys; check `key in self.data.xxx` before read/del; when balance goes to 0, remove ledger key and any listing for that key.

4. **Bowers-specific:**
   - `token_config` per token_id: creator, mint_price, mint_end, mint_paused, max_supply, minted, allowlist_end (if allowlist), royalty_recipient, royalty_bps, min_offer_per_unit_mutez (marketplace contracts).
   - Royalties: `royalty_bps <= 10_000`; use `sp.split_tokens(amount, royalty_bps, 10_000)` for royalty share.
   - Allowlist: key `(token_id, address)`; entry `max_qty`, `minted`, `price_override`. During allowlist phase enforce cap and optional price override.
   - Claimable: accumulate in `claimable[address]`; `withdraw` sends and zeros.
   - **Contract blocklist:** `contract_blocklist: sp.big_map[sp.address, sp.unit]`. Admin-only `block_address(addr)` and `unblock_address(addr)`. Enforce in: `transfer` (assert neither `from_` nor `to_` in blocklist), `buy` (assert `sp.sender` not blocked), `make_offer` (assert `sp.sender` not blocked), `accept_offer` (assert offer buyer not blocked), `mint_editions` (assert `to_` not blocked). This makes objkt/teia purchases fail at the token contract when the buyer is blocked.

5. **Safety:**
   - All params: `sp.cast` to expected type.
   - Division: use `sp.split_tokens` for mutez; avoid division by zero.
   - Offer expiry: check `sp.now <= o.expiry` for accept; allow close_offer after expiry or by buyer.

---

## Changelog (memory updates)

- Initial memory created; project index, contract list, and contract rules from Tezos/Trilitech patterns added. First Ollama audit: BowersAllowlistFA2.
- **Restructure (contract blocklist + mint-only):** (1) All five existing contracts: added `contract_blocklist` storage; admin entrypoints `block_address`, `unblock_address`; enforcement in `transfer` (from_/to_), `buy`, `make_offer`, `accept_offer`, `mint_editions` (to_). (2) Three new mint-only contracts: BowersMintOpenEdition, BowersMintAllowlist, BowersMintBondingCurve (no marketplace; claimable + withdraw for mint payments). (3) Compile scripts and `compile-contracts.sh` updated; frontend: new styles in contract-styles.ts, originate.ts storage for mint-only and contract_blocklist, create-collection wizard grouped (Mint only / Mint + marketplace / Marketplace only / Custom) and blocklist info in configure step. (4) Contract rules in memory updated with blocklist behaviour.
- **Supervisor audit + UI refinement:** Fixed critical bugs:
  1. `types.ts` — `BOWERS_STYLE_IDS` missing unified + 3 mint-only IDs; `styleIcons` missing icons. Added `isMintOnlyStyle()`, `hasCreateTokenFlow()` helpers.
  2. `originate.ts` — Contract address extraction used `opHash.replace(/^o/, "KT1")` (wrong). Replaced with proper `op.contractAddress` + RPC block scan fallback.
  3. `mint.ts` — Called `mint` entrypoint (marketplace-only) for all styles. Refactored to: (a) `create_token` + `mint_editions` for OE/allowlist/bonding-curve styles, (b) `mint` for marketplace-only. Now accepts `styleId` param.
  4. Dashboard/collection/mint-token pages — `styleIcons` only mapped 2 styles; now imports shared `styleIcons`. Explorer links hardcoded to ghostnet; now use `explorerBaseUrl` from network context.
  5. Server routes — `isOpenEdition` only matched `bowers-open-edition`; expanded to include all styles with `token_config`.
  6. Created `blocklist.ts` — Client helpers: `blockAddress`, `unblockAddress`, `setAdmin`, `setMintPaused`, `setMintPrice`.
  7. Created `network-context.tsx` — `NetworkProvider` with `ghostnet`/`mainnet` toggle; calls `setActiveNetwork()` on wallet module to reinitialize TezosToolkit + BeaconWallet for correct network.
  8. `wallet.ts` — Added `setActiveNetwork()` to reset tezos/wallet singletons on network change; `getWallet()` now uses `NetworkType.MAINNET` or `GHOSTNET` based on `currentNetwork`.
  9. `server/index.ts` — CSP `connectSrc` expanded with `mainnet.ecadinfra.com`, `tzkt.io`, `api.tzkt.io`, `api.mainnet.tzkt.io`.
  10. Created `manage-contract.tsx` — Tabbed admin page: Blocklist (block/unblock), Mint Config (pause/resume, set price), Admin (transfer role), Withdraw. Wired to `/manage/:id` route.
  11. Added `DEPLOY.md` — Deployment instructions for Cloudflare, Render, Fly.io (all with free tiers).
- **octez.connect transition:** Beacon SDK is sunsetting; Trillitech's octez.connect (`@tezos-x/octez.connect-sdk`) is the approved successor. Implemented dual-provider architecture:
  1. `loaders.ts` — Added `loadOctezConnect()` lazy loader for `@tezos-x/octez.connect-sdk`.
  2. `wallet.ts` — Rewritten with `WalletAdapter` interface. `OctezConnectAdapter` (primary) uses `getDAppClientInstance` from octez.connect SDK. `BeaconLegacyAdapter` (fallback) uses `@taquito/beacon-wallet` + `@airgap/beacon-dapp`. Auto-detect: tries octez.connect first, falls back to Beacon if unavailable. `getActiveProviderName()` exported for UI display.
  3. `wallet-context.tsx` — `providerName` field added to context (`"octez.connect"` or `"beacon"`). Sidebar shows which provider is active.
  4. Both providers are lazy-loaded. Both integrate with Taquito via `setWalletProvider()`. When octez.connect is active, it creates a `BeaconWallet` under the hood for Taquito compatibility while using `DAppClient` for permission/account management.
  5. Package: `@tezos-x/octez.connect-sdk@1.0.0` added to dependencies.
