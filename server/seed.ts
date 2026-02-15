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
      styleId: "fa2-basic",
      styleVersion: "1.0.0",
      ownerAddress: demoAddress,
      name: "Neon Dreamscapes",
      symbol: "NEON",
      adminModel: "single",
      royaltiesEnabled: false,
      royaltyPercent: 0,
      minterListEnabled: false,
      metadataBaseUri: "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      network: "ghostnet",
      status: "deployed",
      tokenCount: 12,
    },
    {
      kt1Address: "KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9",
      styleId: "fa2-royalties",
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
    {
      kt1Address: "KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn",
      styleId: "fa2-multiminter",
      styleVersion: "1.0.0",
      ownerAddress: demoAddress,
      name: "Collective Canvas",
      symbol: "COLL",
      adminModel: "multi",
      royaltiesEnabled: false,
      royaltyPercent: 0,
      minterListEnabled: true,
      metadataBaseUri: "",
      network: "ghostnet",
      status: "deployed",
      tokenCount: 23,
    },
    {
      kt1Address: "KT1XvH1phSE8VKQf85VmyNx2TLPwrpKmPMzA",
      styleId: "fa2-full",
      styleVersion: "1.0.0",
      ownerAddress: demoAddress,
      name: "Genesis Collection",
      symbol: "GEN",
      adminModel: "single",
      royaltiesEnabled: true,
      royaltyPercent: 15,
      minterListEnabled: true,
      metadataBaseUri: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      network: "ghostnet",
      status: "deployed",
      tokenCount: 45,
    },
  ]);

  console.log("Seed data inserted successfully");
}
