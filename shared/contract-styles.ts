import { z } from "zod";

export const contractStyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  icon: z.string(),
  features: z.array(z.string()),
  entrypoints: z.object({
    mint: z.string(),
    transfer: z.string(),
    balanceOf: z.string().optional(),
    updateOperators: z.string().optional(),
    setListing: z.string().optional(),
    buy: z.string().optional(),
    makeOffer: z.string().optional(),
    acceptOffer: z.string().optional(),
    closeOffer: z.string().optional(),
    withdraw: z.string().optional(),
    blacklistAddress: z.string().optional(),
    unblacklistAddress: z.string().optional(),
    blockAddress: z.string().optional(),
    unblockAddress: z.string().optional(),
    setAdmin: z.string().optional(),
    createToken: z.string().optional(),
    mintEditions: z.string().optional(),
    setMintPrice: z.string().optional(),
    setMintEnd: z.string().optional(),
    setMintPaused: z.string().optional(),
    setAllowlist: z.string().optional(),
    clearAllowlist: z.string().optional(),
    setAllowlistEnd: z.string().optional(),
    batchMint: z.string().optional(),
    batchTransferSingle: z.string().optional(),
    airdrop: z.string().optional(),
    setPaymentSplits: z.string().optional(),
    setTokenSplits: z.string().optional(),
    clearTokenSplits: z.string().optional(),
  }),
  views: z.array(z.string()).optional(),
  recommended: z.boolean().optional(),
});

export type ContractStyle = z.infer<typeof contractStyleSchema>;

// ---------------------------------------------------------------------------
// Module system for the Custom Contract builder
// ---------------------------------------------------------------------------

export interface ContractModule {
  id: string;
  name: string;
  description: string;
  category: "core" | "mint" | "market" | "admin";
  required: boolean;
  estimatedKB: number;
  entrypoints: string[];
  views: string[];
  features: string[];
  /** Module IDs that must also be selected when this module is active */
  requires: string[];
  /** Module IDs that conflict with this module */
  conflicts: string[];
}

