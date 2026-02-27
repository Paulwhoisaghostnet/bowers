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

export async function blockAddress(
  contractAddress: string,
  targetAddress: string,
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.block_address(targetAddress).send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function unblockAddress(
  contractAddress: string,
  targetAddress: string,
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.unblock_address(targetAddress).send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function setAdmin(
  contractAddress: string,
  newAdmin: string,
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.set_admin(newAdmin).send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function setMintPaused(
  contractAddress: string,
  tokenId: number,
  paused: boolean,
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.set_mint_paused({
      token_id: tokenId,
      paused,
    }).send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function setMintPrice(
  contractAddress: string,
  tokenId: number,
  priceMutez: number,
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.set_mint_price({
      token_id: tokenId,
      mint_price: priceMutez,
    }).send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}
