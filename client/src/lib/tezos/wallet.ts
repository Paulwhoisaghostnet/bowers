import { loadTaquito, loadOctezConnect, loadBeaconWallet, loadTzip12, loadTzip16, loadUtils, RPC_URLS } from "./loaders";

export type WalletProviderName = "octez.connect" | "beacon";

interface WalletAdapter {
  name: WalletProviderName;
  requestPermissions(): Promise<string>;
  getActiveAccount(): Promise<string | null>;
  clearActiveAccount(): Promise<void>;
  setAsTaquitoProvider(tezos: any): void;
}

/**
 * Wraps a BeaconWallet instance to implement Taquito's Signer interface.
 * BeaconWallet v24 has getPKH/getPK/sign but NOT publicKeyHash/publicKey,
 * and its sign() returns a bare string instead of {bytes, sig, prefixSig, sbytes}.
 */
class BeaconSigner {
  constructor(private wallet: any) {}

  async publicKeyHash(): Promise<string> {
    return this.wallet.getPKH();
  }

  async publicKey(): Promise<string> {
    return this.wallet.getPK();
  }

  async secretKey(): Promise<string> {
    throw new Error("Secret key not available through Beacon wallet");
  }

  async sign(
    bytes: string,
    watermark?: Uint8Array,
  ): Promise<{ bytes: string; sig: string; prefixSig: string; sbytes: string }> {
    const prefixSig: string = await this.wallet.sign(bytes, watermark);
    const utils = await loadUtils();
    const [rawSig] = utils.b58DecodeAndCheckPrefix(prefixSig, utils.signaturePrefixes);
    const sig = utils.b58Encode(rawSig, "GenericSignature");
    const sbytes = bytes + utils.buf2hex(rawSig);
    return { bytes, sig, prefixSig, sbytes };
  }
}

let tezos: any = null;
let adapter: WalletAdapter | null = null;
let currentNetwork: string = "ghostnet";

const CONNECTION_STABILIZATION_MS = 500;

class OctezConnectAdapter implements WalletAdapter {
  name: WalletProviderName = "octez.connect";
  private client: any = null;
  private beaconWallet: any = null;

  async init(network: string, rpcUrl: string) {
    const mod = await loadOctezConnect();
    const networkType = network === "mainnet" ? mod.NetworkType.MAINNET : mod.NetworkType.GHOSTNET;
    this.client = mod.getDAppClientInstance({
      name: "Bowers",
      iconUrl: "/favicon.png",
      preferredNetwork: networkType,
    });

    try {
      const { BeaconWallet } = (await loadBeaconWallet()).walletModule;
      this.beaconWallet = new BeaconWallet({
        name: "Bowers",
        iconUrl: "/favicon.png",
        network: { type: networkType, rpcUrl },
      });
    } catch {
      this.beaconWallet = null;
    }
  }

  async requestPermissions(): Promise<string> {
    const permissions = await this.client.requestPermissions();
    return permissions.address;
  }

  async getActiveAccount(): Promise<string | null> {
    const account = await this.client.getActiveAccount();
    return account?.address ?? null;
  }

  async clearActiveAccount(): Promise<void> {
    await this.client.clearActiveAccount();
  }

  setAsTaquitoProvider(t: any): void {
    if (this.beaconWallet) {
      t.setWalletProvider(this.beaconWallet);
      t.setSignerProvider(new BeaconSigner(this.beaconWallet));
    }
  }
}

class BeaconLegacyAdapter implements WalletAdapter {
  name: WalletProviderName = "beacon";
  private wallet: any = null;
  private BeaconEvent: any = null;

  async init(network: string, rpcUrl: string) {
    const { walletModule, beaconModule } = await loadBeaconWallet();
    const { BeaconWallet } = walletModule;
    const { NetworkType, BeaconEvent } = beaconModule;
    this.BeaconEvent = BeaconEvent;
    const networkType = network === "mainnet" ? NetworkType.MAINNET : NetworkType.GHOSTNET;
    this.wallet = new BeaconWallet({
      name: "Bowers",
      iconUrl: "/favicon.png",
      network: { type: networkType, rpcUrl },
    });
  }

  async requestPermissions(): Promise<string> {
    const w = this.wallet;
    const accountResolved = new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Connection timed out. Please try again.")), 60_000);
      const onAccount = (account: { address?: string } | undefined) => {
        clearTimeout(timeoutId);
        if (account?.address) resolve(account.address);
      };
      w.client.subscribeToEvent(this.BeaconEvent.ACTIVE_ACCOUNT_SET, onAccount).catch(reject);
    });

    await w.requestPermissions();
    return await accountResolved;
  }

  async getActiveAccount(): Promise<string | null> {
    const account = await this.wallet.client.getActiveAccount();
    return account?.address ?? null;
  }

  async clearActiveAccount(): Promise<void> {
    await this.wallet.clearActiveAccount();
  }

  setAsTaquitoProvider(t: any): void {
    t.setWalletProvider(this.wallet);
    t.setSignerProvider(new BeaconSigner(this.wallet));
  }
}

async function createAdapter(network: string, rpcUrl: string): Promise<WalletAdapter> {
  try {
    const octez = new OctezConnectAdapter();
    await octez.init(network, rpcUrl);
    console.log("[Bowers] Wallet provider: octez.connect");
    return octez;
  } catch (err) {
    console.warn("[Bowers] octez.connect unavailable, falling back to Beacon SDK:", err);
  }

  const beacon = new BeaconLegacyAdapter();
  await beacon.init(network, rpcUrl);
  console.log("[Bowers] Wallet provider: Beacon (legacy fallback)");
  return beacon;
}

export function getActiveProviderName(): WalletProviderName | null {
  return adapter?.name ?? null;
}

export function setActiveNetwork(network: string) {
  if (network !== currentNetwork) {
    currentNetwork = network;
    tezos = null;
    adapter = null;
  }
}

export async function getTezos(network?: string) {
  const net = network || currentNetwork;
  if (!tezos || net !== currentNetwork) {
    currentNetwork = net;
    const { TezosToolkit } = await loadTaquito();
    tezos = new TezosToolkit(RPC_URLS[net] || RPC_URLS.ghostnet);

    const { Tzip12Module } = await loadTzip12();
    const { Tzip16Module } = await loadTzip16();
    tezos.addExtension(new Tzip12Module());
    tezos.addExtension(new Tzip16Module());

    if (adapter) {
      adapter.setAsTaquitoProvider(tezos);
    }
  }
  return tezos;
}

async function ensureAdapter(): Promise<WalletAdapter> {
  if (!adapter) {
    const rpcUrl = RPC_URLS[currentNetwork] || RPC_URLS.ghostnet;
    adapter = await createAdapter(currentNetwork, rpcUrl);
  }
  return adapter;
}

export async function getWallet() {
  return ensureAdapter();
}

export async function connectWallet(): Promise<string> {
  if (adapter) {
    await adapter.clearActiveAccount();
    adapter = null;
  }

  const a = await ensureAdapter();
  const address = await a.requestPermissions();

  const t = await getTezos();
  a.setAsTaquitoProvider(t);
  await new Promise((r) => setTimeout(r, CONNECTION_STABILIZATION_MS));
  return address;
}

export async function disconnectWallet(): Promise<void> {
  const a = await ensureAdapter();
  await a.clearActiveAccount();
  tezos = null;
  adapter = null;
}

export async function getActiveAccount(): Promise<string | null> {
  try {
    const a = await ensureAdapter();
    const address = await a.getActiveAccount();
    if (address) {
      const t = await getTezos();
      a.setAsTaquitoProvider(t);
      return address;
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
