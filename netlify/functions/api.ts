import serverless from "serverless-http";
import { createApp } from "../../server/app";

const FUNCTION_PREFIX = "/.netlify/functions/api";

let cachedHandler: ReturnType<typeof serverless> | undefined;

async function getHandler() {
  if (!cachedHandler) {
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'netlify/functions/api.ts:getHandler',message:'createApp starting',data:{hasDbUrl:!!process.env.DATABASE_URL,hasSessionSecret:!!process.env.SESSION_SECRET,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    try {
      const app = await createApp();
      // #region agent log
      fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'netlify/functions/api.ts:getHandler',message:'createApp succeeded',data:{},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      cachedHandler = serverless(app, {
        request: (req: any, _event: any) => {
          if (req.url.startsWith(FUNCTION_PREFIX)) {
            req.url = "/api" + req.url.slice(FUNCTION_PREFIX.length);
          }
        },
      });
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'netlify/functions/api.ts:getHandler',message:'createApp FAILED',data:{error:err?.message,stack:err?.stack?.slice(0,500)},timestamp:Date.now(),hypothesisId:'H1-H2-H4-H5'})}).catch(()=>{});
      // #endregion
      throw err;
    }
  }
  return cachedHandler;
}

export async function handler(event: any, context: any) {
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'netlify/functions/api.ts:handler',message:'function invoked',data:{path:event.path,rawUrl:event.rawUrl,httpMethod:event.httpMethod},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  const h = await getHandler();
  const result = await h(event, context);
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',location:'netlify/functions/api.ts:handler',message:'function result',data:{statusCode:(result as any)?.statusCode},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  return result;
}
