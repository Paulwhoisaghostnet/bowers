import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertContractSchema, mintRequestSchema, CONTRACT_STYLES, insertWalletSchema, insertBowerSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

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

  app.get("/api/contracts/user/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getContractsByUserId(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertContractSchema.parse({ ...req.body, userId });
      const contract = await storage.createContract(parsed);
      res.status(201).json(contract);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/contracts/:id/mint", isAuthenticated, async (req: any, res) => {
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
        contract: { address: contract.kt1Address, name: contract.name, symbol: contract.symbol, network: contract.network, owner: contract.ownerAddress },
        style: { id: contract.styleId, version: contract.styleVersion, name: style?.name || contract.styleId, features: style?.features || [] },
        capabilities: { royalties: contract.royaltiesEnabled, royaltyPercent: contract.royaltyPercent, minterAllowlist: contract.minterListEnabled, adminModel: contract.adminModel, metadataBaseUri: contract.metadataBaseUri },
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
      const result = await storage.getContractsByOwner(req.params.ownerAddress);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/wallets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getWalletsByUser(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/wallets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getWalletByAddress(req.body.address);
      if (existing) {
        if (existing.userId === userId) {
          return res.json(existing);
        }
        return res.status(400).json({ message: "This wallet is already linked to another account" });
      }
      const parsed = insertWalletSchema.parse({ ...req.body, userId });
      const wallet = await storage.addWallet(parsed);
      res.status(201).json(wallet);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/wallets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const removed = await storage.removeWallet(req.params.id, userId);
      if (!removed) return res.status(404).json({ message: "Wallet not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/wallets/:id/primary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallet = await storage.setPrimaryWallet(req.params.id, userId);
      if (!wallet) return res.status(404).json({ message: "Wallet not found" });
      res.json(wallet);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bowers", async (_req, res) => {
    try {
      const result = await storage.getPublicBowers();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bowers/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bower = await storage.getBowerByUserId(userId);
      res.json(bower || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bowers/:id", async (req, res) => {
    try {
      const bower = await storage.getBowerById(req.params.id);
      if (!bower) return res.status(404).json({ message: "Bower not found" });
      const user = await storage.getUserById(bower.userId);
      res.json({ ...bower, user });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bowers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.getBowerByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "You already have a bower. Update it instead." });
      }
      const parsed = insertBowerSchema.parse({ ...req.body, userId });
      const bower = await storage.createBower(parsed);
      res.status(201).json(bower);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/bowers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateBower(req.params.id, userId, req.body);
      if (!updated) return res.status(404).json({ message: "Bower not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/friends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getFriends(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/friends/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getPendingRequests(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/friends/request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { addresseeId } = req.body;
      if (!addresseeId) return res.status(400).json({ message: "addresseeId required" });
      if (addresseeId === userId) return res.status(400).json({ message: "Cannot friend yourself" });
      const friendship = await storage.sendFriendRequest(userId, addresseeId);
      res.status(201).json(friendship);
    } catch (err: any) {
      if (err.code === "23505") return res.status(400).json({ message: "Friend request already exists" });
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/friends/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.acceptFriendRequest(req.params.id, userId);
      if (!updated) return res.status(404).json({ message: "Request not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/friends/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const removed = await storage.removeFriendship(req.params.id, userId);
      if (!removed) return res.status(404).json({ message: "Friendship not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/followers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getFollowers(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/following", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getFollowing(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { followedId } = req.body;
      if (!followedId) return res.status(400).json({ message: "followedId required" });
      if (followedId === userId) return res.status(400).json({ message: "Cannot follow yourself" });
      const follower = await storage.followUser(userId, followedId);
      res.status(201).json(follower);
    } catch (err: any) {
      if (err.code === "23505") return res.status(400).json({ message: "Already following" });
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/follow/:followedId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const removed = await storage.unfollowUser(userId, req.params.followedId);
      if (!removed) return res.status(404).json({ message: "Not following" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const q = req.query.q as string;
      if (!q || q.length < 2) return res.json([]);
      const result = await storage.searchUsers(q, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
