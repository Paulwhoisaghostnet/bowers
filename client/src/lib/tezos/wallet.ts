import { loadTaquito, loadOctezConnect, loadBeaconWallet, loadTzip12, loadTzip16, loadUtils, RPC_URLS } from "./loaders";

export type WalletProviderName = "octez.connect" | "beacon";

function resolveNetworkType(network: string, NetworkType: any): string {
  if (network === "mainnet") return NetworkType.MAINNET;
  if (network === "ghostnet" && NetworkType.GHOSTNET) return NetworkType.GHOSTNET;
  if (network === "shadownet" && NetworkType.SHADOWNET) return NetworkType.SHADOWNET;
  return NetworkType.CUSTOM || "custom";
}

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
let adapterPromise: Promise<WalletAdapter> | null = null;
let currentNetwork: string = "shadownet";

const CONNECTION_STABILIZATION_MS = 500;

class OctezConnectAdapter implements WalletAdapter {
  name: WalletProviderName = "octez.connect";
  private client: any = null;
  private beaconWallet: any = null;

  async init(network: string, rpcUrl: string) {
    const mod = await loadOctezConnect();
    const networkType = resolveNetworkType(network, mod.NetworkType);
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
        network: { type: networkType, name: network, rpcUrl },
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
      // #region agent log
      fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run1',hypothesisId:'H1',location:'wallet.ts:96',message:'Octez adapter applied providers',data:{adapter:'octez.connect',hasBeaconWallet:!!this.beaconWallet,hasGetPKH:typeof this.beaconWallet?.getPKH==='function',hasGetPK:typeof this.beaconWallet?.getPK==='function'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
    const networkType = resolveNetworkType(network, NetworkType);
    this.wallet = new BeaconWallet({
      name: "Bowers",
      iconUrl: "/favicon.png",
      network: { type: networkType, name: network, rpcUrl },
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

  getClient(): any {
    return this.wallet?.client ?? null;
  }

  setAsTaquitoProvider(t: any): void {
    t.setWalletProvider(this.wallet);
    t.setSignerProvider(new BeaconSigner(this.wallet));
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run1',hypothesisId:'H1',location:'wallet.ts:145',message:'Beacon adapter applied providers',data:{adapter:'beacon',hasWallet:!!this.wallet,hasGetPKH:typeof this.wallet?.getPKH==='function',hasGetPK:typeof this.wallet?.getPK==='function'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
}

function clearStaleBeaconState() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("beacon:") || key.startsWith("beacon-sdk:"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[Bowers] Cleared ${keysToRemove.length} stale Beacon keys`);
    }
  } catch {}
}

let beaconStateCleared = false;

async function createAdapter(network: string, rpcUrl: string): Promise<WalletAdapter> {
  if (!beaconStateCleared) {
    clearStaleBeaconState();
    beaconStateCleared = true;
  }
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run3',hypothesisId:'H8',location:'wallet.ts:createAdapter',message:'createAdapter called',data:{network,rpcUrl},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const beacon = new BeaconLegacyAdapter();
  try {
    await beacon.init(network, rpcUrl);
    console.log("[Bowers] Wallet provider: Beacon");
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run3',hypothesisId:'H8',location:'wallet.ts:createAdapter-beacon-ok',message:'Beacon adapter initialised OK',data:{network},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return beacon;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run3',hypothesisId:'H8',location:'wallet.ts:createAdapter-beacon-fail',message:'Beacon init failed',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.warn("[Bowers] Beacon unavailable:", err);
  }

  const octez = new OctezConnectAdapter();
  await octez.init(network, rpcUrl);
  console.log("[Bowers] Wallet provider: octez.connect (fallback)");
  return octez;
}

export function getActiveProviderName(): WalletProviderName | null {
  return adapter?.name ?? null;
}

export function getCurrentNetwork(): string {
  return currentNetwork;
}

export function setActiveNetwork(network: string) {
  if (network !== currentNetwork) {
    currentNetwork = network;
    tezos = null;
    adapter = null;
    adapterPromise = null;
  }
}

export async function getTezos(network?: string) {
  const net = network || currentNetwork;
  if (!tezos || net !== currentNetwork) {
    currentNetwork = net;
    const { TezosToolkit } = await loadTaquito();
    tezos = new TezosToolkit(RPC_URLS[net] || RPC_URLS.shadownet);

    const { Tzip12Module } = await loadTzip12();
    const { Tzip16Module } = await loadTzip16();
    tezos.addExtension(new Tzip12Module());
    tezos.addExtension(new Tzip16Module());

    if (adapter) {
      adapter.setAsTaquitoProvider(tezos);
      // #region agent log
      fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run1',hypothesisId:'H2',location:'wallet.ts:192',message:'getTezos reused adapter provider',data:{network:net,providerName:adapter?.name??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
  }
  return tezos;
}

async function ensureAdapter(): Promise<WalletAdapter> {
  if (adapter) return adapter;
  if (!adapterPromise) {
    const rpcUrl = RPC_URLS[currentNetwork] || RPC_URLS.shadownet;
    adapterPromise = createAdapter(currentNetwork, rpcUrl).then((a) => {
      adapter = a;
      adapterPromise = null;
      return a;
    });
  }
  return adapterPromise;
}

export async function getWallet() {
  return ensureAdapter();
}

export async function connectWallet(): Promise<string> {
  const a = await ensureAdapter();
  await a.clearActiveAccount();

  const address = await a.requestPermissions();

  const t = await getTezos();
  a.setAsTaquitoProvider(t);
  // #region agent log
  fetch('http://127.0.0.1:7592/ingest/cea64f23-34db-4732-a847-b206fb4aeec2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f1b6d8'},body:JSON.stringify({sessionId:'f1b6d8',runId:'run1',hypothesisId:'H2',location:'wallet.ts:223',message:'connectWallet applied provider after permissions',data:{providerName:a.name,addressPrefix:address?.slice?.(0,6)??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  await new Promise((r) => setTimeout(r, CONNECTION_STABILIZATION_MS));
  return address;
}

export async function disconnectWallet(): Promise<void> {
  const a = await ensureAdapter();
  await a.clearActiveAccount();
  tezos = null;
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
