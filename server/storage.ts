import {
  type Contract, type InsertContract, contracts,
  type Wallet, type InsertWallet, wallets,
  type Bower, type InsertBower, bowers,
  type Friendship, type InsertFriendship, friendships,
  type Follower, followers,
  type User, users,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, and, sql } from "drizzle-orm";

export interface IStorage {
  getContractsByOwner(ownerAddress: string): Promise<Contract[]>;
  getContractsByUserId(userId: string): Promise<Contract[]>;
  getContractById(id: string): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  incrementTokenCount(id: string): Promise<Contract | undefined>;

  getWalletsByUser(userId: string): Promise<Wallet[]>;
  getWalletByAddress(address: string): Promise<Wallet | undefined>;
  addWallet(data: InsertWallet): Promise<Wallet>;
  removeWallet(id: string, userId: string): Promise<boolean>;
  setPrimaryWallet(id: string, userId: string): Promise<Wallet | undefined>;

  getBowerByUserId(userId: string): Promise<Bower | undefined>;
  getBowerById(id: string): Promise<Bower | undefined>;
  getPublicBowers(): Promise<(Bower & { user: User | null })[]>;
  createBower(data: InsertBower): Promise<Bower>;
  updateBower(id: string, userId: string, data: Partial<InsertBower>): Promise<Bower | undefined>;

  sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  acceptFriendRequest(id: string, userId: string): Promise<Friendship | undefined>;
  removeFriendship(id: string, userId: string): Promise<boolean>;
  getFriends(userId: string): Promise<(Friendship & { user: User })[]>;
  getPendingRequests(userId: string): Promise<(Friendship & { user: User })[]>;

  followUser(followerId: string, followedId: string): Promise<Follower>;
  unfollowUser(followerId: string, followedId: string): Promise<boolean>;
  getFollowing(userId: string): Promise<{ id: string; user: User }[]>;
  getFollowers(userId: string): Promise<{ id: string; user: User }[]>;

  getUserById(id: string): Promise<User | undefined>;
  searchUsers(query: string, currentUserId: string): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  async getContractsByOwner(ownerAddress: string): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.ownerAddress, ownerAddress));
  }

  async getContractsByUserId(userId: string): Promise<Contract[]> {
    const userWallets = await this.getWalletsByUser(userId);
    if (userWallets.length === 0) return [];
    const addresses = userWallets.map((w) => w.address);
    return await db.select().from(contracts).where(
      or(...addresses.map((a) => eq(contracts.ownerAddress, a)))
    );
  }

  async getContractById(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(contracts).values(data).returning();
    return contract;
  }

  async incrementTokenCount(id: string): Promise<Contract | undefined> {
    const existing = await this.getContractById(id);
    if (!existing) return undefined;
    const [updated] = await db
      .update(contracts)
      .set({ tokenCount: (existing.tokenCount || 0) + 1 })
      .where(eq(contracts.id, id))
      .returning();
    return updated;
  }

  async getWalletsByUser(userId: string): Promise<Wallet[]> {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWalletByAddress(address: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.address, address));
    return wallet;
  }

  async addWallet(data: InsertWallet): Promise<Wallet> {
    const existing = await this.getWalletsByUser(data.userId);
    if (existing.length === 0) {
      data.isPrimary = true;
    }
    const [wallet] = await db.insert(wallets).values(data).returning();
    return wallet;
  }

  async removeWallet(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(wallets).where(and(eq(wallets.id, id), eq(wallets.userId, userId))).returning();
    return result.length > 0;
  }

  async setPrimaryWallet(id: string, userId: string): Promise<Wallet | undefined> {
    await db.update(wallets).set({ isPrimary: false }).where(eq(wallets.userId, userId));
    const [updated] = await db
      .update(wallets)
      .set({ isPrimary: true })
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return updated;
  }

  async getBowerByUserId(userId: string): Promise<Bower | undefined> {
    const [bower] = await db.select().from(bowers).where(eq(bowers.userId, userId));
    return bower;
  }

  async getBowerById(id: string): Promise<Bower | undefined> {
    const [bower] = await db.select().from(bowers).where(eq(bowers.id, id));
    return bower;
  }

  async getPublicBowers(): Promise<(Bower & { user: User | null })[]> {
    const rows = await db
      .select({ bower: bowers, user: users })
      .from(bowers)
      .leftJoin(users, eq(bowers.userId, users.id))
      .where(eq(bowers.isPublic, true));
    return rows.map((r) => ({ ...r.bower, user: r.user }));
  }

  async createBower(data: InsertBower): Promise<Bower> {
    const [bower] = await db.insert(bowers).values(data).returning();
    return bower;
  }

  async updateBower(id: string, userId: string, data: Partial<InsertBower>): Promise<Bower | undefined> {
    const [updated] = await db
      .update(bowers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(bowers.id, id), eq(bowers.userId, userId)))
      .returning();
    return updated;
  }

  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const [friendship] = await db
      .insert(friendships)
      .values({ requesterId, addresseeId, status: "pending" })
      .returning();
    return friendship;
  }

  async acceptFriendRequest(id: string, userId: string): Promise<Friendship | undefined> {
    const [updated] = await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(and(eq(friendships.id, id), eq(friendships.addresseeId, userId)))
      .returning();
    return updated;
  }

  async removeFriendship(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, id),
          or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
        )
      )
      .returning();
    return result.length > 0;
  }

  async getFriends(userId: string): Promise<(Friendship & { user: User })[]> {
    const rows = await db
      .select({ friendship: friendships, requester: users })
      .from(friendships)
      .leftJoin(users, sql`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END = ${users.id}`)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
        )
      );
    return rows.map((r) => ({ ...r.friendship, user: r.requester! }));
  }

  async getPendingRequests(userId: string): Promise<(Friendship & { user: User })[]> {
    const rows = await db
      .select({ friendship: friendships, requester: users })
      .from(friendships)
      .leftJoin(users, eq(friendships.requesterId, users.id))
      .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")));
    return rows.map((r) => ({ ...r.friendship, user: r.requester! }));
  }

  async followUser(followerId: string, followedId: string): Promise<Follower> {
    const [follower] = await db
      .insert(followers)
      .values({ followerId, followedId })
      .returning();
    return follower;
  }

  async unfollowUser(followerId: string, followedId: string): Promise<boolean> {
    const result = await db
      .delete(followers)
      .where(and(eq(followers.followerId, followerId), eq(followers.followedId, followedId)))
      .returning();
    return result.length > 0;
  }

  async getFollowing(userId: string): Promise<{ id: string; user: User }[]> {
    const rows = await db
      .select({ follower: followers, user: users })
      .from(followers)
      .leftJoin(users, eq(followers.followedId, users.id))
      .where(eq(followers.followerId, userId));
    return rows.map((r) => ({ id: r.follower.id, user: r.user! }));
  }

  async getFollowers(userId: string): Promise<{ id: string; user: User }[]> {
    const rows = await db
      .select({ follower: followers, user: users })
      .from(followers)
      .leftJoin(users, eq(followers.followerId, users.id))
      .where(eq(followers.followedId, userId));
    return rows.map((r) => ({ id: r.follower.id, user: r.user! }));
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    const pattern = `%${query}%`;
    return await db
      .select()
      .from(users)
      .where(
        and(
          or(
            sql`${users.firstName} ILIKE ${pattern}`,
            sql`${users.lastName} ILIKE ${pattern}`,
            sql`${users.email} ILIKE ${pattern}`
          ),
          sql`${users.id} != ${currentUserId}`
        )
      )
      .limit(20);
  }
}

export const storage = new DatabaseStorage();
