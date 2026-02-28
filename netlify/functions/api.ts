import serverless from "serverless-http";
import { createApp } from "../../server/app";

const FUNCTION_PREFIX = "/.netlify/functions/api";

let cachedHandler: ReturnType<typeof serverless> | undefined;

async function getHandler() {
  if (!cachedHandler) {
    const app = await createApp();
    cachedHandler = serverless(app, {
      request: (req: any, _event: any) => {
        if (req.url.startsWith(FUNCTION_PREFIX)) {
          req.url = "/api" + req.url.slice(FUNCTION_PREFIX.length);
        }
      },
    });
  }
  return cachedHandler;
}

export async function handler(event: any, context: any) {
  const h = await getHandler();
  return h(event, context);
}
