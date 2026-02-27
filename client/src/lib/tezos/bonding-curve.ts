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

export async function createBondingCurveToken(
  contractAddress: string,
  metadataUri: string,
  creator: string,
  basePriceMutez: number,
  priceIncrementMutez: number,
  stepSize: number,
  maxSupply: number,
  mintEnd: string | null,
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
        base_price: basePriceMutez,
        price_increment: priceIncrementMutez,
        step_size: stepSize,
        max_supply: maxSupply,
        mint_end: mintEnd,
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

export async function mintBondingCurveEditions(
  contractAddress: string,
  tokenId: number,
  qty: number,
  toAddress: string,
  totalPriceMutez: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .mint_editions({
        token_id: tokenId,
        qty,
        to_: toAddress,
      })
      .send({ amount: totalPriceMutez, mutez: true });
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}
