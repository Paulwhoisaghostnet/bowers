let tezosModule: any = null;
let beaconModule: any = null;
let walletModule: any = null;
let michelCodecModule: any = null;
let tzip12Mod: any = null;
let tzip16Mod: any = null;
let taquitoUtils: any = null;

export async function loadTaquito() {
  if (!tezosModule) {
    tezosModule = await import("@taquito/taquito");
  }
  return tezosModule;
}

export async function loadBeaconWallet() {
  if (!walletModule) {
    walletModule = await import("@taquito/beacon-wallet");
  }
  if (!beaconModule) {
    beaconModule = await import("@airgap/beacon-sdk");
  }
  return { walletModule, beaconModule };
}

export async function loadMichelCodec() {
  if (!michelCodecModule) {
    michelCodecModule = await import("@taquito/michel-codec");
  }
  return michelCodecModule;
}

export async function loadTzip12() {
  if (!tzip12Mod) {
    tzip12Mod = await import("@taquito/tzip12");
  }
  return tzip12Mod;
}

export async function loadTzip16() {
  if (!tzip16Mod) {
    tzip16Mod = await import("@taquito/tzip16");
  }
  return tzip16Mod;
}

export async function loadUtils() {
  if (!taquitoUtils) {
    taquitoUtils = await import("@taquito/utils");
  }
  return taquitoUtils;
}

export const RPC_URLS: Record<string, string> = {
  ghostnet: "https://ghostnet.ecadinfra.com",
  mainnet: "https://mainnet.ecadinfra.com",
};
