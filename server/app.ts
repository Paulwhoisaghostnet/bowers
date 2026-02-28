import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { seedDatabase } from "./seed";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https:",
            "https://gateway.pinata.cloud",
            "https://*.pinata.cloud",
            "https://ipfs.io",
          ],
          connectSrc: [
            "'self'",
            "https://*.tezos.marigold.dev",
            "https://ghostnet.ecadinfra.com",
            "https://mainnet.ecadinfra.com",
            "https://ghostnet.smartpy.io",
            "https://ghostnet.tzkt.io",
            "https://tzkt.io",
            "https://fonts.googleapis.com",
            "https://fonts.gstatic.com",
            "wss://relay.walletconnect.com",
            "wss://relay.walletconnect.org",
            "https://relay.walletconnect.com",
            "https://relay.walletconnect.org",
            "https://wallet.kukai.app",
            "https://*.kukai.app",
            "https://*.matrix.org",
            "wss://*.matrix.org",
            "https://*.papers.tech",
            "wss://*.papers.tech",
            "https://api.pinata.cloud",
            "https://gateway.pinata.cloud",
            "https://*.pinata.cloud",
            "https://ipfs.io",
            "https://api.ghostnet.tzkt.io",
            "https://api.tzkt.io",
            "https://api.mainnet.tzkt.io",
          ],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          frameSrc: [
            "'self'",
            "https://walletconnect.com",
            "https://*.walletconnect.com",
            "https://*.walletconnect.org",
            "https://beacon-wallet.app",
            "https://wallet.kukai.app",
            "https://*.kukai.app",
          ],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV !== "production") return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  });

  await seedDatabase().catch((err) => console.error("Seed error:", err));
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return app;
}
