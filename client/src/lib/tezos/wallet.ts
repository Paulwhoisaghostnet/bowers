import { loadTaquito, loadBeaconWallet, loadTzip12, loadTzip16, RPC_URLS } from "./loaders";

let tezos: any = null;
let wallet: any = null;

export async function getTezos(network: string = "ghostnet") {
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

export async function getWallet() {
  if (!wallet) {
    const { BeaconWallet } = (await loadBeaconWallet()).walletModule;
    const { NetworkType } = (await loadBeaconWallet()).beaconModule;
    wallet = new BeaconWallet({
      name: "Bowers",
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
