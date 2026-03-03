# Bowers Deployment Guide — Lessons Learned

This document explains the issues encountered while setting up Tezos smart contract
deployment through Bowers, the lessons learned from each, and the correct pathway
for deploying contracts today. It is written for anyone using or contributing to
this project.

---

## Table of Contents

1. [The Correct Deployment Pathway](#the-correct-deployment-pathway)
2. [Wallet Choice: Why Temple, Not Kukai](#wallet-choice-why-temple-not-kukai)
3. [The Kukai Bug — Full Explanation](#the-kukai-bug--full-explanation)
4. [The Accidental Mainnet Deploy](#the-accidental-mainnet-deploy)
5. [Beacon SDK Lifecycle Pitfalls](#beacon-sdk-lifecycle-pitfalls)
6. [The "Preparing Transaction Forever" Problem](#the-preparing-transaction-forever-problem)
7. [Why Contracts Didn't Appear in My Contracts](#why-contracts-didnt-appear-in-my-contracts)
8. [Network Migration: Ghostnet to Shadownet](#network-migration-ghostnet-to-shadownet)
9. [Importing Existing Contracts](#importing-existing-contracts)
10. [Quick Reference](#quick-reference)

---

## The Correct Deployment Pathway

Here is the step-by-step process that works reliably:

### Prerequisites

1. **Install Temple Wallet** — the browser extension from [templewallet.com](https://templewallet.com).
   Temple is the only wallet that reliably handles contract origination on current
   Tezos protocols.

2. **Create a Shadownet account in Temple** — open Temple, go to Settings, and switch
   the network to a custom network or import Shadownet if available.

3. **Fund your account** — visit the [Shadownet faucet](https://faucet.shadownet.teztnets.com)
   and request test tez. You'll need approximately 1-2 tez per contract deployment.

### Deployment Steps

1. **Log in to Bowers** and navigate to the dashboard.
2. **Connect your wallet** — click "Connect Wallet" and select Temple in the Beacon dialog.
   Make sure Temple is set to the Shadownet network.
3. **Create a new collection** — click "New Collection" and walk through the wizard:
   - Choose a contract style
   - Configure name, symbol, and options
   - Review the estimated deployment cost
4. **Click Deploy** — the app will:
   - Upload metadata to IPFS via Pinata
   - Build the contract's Michelson code and initial storage
   - Send the origination request to your wallet via the Beacon SDK
5. **Wait for Temple to prompt** — contract origination is a heavy operation. It can
   take 30-60 seconds before Temple shows the approval dialog. This is normal. The
   Beacon SDK serializes the full contract code into a forged payload and Temple
   runs its own gas simulation.
6. **Approve in Temple** — review the fee and click Confirm.
7. **Wait for on-chain confirmation** — the app waits up to 120 seconds for the
   operation to be included in a block. You'll see a success toast with your new
   KT1 address.

Your contract will automatically appear on the **My Contracts** dashboard.

---

## Wallet Choice: Why Temple, Not Kukai

We discovered through extensive testing that **Kukai wallet cannot originate
contracts** on Tezos protocol 024 (Tallinn) and later. This is not a Bowers
bug — it's a bug in Kukai's internal gas estimation.

Kukai works fine for:
- Connecting to dApps
- Sending tez transfers
- Interacting with existing contracts (calling entrypoints)

Kukai does **not** work for:
- Contract origination (deploying new contracts)

If you try to deploy with Kukai, you'll see either:
- "Failed to estimate fee" in Kukai's interface
- An `ABORTED_ERROR` or `UNKNOWN_ERROR` returned to the app
- The "Preparing transaction" dialog hanging forever

**Always use Temple wallet for contract deployment.**

---

## The Kukai Bug — Full Explanation

When a dApp sends an origination operation to a wallet via Beacon's
`requestOperation`, the wallet is supposed to:

1. Receive the operation payload
2. Simulate it against an RPC node to estimate gas and storage costs
3. Show the user a confirmation dialog with the estimated fees
4. Sign and inject the operation

Kukai's simulation step has a bug: it sends `gas_limit: "0"` in its
`simulate_operation` RPC call. On protocol 024 (Tallinn), the protocol
enforces a minimum of 100 gas units for manager operations. The RPC
rejects the simulation with:

```
insufficient_gas_for_manager: a minimum of 100 gas units is required
```

Kukai sees this rejection, displays an internal error ("Failed to estimate fee"),
and either:
- Closes the dialog and returns `ABORTED_ERROR` to the dApp
- Hangs silently, leaving the Beacon "Preparing..." spinner indefinitely

This happens regardless of what gas limit the dApp passes. Kukai always
re-estimates with its own values, and those values include `gas_limit: 0`.

### What we tried (and why it didn't work)

| Approach | Result |
|---|---|
| Pass explicit `gasLimit: 10000` to `wallet.originate()` | Kukai ignored it, re-estimated with 0 |
| Use `beaconClient.requestOperation()` directly with `gas_limit` | Kukai ignored it, re-estimated with 0 |
| Use `Tezos.contract.originate()` (Contract API) | Kukai rejected `requestSignPayload` for origination payloads |
| Pre-forge the operation and send via Beacon | Kukai still re-estimated with 0 |

The only solution: **use Temple wallet**. Temple's simulation works correctly.

---

## The Accidental Mainnet Deploy

During development, a contract was accidentally deployed to Tezos mainnet
instead of the intended testnet. This happened because:

1. The Beacon SDK `requestPermissions()` call did not explicitly specify
   which network to connect on.
2. Temple wallet was set to mainnet internally.
3. When `Tezos.wallet.originate().send()` is called, the Beacon SDK
   delegates the entire operation (simulation, signing, injection) to the
   wallet. The wallet uses **its own** RPC endpoint — not the one configured
   in TezosToolkit.
4. So even though TezosToolkit was configured with a testnet RPC, Temple
   injected the operation on mainnet.

### The fix: chain ID verification

The app now includes a `verifyNetwork()` check that runs before every
origination. It queries the RPC for the actual chain ID and compares it
to the expected chain ID for the app's active network:

- Shadownet: `NetXsqzbfFenSTS`
- Mainnet: `NetXdQprcVkpaWU`

If there's a mismatch, the operation is blocked with a clear error message
before any tez is spent.

### Lesson learned

Never trust that the wallet is on the same network as the dApp. Always
verify the chain ID before sending operations. The TezosToolkit's RPC
URL only affects Taquito's own RPC calls (like `estimate`), not the
wallet's operations.

---

## Beacon SDK Lifecycle Pitfalls

The Beacon SDK (which connects dApps to wallets) has several sharp edges:

### Multiple instances crash the SDK

Creating more than one `BeaconWallet` instance per page causes the SDK
to emit a warning and then fail silently on subsequent operations. In
React with StrictMode, effects run twice, which can create two instances
if you're not careful.

**Fix:** Use a singleton pattern with a promise lock. The `ensureAdapter()`
function in `wallet.ts` guarantees only one adapter is ever created.

### Don't destroy the adapter on reconnect

An earlier approach was to null out the adapter in `connectWallet()` and
create a fresh one. This caused the old DAppClient's transport to stay
alive in memory while a new one was created, leading to competing clients
and broken wallet communication.

**Fix:** Reuse the same adapter for the entire page lifecycle. On reconnect,
just call `clearActiveAccount()` and then `requestPermissions()` on the
existing adapter. On disconnect, only clear the account — don't destroy
the adapter.

### Stale pairings in localStorage

The Beacon SDK stores pairing data in `localStorage` under keys prefixed
with `beacon:` and `beacon-sdk:`. If you've connected to multiple wallets
(Kukai, then Temple) or multiple networks (ghostnet, mainnet), the stored
pairings can become stale and cause connection failures.

If wallet connect seems broken after switching wallets, clear the Beacon
data from your browser's `localStorage` and refresh the page.

---

## The "Preparing Transaction Forever" Problem

After clicking Deploy, you might see the Beacon SDK overlay showing
"Preparing transaction..." with a spinner that never goes away. This is
the manifestation of the Kukai bug described above.

What's happening: the Beacon SDK sent the origination request to Kukai,
and Kukai's internal simulation failed silently. Kukai doesn't return an
error or a response — it just does nothing. The Beacon SDK waits
indefinitely for a response that never comes.

**Fix:** Close the dialog, disconnect your wallet, and reconnect using
Temple. The app now includes a 120-second timeout on confirmation so it
won't hang forever.

---

## Why Contracts Didn't Appear in My Contracts

After successfully deploying contracts, the "My Contracts" dashboard showed
"No collections yet." The contracts were on-chain (visible on the block
explorer) and in the database, but not showing in the UI.

### Root cause

The dashboard's query (`GET /api/contracts/user/me`) called
`getContractsByUserId()`, which:

1. Looked up the user's **linked wallets** from the `wallets` table
2. Returned contracts whose `ownerAddress` matched one of those wallets

But the deployer's wallet was never explicitly linked on the `/wallets` page.
The contracts were in the database with the correct `userId`, but the query
only searched by wallet address — and found no linked wallets.

### Fix (applied)

1. **Auto-link on deploy:** When a contract is created, the server automatically
   links the deployer's wallet to the user's account if it isn't already linked.

2. **Query by userId too:** `getContractsByUserId()` now also returns contracts
   where `contracts.userId` matches, not just wallet-address matches. This catches
   contracts deployed before the auto-link fix was applied.

---

## Network Migration: Ghostnet to Shadownet

Ghostnet (the previous Tezos long-term testnet) sunset in March 2026.
The replacement is **Shadownet**.

| | Ghostnet (old) | Shadownet (current) |
|---|---|---|
| RPC | `ghostnet.ecadinfra.com` | `shadownet.tezos.ecadinfra.com` |
| Explorer | `ghostnet.tzkt.io` | `shadownet.tzkt.io` |
| Faucet | `faucet.ghostnet.teztnets.com` | `faucet.shadownet.teztnets.com` |
| Chain ID | `NetXnHfVqm9iesp` | `NetXsqzbfFenSTS` |
| Protocol | 024 Tallinn | 024 Tallinn (and later) |

All references in the codebase have been updated from ghostnet to shadownet.
If you have existing contracts on ghostnet, you can import them (see below),
but new deployments should target shadownet.

---

## Importing Existing Contracts

If you deployed a contract outside of Bowers (or on a previous testnet), you
can import it:

1. Go to the **My Contracts** dashboard
2. Click **Import Existing**
3. Enter the KT1 address and select the network (Shadownet or Mainnet)
4. Click **Import Contract**

The server will:
- Fetch the contract's storage from the TzKT API
- Read the `admin` field from the on-chain storage
- Verify that the admin address matches one of your linked wallets
- If verified, add the contract to your dashboard

If the admin address doesn't match any of your wallets, the import will
be rejected with a 403 error. You must be the contract admin to import it.

---

## Quick Reference

| Task | How |
|---|---|
| Fund testnet account | [Shadownet faucet](https://faucet.shadownet.teztnets.com) |
| Deploy a contract | Connect Temple wallet (Shadownet) → Create Collection wizard → Deploy |
| Check deployment on-chain | [shadownet.tzkt.io](https://shadownet.tzkt.io) |
| Import existing contract | Dashboard → Import Existing → Enter KT1 address |
| Switch network in app | Sidebar → Network section → click the badge |
| Required wallet | **Temple** (browser extension) — Kukai does not support origination |
| Origination wait time | 30-90 seconds for Temple to prompt; 15-30 seconds for on-chain confirmation |
