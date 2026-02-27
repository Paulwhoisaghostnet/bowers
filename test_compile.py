import smartpy as sp

@sp.module
def main():

    OfferType: type = sp.record(
        token_id=sp.nat, buyer=sp.address, unit_price=sp.mutez,
        remaining_qty=sp.nat, remaining_amount=sp.mutez,
        expiry=sp.timestamp, active=sp.bool,
        required_rejections=sp.nat, rejected_count=sp.nat)

    ListingType: type = sp.record(price=sp.mutez, max_qty=sp.nat, min_bps=sp.nat)

    BalanceOfRequestType: type = sp.record(owner=sp.address, token_id=sp.nat)
    BalanceOfResponseType: type = sp.record(request=BalanceOfRequestType, balance=sp.nat)
    LedgerKeyType: type = sp.record(owner=sp.address, token_id=sp.nat)
    OperatorKeyType: type = sp.record(owner=sp.address, operator=sp.address, token_id=sp.nat)
    OperatorParamType: type = sp.variant(add_operator=OperatorKeyType, remove_operator=OperatorKeyType)
    TransferTxType: type = sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)
    TransferBatchItemType: type = sp.record(from_=sp.address, txs=sp.list[TransferTxType])

    class BowersFA2(sp.Contract):

        def __init__(self, admin, metadata, royalty_recipient, royalty_bps, min_offer_per_unit_mutez):
            self.data.admin = admin
            self.data.ledger = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, sp.nat])
            self.data.token_metadata = sp.cast(sp.big_map(), sp.big_map[sp.nat, sp.record(token_id=sp.nat, token_info=sp.map[sp.string, sp.bytes])])
            self.data.operators = sp.cast(sp.big_map(), sp.big_map[OperatorKeyType, sp.unit])
            self.data.next_token_id = sp.nat(0)
            self.data.listings = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, ListingType])
            self.data.offers = sp.cast(sp.big_map(), sp.big_map[sp.nat, OfferType])
            self.data.next_offer_id = sp.nat(0)
            self.data.claimable = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.mutez])
            self.data.royalty_recipient = royalty_recipient
            self.data.royalty_bps = royalty_bps
            self.data.min_offer_per_unit_mutez = min_offer_per_unit_mutez
            self.data.metadata = metadata

        @sp.entrypoint
        def balance_of(self, params):
            sp.cast(params, sp.record(requests=sp.list[BalanceOfRequestType], callback=sp.contract[sp.list[BalanceOfResponseType]]))
            balances = []
            for req in params.requests:
                bal = self.data.ledger.get(sp.record(owner=req.owner, token_id=req.token_id), default=sp.nat(0))
                balances.push(sp.record(request=sp.record(owner=req.owner, token_id=req.token_id), balance=bal))
            sp.transfer(reversed(balances), sp.mutez(0), params.callback)

        @sp.entrypoint
        def update_operators(self, actions):
            sp.cast(actions, sp.list[OperatorParamType])
            for action in actions:
                match action:
                    case add_operator(op):
                        assert op.owner == sp.sender, "NOT_OWNER"
                        self.data.operators[op] = ()
                    case remove_operator(op):
                        assert op.owner == sp.sender, "NOT_OWNER"
                        assert op in self.data.operators, "NO_SUCH_OPERATOR"
                        del self.data.operators[op]

        @sp.entrypoint
        def transfer(self, batch):
            sp.cast(batch, sp.list[TransferBatchItemType])
            for item in batch:
                from_ = item.from_
                for tx in item.txs:
                    if from_ != sp.sender:
                        assert sp.record(owner=from_, operator=sp.sender, token_id=tx.token_id) in self.data.operators, "NOT_OPERATOR"
                    assert tx.amount > 0, "BAD_AMOUNT"
                    fk = sp.record(owner=from_, token_id=tx.token_id)
                    fb = self.data.ledger.get(fk, default=sp.nat(0))
                    assert fb >= tx.amount, "INSUFFICIENT_BALANCE"
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

        @sp.entrypoint
        def mint(self, params):
            sp.cast(params, sp.record(to_=sp.address, supply=sp.nat, token_info=sp.map[sp.string, sp.bytes]))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.supply > 0, "ZERO_SUPPLY"
            tid = self.data.next_token_id
            self.data.next_token_id += 1
            self.data.token_metadata[tid] = sp.record(token_id=tid, token_info=params.token_info)
            lk = sp.record(owner=params.to_, token_id=tid)
            cb = self.data.ledger.get(lk, default=sp.nat(0))
            self.data.ledger[lk] = cb + params.supply

        @sp.entrypoint
        def set_listing(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, price=sp.mutez, max_qty=sp.nat, min_bps=sp.nat))
            assert self.data.ledger.get(sp.record(owner=sp.sender, token_id=params.token_id), default=sp.nat(0)) > 0, "NOT_OWNER"
            if params.price == sp.mutez(0):
                pk = sp.record(owner=sp.sender, token_id=params.token_id)
                if pk in self.data.listings:
                    del self.data.listings[pk]
            else:
                assert params.min_bps <= 10_000, "BPS_TOO_HIGH"
                self.data.listings[sp.record(owner=sp.sender, token_id=params.token_id)] = sp.record(price=params.price, max_qty=params.max_qty, min_bps=params.min_bps)

        @sp.entrypoint
        def buy(self, params):
            sp.cast(params, sp.record(owner=sp.address, token_id=sp.nat, qty=sp.nat))
            assert params.qty > 0, "BAD_QTY"
            pk = sp.record(owner=params.owner, token_id=params.token_id)
            assert pk in self.data.listings, "NOT_FOR_SALE"
            lst = self.data.listings[pk]
            if lst.max_qty > 0:
                assert params.qty <= lst.max_qty, "EXCEEDS_MAX_BUY_QTY"
            fb = self.data.ledger.get(pk, default=sp.nat(0))
            assert fb >= params.qty, "OWNER_INSUFFICIENT"
            tp = sp.split_tokens(lst.price, params.qty, 1)
            assert sp.amount == tp, "WRONG_PRICE"
            ry = sp.split_tokens(tp, self.data.royalty_bps, 10_000)
            po = tp - ry
            self.data.claimable[self.data.royalty_recipient] = self.data.claimable.get(self.data.royalty_recipient, default=sp.mutez(0)) + ry
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

        @sp.entrypoint
        def make_offer(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, qty=sp.nat, expiry=sp.timestamp, required_rejections=sp.nat))
            assert params.qty > 0, "BAD_QTY"
            assert params.expiry > sp.now, "BAD_EXPIRY"
            assert params.required_rejections > 0, "BAD_REJECTIONS"
            assert sp.amount >= sp.split_tokens(self.data.min_offer_per_unit_mutez, params.qty, 1), "OFFER_TOO_LOW"
            up = sp.split_tokens(sp.amount, 1, params.qty)
            assert sp.split_tokens(up, params.qty, 1) == sp.amount, "AMOUNT_NOT_DIVISIBLE_BY_QTY"
            assert up > sp.mutez(0), "UNIT_PRICE_ZERO"
            oid = self.data.next_offer_id
            self.data.next_offer_id += 1
            self.data.offers[oid] = sp.record(
                token_id=params.token_id, buyer=sp.sender, unit_price=up,
                remaining_qty=params.qty, remaining_amount=sp.amount,
                expiry=params.expiry, active=True,
                required_rejections=params.required_rejections, rejected_count=sp.nat(0))

        @sp.entrypoint
        def reject_offer(self, offer_id):
            sp.cast(offer_id, sp.nat)
            o = self.data.offers[offer_id]
            assert o.active, "NOT_ACTIVE"
            assert self.data.ledger.get(sp.record(owner=sp.sender, token_id=o.token_id), default=sp.nat(0)) > 0, "NOT_OWNER"
            o.rejected_count += 1
            if o.rejected_count >= o.required_rejections:
                o.active = False
                if o.remaining_amount > sp.mutez(0):
                    self.data.claimable[o.buyer] = self.data.claimable.get(o.buyer, default=sp.mutez(0)) + o.remaining_amount
                o.remaining_amount = sp.mutez(0)
                o.remaining_qty = sp.nat(0)
            self.data.offers[offer_id] = o

        @sp.entrypoint
        def close_offer(self, offer_id):
            sp.cast(offer_id, sp.nat)
            o = self.data.offers[offer_id]
            assert o.active, "NOT_ACTIVE"
            if o.buyer == sp.sender:
                pass
            else:
                assert sp.now > o.expiry, "NOT_EXPIRED_OR_NOT_BUYER"
            o.active = False
            if o.remaining_amount > sp.mutez(0):
                self.data.claimable[o.buyer] = self.data.claimable.get(o.buyer, default=sp.mutez(0)) + o.remaining_amount
            o.remaining_amount = sp.mutez(0)
            o.remaining_qty = sp.nat(0)
            self.data.offers[offer_id] = o

        @sp.entrypoint
        def accept_offer(self, params):
            sp.cast(params, sp.record(offer_id=sp.nat, accept_qty=sp.nat))
            o = self.data.offers[params.offer_id]
            assert o.active, "NOT_ACTIVE"
            assert sp.now <= o.expiry, "OFFER_EXPIRED"
            assert params.accept_qty > 0, "BAD_ACCEPT_QTY"
            assert params.accept_qty <= o.remaining_qty, "ACCEPT_EXCEEDS_REMAINING"
            tid = o.token_id
            fk = sp.record(owner=sp.sender, token_id=tid)
            fb = self.data.ledger.get(fk, default=sp.nat(0))
            assert fb >= params.accept_qty, "INSUFFICIENT_BALANCE"
            pt = sp.split_tokens(o.unit_price, params.accept_qty, 1)
            assert pt > sp.mutez(0), "PAY_ZERO"
            assert pt <= o.remaining_amount, "OFFER_AMOUNT_UNDERFLOW"
            if fk in self.data.listings:
                lst = self.data.listings[fk]
                if lst.min_bps > 0:
                    lt = sp.split_tokens(lst.price, params.accept_qty, 1)
                    ft = sp.split_tokens(lt, lst.min_bps, 10_000)
                    assert pt >= ft, "BELOW_OWNER_PERCENT_FLOOR"
            ry = sp.split_tokens(pt, self.data.royalty_bps, 10_000)
            po = pt - ry
            self.data.claimable[self.data.royalty_recipient] = self.data.claimable.get(self.data.royalty_recipient, default=sp.mutez(0)) + ry
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
            o.remaining_amount = o.remaining_amount - pt
            if o.remaining_qty == 0:
                o.active = False
                if o.remaining_amount > sp.mutez(0):
                    self.data.claimable[o.buyer] = self.data.claimable.get(o.buyer, default=sp.mutez(0)) + o.remaining_amount
                    o.remaining_amount = sp.mutez(0)
            self.data.offers[params.offer_id] = o

        @sp.entrypoint
        def withdraw(self):
            amount = self.data.claimable.get(sp.sender, default=sp.mutez(0))
            assert amount > sp.mutez(0), "NO_FUNDS"
            self.data.claimable[sp.sender] = sp.mutez(0)
            sp.send(sp.sender, amount)


@sp.add_test()
def test():
    scenario = sp.test_scenario("BowersFA2", main)
    admin = sp.test_account("admin")
    c = main.BowersFA2(
        admin=admin.address,
        metadata=sp.scenario_utils.metadata_of_url("https://example.com"),
        royalty_recipient=admin.address,
        royalty_bps=500,
        min_offer_per_unit_mutez=sp.mutez(1000)
    )
    scenario += c
