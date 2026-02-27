/**
 * TzKT API helpers for reading on-chain contract data (Ghostnet).
 */

const TZKT_BASE = "https://api.ghostnet.tzkt.io/v1";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

async function tzktFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${TZKT_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`TzKT API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface BigMapKey {
  id: number;
  active: boolean;
  key: unknown;
  value: unknown;
}

export async function getBigMapKeys(
  contractAddress: string,
  bigmapName: string,
  limit = 10000
): Promise<BigMapKey[]> {
  return tzktFetch<BigMapKey[]>(
    `/contracts/${contractAddress}/bigmaps/${bigmapName}/keys?limit=${limit}&active=true`
  );
}

export interface TokenInfo {
  tokenId: number;
  name: string;
  description: string;
  artifactUri: string;
  displayUri: string;
  thumbnailUri: string;
  mimeType: string;
  creators: string[];
  tags: string[];
  formats: Array<{ uri: string; mimeType: string }>;
  attributes: unknown[];
}

export interface ListingInfo {
  tokenId: number;
  owner: string;
  price: number;
  maxQty: number;
  minBps: number;
}

export interface OfferInfo {
  offerId: number;
  tokenId: number;
  buyer: string;
  pricePerUnit: number;
  qty: number;
  expiry: string;
}

export interface LedgerEntry {
  owner: string;
  tokenId: number;
  balance: number;
}

export interface ClaimableEntry {
  address: string;
  amount: number;
}

export interface TokenConfigEntry {
  tokenId: number;
  creator: string;
  mintPrice: number;
  mintEnd: string | null;
  mintPaused: boolean;
  maxSupply: number | null;
  currentSupply: number;
}

function hexToUtf8(hex: string): string {
  try {
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return hex;
  }
}

function parseTokenInfo(tokenInfoMap: Record<string, string>): Partial<TokenInfo> {
  const get = (key: string) => {
    const val = tokenInfoMap[key];
    return val ? hexToUtf8(val) : "";
  };

  let formats: Array<{ uri: string; mimeType: string }> = [];
  try {
    formats = JSON.parse(get("formats") || "[]");
  } catch {}

  let creators: string[] = [];
  try {
    creators = JSON.parse(get("creators") || "[]");
  } catch {}

  let tags: string[] = [];
  try {
    tags = JSON.parse(get("tags") || "[]");
  } catch {}

  let attributes: unknown[] = [];
  try {
    attributes = JSON.parse(get("attributes") || "[]");
  } catch {}

  return {
    name: get("name"),
    description: get("description"),
    artifactUri: get("artifactUri"),
    displayUri: get("displayUri"),
    thumbnailUri: get("thumbnailUri"),
    mimeType: formats[0]?.mimeType || "",
    creators,
    tags,
    formats,
    attributes,
  };
}

export interface EnrichedToken {
  tokenId: number;
  metadata: Partial<TokenInfo>;
  imageUrl: string;
  owners: Array<{ address: string; balance: number }>;
  listing?: ListingInfo;
  offers: OfferInfo[];
  tokenConfig?: TokenConfigEntry;
}

export async function getContractTokens(
  contractAddress: string,
  isOpenEdition: boolean
): Promise<{
  tokens: EnrichedToken[];
  claimable: ClaimableEntry[];
}> {
  const [tokenMetaKeys, ledgerKeys, listingKeys, offerKeys] =
    await Promise.all([
      getBigMapKeys(contractAddress, "token_metadata").catch(() => []),
      getBigMapKeys(contractAddress, "ledger").catch(() => []),
      getBigMapKeys(contractAddress, "listings").catch(() => []),
      getBigMapKeys(contractAddress, "offers").catch(() => []),
    ]);

  const claimableKeys = await getBigMapKeys(contractAddress, "claimable").catch(
    () => []
  );
  const tokenConfigKeys = isOpenEdition
    ? await getBigMapKeys(contractAddress, "token_config").catch(() => [])
    : [];

  const tokensMap = new Map<number, EnrichedToken>();

  for (const key of tokenMetaKeys) {
    const v = key.value as { token_id: string; token_info: Record<string, string> };
    const tokenId = parseInt(v.token_id);
    const metadata = parseTokenInfo(v.token_info || {});
    const imageUrl = ipfsToHttp(
      metadata.displayUri || metadata.thumbnailUri || metadata.artifactUri || ""
    );
    tokensMap.set(tokenId, {
      tokenId,
      metadata,
      imageUrl,
      owners: [],
      offers: [],
    });
  }

  for (const key of ledgerKeys) {
    const k = key.key as { nat: string; address: string };
    const tokenId = parseInt(k.nat);
    const balance = parseInt(key.value as string);
    const token = tokensMap.get(tokenId);
    if (token && balance > 0) {
      token.owners.push({ address: k.address, balance });
    }
  }

  for (const key of listingKeys) {
    const k = key.key as { nat: string; address: string };
    const tokenId = parseInt(k.nat);
    const v = key.value as { price: string; max_qty: string; min_bps: string };
    const token = tokensMap.get(tokenId);
    if (token && parseInt(v.max_qty) > 0) {
      token.listing = {
        tokenId,
        owner: k.address,
        price: parseInt(v.price),
        maxQty: parseInt(v.max_qty),
        minBps: parseInt(v.min_bps),
      };
    }
  }

  for (const key of offerKeys) {
    const v = key.value as {
      token_id: string;
      buyer: string;
      price_per_unit: string;
      qty: string;
      expiry: string;
    };
    const tokenId = parseInt(v.token_id);
    const token = tokensMap.get(tokenId);
    if (token) {
      token.offers.push({
        offerId: parseInt(key.key as string),
        tokenId,
        buyer: v.buyer,
        pricePerUnit: parseInt(v.price_per_unit),
        qty: parseInt(v.qty),
        expiry: v.expiry,
      });
    }
  }

  for (const key of tokenConfigKeys) {
    const tokenId = parseInt(key.key as string);
    const v = key.value as {
      creator: string;
      mint_price: string;
      mint_end: string | null;
      mint_paused: boolean;
      max_supply: string | null;
      current_supply: string;
    };
    const token = tokensMap.get(tokenId);
    if (token) {
      token.tokenConfig = {
        tokenId,
        creator: v.creator,
        mintPrice: parseInt(v.mint_price),
        mintEnd: v.mint_end,
        mintPaused: v.mint_paused,
        maxSupply: v.max_supply ? parseInt(v.max_supply) : null,
        currentSupply: parseInt(v.current_supply),
      };
    }
  }

  const claimable: ClaimableEntry[] = claimableKeys.map((key) => ({
    address: key.key as string,
    amount: parseInt(key.value as string),
  }));

  const tokens = Array.from(tokensMap.values()).sort(
    (a, b) => b.tokenId - a.tokenId
  );

  return { tokens, claimable };
}
