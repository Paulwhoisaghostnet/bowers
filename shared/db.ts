import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kt1Address: text("kt1_address").notNull(),
  styleId: text("style_id").notNull(),
  styleVersion: text("style_version").notNull(),
  ownerAddress: text("owner_address").notNull(),
  userId: varchar("user_id").references(() => users.id),
  walletId: varchar("wallet_id").references(() => wallets.id),
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

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  address: text("address").notNull().unique(),
  label: text("label").default(""),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
});

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export const bowers = pgTable("bowers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  contractId: varchar("contract_id").references(() => contracts.id),
  title: text("title").notNull(),
  description: text("description").default(""),
  themeColor: text("theme_color").default("#6366f1"),
  layout: text("layout").notNull().default("standard"),
  featuredTokenId: integer("featured_token_id"),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBowerSchema = createInsertSchema(bowers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBower = z.infer<typeof insertBowerSchema>;
export type Bower = typeof bowers.$inferSelect;

export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  addresseeId: varchar("addressee_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_friendship").on(table.requesterId, table.addresseeId),
]);

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
});

export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type Friendship = typeof friendships.$inferSelect;

export const followers = pgTable("followers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followedId: varchar("followed_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_follow").on(table.followerId, table.followedId),
]);

export const insertFollowerSchema = createInsertSchema(followers).omit({
  id: true,
  createdAt: true,
});

export type InsertFollower = z.infer<typeof insertFollowerSchema>;
export type Follower = typeof followers.$inferSelect;
