import { loadUtils } from "./loaders";
import { getTezos } from "./wallet";

export interface MintParams {
  contractAddress: string;
  styleId: string;
  tokenName: string;
  description: string;
  artifactUri: string;
  displayUri: string;
  thumbnailUri: string;
  mimeType: string;
  editions: number;
  creators: string[];
  tags: string[];
  attributes: string;
  owner: string;
  royaltyRecipient: string;
  royaltyBps: number;
  minOfferPerUnitMutez: number;
  mintPriceMutez?: number;
  mintEnd?: string | null;
  maxSupply?: number | null;
}

const CREATE_TOKEN_STYLES = [
  "bowers-open-edition",
  "bowers-allowlist",
  "bowers-bonding-curve",
  "bowers-unified",
  "bowers-mint-oe",
  "bowers-mint-allowlist",
  "bowers-mint-bonding-curve",
];

export async function mintToken(params: MintParams): Promise<string> {
  const t = await getTezos();
  const { stringToBytes } = await loadUtils();

  try {
    const contract = await t.wallet.at(params.contractAddress);
    const metadataUri = params.artifactUri || `ipfs://${params.tokenName}`;
    const editions = params.editions > 0 ? params.editions : 1;

    if (CREATE_TOKEN_STYLES.includes(params.styleId)) {
      return await mintViaCreateToken(contract, params, metadataUri, editions, stringToBytes);
    }

    if (params.styleId === "bowers-marketplace") {
      return await mintViaAdminMint(contract, params, metadataUri, editions, stringToBytes);
    }

    const op = await contract.methodsObject.mint({
      metadata_uri: stringToBytes(metadataUri),
      supply: editions,
      royalty_recipient: params.royaltyRecipient,
      royalty_bps: params.royaltyBps,
      min_offer_per_unit_mutez: params.minOfferPerUnitMutez,
    }).send();

    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    if (err.message?.includes("Aborted")) {
      throw new Error("Transaction was rejected in wallet");
    }
    throw err;
  }
}

async function mintViaCreateToken(
  contract: any,
  params: MintParams,
  metadataUri: string,
  editions: number,
  stringToBytes: (s: string) => string,
): Promise<string> {
  const isBondingCurve =
    params.styleId === "bowers-bonding-curve" ||
    params.styleId === "bowers-mint-bonding-curve";

  const isAllowlist =
    params.styleId === "bowers-allowlist" ||
    params.styleId === "bowers-mint-allowlist";

  const createParams: Record<string, any> = {
    metadata_uri: stringToBytes(metadataUri),
    creator: params.owner,
    royalty_recipient: params.royaltyRecipient,
    royalty_bps: params.royaltyBps,
  };

  if (isBondingCurve) {
    createParams.base_price = params.mintPriceMutez ?? 1_000_000;
    createParams.price_increment = 100_000;
    createParams.step_size = 10;
    createParams.max_supply = params.maxSupply ?? 100;
    createParams.mint_end = params.mintEnd ?? null;
  } else {
    createParams.mint_price = params.mintPriceMutez ?? 0;
    createParams.mint_end = params.mintEnd ?? null;
    createParams.max_supply = params.maxSupply ?? null;
  }

  if (isAllowlist) {
    createParams.allowlist_end = null;
  }

  const batch = contract.methods.create_token(createParams);
  const createOp = await batch.send();
  await createOp.confirmation(1);

  if (editions > 0 && params.mintPriceMutez === 0) {
    const mintOp = await contract.methodsObject.mint_editions({
      token_id: 0,
      qty: editions,
      to_: params.owner,
    }).send();
    await mintOp.confirmation(1);
    return mintOp.opHash;
  }

  return createOp.opHash;
}

async function mintViaAdminMint(
  contract: any,
  params: MintParams,
  metadataUri: string,
  editions: number,
  stringToBytes: (s: string) => string,
): Promise<string> {
  const op = await contract.methodsObject.mint({
    metadata_uri: stringToBytes(metadataUri),
    supply: editions,
    royalty_recipient: params.royaltyRecipient,
    royalty_bps: params.royaltyBps,
    min_offer_per_unit_mutez: params.minOfferPerUnitMutez,
  }).send();

  await op.confirmation(1);
  return op.opHash;
}
