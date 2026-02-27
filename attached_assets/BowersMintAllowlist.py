# BowersMintAllowlist - SmartPy v2
# Mint-only FA2: open edition with allowlist phase. No marketplace (sell on objkt/teia).
# FA2 core, create_token, allowlist, mint_editions, contract_blocklist, withdraw.

import smartpy as sp


@sp.module
def main():
    BalanceOfRequestType: type = sp.record(owner=sp.address, token_id=sp.nat)
    BalanceOfResponseType: type = sp.record(request=BalanceOfRequestType, balance=sp.nat)
    LedgerKeyType: type = sp.record(owner=sp.address, token_id=sp.nat)
    OperatorKeyType: type = sp.record(owner=sp.address, operator=sp.address, token_id=sp.nat)
    AllowlistKeyType: type = sp.record(token_id=sp.nat, address=sp.address)
    AllowlistEntryType: type = sp.record(max_qty=sp.nat, minted=sp.nat, price_override=sp.option[sp.mutez])
    OperatorParamType: type = sp.variant(add_operator=OperatorKeyType, remove_operator=OperatorKeyType)
    TransferTxType: type = sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)
    TransferBatchItemType: type = sp.record(from_=sp.address, txs=sp.list[TransferTxType])

    TokenConfigType: type = sp.record(
        creator=sp.address,
        mint_price=sp.mutez,
        mint_end=sp.option[sp.timestamp],
        mint_paused=sp.bool,
        max_supply=sp.option[sp.nat],
        minted=sp.nat,
        allowlist_end=sp.option[sp.timestamp],
        royalty_recipient=sp.address,
        royalty_bps=sp.nat,
    )

    AllowlistEntryParam: type = sp.record(
        address=sp.address,
        max_qty=sp.nat,
        price_override=sp.option[sp.mutez],
    )

    class BowersMintAllowlist(sp.Contract):
        def __init__(self, admin, metadata):
            self.data.admin = admin
            self.data.metadata = metadata
            self.data.ledger = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, sp.nat])
            self.data.token_metadata = sp.cast(sp.big_map(), sp.big_map[sp.nat, sp.record(token_id=sp.nat, token_info=sp.map[sp.string, sp.bytes])])
            self.data.token_config = sp.cast(sp.big_map(), sp.big_map[sp.nat, TokenConfigType])
            self.data.token_allowlist = sp.cast(sp.big_map(), sp.big_map[AllowlistKeyType, AllowlistEntryType])
            self.data.operators = sp.cast(sp.big_map(), sp.big_map[OperatorKeyType, sp.unit])
            self.data.next_token_id = sp.nat(0)
            self.data.claimable = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.mutez])
            self.data.contract_blocklist = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.unit])

        @sp.entrypoint
        def balance_of(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(requests=sp.list[BalanceOfRequestType], callback=sp.contract[sp.list[BalanceOfResponseType]]))
            balances = []
            for req in params.requests:
                bal = self.data.ledger.get(sp.record(owner=req.owner, token_id=req.token_id), default=sp.nat(0))
                balances.push(sp.record(request=sp.record(owner=req.owner, token_id=req.token_id), balance=bal))
            sp.transfer(reversed(balances), sp.mutez(0), params.callback)

        @sp.entrypoint
        def update_operators(self, actions):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(actions, sp.list[OperatorParamType])
            for action in actions:
                match action:
                    case add_operator(op):
                        assert op.owner == sp.sender, "NOT_OWNER"
                        self.data.operators[op] = ()
                    case remove_operator(op):
                        assert op.owner == sp.sender, "NOT_OWNER"
                        assert op in self.data.operators, "NO_OP"
                        del self.data.operators[op]

        @sp.entrypoint
        def transfer(self, batch):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(batch, sp.list[TransferBatchItemType])
            for item in batch:
                from_ = item.from_
                for tx in item.txs:
                    assert not (from_ in self.data.contract_blocklist), "BLOCKED"
                    assert not (tx.to_ in self.data.contract_blocklist), "BLOCKED"
                    if from_ != sp.sender:
                        assert sp.record(owner=from_, operator=sp.sender, token_id=tx.token_id) in self.data.operators, "NOT_OPERATOR"
                    assert tx.amount > 0, "BAD_AMOUNT"
                    fk = sp.record(owner=from_, token_id=tx.token_id)
                    fb = self.data.ledger.get(fk, default=sp.nat(0))
                    assert fb >= tx.amount, "LOW_BAL"
                    nfb = sp.as_nat(fb - tx.amount)
                    if nfb == 0:
                        if fk in self.data.ledger:
                            del self.data.ledger[fk]
                    else:
                        self.data.ledger[fk] = nfb
                    tk = sp.record(owner=tx.to_, token_id=tx.token_id)
                    tb = self.data.ledger.get(tk, default=sp.nat(0))
                    self.data.ledger[tk] = tb + tx.amount
                    sp.emit(sp.record(f=from_, t=tx.to_, i=tx.token_id, a=tx.amount), tag="xfer")

        @sp.entrypoint
        def set_admin(self, new_admin):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(new_admin, sp.address)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            self.data.admin = new_admin

        @sp.entrypoint
        def create_token(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(
                params,
                sp.record(
                    metadata_uri=sp.bytes,
                    creator=sp.address,
                    mint_price=sp.mutez,
                    mint_end=sp.option[sp.timestamp],
                    max_supply=sp.option[sp.nat],
                    allowlist_end=sp.option[sp.timestamp],
                    royalty_recipient=sp.address,
                    royalty_bps=sp.nat,
                ),
            )
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.royalty_bps <= 10_000, "BPS_TOO_HIGH"

            tid = self.data.next_token_id
            self.data.next_token_id += 1

            token_info = {"": params.metadata_uri, "decimals": sp.bytes("0x30")}
            self.data.token_metadata[tid] = sp.record(token_id=tid, token_info=token_info)

            self.data.token_config[tid] = sp.record(
                creator=params.creator,
                mint_price=params.mint_price,
                mint_end=params.mint_end,
                mint_paused=False,
                max_supply=params.max_supply,
                minted=sp.nat(0),
                allowlist_end=params.allowlist_end,
                royalty_recipient=params.royalty_recipient,
                royalty_bps=params.royalty_bps,
            )

        @sp.entrypoint
        def set_mint_price(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, mint_price=sp.mutez))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            cfg.mint_price = params.mint_price
            self.data.token_config[params.token_id] = cfg

        @sp.entrypoint
        def set_mint_end(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, mint_end=sp.option[sp.timestamp]))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            cfg.mint_end = params.mint_end
            self.data.token_config[params.token_id] = cfg

        @sp.entrypoint
        def set_mint_paused(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, paused=sp.bool))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            cfg.mint_paused = params.paused
            self.data.token_config[params.token_id] = cfg

        @sp.entrypoint
        def set_allowlist(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, entries=sp.list[AllowlistEntryParam]))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            for e in params.entries:
                key = sp.record(token_id=params.token_id, address=e.address)
                self.data.token_allowlist[key] = sp.record(
                    max_qty=e.max_qty, minted=sp.nat(0), price_override=e.price_override)

        @sp.entrypoint
        def clear_allowlist(self, token_id):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(token_id, sp.nat)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[token_id]
            cfg.allowlist_end = None
            self.data.token_config[token_id] = cfg

        @sp.entrypoint
        def set_allowlist_end(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, allowlist_end=sp.option[sp.timestamp]))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            cfg.allowlist_end = params.allowlist_end
            self.data.token_config[params.token_id] = cfg

        @sp.entrypoint
        def mint_editions(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, qty=sp.nat, to_=sp.address))
            assert params.qty > 0, "BAD_QTY"
            assert not (params.to_ in self.data.contract_blocklist), "BLOCKED"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]

            ms = cfg.max_supply
            if ms.is_some():
                cap = ms.unwrap_some()
                assert cfg.minted + params.qty <= cap, "MAX_SUPPLY"

            me = cfg.mint_end
            if me.is_some():
                assert sp.now <= me.unwrap_some(), "MINT_CLOSED"
            assert not cfg.mint_paused, "MINT_CLOSED"

            price_per = cfg.mint_price
            al_end = cfg.allowlist_end
            if al_end.is_some():
                if sp.now < al_end.unwrap_some():
                    key = sp.record(token_id=params.token_id, address=sp.sender)
                    assert key in self.data.token_allowlist, "NOT_ALLOWLISTED"
                    entry = self.data.token_allowlist[key]
                    assert entry.minted + params.qty <= entry.max_qty, "ALLOWLIST_CAP"
                    po = entry.price_override
                    if po.is_some():
                        price_per = po.unwrap_some()
                    entry.minted = entry.minted + params.qty
                    self.data.token_allowlist[key] = entry

            total_price = sp.split_tokens(price_per, params.qty, 1)
            assert sp.amount == total_price, "BAD_PAYMENT"

            lk = sp.record(owner=params.to_, token_id=params.token_id)
            self.data.ledger[lk] = self.data.ledger.get(lk, default=sp.nat(0)) + params.qty
            self.data.claimable[cfg.creator] = self.data.claimable.get(cfg.creator, default=sp.mutez(0)) + total_price

            cfg.minted = cfg.minted + params.qty
            self.data.token_config[params.token_id] = cfg
            sp.emit(sp.record(token_id=params.token_id, to_=params.to_, qty=params.qty, paid=total_price), tag="mint")

        @sp.entrypoint
        def block_address(self, address):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(address, sp.address)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            self.data.contract_blocklist[address] = ()

        @sp.entrypoint
        def unblock_address(self, address):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(address, sp.address)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            if address in self.data.contract_blocklist:
                del self.data.contract_blocklist[address]

        @sp.entrypoint
        def withdraw(self):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            amount = self.data.claimable.get(sp.sender, default=sp.mutez(0))
            assert amount > sp.mutez(0), "NO_FUNDS"
            self.data.claimable[sp.sender] = sp.mutez(0)
            sp.send(sp.sender, amount)

        @sp.onchain_view
        def get_balance(self, params):
            sp.cast(params, sp.record(owner=sp.address, token_id=sp.nat))
            return self.data.ledger.get(sp.record(owner=params.owner, token_id=params.token_id), default=sp.nat(0))

        @sp.onchain_view
        def get_claimable(self, addr):
            sp.cast(addr, sp.address)
            return self.data.claimable.get(addr, default=sp.mutez(0))

        @sp.onchain_view
        def get_token_config(self, token_id):
            sp.cast(token_id, sp.nat)
            return self.data.token_config[token_id]

        @sp.onchain_view
        def is_allowlisted(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, address=sp.address))
            return sp.record(token_id=params.token_id, address=params.address) in self.data.token_allowlist


@sp.add_test()
def test():
    scenario = sp.test_scenario("BowersMintAllowlist", main)
    admin = sp.test_account("admin")
    alice = sp.test_account("alice")
    bob = sp.test_account("bob")

    c = main.BowersMintAllowlist(
        admin=admin.address,
        metadata=sp.scenario_utils.metadata_of_url("https://example.com"),
    )
    scenario += c

    c.create_token(
        metadata_uri=sp.bytes("0x" + "ipfs://QmExample".encode("utf-8").hex()),
        creator=alice.address,
        mint_price=sp.tez(1),
        mint_end=None,
        max_supply=sp.Some(10),
        allowlist_end=sp.Some(sp.timestamp(100)),
        royalty_recipient=admin.address,
        royalty_bps=500,
        _sender=admin,
    )

    c.set_allowlist(
        token_id=0,
        entries=[sp.record(address=bob.address, max_qty=2, price_override=sp.Some(sp.tez(0)))],
        _sender=admin,
    )

    c.mint_editions(token_id=0, qty=2, to_=bob.address, _sender=bob, _amount=sp.mutez(0))