export const CONTRACT_MODULES: ContractModule[] = [
  {
    id: "fa2-core",
    name: "FA2 Core",
    description: "Standard TZIP-12 token ledger with transfer, balance_of, and update_operators. Required for all contracts.",
    category: "core",
    required: true,
    estimatedKB: 3,
    entrypoints: ["transfer", "balance_of", "update_operators"],
    views: ["get_balance", "is_operator"],
    features: ["FA2 compliant (TZIP-12)", "TZIP-21 rich metadata"],
    requires: [],
    conflicts: [],
  },
  {
    id: "royalties",
    name: "Royalties",
    description: "On-chain royalty distribution. A percentage of every sale or accepted offer is sent to a single royalty recipient.",
    category: "core",
    required: false,
    estimatedKB: 1,
    entrypoints: [],
    views: [],
    features: ["On-chain royalties"],
    requires: [],
    conflicts: ["split-payments"],
  },
  {
    id: "admin-mint",
    name: "Admin Mint",
    description: "Only the contract admin can mint new tokens with custom metadata and supply. Standard Objkt-style minting.",
    category: "mint",
    required: false,
    estimatedKB: 1,
    entrypoints: ["mint"],
    views: [],
    features: ["Admin-only minting"],
    requires: [],
    conflicts: [],
  },
  {
    id: "open-edition-mint",
    name: "Open Edition Mint",
    description: "Anyone can mint editions by paying a set price. Admin creates token templates with price, end date, and max supply controls.",
    category: "mint",
    required: false,
    estimatedKB: 2,
    entrypoints: ["create_token", "mint_editions", "set_mint_price", "set_mint_end", "set_mint_paused"],
    views: ["get_token_config"],
    features: ["Open-edition minting", "Per-token mint controls"],
    requires: [],
    conflicts: [],
  },
  {
    id: "allowlist",
    name: "Allowlist",
    description: "Phased drops: only allowlisted addresses can mint during the allowlist phase (per-address cap, optional price override). After the phase ends, standard open-edition minting applies.",
    category: "mint",
    required: false,
    estimatedKB: 1,
    entrypoints: ["set_allowlist", "clear_allowlist", "set_allowlist_end"],
    views: ["get_allowlist_entry", "is_allowlisted"],
    features: ["Phased drops", "Per-address caps", "Early access pricing"],
    requires: [],
    conflicts: [],
  },
  {
    id: "bonding-curve-mint",
    name: "Bonding Curve Mint",
    description: "Price increases as more editions are minted. Admin creates token factories with base price, increment, and step size. Early minters pay less.",
    category: "mint",
    required: false,
    estimatedKB: 2,
    entrypoints: ["create_token", "mint_editions", "set_mint_paused", "set_mint_end"],
    views: ["get_token_config", "get_current_price"],
    features: ["Bonding curve pricing", "Per-token mint controls"],
    requires: [],
    conflicts: [],
  },
  {
    id: "batch-ops",
    name: "Batch Operations",
    description: "Admin can mint multiple tokens or distribute to many addresses in one transaction. Supports airdrops and gas-efficient batch minting.",
    category: "admin",
    required: false,
    estimatedKB: 1,
    entrypoints: ["batch_mint", "batch_transfer_single", "airdrop"],
    views: [],
    features: ["Batch minting", "Airdrops", "Multi-recipient distribution"],
    requires: [],
    conflicts: [],
  },
  {
    id: "split-payments",
    name: "Split Payments",
    description: "Multiple royalty recipients with configurable basis-point shares. Replaces single royalty recipient with per-contract or per-token split configuration.",
    category: "core",
    required: false,
    estimatedKB: 1,
    entrypoints: ["set_payment_splits", "set_token_splits", "clear_token_splits"],
    views: ["get_payment_splits", "get_token_splits"],
    features: ["Multi-recipient royalties", "Per-token split overrides"],
    requires: [],
    conflicts: ["royalties"],
  },
  {
    id: "listings",
    name: "Listings & Buy",
    description: "Token owners can list tokens for sale at a fixed price. Buyers pay exact amount to purchase. Includes pull-payment withdraw.",
    category: "market",
    required: false,
    estimatedKB: 2,
    entrypoints: ["set_listing", "buy", "withdraw"],
    views: ["get_listing", "get_claimable"],
    features: ["Consolidated listings", "Pull payments"],
    requires: [],
    conflicts: [],
  },
  {
    id: "offers",
    name: "Offers",
    description: "Buyers can make offers on tokens. Owners can accept full or partial quantities. Offers auto-expire after 7 days.",
    category: "market",
    required: false,
    estimatedKB: 2,
    entrypoints: ["make_offer", "accept_offer", "close_offer"],
    views: ["get_offer"],
    features: ["Partial-fill offers", "7-day auto-expiry"],
    requires: ["listings"],
    conflicts: [],
  },
  {
    id: "blacklist",
    name: "Blacklist",
    description: "Per-owner, per-token address blocking. Prevents blacklisted addresses from buying or receiving specific tokens.",
    category: "admin",
    required: false,
    estimatedKB: 1,
    entrypoints: ["blacklist_address", "unblacklist_address"],
    views: ["is_blacklisted"],
    features: ["Per-owner blacklist"],
    requires: [],
    conflicts: [],
  },
  {
    id: "contract-blocklist",
    name: "Contract Blocklist",
    description: "Admin-maintained contract-level blocklist. Blocked addresses cannot transfer, receive, buy, or mint. Enforced in FA2 transfer so objkt/teia purchases fail at the token contract.",
    category: "admin",
    required: false,
    estimatedKB: 1,
    entrypoints: ["block_address", "unblock_address"],
    views: [],
    features: ["Contract-level blocklist", "Transfer enforcement", "Self-sovereign gatekeeping"],
    requires: [],
    conflicts: [],
  },
];

/**
 * Maximum estimated contract code size (KB) that can deploy within
 * the Tezos max_operation_data_length of 32,768 bytes. The remaining
 * ~8 KB covers initial storage, operation headers, and the signature.
 */
export const MAX_CONTRACT_SIZE_KB = 24;

