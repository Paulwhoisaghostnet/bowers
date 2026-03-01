/**
 * Register each contract's Michelson code body as a Tezos Global Constant on
 * the target network (default: ghostnet). Outputs a mapping file that
 * apply-global-constants.ts consumes to produce slim contract modules.
 *
 * Usage:
 *   TEZOS_SECRET_KEY=edsk... npx tsx scripts/register-global-constants.ts [network]
 *
 * Requirements:
 *   - A funded account on the target network
 *   - The JSON contract files in client/src/lib/tezos/michelson/*.json
 */

import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const RPC: Record<string, string> = {
  ghostnet: "https://ghostnet.ecadinfra.com",
  mainnet: "https://mainnet.ecadinfra.com",
};

const CONTRACT_IDS = [
  "bowers-marketplace",
  "bowers-open-edition",
  "bowers-allowlist",
  "bowers-bonding-curve",
  "bowers-unified",
  "bowers-mint-oe",
  "bowers-mint-allowlist",
  "bowers-mint-bonding-curve",
];

const MICHELSON_DIR = resolve(__dirname, "../client/src/lib/tezos/michelson");
const OUTPUT_FILE = resolve(MICHELSON_DIR, "global-constants.json");

interface ConstantMapping {
  [network: string]: {
    [contractId: string]: {
      codeHash: string;
      registeredAt: string;
    };
  };
}

async function main() {
  const network = process.argv[2] || "ghostnet";
  const secretKey = process.env.TEZOS_SECRET_KEY;
  if (!secretKey) {
    console.error("Set TEZOS_SECRET_KEY to a funded account's secret key.");
    process.exit(1);
  }

  const rpcUrl = RPC[network];
  if (!rpcUrl) {
    console.error(`Unknown network: ${network}. Use ghostnet or mainnet.`);
    process.exit(1);
  }

  const tezos = new TezosToolkit(rpcUrl);
  tezos.setProvider({ signer: new InMemorySigner(secretKey) });

  const pkh = await tezos.signer.publicKeyHash();
  const balance = await tezos.tz.getBalance(pkh);
  console.log(`Account: ${pkh}`);
  console.log(`Balance: ${balance.toNumber() / 1_000_000} tez`);
  console.log(`Network: ${network} (${rpcUrl})\n`);

  const existing: ConstantMapping = existsSync(OUTPUT_FILE)
    ? JSON.parse(readFileSync(OUTPUT_FILE, "utf8"))
    : {};

  if (!existing[network]) existing[network] = {};

  for (const id of CONTRACT_IDS) {
    const jsonPath = resolve(MICHELSON_DIR, `${id}.json`);
    if (!existsSync(jsonPath)) {
      console.log(`[${id}] JSON not found — skipping (stub contract)`);
      continue;
    }

    if (existing[network][id]?.codeHash) {
      console.log(`[${id}] Already registered: ${existing[network][id].codeHash}`);
      continue;
    }

    const contract: any[] = JSON.parse(readFileSync(jsonPath, "utf8"));
    const codeElement = contract.find((el: any) => el.prim === "code");
    if (!codeElement?.args?.[0]) {
      console.log(`[${id}] No code section found — skipping`);
      continue;
    }

    const codeBody = codeElement.args[0];
    console.log(`[${id}] Registering code body (${JSON.stringify(codeBody).length} bytes JSON)...`);

    try {
      const op = await tezos.contract.registerGlobalConstant({ value: codeBody });
      await op.confirmation(1);
      const hash = op.globalConstantHash;
      console.log(`[${id}] Registered: ${hash}`);

      existing[network][id] = {
        codeHash: hash!,
        registeredAt: new Date().toISOString(),
      };
      writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2));
    } catch (err: any) {
      console.error(`[${id}] Registration failed: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nAll constants registered. Mapping saved to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
