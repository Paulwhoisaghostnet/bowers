import smartpy as sp

@sp.module
def main():

    # ---- Types ----

    OfferType: type = sp.record(
        token_id=sp.nat, buyer=sp.address, unit_price=sp.mutez,
        remaining_qty=sp.nat, expiry=sp.timestamp)

    ListingType: type = sp.record(price=sp.mutez, max_qty=sp.nat, min_bps=sp.nat)

    BalanceOfRequestType: type = sp.record(owner=sp.address, token_id=sp.nat)
    BalanceOfResponseType: type = sp.record(request=BalanceOfRequestType, balance=sp.nat)
    LedgerKeyType: type = sp.record(owner=sp.address, token_id=sp.nat)
    OperatorKeyType: type = sp.record(owner=sp.address, operator=sp.address, token_id=sp.nat)
    BlacklistKeyType: type = sp.record(owner=sp.address, token_id=sp.nat, blocked=sp.address)
    OperatorParamType: type = sp.variant(add_operator=OperatorKeyType, remove_operator=OperatorKeyType)
    TransferTxType: type = sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)
    TransferBatchItemType: type = sp.record(from_=sp.address, txs=sp.list[TransferTxType])

    TokenMarketType: type = sp.record(
        royalty_recipient=sp.address,
        royalty_bps=sp.nat,
        min_offer_per_unit_mutez=sp.mutez,
    )

    # ---- Contract ----

    class BowersFA2(sp.Contract):

        def __init__(self, admin, metadata):
            self.data.admin = admin
            self.data.ledger = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, sp.nat])
            self.data.token_metadata = sp.cast(sp.big_map(), sp.big_map[sp.nat, sp.record(token_id=sp.nat, token_info=sp.map[sp.string, sp.bytes])])
            self.data.operators = sp.cast(sp.big_map(), sp.big_map[OperatorKeyType, sp.unit])
            self.data.next_token_id = sp.nat(0)
            self.data.listings = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, ListingType])
            self.data.offers = sp.cast(sp.big_map(), sp.big_map[sp.nat, OfferType])
            self.data.next_offer_id = sp.nat(0)
            self.data.claimable = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.mutez])
            self.data.blacklist = sp.cast(sp.big_map(), sp.big_map[BlacklistKeyType, sp.unit])
            self.data.contract_blocklist = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.unit])
            self.data.token_market = sp.cast(sp.big_map(), sp.big_map[sp.nat, TokenMarketType])
            self.data.metadata = metadata

        # ---- FA2 standard (TZIP-12) ----

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
                        if fk in self.data.listings:
                            del self.data.listings[fk]
                    else:
                        self.data.ledger[fk] = nfb
                    tk = sp.record(owner=tx.to_, token_id=tx.token_id)
                    tb = self.data.ledger.get(tk, default=sp.nat(0))
                    self.data.ledger[tk] = tb + tx.amount
                    sp.emit(sp.record(f=from_, t=tx.to_, i=tx.token_id, a=tx.amount), tag="xfer")

        # ---- Minting ----

        @sp.entrypoint
        def mint(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(
                params,
                sp.record(
                    metadata_uri=sp.bytes,
                    supply=sp.nat,
                    royalty_recipient=sp.address,
                    royalty_bps=sp.nat,
                    min_offer_per_unit_mutez=sp.mutez,
                ),
            )
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.supply > 0, "ZERO_SUPPLY"
            assert params.royalty_bps <= 10_000, "BPS_TOO_HIGH"

            tid = self.data.next_token_id
            self.data.next_token_id += 1

            token_info = {"": params.metadata_uri, "decimals": sp.bytes("0x30")}
            self.data.token_metadata[tid] = sp.record(token_id=tid, token_info=token_info)

            self.data.token_market[tid] = sp.record(
                royalty_recipient=params.royalty_recipient,
                royalty_bps=params.royalty_bps,
                min_offer_per_unit_mutez=params.min_offer_per_unit_mutez,
            )

            lk = sp.record(owner=self.data.admin, token_id=tid)
            cb = self.data.ledger.get(lk, default=sp.nat(0))
            self.data.ledger[lk] = cb + params.supply
            sp.emit(sp.record(i=tid, t=self.data.admin, s=params.supply), tag="mint")

        # ---- Listings (set price=0 to clear) ----

        @sp.entrypoint
        def set_listing(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, price=sp.mutez, max_qty=sp.nat, min_bps=sp.nat))
            pk = sp.record(owner=sp.sender, token_id=params.token_id)
            assert self.data.ledger.get(pk, default=sp.nat(0)) > 0, "NOT_OWNER"
            if params.price == sp.mutez(0):
                if pk in self.data.listings:
                    del self.data.listings[pk]
            else:
                assert params.min_bps <= 10_000, "BPS_TOO_HIGH"
                self.data.listings[pk] = sp.record(price=params.price, max_qty=params.max_qty, min_bps=params.min_bps)

        # ---- Instant buy ----

        @sp.entrypoint
        def buy(self, params):
            sp.cast(params, sp.record(owner=sp.address, token_id=sp.nat, qty=sp.nat))
            assert params.qty > 0, "BAD_QTY"
            assert not (sp.sender in self.data.contract_blocklist), "BLOCKED"
            assert not (sp.record(owner=params.owner, token_id=params.token_id, blocked=sp.sender) in self.data.blacklist), "BLACKLISTED"
            pk = sp.record(owner=params.owner, token_id=params.token_id)
            assert pk in self.data.listings, "NOT_FOR_SALE"
            lst = self.data.listings[pk]
            if lst.max_qty > 0:
                assert params.qty <= lst.max_qty, "MAX_QTY"
            fb = self.data.ledger.get(pk, default=sp.nat(0))
            assert fb >= params.qty, "NO_BAL"
            tp = sp.split_tokens(lst.price, params.qty, 1)
            assert sp.amount == tp, "WRONG_PRICE"
            tm = self.data.token_market[params.token_id]
            rr = tm.royalty_recipient
            ry = sp.split_tokens(tp, tm.royalty_bps, 10_000)
            po = tp - ry
            self.data.claimable[rr] = self.data.claimable.get(rr, default=sp.mutez(0)) + ry
            self.data.claimable[params.owner] = self.data.claimable.get(params.owner, default=sp.mutez(0)) + po
            nfb = sp.as_nat(fb - params.qty)
            if nfb == 0:
                if pk in self.data.ledger:
                    del self.data.ledger[pk]
                if pk in self.data.listings:
                    del self.data.listings[pk]
            else:
                self.data.ledger[pk] = nfb
            tk = sp.record(owner=sp.sender, token_id=params.token_id)
            tb = self.data.ledger.get(tk, default=sp.nat(0))
            self.data.ledger[tk] = tb + params.qty
            sp.emit(sp.record(b=sp.sender, o=params.owner, i=params.token_id, q=params.qty), tag="buy")

        # ---- Offers (partial fill) ----

        @sp.entrypoint
        def make_offer(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, qty=sp.nat, expiry=sp.timestamp))
            assert params.qty > 0, "BAD_QTY"
            assert not (sp.sender in self.data.contract_blocklist), "BLOCKED"
            assert params.expiry > sp.now, "BAD_EXPIRY"
            tm = self.data.token_market[params.token_id]
            assert sp.amount >= sp.split_tokens(tm.min_offer_per_unit_mutez, params.qty, 1), "OFFER_TOO_LOW"
            up = sp.split_tokens(sp.amount, 1, params.qty)
            assert sp.split_tokens(up, params.qty, 1) == sp.amount, "NOT_DIV"
            assert up > sp.mutez(0), "UNIT_PRICE_ZERO"
            oid = self.data.next_offer_id
            self.data.next_offer_id += 1
            self.data.offers[oid] = sp.record(
                token_id=params.token_id, buyer=sp.sender, unit_price=up,
                remaining_qty=params.qty, expiry=params.expiry)

        @sp.entrypoint
        def close_offer(self, offer_id):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(offer_id, sp.nat)
            o = self.data.offers[offer_id]
            assert o.remaining_qty > 0, "NOT_ACTIVE"
            if o.buyer != sp.sender:
                assert sp.now > o.expiry, "NO_AUTH"
            refund = sp.split_tokens(o.unit_price, o.remaining_qty, 1)
            self.data.claimable[o.buyer] = self.data.claimable.get(o.buyer, default=sp.mutez(0)) + refund
            o.remaining_qty = sp.nat(0)
            self.data.offers[offer_id] = o

        @sp.entrypoint
        def accept_offer(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(offer_id=sp.nat, accept_qty=sp.nat))
            o = self.data.offers[params.offer_id]
            assert o.remaining_qty > 0, "NOT_ACTIVE"
            assert sp.now <= o.expiry, "OFFER_EXPIRED"
            assert params.accept_qty > 0, "BAD_ACCEPT_QTY"
            assert params.accept_qty <= o.remaining_qty, "OVER_QTY"
            tid = o.token_id
            assert not (o.buyer in self.data.contract_blocklist), "BLOCKED"
            fk = sp.record(owner=sp.sender, token_id=tid)
            fb = self.data.ledger.get(fk, default=sp.nat(0))
            assert fb >= params.accept_qty, "LOW_BAL"
            assert not (sp.record(owner=sp.sender, token_id=tid, blocked=o.buyer) in self.data.blacklist), "BLACKLISTED"
            pt = sp.split_tokens(o.unit_price, params.accept_qty, 1)
            assert pt > sp.mutez(0), "PAY_ZERO"
            if fk in self.data.listings:
                lst = self.data.listings[fk]
                if lst.min_bps > 0:
                    lt = sp.split_tokens(lst.price, params.accept_qty, 1)
                    ft = sp.split_tokens(lt, lst.min_bps, 10_000)
                    assert pt >= ft, "LOW_BID"
            tm = self.data.token_market[tid]
            rr = tm.royalty_recipient
            ry = sp.split_tokens(pt, tm.royalty_bps, 10_000)
            po = pt - ry
            self.data.claimable[rr] = self.data.claimable.get(rr, default=sp.mutez(0)) + ry
            self.data.claimable[sp.sender] = self.data.claimable.get(sp.sender, default=sp.mutez(0)) + po
            nfb = sp.as_nat(fb - params.accept_qty)
            if nfb == 0:
                if fk in self.data.ledger:
                    del self.data.ledger[fk]
                if fk in self.data.listings:
                    del self.data.listings[fk]
            else:
                self.data.ledger[fk] = nfb
            tk = sp.record(owner=o.buyer, token_id=tid)
            tb = self.data.ledger.get(tk, default=sp.nat(0))
            self.data.ledger[tk] = tb + params.accept_qty
            o.remaining_qty = sp.as_nat(o.remaining_qty - params.accept_qty)
            self.data.offers[params.offer_id] = o
            sp.emit(sp.record(id=params.offer_id, o=sp.sender, q=params.accept_qty), tag="accept")

        # ---- Contract blocklist (admin) ----

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

        # ---- Blacklist (per-token, owner) ----

        @sp.entrypoint
        def blacklist_address(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, blocked=sp.address))
            assert self.data.ledger.get(sp.record(owner=sp.sender, token_id=params.token_id), default=sp.nat(0)) > 0, "NOT_OWNER"
            self.data.blacklist[sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked)] = ()

        @sp.entrypoint
        def unblacklist_address(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, blocked=sp.address))
            assert self.data.ledger.get(sp.record(owner=sp.sender, token_id=params.token_id), default=sp.nat(0)) > 0, "NOT_OWNER"
            key = sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked)
            if key in self.data.blacklist:
                del self.data.blacklist[key]

        # ---- Withdraw ----

        @sp.entrypoint
        def withdraw(self):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            amount = self.data.claimable.get(sp.sender, default=sp.mutez(0))
            assert amount > sp.mutez(0), "NO_FUNDS"
            self.data.claimable[sp.sender] = sp.mutez(0)
            sp.send(sp.sender, amount)

        # ---- On-chain views ----

        @sp.onchain_view
        def get_balance(self, params):
            sp.cast(params, sp.record(owner=sp.address, token_id=sp.nat))
            return self.data.ledger.get(sp.record(owner=params.owner, token_id=params.token_id), default=sp.nat(0))

        @sp.onchain_view
        def get_offer(self, offer_id):
            sp.cast(offer_id, sp.nat)
            return self.data.offers[offer_id]

        @sp.onchain_view
        def is_operator(self, params):
            sp.cast(params, sp.record(owner=sp.address, operator=sp.address, token_id=sp.nat))
            return sp.record(owner=params.owner, operator=params.operator, token_id=params.token_id) in self.data.operators

        @sp.onchain_view
        def get_listing(self, params):
            sp.cast(params, sp.record(owner=sp.address, token_id=sp.nat))
            return self.data.listings[sp.record(owner=params.owner, token_id=params.token_id)]

        @sp.onchain_view
        def get_claimable(self, addr):
            sp.cast(addr, sp.address)
            return self.data.claimable.get(addr, default=sp.mutez(0))

        @sp.onchain_view
        def is_blacklisted(self, params):
            sp.cast(params, sp.record(owner=sp.address, token_id=sp.nat, blocked=sp.address))
            return params in self.data.blacklist

        @sp.onchain_view
        def get_token_market(self, token_id):
            sp.cast(token_id, sp.nat)
            return self.data.token_market[token_id]


@sp.add_test()
def test():
    scenario = sp.test_scenario("BowersFA2", main)
    admin = sp.test_account("admin")
    c = main.BowersFA2(
        admin=admin.address,
        metadata=sp.scenario_utils.metadata_of_url("https://example.com"),
    )
    scenario += c
