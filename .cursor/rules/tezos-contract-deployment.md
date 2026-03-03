# Tezos Contract Deployment — Agent Reference

This document captures the correct architecture for deploying (originating) Tezos
smart contracts from a browser dApp using Taquito, Beacon SDK, and wallet
extensions. It was produced from extensive debugging and source-code tracing of
Taquito v24, Beacon SDK v4.7, and multiple wallet implementations.

## Quick summary

| Layer | Package | Role |
|---|---|---|
| Taquito Wallet API | `@taquito/taquito` | Builds the origination, encodes storage, hands off to wallet |
| Beacon bridge | `@taquito/beacon-wallet` + `@airgap/beacon-dapp` | Sends `requestOperation` to whichever wallet the user chose |
| Wallet extension | Temple (recommended) or Kukai | Simulates, signs, and injects the operation on-chain |

## Network configuration

The app defaults to **Shadownet** (Tezos long-term testnet, replacing Ghostnet which sunsetted March 2026).

| Network | RPC URL | Chain ID | TzKT Explorer | TzKT API | Faucet |
|---|---|---|---|---|---|
| Shadownet | `https://shadownet.tezos.ecadinfra.com` | `NetXsqzbfFenSTS` | `https://shadownet.tzkt.io` | `https://api.shadownet.tzkt.io/v1` | `https://faucet.shadownet.teztnets.com` |
| Mainnet | `https://mainnet.ecadinfra.com` | `NetXdQprcVkpaWU` | `https://tzkt.io` | `https://api.tzkt.io/v1` | N/A |

### Beacon SDK and Shadownet

The Beacon SDK may not have `NetworkType.SHADOWNET` in its enum. Use `NetworkType.CUSTOM`
with `name: "shadownet"` and `rpcUrl` set to the shadownet RPC. The `resolveNetworkType()`
helper in `wallet.ts` handles this automatically.

### Network safety: chain ID verification

Before any origination, `verifyNetwork()` in `originate.ts` fetches the actual chain ID from
the RPC and compares it to the expected chain ID for the app's active network. This prevents
accidental mainnet deployments when the wallet is on the wrong network.

## The canonical origination pattern (Taquito Wallet API)

Source: <https://taquito.io/docs/24.0.0/originate>

```typescript
import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";

const Tezos = new TezosToolkit("https://shadownet.tezos.ecadinfra.com");
const wallet = new BeaconWallet({
  name: "MyDapp",
  network: { type: "custom", name: "shadownet", rpcUrl: "https://shadownet.tezos.ecadinfra.com" },
});
await wallet.requestPermissions();
Tezos.setWalletProvider(wallet);

// code = JSON Michelson array (parameter, storage, code sections)
// storage = plain JS object — Taquito encodes it to Michelson automatically
const op = await Tezos.wallet
  .originate({ code, storage })
  .send();

const contract = await op.contract();       // waits for 1 confirmation
const kt1 = contract.address;               // "KT1…"
```

Key points:

- **Do NOT pass `gasLimit`, `storageLimit`, or `fee`** into `wallet.originate()`.
  The wallet extension handles gas estimation and fee calculation via Beacon's
  `requestOperation`. Passing explicit limits is allowed by Taquito but the
  wallet may ignore or override them.
- **Do NOT use `Tezos.contract.originate()`** for wallet-connected dApps. That
  API calls `requestSignPayload` to ask the wallet to sign raw forged bytes.
  Most wallets (Kukai in particular) reject `requestSignPayload` for
  origination-sized payloads with `UNKNOWN_ERROR`.
- `code` must be a JSON Michelson **array** (not a string). Each element is a
  Micheline object with a `prim` field (`"parameter"`, `"storage"`, `"code"`,
  plus optional `"view"` entries).
- `storage` can be a plain JS object. Use `MichelsonMap` from `@taquito/taquito`
  for `big_map` / `map` fields.

## Two Taquito APIs — when to use which

| | Contract API (`Tezos.contract`) | Wallet API (`Tezos.wallet`) |
|---|---|---|
| Signing | Requires a `Signer` (private key or `BeaconSigner`) | Wallet extension signs via Beacon |
| Gas estimation | Taquito estimates internally via `simulate_operation` | Wallet extension estimates (via its own RPC calls) |
| `.send()` | Not needed — returns the op directly | **Required** — `Tezos.wallet.originate({…}).send()` |
| Use case | CLI scripts, backend, tests | Browser dApps with user wallets |
| Origination | Works only if wallet supports `requestSignPayload` | Works with any TZIP-10 wallet |

**For browser-based dApps: always use `Tezos.wallet`, never `Tezos.contract`.**

## The BeaconSigner adapter (required for `Tezos.estimate`)

Taquito's `estimate.originate()` internally needs `publicKeyHash()` /
`publicKey()` from the signer. BeaconWallet v24 exposes `getPKH()` / `getPK()`
instead. You must bridge the two:

