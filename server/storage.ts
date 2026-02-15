import { type Contract, type InsertContract, contracts } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getContractsByOwner(ownerAddress: string): Promise<Contract[]>;
  getContractById(id: string): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  incrementTokenCount(id: string): Promise<Contract | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getContractsByOwner(ownerAddress: string): Promise<Contract[]> {
    return await db
      .select()
      .from(contracts)
      .where(eq(contracts.ownerAddress, ownerAddress));
  }

  async getContractById(id: string): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, id));
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
}

export const storage = new DatabaseStorage();
