import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertContractSchema, mintRequestSchema, CONTRACT_STYLES } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/styles", (_req, res) => {
    res.json(CONTRACT_STYLES);
  });

  app.get("/api/contracts/detail/:id", async (req, res) => {
    try {
      const contract = await storage.getContractById(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      const parsed = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(parsed);
      res.status(201).json(contract);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/contracts/:id/mint", async (req, res) => {
    try {
      const parsed = mintRequestSchema.parse(req.body);
      const contract = await storage.getContractById(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      const updated = await storage.incrementTokenCount(req.params.id);
      res.json({
        success: true,
        tokenId: updated?.tokenCount,
        tokenName: parsed.tokenName,
        contract: updated,
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/contracts/:id/config", async (req, res) => {
    try {
      const contract = await storage.getContractById(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const style = CONTRACT_STYLES.find((s) => s.id === contract.styleId);

      const config = {
        contract: {
          address: contract.kt1Address,
          name: contract.name,
          symbol: contract.symbol,
          network: contract.network,
          owner: contract.ownerAddress,
        },
        style: {
          id: contract.styleId,
          version: contract.styleVersion,
          name: style?.name || contract.styleId,
          features: style?.features || [],
        },
        capabilities: {
          royalties: contract.royaltiesEnabled,
          royaltyPercent: contract.royaltyPercent,
          minterAllowlist: contract.minterListEnabled,
          adminModel: contract.adminModel,
          metadataBaseUri: contract.metadataBaseUri,
        },
        entrypoints: style?.entrypoints || {},
        tokenCount: contract.tokenCount,
        deployedAt: contract.createdAt,
      };

      res.setHeader("Content-Disposition", `attachment; filename="${contract.name.replace(/\s+/g, "_")}_config.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/contracts/:ownerAddress", async (req, res) => {
    try {
      const { ownerAddress } = req.params;
      const result = await storage.getContractsByOwner(ownerAddress);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
