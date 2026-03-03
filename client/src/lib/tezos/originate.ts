import type { ContractStyle } from "@shared/schema";
import { loadTaquito, loadUtils } from "./loaders";
import { getTezos, getCurrentNetwork } from "./wallet";

export interface OriginateParams {
  name: string;
  symbol: string;
  admin: string;
  royaltiesEnabled: boolean;
  royaltyPercent: number;
  minterListEnabled: boolean;
  metadataBaseUri: string;
  style: ContractStyle;
}

const BOWERS_STYLE_IDS = [
  "bowers-marketplace",
  "bowers-open-edition",
  "bowers-allowlist",
  "bowers-bonding-curve",
  "bowers-unified",
  "bowers-mint-oe",
  "bowers-mint-allowlist",
  "bowers-mint-bonding-curve",
];

export async function buildFA2Storage(params: OriginateParams) {
  const { MichelsonMap } = await loadTaquito();
  const { stringToBytes } = await loadUtils();

  const ledger = new MichelsonMap();
  const operators = new MichelsonMap();
  const tokenMetadata = new MichelsonMap();

  const contractMetadata = new MichelsonMap();
  const tzip16Meta = JSON.stringify({
    name: params.name,
    description: `${params.name} - FA2 NFT Collection deployed via Bowers`,
    version: params.style.version,
    interfaces: ["TZIP-012", "TZIP-016"],
    authors: [params.admin],
  });
  contractMetadata.set("", stringToBytes("tezos-storage:content"));
  contractMetadata.set("content", stringToBytes(tzip16Meta));

  const styleId = params.style.id;
  if (!BOWERS_STYLE_IDS.includes(styleId)) {
    throw new Error(`Unknown contract style: ${styleId}`);
  }
  return buildBowersStorage(params, styleId, ledger, operators, tokenMetadata, contractMetadata);
}

async function buildBowersStorage(
  params: OriginateParams,
  styleId: string,
  ledger: any,
  operators: any,
  tokenMetadata: any,
  contractMetadata: any,
) {
  const { MichelsonMap } = await loadTaquito();

  const isMintOnly =
    styleId === "bowers-mint-oe" ||
    styleId === "bowers-mint-allowlist" ||
    styleId === "bowers-mint-bonding-curve";

  const storage: Record<string, any> = {
    admin: params.admin,
    ledger,
    token_metadata: tokenMetadata,
    operators,
    next_token_id: 0,
    claimable: new MichelsonMap(),
    contract_blocklist: new MichelsonMap(),
    metadata: contractMetadata,
  };

  if (!isMintOnly) {
    storage.listings = new MichelsonMap();
    storage.offers = new MichelsonMap();
    storage.next_offer_id = 0;
    storage.blacklist = new MichelsonMap();
  }

  if (styleId === "bowers-marketplace") {
    storage.token_market = new MichelsonMap();
  }

  if (
    styleId === "bowers-open-edition" ||
    styleId === "bowers-allowlist" ||
    styleId === "bowers-bonding-curve" ||
    styleId === "bowers-unified" ||
    isMintOnly
  ) {
    storage.token_config = new MichelsonMap();
  }

  if (styleId === "bowers-allowlist" || styleId === "bowers-unified" || styleId === "bowers-mint-allowlist") {
    storage.token_allowlist = new MichelsonMap();
  }

  return storage;
}

export interface OriginationEstimate {
  gasLimit: number;
  storageLimit: number;
  suggestedFeeMutez: number;
  burnFeeMutez: number;
  totalCostTez: string;
}

const GAS_BUFFER = 1.5;
const STORAGE_BUFFER = 1.5;
const MIN_GAS_ORIGINATE = 10_000;
const MAX_STORAGE_ORIGINATE = 60_000;
const FALLBACK_ESTIMATE: OriginationEstimate = {
  gasLimit: 300_000,
  storageLimit: 20_000,
  suggestedFeeMutez: 15_000,
  burnFeeMutez: 5_000,
  totalCostTez: "0.020000",
};

const EXPECTED_CHAIN_IDS: Record<string, string> = {
  shadownet: "NetXsqzbfFenSTS",
  mainnet: "NetXdQprcVkpaWU",
};

async function verifyNetwork(tezos: any, expectedNetwork: string): Promise<void> {
  const expectedChainId = EXPECTED_CHAIN_IDS[expectedNetwork];
  if (!expectedChainId) return;

  try {
    const actualChainId = await tezos.rpc.getChainId();
    if (actualChainId !== expectedChainId) {
      const actualName = Object.entries(EXPECTED_CHAIN_IDS)
        .find(([, id]) => id === actualChainId)?.[0] ?? "unknown";
      throw new Error(
        `Network mismatch: app is set to ${expectedNetwork} but your wallet/RPC ` +
        `is on ${actualName} (chain ${actualChainId}). ` +
        `Please switch your wallet to ${expectedNetwork} and try again.`,
      );
    }
  } catch (err: any) {
    if (err.message?.includes("Network mismatch")) throw err;
    console.warn("[Bowers] Could not verify chain ID:", err);
  }
}

