#!/usr/bin/env python3
"""
Compiles BowersMintBondingCurve SmartPy contract to Micheline JSON.
Run from project root. Output goes to SMARTPY_OUTPUT_DIR/BowersMintBondingCurve/.
"""
import os
import sys
import importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

import smartpy as sp

contract_path = os.path.join(ROOT, "attached_assets", "BowersMintBondingCurve.py")
spec = importlib.util.spec_from_file_location("bowers_mint_bc_module", contract_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
main = module.main

admin = sp.address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")
metadata = sp.big_map({"": sp.bytes("0x")})

scenario = sp.test_scenario("BowersMintBondingCurve", main)
c = main.BowersMintBondingCurve(
    admin=admin,
    metadata=metadata,
)
scenario += c