```typescript
class BeaconSigner {
  constructor(private wallet: any) {}
  async publicKeyHash() { return this.wallet.getPKH(); }
  async publicKey()     { return this.wallet.getPK(); }
  async secretKey()     { throw new Error("Not available"); }
  async sign(bytes: string, watermark?: Uint8Array) {
    const prefixSig = await this.wallet.sign(bytes, watermark);
    // … decode prefixSig into { bytes, sig, prefixSig, sbytes }
  }
}
```

Set it via `Tezos.setSignerProvider(new BeaconSigner(wallet))` alongside
`Tezos.setWalletProvider(wallet)`.

Without this, `Tezos.estimate.originate()` throws
`"this.signer.publicKeyHash is not a function"`.

## Singleton BeaconWallet — critical

The Beacon SDK enforces a single DAppClient instance per page. Creating multiple
`BeaconWallet` instances causes:

```
[BEACON] It looks like you created multiple Beacon SDK Client instances.
```

And subsequent `requestPermissions()` / `requestOperation()` calls throw
`UNKNOWN_ERROR`.

**Fix:** use a promise-based lock so concurrent callers share the same
initialisation promise:

```typescript
let adapter: WalletAdapter | null = null;
let adapterPromise: Promise<WalletAdapter> | null = null;

async function ensureAdapter(): Promise<WalletAdapter> {
  if (adapter) return adapter;
  if (!adapterPromise) {
    adapterPromise = createAdapter().then((a) => {
      adapter = a;
      adapterPromise = null;
      return a;
    });
  }
  return adapterPromise;
}
```

React StrictMode calls effects twice, so without this lock two BeaconWallet
instances are created and the SDK breaks.

**Important:** Never null out the adapter in `connectWallet()` or `disconnectWallet()`.
Reuse the same BeaconWallet instance for the entire page lifecycle. Only call
`clearActiveAccount()` and then `requestPermissions()` on the same adapter.

## Wallet-linking and contract visibility

Contracts deployed via Bowers are stored in the database with both `userId` and
`ownerAddress`. The "My Contracts" dashboard queries contracts by:

1. `contracts.userId = currentUser.id` (direct ownership)
2. `contracts.ownerAddress IN (user's linked wallet addresses)` (wallet-linked ownership)

**Auto-link on deploy:** When `POST /api/contracts` creates a new contract, the
server automatically links the deployer's wallet address to the user's account if
it isn't already linked. This ensures deployed contracts always appear on the dashboard.

## Import existing contract

Users can import contracts they deployed outside of Bowers via `POST /api/contracts/import`.

Flow:
1. User provides `{ kt1Address, network }`
2. Server fetches contract storage from TzKT API
3. Server reads the `admin` field from on-chain storage
4. Server compares admin address against the user's linked wallet addresses
5. If match → contract row created; if mismatch → 403 Forbidden

## Wallet compatibility for origination

| Wallet | Transfers | Origination | Notes |
|---|---|---|---|
| **Temple** (browser ext) | Yes | **Yes** | Recommended for contract deployment. Handles gas estimation properly. |
| **Kukai** (web wallet) | Yes | **No** (protocol 024+) | Bug: Kukai's internal `simulate_operation` call uses `gas_limit=0`, which protocol 024 (Tallinn) rejects. Shows "Failed to estimate fee" then returns `ABORTED_ERROR` to the dApp. |

### What happens inside Kukai during origination

1. dApp sends `requestOperation` via Beacon with `kind: "origination"`.
2. Kukai receives it (with or without explicit `gas_limit`).
3. Kukai **always** re-runs its own estimation by calling
   `simulate_operation?version=1` against its RPC endpoints.
4. Kukai's simulation request contains `"gas_limit": "0"`.
5. Protocol 024 rejects: `insufficient_gas_for_manager`.
6. Kukai shows an internal error, user cannot proceed, and closes the dialog.
7. dApp receives `ABORTED_ERROR` (or `UNKNOWN_ERROR` in older flows).

### Approaches that do NOT work around this

| Approach | Why it fails |
|---|---|
| Pass explicit `gasLimit` to `wallet.originate()` | Taquito passes it through, but Kukai ignores it and re-estimates with 0 |
| Call `beaconClient.requestOperation()` directly with `gas_limit` | Same result — Kukai ignores passed limits |
| Use `Tezos.contract.originate()` | Calls `requestSignPayload` — Kukai rejects signing raw origination bytes |
| Use `Tezos.prepare.originate()` + manual Beacon call | Kukai still re-estimates with 0 |

### The only working approach

Use **Temple wallet** for origination. Temple connects through the same
`BeaconWallet` / Beacon SDK — the user simply selects Temple instead of Kukai
in the wallet selection dialog. No code changes required.

Detect the failure and surface a helpful message:

```typescript
} catch (err: any) {
  if (err?.errorType === "ABORTED_ERROR" || err?.errorType === "UNKNOWN_ERROR") {
    throw new Error(
      "Contract deployment failed in wallet. " +
      "Kukai has a known issue with contract origination on this Tezos protocol. " +
      "Please reconnect using Temple wallet to deploy contracts."
    );
  }
  throw err;
}
```

