import { Parser, emitMicheline } from "@taquito/michel-codec";
import { buildParameter } from "./parameter";
import { buildStorageType } from "./storage";
import { buildCode } from "./code";

const parser = new Parser();

export function getFA2Michelson(styleId: string): any[] {
  const parameter = buildParameter(styleId);
  const storage = buildStorageType(styleId);
  const code = buildCode(styleId);
  return [parameter, storage, code];
}

export function getFA2MichelineString(styleId: string): string {
  const michelson = getFA2Michelson(styleId);
  return michelson.map((section: any) => emitMicheline(section)).join("\n");
}

export function validateMichelson(styleId: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    const michelineStr = getFA2MichelineString(styleId);
    const parsed = parser.parseScript(michelineStr);
    if (!parsed || parsed.length === 0) {
      errors.push("Parser returned empty result");
    }
  } catch (err: any) {
    errors.push(`Michelson validation failed: ${err.message}`);
  }
  return { valid: errors.length === 0, errors };
}

export function getStorageTypeForStyle(styleId: string) {
  return buildStorageType(styleId);
}
