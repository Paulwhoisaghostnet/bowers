#!/usr/bin/env python3
"""
Compiles BowersOpenEditionFA2 SmartPy contract to Micheline JSON.
Run from project root. Output goes to SMARTPY_OUTPUT_DIR/BowersOpenEdition/.
"""
import os
import sys
import importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

import smartpy as sp

contract_path = os.path.join(ROOT, "attached_assets", "BowersOpenEditionFA2_v5_fa2complete_1771143451660.py")
spec = importlib.util.spec_from_file_location("bowers_open_edition_module", contract_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
main = module.main

admin = sp.address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")
metadata = sp.big_map({"": sp.bytes("0x")})

scenario = sp.test_scenario("BowersOpenEdition", main)
c = main.BowersOpenEditionFA2(
    admin=admin,
    metadata=metadata,
)
scenario += c
