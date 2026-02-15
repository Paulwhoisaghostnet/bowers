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

export async function buildFA2Storage(params: OriginateParams) {
  const { MichelsonMap } = await loadTaquito();
  const { char2Bytes } = await loadUtils();

  const ledger = new MichelsonMap();
  const operators = new MichelsonMap();
  const tokenMetadata = new MichelsonMap();

  const contractMetadata = new MichelsonMap();
  const tzip16Meta = JSON.stringify({
    name: params.name,
    description: `${params.name} - FA2 NFT Collection deployed via MintCapsule`,
    version: params.style.version,
    interfaces: ["TZIP-012", "TZIP-016"],
    authors: [params.admin],
  });
  contractMetadata.set("", char2Bytes("tezos-storage:content"));
  contractMetadata.set("content", char2Bytes(tzip16Meta));

  const styleId = params.style.id;
  const hasMultiMinter = styleId === "fa2-multiminter" || styleId === "fa2-full";
  const hasRoyalties = styleId === "fa2-royalties" || styleId === "fa2-full";
  const hasPause = styleId === "fa2-full";

  const storage: Record<string, any> = {
    admin: params.admin,
    next_token_id: 0,
    ledger,
    operators,
    token_metadata: tokenMetadata,
    metadata: contractMetadata,
  };

  if (hasMultiMinter) {
    const minters = new MichelsonMap();
    minters.set(params.admin, true);
    storage.minters = minters;
  }

  if (hasRoyalties) {
    const royalties = new MichelsonMap();
    storage.royalties = royalties;
  }

  if (hasPause) {
    storage.paused = false;
  }

  return storage;
}

export async function originateContract(params: OriginateParams): Promise<string> {
  const t = await getTezos();
  const { getFA2Michelson, validateMichelson } = await import("../fa2");

  const validation = validateMichelson(params.style.id);
  if (!validation.valid) {
    throw new Error(`Contract validation failed: ${validation.errors.join(", ")}`);
  }

  try {
    const code = getFA2Michelson(params.style.id);
    const storage = await buildFA2Storage(params);

    const op = await t.wallet.originate({
      code,
      storage,
    }).send();

    const result = await op.confirmation(1);
    const contractAddress = (result as any)?.contractAddress ||
      op.opHash?.replace(/^o/, "KT1");

    if (!contractAddress) {
      throw new Error("Could not retrieve contract address from origination");
    }

    return contractAddress;
  } catch (err: any) {
    if (err.message?.includes("Aborted")) {
      throw new Error("Transaction was rejected in wallet");
    }
    throw err;
  }
}
