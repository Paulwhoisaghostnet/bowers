/**
 * Client-side IPFS helpers – wraps the server-side Pinata proxy endpoints.
 */

export interface IpfsUploadResult {
  cid: string;
  uri: string;
  size: number;
  mimeType?: string;
}

export interface IpfsMetadataResult {
  cid: string;
  uri: string;
}

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/**
 * Upload a file to IPFS via the backend proxy.
 */
export async function uploadFileToIPFS(file: File): Promise<IpfsUploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/ipfs/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "File upload failed");
  }

  return res.json();
}

/**
 * Pin a JSON metadata object to IPFS via the backend proxy.
 */
export async function uploadMetadataToIPFS(
  metadata: Record<string, unknown>
): Promise<IpfsMetadataResult> {
  const res = await fetch("/api/ipfs/metadata", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Metadata pin failed");
  }

  return res.json();
}

/**
 * Convert an ipfs:// URI to an HTTP gateway URL for display.
 */
export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY}${uri.slice(7)}`;
  }
  return uri;
}
