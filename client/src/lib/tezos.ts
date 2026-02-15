import type { ContractStyle } from "@shared/schema";

let tezosModule: any = null;
let beaconModule: any = null;
let walletModule: any = null;
let michelCodecModule: any = null;
let tzip12Mod: any = null;
let tzip16Mod: any = null;
let taquitoUtils: any = null;

let tezos: any = null;
let wallet: any = null;

const RPC_URLS: Record<string, string> = {
  ghostnet: "https://ghostnet.ecadinfra.com",
  mainnet: "https://mainnet.ecadinfra.com",
};

async function loadTaquito() {
  if (!tezosModule) {
    tezosModule = await import("@taquito/taquito");
  }
  return tezosModule;
}

async function loadBeaconWallet() {
  if (!walletModule) {
    walletModule = await import("@taquito/beacon-wallet");
  }
  if (!beaconModule) {
    beaconModule = await import("@airgap/beacon-sdk");
  }
  return { walletModule, beaconModule };
}

async function loadMichelCodec() {
  if (!michelCodecModule) {
    michelCodecModule = await import("@taquito/michel-codec");
  }
  return michelCodecModule;
}

async function loadTzip12() {
  if (!tzip12Mod) {
    tzip12Mod = await import("@taquito/tzip12");
  }
  return tzip12Mod;
}

async function loadTzip16() {
  if (!tzip16Mod) {
    tzip16Mod = await import("@taquito/tzip16");
  }
  return tzip16Mod;
}

async function loadUtils() {
  if (!taquitoUtils) {
    taquitoUtils = await import("@taquito/utils");
  }
  return taquitoUtils;
}

async function getTezos(network: string = "ghostnet") {
  if (!tezos) {
    const { TezosToolkit } = await loadTaquito();
    tezos = new TezosToolkit(RPC_URLS[network] || RPC_URLS.ghostnet);

    const { Tzip12Module } = await loadTzip12();
    const { Tzip16Module } = await loadTzip16();
    tezos.addExtension(new Tzip12Module());
    tezos.addExtension(new Tzip16Module());
  }
  return tezos;
}

async function getWallet() {
  if (!wallet) {
    const { BeaconWallet } = (await loadBeaconWallet()).walletModule;
    const { NetworkType } = (await loadBeaconWallet()).beaconModule;
    wallet = new BeaconWallet({
      name: "MintCapsule",
      preferredNetwork: NetworkType.GHOSTNET,
    });
  }
  return wallet;
}

export async function connectWallet(): Promise<string> {
  const { NetworkType } = (await loadBeaconWallet()).beaconModule;
  const w = await getWallet();
  await w.requestPermissions({
    network: {
      type: NetworkType.GHOSTNET,
      rpcUrl: RPC_URLS.ghostnet,
    },
  });
  const t = await getTezos();
  t.setWalletProvider(w);
  const address = await w.getPKH();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  const w = await getWallet();
  await w.clearActiveAccount();
  tezos = null;
  wallet = null;
}

export async function getActiveAccount(): Promise<string | null> {
  try {
    const w = await getWallet();
    const account = await w.client.getActiveAccount();
    if (account) {
      const t = await getTezos();
      t.setWalletProvider(w);
      return account.address;
    }
    return null;
  } catch {
    return null;
  }
}

export function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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

async function buildFA2Storage(params: OriginateParams) {
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
  const { getFA2Michelson, validateMichelson } = await import("./fa2-michelson");

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
