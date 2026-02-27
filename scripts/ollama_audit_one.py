#!/usr/bin/env python3
"""
Send one SmartPy contract to Ollama for audit. Uses POST /api/generate.
Usage: python scripts/ollama_audit_one.py <path_to_contract.py> [model]
"""
import json
import sys
import requests

OLLAMA = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"

def main():
    if len(sys.argv) < 2:
        print("Usage: ollama_audit_one.py <contract.py> [model]", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_MODEL
    try:
        source = open(path).read()
    except Exception as e:
        print(f"Read error: {e}", file=sys.stderr)
        sys.exit(1)
    contract_name = path.replace("\\", "/").split("/")[-1].replace(".py", "")

    prompt = f"""You are auditing a Tezos SmartPy (v2) FA2 contract for the Bowers project. Bowers is an FA2 NFT collections and marketplace app on Tezos (Ghostnet). This contract ({contract_name}) should provide FA2 (TZIP-12) plus the features described in its header comments (e.g. open edition, allowlist, bonding curve, marketplace). It must use SmartPy v2 module syntax.

Review the contract below for:
1. Will it compile cleanly with SmartPy (syntax, types, entrypoints)?
2. Does it match the intended behavior (allowlist phase, open edition after, marketplace, royalties, claimable)?
3. Any logic bugs, missing checks, or security concerns (e.g. reentrancy, overflow, access control)?

Reply with a concise audit: COMPILE (ok/fail + any errors), BEHAVIOR (match/mismatch + notes), ISSUES (list or "none"), and RECOMMENDATIONS.

Contract source:
```
{source}
```
"""

    # Try native /api/generate first; some installs only expose /api/chat
    for endpoint in ["/api/generate", "/api/chat"]:
        url = f"{OLLAMA}{endpoint}"
        payload = {"model": model, "prompt": prompt, "stream": False} if "generate" in endpoint else {"model": model, "messages": [{"role": "user", "content": prompt}], "stream": False}
        try:
            r = requests.post(url, json=payload, timeout=300)
            if r.status_code != 200:
                continue
            out = r.json()
            if "generate" in endpoint:
                text = out.get("response", "").strip()
            else:
                text = (out.get("message") or {}).get("content", "").strip()
            if text:
                print(text)
                return
        except requests.RequestException:
            continue
    print("Ollama request failed (tried /api/generate and /api/chat). Is Ollama running? e.g. ollama serve", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    main()
