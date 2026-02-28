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
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'server/app.ts:createApp:start',message:'createApp entered',data:{hasDbUrl:!!process.env.DATABASE_URL,hasSessionSecret:!!process.env.SESSION_SECRET,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
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

  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'server/app.ts:createApp:preSeed',message:'about to seed and register routes',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  await seedDatabase().catch((err) => {
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'server/app.ts:createApp:seedFail',message:'seed failed',data:{error:err?.message},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    console.error("Seed error:", err);
  });
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'server/app.ts:createApp:preRoutes',message:'seed done, registering routes',data:{},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
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
