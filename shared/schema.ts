import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kt1Address: text("kt1_address").notNull(),
  styleId: text("style_id").notNull(),
  styleVersion: text("style_version").notNull(),
  ownerAddress: text("owner_address").notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  adminModel: text("admin_model").notNull().default("single"),
  royaltiesEnabled: boolean("royalties_enabled").notNull().default(false),
  royaltyPercent: integer("royalty_percent").default(0),
  minterListEnabled: boolean("minter_list_enabled").notNull().default(false),
  metadataBaseUri: text("metadata_base_uri").default(""),
  options: jsonb("options").$type<Record<string, unknown>>().default({}),
  network: text("network").notNull().default("ghostnet"),
  status: text("status").notNull().default("deployed"),
  tokenCount: integer("token_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
});

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

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

export const mintRequestSchema = z.object({
  contractId: z.string(),
  tokenName: z.string().min(1, "Token name is required"),
  description: z.string().optional().default(""),
  artifactUri: z.string().url("Must be a valid URI"),
  displayUri: z.string().optional().default(""),
  thumbnailUri: z.string().optional().default(""),
  attributes: z.string().optional().default("[]"),
});

export type MintRequest = z.infer<typeof mintRequestSchema>;

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