/**
 * Given a set of selected module IDs, resolve the best matching pre-compiled
 * contract style. Returns the style ID to deploy.
 * When multiple mint models are selected, use the unified contract.
 */
export function resolveStyleFromModules(moduleIds: string[]): string {
  const mintModels = ["admin-mint", "open-edition-mint", "bonding-curve-mint"] as const;
  const selectedMintCount = mintModels.filter((id) => moduleIds.includes(id)).length;
  if (selectedMintCount >= 2) return "bowers-unified";

  if (moduleIds.includes("bonding-curve-mint")) return "bowers-bonding-curve";
  if (moduleIds.includes("allowlist") && moduleIds.includes("open-edition-mint"))
    return "bowers-allowlist";
  if (moduleIds.includes("open-edition-mint")) return "bowers-open-edition";
  return "bowers-marketplace";
}

/**
 * Compute the set of features, entrypoints, and views from selected modules.
 */
export function computeModuleAggregates(moduleIds: string[]) {
  const selected = CONTRACT_MODULES.filter((m) => moduleIds.includes(m.id));
  const features = selected.flatMap((m) => m.features);
  const entrypoints = selected.flatMap((m) => m.entrypoints);
  const views = selected.flatMap((m) => m.views);
  const estimatedKB = selected.reduce((sum, m) => sum + m.estimatedKB, 0);
  return { features, entrypoints, views, estimatedKB };
}

/**
 * Validate module selection: check dependencies, conflicts, and at least one mint model.
 */
export function validateModuleSelection(moduleIds: string[]): string[] {
  const errors: string[] = [];
  const selected = CONTRACT_MODULES.filter((m) => moduleIds.includes(m.id));

  const hasMint =
    moduleIds.includes("admin-mint") ||
    moduleIds.includes("open-edition-mint") ||
    moduleIds.includes("bonding-curve-mint");
  if (!hasMint) {
    errors.push(
      "Select at least one minting model (Admin Mint, Open Edition, or Bonding Curve)."
    );
  }

  const hasRoyaltyModel =
    moduleIds.includes("royalties") || moduleIds.includes("split-payments");
  if (!hasRoyaltyModel) {
    errors.push("Select a royalty model (Royalties or Split Payments).");
  }

  if (moduleIds.includes("allowlist")) {
    const hasOEorBC =
      moduleIds.includes("open-edition-mint") || moduleIds.includes("bonding-curve-mint");
    if (!hasOEorBC) {
      errors.push("Allowlist requires Open Edition or Bonding Curve mint (or both).");
    }
  }

  for (const mod of selected) {
    for (const req of mod.requires) {
      if (!moduleIds.includes(req)) {
        const reqMod = CONTRACT_MODULES.find((m) => m.id === req);
        errors.push(`"${mod.name}" requires "${reqMod?.name || req}".`);
      }
    }
    for (const conflict of mod.conflicts) {
      if (moduleIds.includes(conflict)) {
        const conflictMod = CONTRACT_MODULES.find((m) => m.id === conflict);
        errors.push(`"${mod.name}" conflicts with "${conflictMod?.name || conflict}".`);
      }
    }
  }

  return errors;
}

