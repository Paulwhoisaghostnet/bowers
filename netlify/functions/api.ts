import serverless from "serverless-http";
import { createApp } from "../../server/app";

let cachedHandler: ReturnType<typeof serverless> | undefined;

async function getHandler() {
  if (!cachedHandler) {
    const app = await createApp();
    cachedHandler = serverless(app);
  }
  return cachedHandler;
}

export async function handler(event: any, context: any) {
  const h = await getHandler();
  return h(event, context);
}