## Contract code format

Contract code is stored as TypeScript modules exporting a `code` array of
Micheline JSON objects. The array must contain (in order):

1. `{ "prim": "storage", "args": [ … ] }` — storage type definition
2. `{ "prim": "parameter", "args": [ … ] }` — parameter type definition
3. `{ "prim": "code", "args": [ [ … ] ] }` — contract logic
4. (optional) `{ "prim": "view", "args": [ … ] }` — on-chain views

These are compiled from SmartPy source using `scripts/compile-contracts.sh`.
The SmartPy CLI (v0.17+ from smartpy.io) is required — not the `pip smartpy`
package, which is an unrelated hydrology library.

## Tezos protocol limits (as of protocol 024 — Tallinn)

| Limit | Value |
|---|---|
| `max_operation_data_length` | 32,768 bytes (~24 KB usable for code after overhead) |
| `hard_gas_limit_per_operation` | 1,040,000 gas units |
| `hard_storage_limit_per_operation` | 60,000 bytes |

Contract binary sizes (measured via `@taquito/michel-codec` `packData`) are
typically 4–15 KB for our contracts, well within the 32 KB limit.

## File layout in this project

```
client/src/lib/tezos/
├── loaders.ts          # Lazy-load Taquito, Beacon, extensions (singletons); RPC_URLS
├── wallet.ts           # WalletAdapter abstraction, BeaconSigner, connect/disconnect, resolveNetworkType
├── originate.ts        # buildFA2Storage, estimateOrigination, originateContract, verifyNetwork
├── michelson/
│   ├── index.ts        # getCode(styleId) — returns compiled Micheline array
│   ├── bowers-marketplace.ts
│   ├── bowers-open-edition.ts
│   ├── bowers-mint-oe.ts
│   └── …               # One file per contract style
├── metadata.ts         # TZIP-12/16 metadata reads (getTokenMetadata, getContractMetadata)
├── blocklist.ts        # Contract entrypoint calls (blockAddress, setAdmin, etc.)
├── mint.ts             # Token minting operations
└── marketplace.ts      # Marketplace interactions (buy, list, delist)

server/
├── tzkt.ts             # TzKT API helpers (network-aware), getContractStorage, getContractInfo
├── routes.ts           # API routes including POST /api/contracts/import
└── storage.ts          # Database operations (getContractsByUserId, getContractByKt1, etc.)

shared/
└── db.ts               # Drizzle schema (contracts, wallets, etc.)
```

## Common errors and their causes

| Error | Cause | Fix |
|---|---|---|
| `No signer has been configured` | `TezosToolkit` was re-created without re-attaching the wallet provider | Call `adapter.setAsTaquitoProvider(tezos)` after creating a new `TezosToolkit` |
| `this.signer.publicKeyHash is not a function` | BeaconWallet v24 lacks `publicKeyHash()` | Use the `BeaconSigner` adapter class |
| `UNKNOWN_ERROR` from Beacon on connect | Multiple BeaconWallet instances | Use the singleton promise lock in `ensureAdapter()` |
| `UNKNOWN_ERROR` from Beacon on originate | Kukai can't sign raw forged bytes (`requestSignPayload`) | Use `Tezos.wallet` API, not `Tezos.contract` |
| `ABORTED_ERROR` on originate | Kukai's gas estimation failed internally (gas_limit=0 bug) | Use Temple wallet instead of Kukai |
| `insufficient_gas_for_manager` | Gas limit set below 100 (or 0) in `simulate_operation` | Kukai bug — use Temple; or if from your own code, ensure `gasLimit >= 100` |
| `storage_limit_too_high` | Storage limit exceeds protocol cap of 60,000 | Cap `storageLimit` at 60,000 |
| `t.contract.originate(…).send is not a function` | Contract API does not use `.send()` | Remove `.send()` — or better, switch to `Tezos.wallet` API |
| `Network mismatch` | Wallet is on mainnet but app is set to shadownet (or vice versa) | `verifyNetwork()` catches this before origination; user must switch wallet network |
| Contracts not showing in My Contracts | Deployer wallet not linked to user account | Fixed by auto-link on deploy; also `getContractsByUserId` now queries by `userId` directly |

## References

- Taquito origination docs: <https://taquito.io/docs/24.0.0/originate>
- Taquito Wallet API docs: <https://taquito.io/docs/24.0.0/wallet_API>
- Taquito transaction limits: <https://taquito.io/docs/24.0.0/transaction_limits>
- Beacon SDK best practices: <https://docs.walletbeacon.io/getting-started/best-practices>
- Tezos dApp best practices: <https://docs.tezos.com/dApps/best-practices>
- Kukai GitHub (known issues): <https://github.com/kukai-wallet/kukai/issues>
- Teztnets Shadownet: <https://teztnets.com/shadownet-about>
- Shadownet faucet: <https://faucet.shadownet.teztnets.com>