export const CONTRACT_STYLES: ContractStyle[] = [
  {
    id: "bowers-custom",
    name: "Custom Contract",
    description: "Build your own contract by selecting individual modules. Choose your minting model, marketplace features, and admin tools to fit your exact needs.",
    version: "2.0.0",
    icon: "Settings2",
    features: ["Modular configuration", "Choose your own modules"],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
    },
    views: [],
  },
  {
    id: "bowers-marketplace",
    name: "Bowers Marketplace",
    description: "Market-independent FA2 with built-in listings, partial-fill offers, pull payments, per-owner blacklists, and royalty distribution. The default Bowers contract.",
    version: "2.0.0",
    icon: "Store",
    recommended: true,
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "On-chain royalties",
      "Consolidated listings",
      "Partial-fill offers",
      "Pull payments",
      "Per-owner blacklist",
      "6 on-chain views",
      "NO_TEZ guards",
      "Minimal events",
    ],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setListing: "set_listing",
      buy: "buy",
      makeOffer: "make_offer",
      acceptOffer: "accept_offer",
      closeOffer: "close_offer",
      withdraw: "withdraw",
      blacklistAddress: "blacklist_address",
      unblacklistAddress: "unblacklist_address",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: [
      "get_balance",
      "get_offer",
      "is_operator",
      "get_listing",
      "get_claimable",
      "is_blacklisted",
    ],
  },
  {
    id: "bowers-open-edition",
    name: "Bowers Open Edition",
    description: "Open-edition FA2 where anyone can mint editions at a set price. Includes built-in marketplace with listings, 7-day auto-expiring offers, pull payments, and per-owner blacklists.",
    version: "2.0.0",
    icon: "Infinity",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Open-edition minting",
      "On-chain royalties",
      "Consolidated listings",
      "Partial-fill offers",
      "7-day auto-expiry",
      "Pull payments",
      "Per-owner blacklist",
      "Per-token mint controls",
      "7 on-chain views",
      "NO_TEZ guards",
      "Minimal events",
    ],
    entrypoints: {
      mint: "mint_editions",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPrice: "set_mint_price",
      setMintEnd: "set_mint_end",
      setMintPaused: "set_mint_paused",
      setListing: "set_listing",
      buy: "buy",
      makeOffer: "make_offer",
      acceptOffer: "accept_offer",
      closeOffer: "close_offer",
      withdraw: "withdraw",
      blacklistAddress: "blacklist_address",
      unblacklistAddress: "unblacklist_address",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: [
      "get_balance",
      "get_offer",
      "is_operator",
      "get_listing",
      "get_claimable",
      "is_blacklisted",
      "get_token_config",
    ],
  },
  {
    id: "bowers-allowlist",
    name: "Bowers Allowlist",
    description:
      "Open-edition FA2 with allowlist phased minting. Only allowlisted addresses can mint during the allowlist phase; then public minting opens. Full marketplace included.",
    version: "2.0.0",
    icon: "ListChecks",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Allowlist phased drops",
      "Per-address caps and price overrides",
      "On-chain royalties",
      "Consolidated listings",
      "Partial-fill offers",
      "Pull payments",
      "Per-owner blacklist",
      "Per-token mint controls",
    ],
    entrypoints: {
      mint: "mint_editions",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPrice: "set_mint_price",
      setMintEnd: "set_mint_end",
      setMintPaused: "set_mint_paused",
      setAllowlist: "set_allowlist",
      clearAllowlist: "clear_allowlist",
      setAllowlistEnd: "set_allowlist_end",
      setListing: "set_listing",
      buy: "buy",
      makeOffer: "make_offer",
      acceptOffer: "accept_offer",
      closeOffer: "close_offer",
      withdraw: "withdraw",
      blacklistAddress: "blacklist_address",
      unblacklistAddress: "unblacklist_address",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: [
      "get_balance",
      "get_offer",
      "is_operator",
      "get_listing",
      "get_claimable",
      "is_blacklisted",
      "get_token_config",
      "get_allowlist_entry",
      "is_allowlisted",
    ],
  },
  {
    id: "bowers-bonding-curve",
    name: "Bowers Bonding Curve",
    description:
      "FA2 with bonding-curve minting: price increases as more editions are minted. Full marketplace with listings, offers, and pull payments.",
    version: "2.0.0",
    icon: "TrendingUp",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Bonding curve pricing",
      "On-chain royalties",
      "Consolidated listings",
      "Partial-fill offers",
      "Pull payments",
      "Per-owner blacklist",
      "Per-token mint controls",
    ],
    entrypoints: {
      mint: "mint_editions",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPaused: "set_mint_paused",
      setMintEnd: "set_mint_end",
      setListing: "set_listing",
      buy: "buy",
      makeOffer: "make_offer",
      acceptOffer: "accept_offer",
      closeOffer: "close_offer",
      withdraw: "withdraw",
      blacklistAddress: "blacklist_address",
      unblacklistAddress: "unblacklist_address",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: [
      "get_balance",
      "get_offer",
      "is_operator",
      "get_listing",
      "get_claimable",
      "is_blacklisted",
      "get_token_config",
      "get_current_price",
    ],
  },
  {
    id: "bowers-unified",
    name: "Bowers Unified",
    description:
      "Multi-mint FA2: choose per-token between admin mint, open edition, and bonding curve. Supports allowlist phases. Full marketplace.",
    version: "2.0.0",
    icon: "Layers",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Admin mint, Open Edition, Bonding Curve per-token",
      "Allowlist phased drops",
      "On-chain royalties",
      "Consolidated listings",
      "Partial-fill offers",
      "Pull payments",
      "Per-owner blacklist",
      "Contract blocklist",
    ],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPrice: "set_mint_price",
      setMintEnd: "set_mint_end",
      setMintPaused: "set_mint_paused",
      setAllowlist: "set_allowlist",
      clearAllowlist: "clear_allowlist",
      setAllowlistEnd: "set_allowlist_end",
      setListing: "set_listing",
      buy: "buy",
      makeOffer: "make_offer",
      acceptOffer: "accept_offer",
      closeOffer: "close_offer",
      withdraw: "withdraw",
      blacklistAddress: "blacklist_address",
      unblacklistAddress: "unblacklist_address",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: [
      "get_balance",
      "get_offer",
      "is_operator",
      "get_listing",
      "get_claimable",
      "is_blacklisted",
      "get_token_config",
      "get_current_price",
      "get_allowlist_entry",
      "is_allowlisted",
    ],
  },
  {
    id: "bowers-mint-oe",
    name: "Mint Only: Open Edition",
    description: "Open-edition minting only. No built-in marketplace — deploy and sell on objkt or teia. Lighter contract with contract-level blocklist.",
    version: "2.0.0",
    icon: "Infinity",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Open-edition minting",
      "Contract blocklist",
      "Pull payments (mint to creator)",
      "Per-token mint controls",
    ],
    entrypoints: {
      mint: "mint_editions",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPrice: "set_mint_price",
      setMintEnd: "set_mint_end",
      setMintPaused: "set_mint_paused",
      withdraw: "withdraw",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: ["get_balance", "get_claimable", "get_token_config"],
  },
  {
    id: "bowers-mint-allowlist",
    name: "Mint Only: Allowlist",
    description: "Open-edition with allowlist phase. No built-in marketplace — sell on objkt or teia. Contract-level blocklist supported.",
    version: "2.0.0",
    icon: "ListChecks",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Allowlist phased drops",
      "Per-address caps and price overrides",
      "Contract blocklist",
      "Pull payments",
      "Per-token mint controls",
    ],
    entrypoints: {
      mint: "mint_editions",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPrice: "set_mint_price",
      setMintEnd: "set_mint_end",
      setMintPaused: "set_mint_paused",
      setAllowlist: "set_allowlist",
      clearAllowlist: "clear_allowlist",
      setAllowlistEnd: "set_allowlist_end",
      withdraw: "withdraw",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: ["get_balance", "get_claimable", "get_token_config", "is_allowlisted"],
  },
  {
    id: "bowers-mint-bonding-curve",
    name: "Mint Only: Bonding Curve",
    description: "Bonding-curve minting only. No built-in marketplace — sell on objkt or teia. Contract-level blocklist supported.",
    version: "2.0.0",
    icon: "TrendingUp",
    features: [
      "FA2 compliant (TZIP-12)",
      "TZIP-21 rich metadata",
      "Bonding curve pricing",
      "Contract blocklist",
      "Pull payments",
      "Per-token mint controls",
    ],
    entrypoints: {
      mint: "mint_editions",
      transfer: "transfer",
      balanceOf: "balance_of",
      updateOperators: "update_operators",
      setAdmin: "set_admin",
      createToken: "create_token",
      mintEditions: "mint_editions",
      setMintPaused: "set_mint_paused",
      setMintEnd: "set_mint_end",
      withdraw: "withdraw",
      blockAddress: "block_address",
      unblockAddress: "unblock_address",
    },
    views: ["get_balance", "get_claimable", "get_token_config", "get_current_price"],
  },
];
