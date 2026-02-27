#!/usr/bin/env python3
"""
Compiles BowersFA2 (marketplace) SmartPy contract to Micheline JSON.
Run from project root. Output goes to SMARTPY_OUTPUT_DIR/BowersMarketplace/.
"""
import os
import sys
import importlib.util

# Run from project root so attached_assets and smartpy are resolvable
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

import smartpy as sp

# Load the contract module without executing as main
contract_path = os.path.join(ROOT, "attached_assets", "BowersFA2_partial_fill_offer_1771139881452.py")
spec = importlib.util.spec_from_file_location("bowers_fa2_module", contract_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
main = module.main

# Dummy init values for compilation (only the contract code is needed)
admin = sp.address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")
metadata = sp.big_map({"": sp.bytes("0x")})

scenario = sp.test_scenario("BowersMarketplace", main)
c = main.BowersFA2(
    admin=admin,
    metadata=metadata,
)
scenario += c
