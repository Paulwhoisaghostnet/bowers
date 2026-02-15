import { loadTaquito, loadUtils } from "./loaders";
import { getTezos } from "./wallet";

export interface MintParams {
  contractAddress: string;
  tokenId: number;
  tokenName: string;
  description: string;
  artifactUri: string;
  displayUri: string;
  thumbnailUri: string;
  attributes: string;
  owner: string;
}

export async function mintToken(params: MintParams): Promise<string> {
  const t = await getTezos();
  const { MichelsonMap } = await loadTaquito();
  const { char2Bytes } = await loadUtils();

  try {
    const contract = await t.wallet.at(params.contractAddress);

    const tokenInfo = new MichelsonMap();
    tokenInfo.set("name", char2Bytes(params.tokenName));
    tokenInfo.set("description", char2Bytes(params.description || ""));
    tokenInfo.set("artifactUri", char2Bytes(params.artifactUri));
    if (params.displayUri) {
      tokenInfo.set("displayUri", char2Bytes(params.displayUri));
    }
    if (params.thumbnailUri) {
      tokenInfo.set("thumbnailUri", char2Bytes(params.thumbnailUri));
    }
    tokenInfo.set("decimals", char2Bytes("0"));

    if (params.attributes && params.attributes !== "[]") {
      tokenInfo.set("attributes", char2Bytes(params.attributes));
    }

    const op = await contract.methods.mint(
      params.owner,
      params.tokenId,
      tokenInfo,
      1
    ).send();

    await op.confirmation(1);
    return op.opHash;
  } catch (err: any) {
    if (err.message?.includes("Aborted")) {
      throw new Error("Transaction was rejected in wallet");
    }
    throw err;
  }
}
