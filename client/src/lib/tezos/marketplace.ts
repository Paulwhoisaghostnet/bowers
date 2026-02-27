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

export async function setListing(
  contractAddress: string,
  tokenId: number,
  priceMutez: number,
  maxQty: number,
  minBps: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .set_listing({
        token_id: tokenId,
        price: priceMutez,
        max_qty: maxQty,
        min_bps: minBps,
      })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function cancelListing(
  contractAddress: string,
  tokenId: number
): Promise<string> {
  return setListing(contractAddress, tokenId, 0, 0, 0);
}

export async function buy(
  contractAddress: string,
  owner: string,
  tokenId: number,
  qty: number,
  totalPriceMutez: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .buy({ owner, token_id: tokenId, qty })
      .send({ amount: totalPriceMutez, mutez: true });
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function makeOffer(
  contractAddress: string,
  tokenId: number,
  qty: number,
  expiryIso: string,
  totalAmountMutez: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .make_offer({
        token_id: tokenId,
        qty,
        expiry: expiryIso,
      })
      .send({ amount: totalAmountMutez, mutez: true });
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function acceptOffer(
  contractAddress: string,
  offerId: number,
  acceptQty: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .accept_offer({ offer_id: offerId, accept_qty: acceptQty })
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function closeOffer(
  contractAddress: string,
  offerId: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .close_offer(offerId)
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function withdraw(
  contractAddress: string
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject.withdraw().send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}

export async function transfer(
  contractAddress: string,
  fromAddress: string,
  toAddress: string,
  tokenId: number,
  amount: number
): Promise<string> {
  try {
    const contract = await getContract(contractAddress);
    const op = await contract.methodsObject
      .transfer([
        {
          from_: fromAddress,
          txs: [{ to_: toAddress, token_id: tokenId, amount }],
        },
      ])
      .send();
    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    handleTxError(err);
  }
}