function isRpcSimulationFailure(err: any): boolean {
  const message = String(err?.message || err || "");
  return (
    message.includes("gas_limit_too_high") ||
    message.includes("gas_exhausted.block") ||
    message.includes("Http error response: (500)") ||
    message.includes("Failed to fetch")
  );
}

/**
 * Estimate the gas, storage, and fee cost of originating a contract
 * without actually sending it. BeaconSigner provides the publicKeyHash()
 * and publicKey() that Taquito's estimator needs.
 */
export async function estimateOrigination(params: OriginateParams): Promise<OriginationEstimate> {
  const t = await getTezos();
  await verifyNetwork(t, getCurrentNetwork());
  const { getCode } = await import("./michelson");

  const storage = await buildFA2Storage(params);
  const code = getCode(params.style.id);
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run1',hypothesisId:'H3',location:'originate.ts:130',message:'estimateOrigination start',data:{styleId:params.style.id,codeLength:Array.isArray(code)?code.length:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  let estimate: any;
  try {
    estimate = await t.estimate.originate({ code, storage });
  } catch (err: any) {
    if (isRpcSimulationFailure(err)) {
      console.warn("[Bowers] Estimation RPC failed; using fallback estimate.", err?.message || err);
      return FALLBACK_ESTIMATE;
    }
    throw err;
  }

  const gasLimit = Math.max(Math.ceil(estimate.gasLimit * GAS_BUFFER), MIN_GAS_ORIGINATE);
  const storageLimit = Math.min(Math.ceil(estimate.storageLimit * STORAGE_BUFFER), MAX_STORAGE_ORIGINATE);
  const suggestedFeeMutez = estimate.suggestedFeeMutez;
  const burnFeeMutez = estimate.burnFeeMutez;
  const totalCostMutez = suggestedFeeMutez + burnFeeMutez;
  const totalCostTez = (totalCostMutez / 1_000_000).toFixed(6);
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run1',hypothesisId:'H3',location:'originate.ts:141',message:'estimateOrigination success',data:{rawGas:estimate.gasLimit,rawStorage:estimate.storageLimit,bufferedGas:gasLimit,bufferedStorage:storageLimit,suggestedFeeMutez},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { gasLimit, storageLimit, suggestedFeeMutez, burnFeeMutez, totalCostTez };
}

/**
 * Originate a contract via Taquito's Wallet API (canonical approach from
 * https://taquito.io/docs/24.0.0/originate). The connected wallet (Temple,
 * Kukai, etc.) handles gas estimation and signing via Beacon's
 * requestOperation.
 *
 * Known issue: Kukai wallet on protocol 024 (Tallinn) has a bug where its
 * internal simulate_operation call uses gas_limit=0, which the protocol
 * rejects. If this happens, the user should reconnect with Temple wallet.
 */
export async function originateContract(params: OriginateParams): Promise<string> {
  const t = await getTezos();
  await verifyNetwork(t, getCurrentNetwork());
  const { getCode } = await import("./michelson");

  const storage = await buildFA2Storage(params);
  const code = getCode(params.style.id);

  try {
    const originationOp = await t.wallet
      .originate({ code, storage })
      .send();

    console.log(`[Bowers] Waiting for confirmation of origination...`);
    const contract = await originationOp.contract();
    const contractAddress = contract.address;

    if (!contractAddress || !contractAddress.startsWith("KT1")) {
      throw new Error(
        `Contract originated (op: ${originationOp.opHash}) but KT1 address not found. ` +
          `Check the operation on a block explorer.`,
      );
    }

    return contractAddress;
  } catch (err: any) {
    const isAbort =
      err?.errorType === "ABORTED_ERROR" ||
      err?.message?.includes("Aborted");
    const isUnknown = err?.errorType === "UNKNOWN_ERROR";

    if (isAbort || isUnknown) {
      throw new Error(
        "Contract deployment failed in wallet. " +
          "Kukai wallet has a known issue with contract origination on the current Tezos protocol. " +
          "Please disconnect and reconnect using Temple wallet (browser extension) to deploy contracts.",
      );
    }

    if (err?.errorType) {
      throw new Error(`Wallet error: ${err.errorType}${err.description ? ` — ${err.description}` : ""}`);
    }

    throw err;
  }
}
