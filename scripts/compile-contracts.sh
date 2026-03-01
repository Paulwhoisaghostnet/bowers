#!/usr/bin/env bash
# Compiles SmartPy contracts to Micheline JSON and copies to client michelson folder.
# Requires: Python 3, pip install smartpy-tezos (or run from venv with smartpy-tezos).
# Usage: from project root, run: ./scripts/compile-contracts.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${ROOT}/build/smartpy"
MICHELSON_DIR="${ROOT}/client/src/lib/tezos/michelson"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$MICHELSON_DIR"

export SMARTPY_OUTPUT_DIR="$OUTPUT_DIR"

# Check for smartpy-tezos (pip install smartpy-tezos)
if ! python3 -c "import smartpy; assert hasattr(smartpy, 'module')" 2>/dev/null; then
  echo "SmartPy not found. Install with: pip install smartpy-tezos"
  echo "If 'smartpy' (hydrology package) is installed, uninstall it first: pip uninstall smartpy"
  exit 1
fi

cd "$ROOT"

# Compile marketplace
echo "Compiling Bowers Marketplace contract..."
python3 scripts/compile_marketplace.py

# Compile open edition
echo "Compiling Bowers Open Edition contract..."
python3 scripts/compile_open_edition.py

# Compile allowlist
echo "Compiling Bowers Allowlist contract..."
python3 scripts/compile_allowlist.py

# Compile bonding curve
echo "Compiling Bowers Bonding Curve contract..."
python3 scripts/compile_bonding_curve.py

# Compile unified (multi-mint)
echo "Compiling Bowers Unified contract..."
python3 scripts/compile_unified.py

# Compile mint-only contracts
echo "Compiling Bowers Mint Open Edition contract..."
python3 scripts/compile_mint_open_edition.py
echo "Compiling Bowers Mint Allowlist contract..."
python3 scripts/compile_mint_allowlist.py
echo "Compiling Bowers Mint Bonding Curve contract..."
python3 scripts/compile_mint_bonding_curve.py

# Copy first contract JSON from each scenario (step_*_cont_0_contract.json)
copy_contract() {
  local scenario_name="$1"
  local out_name="$2"
  local dir="${OUTPUT_DIR}/${scenario_name}"
  if [ ! -d "$dir" ]; then
    echo "Missing output directory: $dir"
    exit 1
  fi
  local json
  json=$(find "$dir" -name "step_*_cont_0_contract.json" | head -1)
  if [ -z "$json" ]; then
    echo "No contract JSON found in $dir"
    exit 1
  fi
  cp "$json" "${MICHELSON_DIR}/${out_name}.json"
  echo "  -> ${MICHELSON_DIR}/${out_name}.json"
}

copy_contract "BowersMarketplace" "bowers-marketplace"
copy_contract "BowersOpenEdition" "bowers-open-edition"
copy_contract "BowersAllowlist" "bowers-allowlist"
copy_contract "BowersBondingCurve" "bowers-bonding-curve"
copy_contract "BowersUnified" "bowers-unified"
copy_contract "BowersMintOpenEdition" "bowers-mint-oe"
copy_contract "BowersMintAllowlist" "bowers-mint-allowlist"
copy_contract "BowersMintBondingCurve" "bowers-mint-bonding-curve"

# Generate TypeScript modules from JSON
if [ -f "${MICHELSON_DIR}/bowers-marketplace.json" ]; then
  node scripts/generate-michelson-ts.cjs
else
  echo "No JSON produced; .ts files not updated. Run with SmartPy to compile."
fi
echo "Done."
