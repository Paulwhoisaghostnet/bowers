import { code as bowersMarketplaceCode } from "./bowers-marketplace";
import { code as bowersOpenEditionCode } from "./bowers-open-edition";
import { code as bowersAllowlistCode } from "./bowers-allowlist";
import { code as bowersBondingCurveCode } from "./bowers-bonding-curve";
import { code as bowersUnifiedCode } from "./bowers-unified";
import { code as bowersMintOECode } from "./bowers-mint-oe";
import { code as bowersMintAllowlistCode } from "./bowers-mint-allowlist";
import { code as bowersMintBondingCurveCode } from "./bowers-mint-bonding-curve";

const CONTRACT_CODE: Record<string, unknown[]> = {
  "bowers-marketplace": bowersMarketplaceCode as unknown[],
  "bowers-open-edition": bowersOpenEditionCode as unknown[],
  "bowers-allowlist": bowersAllowlistCode as unknown[],
  "bowers-bonding-curve": bowersBondingCurveCode as unknown[],
  "bowers-unified": bowersUnifiedCode as unknown[],
  "bowers-mint-oe": bowersMintOECode as unknown[],
  "bowers-mint-allowlist": bowersMintAllowlistCode as unknown[],
  "bowers-mint-bonding-curve": bowersMintBondingCurveCode as unknown[],
};

export function getCode(styleId: string): unknown[] {
  const code = CONTRACT_CODE[styleId];
  if (!code || code.length === 0) {
    throw new Error(
      `Contract code for "${styleId}" not compiled. Run: npm run compile:contracts (requires SmartPy)`
    );
  }
  return code;
}
