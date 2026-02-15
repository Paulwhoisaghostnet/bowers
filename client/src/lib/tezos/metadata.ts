import { loadTaquito, loadTzip12, loadTzip16, loadMichelCodec } from "./loaders";
import { getTezos } from "./wallet";

export async function getTokenMetadata(contractAddress: string, tokenId: number) {
  const t = await getTezos();
  const { tzip12 } = await loadTzip12();
  const { compose } = await loadTaquito();
  const { tzip16 } = await loadTzip16();

  try {
    const contract = await t.wallet.at(contractAddress, compose(tzip12, tzip16));
    const metadata = await contract.tzip12().getTokenMetadata(tokenId);
    return metadata;
  } catch (err: any) {
    console.error("Failed to fetch token metadata:", err.message);
    return null;
  }
}

export async function getContractMetadata(contractAddress: string) {
  const t = await getTezos();
  const { tzip16 } = await loadTzip16();

  try {
    const contract = await t.wallet.at(contractAddress, tzip16);
    const metadata = await contract.tzip16().getMetadata();
    return metadata;
  } catch (err: any) {
    console.error("Failed to fetch contract metadata:", err.message);
    return null;
  }
}

export async function parseMichelson(code: string) {
  const { Parser, emitMicheline } = await loadMichelCodec();
  const p = new Parser();
  const parsed = p.parseScript(code);
  return { parsed, micheline: parsed ? emitMicheline(parsed) : null };
}
