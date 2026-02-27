import { loadTaquito, loadUtils } from "./loaders";
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

export async function createToken(
  contractAddress: string,
  metadataUri: string,
  creator: string,
  mintPriceMutez: number,
  mintEnd: string | null,
  maxSupply: number | null
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
      })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function mintEditions(
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

export async function setMintPrice(
  contractAddress: string,
  tokenId: number,
  mintPriceMutez: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .set_mint_price({ token_id: tokenId, mint_price: mintPriceMutez })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function setMintPaused(
  contractAddress: string,
  tokenId: number,
  paused: boolean
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .set_mint_paused({ token_id: tokenId, paused })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function setMintEnd(
  contractAddress: string,
  tokenId: number,
  mintEnd: string | null
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .set_mint_end({ token_id: tokenId, mint_end: mintEnd })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}
