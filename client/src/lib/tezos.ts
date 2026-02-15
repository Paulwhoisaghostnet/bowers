import type { ContractStyle } from "@shared/schema";

let tezosModule: any = null;
let beaconModule: any = null;
let walletModule: any = null;

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

async function getTezos(network: string = "ghostnet") {
  if (!tezos) {
    const { TezosToolkit } = await loadTaquito();
    tezos = new TezosToolkit(RPC_URLS[network] || RPC_URLS.ghostnet);
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

function buildFA2Storage(params: OriginateParams) {
  const admin = params.admin;
  return `(Pair (Pair "${admin}" (Pair ${params.minterListEnabled ? `{Elt "${admin}" True}` : "{}"} 0))
          (Pair (Pair {} {})
                (Pair {} (Pair "${params.metadataBaseUri || ""}" "${params.symbol}"))))`;
}

export async function originateContract(params: OriginateParams): Promise<string> {
  const t = await getTezos();

  try {
    const storage = buildFA2Storage(params);

    const op = await t.wallet.originate({
      code: FA2_MICHELSON_STUB,
      init: storage,
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

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function mintToken(params: MintParams): Promise<string> {
  const t = await getTezos();

  try {
    const contract = await t.wallet.at(params.contractAddress);

    const metadata = new Map<string, string>();
    metadata.set("name", toHex(params.tokenName));
    metadata.set("description", toHex(params.description || ""));
    metadata.set("artifactUri", toHex(params.artifactUri));
    if (params.displayUri) {
      metadata.set("displayUri", toHex(params.displayUri));
    }
    if (params.thumbnailUri) {
      metadata.set("thumbnailUri", toHex(params.thumbnailUri));
    }

    const op = await contract.methods.mint(
      params.owner,
      params.tokenId,
      metadata,
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

const FA2_MICHELSON_STUB = [
  { prim: "parameter", args: [{ prim: "or", args: [
    { prim: "pair", annots: ["%mint"], args: [
      { prim: "address" }, { prim: "pair", args: [
        { prim: "nat" }, { prim: "pair", args: [
          { prim: "map", args: [{ prim: "string" }, { prim: "bytes" }] },
          { prim: "nat" }
        ]}
      ]}
    ]},
    { prim: "or", args: [
      { prim: "list", annots: ["%transfer"], args: [{ prim: "pair", args: [
        { prim: "address" }, { prim: "list", args: [{ prim: "pair", args: [
          { prim: "address" }, { prim: "pair", args: [{ prim: "nat" }, { prim: "nat" }] }
        ]}] }
      ]}] },
      { prim: "list", annots: ["%update_operators"], args: [{ prim: "or", args: [
        { prim: "pair", annots: ["%add_operator"], args: [
          { prim: "address" }, { prim: "pair", args: [{ prim: "address" }, { prim: "nat" }] }
        ]},
        { prim: "pair", annots: ["%remove_operator"], args: [
          { prim: "address" }, { prim: "pair", args: [{ prim: "address" }, { prim: "nat" }] }
        ]}
      ]}] }
    ]}
  ]}] },
  { prim: "storage", args: [{ prim: "pair", args: [
    { prim: "pair", args: [
      { prim: "address", annots: ["%admin"] },
      { prim: "pair", args: [
        { prim: "big_map", annots: ["%minters"], args: [{ prim: "address" }, { prim: "bool" }] },
        { prim: "nat", annots: ["%next_token_id"] }
      ]}
    ]},
    { prim: "pair", args: [
      { prim: "pair", args: [
        { prim: "big_map", annots: ["%ledger"], args: [{ prim: "pair", args: [{ prim: "address" }, { prim: "nat" }] }, { prim: "nat" }] },
        { prim: "big_map", annots: ["%operators"], args: [
          { prim: "pair", args: [{ prim: "address" }, { prim: "pair", args: [{ prim: "address" }, { prim: "nat" }] }] },
          { prim: "unit" }
        ]}
      ]},
      { prim: "pair", args: [
        { prim: "big_map", annots: ["%token_metadata"], args: [{ prim: "nat" }, { prim: "pair", args: [{ prim: "nat" }, { prim: "map", args: [{ prim: "string" }, { prim: "bytes" }] }] }] },
        { prim: "pair", args: [
          { prim: "string", annots: ["%metadata_base_uri"] },
          { prim: "string", annots: ["%symbol"] }
        ]}
      ]}
    ]}
  ]}] },
  { prim: "code", args: [[
    { prim: "FAILWITH" }
  ]] }
];
