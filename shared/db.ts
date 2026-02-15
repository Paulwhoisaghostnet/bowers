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
