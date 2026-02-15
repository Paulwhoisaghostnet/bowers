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
    updateOperators: z.string().optional(),
    setRoyalties: z.string().optional(),
    addMinter: z.string().optional(),
    removeMinter: z.string().optional(),
  }),
});

export type ContractStyle = z.infer<typeof contractStyleSchema>;

export const CONTRACT_STYLES: ContractStyle[] = [
  {
    id: "fa2-basic",
    name: "FA2 Basic",
    description: "Standard FA2 NFT contract with single admin. Perfect for simple collections with straightforward minting.",
    version: "1.0.0",
    icon: "Layers",
    features: ["FA2 compliant", "Single admin", "Batch transfer", "On-chain metadata"],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      updateOperators: "update_operators",
    },
  },
  {
    id: "fa2-royalties",
    name: "FA2 + Royalties",
    description: "FA2 with built-in royalty distribution. Automatically splits secondary sales between creator and platform.",
    version: "1.0.0",
    icon: "Gem",
    features: ["FA2 compliant", "On-chain royalties", "EIP-2981 compatible", "Configurable split"],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      updateOperators: "update_operators",
      setRoyalties: "set_royalties",
    },
  },
  {
    id: "fa2-multiminter",
    name: "FA2 Multi-Minter",
    description: "Collaborative minting with allowlist. Add multiple wallet addresses as authorized minters for your collection.",
    version: "1.0.0",
    icon: "Users",
    features: ["FA2 compliant", "Multi-admin", "Minter allowlist", "Role management"],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      updateOperators: "update_operators",
      addMinter: "add_minter",
      removeMinter: "remove_minter",
    },
  },
  {
    id: "fa2-full",
    name: "FA2 Complete",
    description: "Full-featured contract with royalties, multi-minter support, and advanced metadata. The ultimate collection contract.",
    version: "1.0.0",
    icon: "Crown",
    features: ["FA2 compliant", "Royalties", "Multi-minter", "Advanced metadata", "Pausable"],
    entrypoints: {
      mint: "mint",
      transfer: "transfer",
      updateOperators: "update_operators",
      setRoyalties: "set_royalties",
      addMinter: "add_minter",
      removeMinter: "remove_minter",
    },
  },
];
