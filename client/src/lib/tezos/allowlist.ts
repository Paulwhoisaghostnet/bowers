import { loadUtils } from "./loaders";
import { getTezos } from "./wallet";

async function getContract(address: string) {
  const t = await getTezos();
  return t.wallet.at(address);
}

function handleTxError(err: any): never {
  if (err.message?.includes("Aborted")) {
    throw new Error("Transaction was rejected in wallet");
  }
  throw err;
}

export interface AllowlistEntry {
  address: string;
  max_qty: number;
  price_override: number | null;
}

export async function setAllowlist(
  contractAddress: string,
  tokenId: number,
  entries: AllowlistEntry[]
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .set_allowlist({
        token_id: tokenId,
        entries: entries.map((e) => ({
          address: e.address,
          max_qty: e.max_qty,
          price_override: e.price_override,
        })),
      })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function clearAllowlist(
  contractAddress: string,
  tokenId: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.clear_allowlist(tokenId).send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function setAllowlistEnd(
  contractAddress: string,
  tokenId: number,
  allowlistEnd: string | null
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .set_allowlist_end({
        token_id: tokenId,
        allowlist_end: allowlistEnd,
      })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function createAllowlistToken(
  contractAddress: string,
  metadataUri: string,
  creator: string,
  mintPriceMutez: number,
  mintEnd: string | null,
  maxSupply: number | null,
  allowlistEnd: string | null,
  royaltyRecipient: string,
  royaltyBps: number,
  minOfferPerUnitMutez: number,
): Promise<string> {
  try {
    const { stringToBytes } = await loadUtils();
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .create_token({
        metadata_uri: stringToBytes(metadataUri),
        creator,
        mint_price: mintPriceMutez,
        mint_end: mintEnd,
        max_supply: maxSupply,
        allowlist_end: allowlistEnd,
        royalty_recipient: royaltyRecipient,
        royalty_bps: royaltyBps,
        min_offer_per_unit_mutez: minOfferPerUnitMutez,
      })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}
