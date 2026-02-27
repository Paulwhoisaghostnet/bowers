import smartpy as sp

tstorage = sp.record(deadline=sp.option[sp.timestamp], x=sp.nat).layout(("deadline", "x"))
tparameter = sp.variant(check=sp.unit).layout("check")
tprivates = { }
tviews = { }
