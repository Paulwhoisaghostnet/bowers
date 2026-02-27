import { db } from "./db";
import { contracts } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(contracts);
  if (Number(existing[0].count) > 0) return;

  const demoAddress = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";

  await db.insert(contracts).values([
    {
      kt1Address: "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton",
      styleId: "bowers-marketplace",
      styleVersion: "1.0.0",
      ownerAddress: demoAddress,
      name: "Neon Dreamscapes",
      symbol: "NEON",
      adminModel: "single",
      royaltiesEnabled: true,
      royaltyPercent: 5,
      minterListEnabled: false,
      metadataBaseUri: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      network: "ghostnet",
      status: "deployed",
      tokenCount: 12,
    },
    {
      kt1Address: "KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9",
      styleId: "bowers-open-edition",
      styleVersion: "1.0.0",
      ownerAddress: demoAddress,
      name: "Pixel Artifacts",
      symbol: "PXART",
      adminModel: "single",
      royaltiesEnabled: true,
      royaltyPercent: 10,
      minterListEnabled: false,
      metadataBaseUri: "ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX",
      network: "ghostnet",
      status: "deployed",
      tokenCount: 7,
    },
  ]);

  console.log("Seed data inserted successfully");
}
