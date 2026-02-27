/**
 * Pinata IPFS upload helpers. Uses fetch only (no SDK).
 * Requires PINATA_JWT in environment.
 */

const PINATA_API = "https://api.pinata.cloud";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function getAuth(): string {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is not set. Configure it in .env to use IPFS uploads.");
  }
  return jwt;
}

export interface PinFileResult {
  cid: string;
  uri: string;
  size: number;
  mimeType?: string;
}

/**
 * Pin a file buffer to IPFS via Pinata.
 */
export async function pinFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<PinFileResult> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit`);
  }
  const auth = getAuth();
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Pinata error: ${res.status}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return {
    cid: data.IpfsHash,
    uri: `ipfs://${data.IpfsHash}`,
    size: buffer.length,
    mimeType,
  };
}

export interface PinMetadataResult {
  cid: string;
  uri: string;
}

/**
 * Pin a JSON object to IPFS via Pinata (pinJSONToIPFS).
 */
export async function pinMetadata(metadata: Record<string, unknown>): Promise<PinMetadataResult> {
  const auth = getAuth();
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Pinata error: ${res.status}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return {
    cid: data.IpfsHash,
    uri: `ipfs://${data.IpfsHash}`,
  };
}
