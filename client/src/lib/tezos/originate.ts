import type { ContractStyle } from "@shared/schema";
import { loadTaquito, loadUtils } from "./loaders";
import { getTezos } from "./wallet";

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

const GAS_BUFFER = 1.2;
const STORAGE_BUFFER = 1.2;

/**
 * Estimate the gas, storage, and fee cost of originating a contract
 * without actually sending it. Returns values with a safety buffer applied.
 */
export async function estimateOrigination(params: OriginateParams): Promise<OriginationEstimate> {
  const t = await getTezos();
  const { getCode } = await import("./michelson");

  const storage = await buildFA2Storage(params);
  const code = getCode(params.style.id);

  const estimate = await t.estimate.originate({ code, storage });

  const gasLimit = Math.ceil(estimate.gasLimit * GAS_BUFFER);
  const storageLimit = Math.ceil(estimate.storageLimit * STORAGE_BUFFER);
  const suggestedFeeMutez = estimate.suggestedFeeMutez;
  const burnFeeMutez = estimate.burnFeeMutez;
  const totalCostMutez = suggestedFeeMutez + burnFeeMutez;
  const totalCostTez = (totalCostMutez / 1_000_000).toFixed(6);

  return { gasLimit, storageLimit, suggestedFeeMutez, burnFeeMutez, totalCostTez };
}

export async function originateContract(params: OriginateParams): Promise<string> {
  const t = await getTezos();
  const { getCode } = await import("./michelson");

  try {
    const storage = await buildFA2Storage(params);
    const code = getCode(params.style.id);

    const est = await t.estimate.originate({ code, storage });
    const gasLimit = Math.ceil(est.gasLimit * GAS_BUFFER);
    const storageLimit = Math.ceil(est.storageLimit * STORAGE_BUFFER);
    const fee = est.suggestedFeeMutez;

    const op = await t.wallet.originate({
      code,
      storage,
      gasLimit,
      storageLimit,
      fee,
      mutez: true,
    }).send();

    await op.confirmation(1);

    const contractAddress =
      (op as any).contractAddress ??
      (op as any).operationResults?.[0]?.metadata?.operation_result?.originated_contracts?.[0];

    if (!contractAddress || !contractAddress.startsWith("KT1")) {
      const receipt = await t.rpc.getBlock();
      for (const ops of receipt.operations) {
        for (const entry of ops) {
          if (entry.hash === op.opHash) {
            const originated = (entry as any).contents?.[0]?.metadata?.operation_result?.originated_contracts?.[0];
            if (originated) return originated;
          }
        }
      }
      throw new Error(
        `Contract originated (op: ${op.opHash}) but could not retrieve KT1 address. ` +
        `Check the operation on a block explorer.`
      );
    }

    return contractAddress;
  } catch (err: any) {
    if (err.message?.includes("Aborted")) {
      throw new Error("Transaction was rejected in wallet");
    }
    throw err;
  }
}
