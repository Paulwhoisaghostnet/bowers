# BowersUnifiedFA2.py
# Unified FA2: admin mint, open edition, bonding curve, and allowlist per-token.
# mint_model 0 = admin-only (mint entrypoint, no token_config).
# mint_model 1 = open edition (create_token + mint_editions, optional allowlist).
# mint_model 2 = bonding curve (create_token + mint_editions).
# Full marketplace: listings, offers, buy, blacklist, withdraw.

import smartpy as sp


@sp.module
def main():
    OfferType: type = sp.record(
        token_id=sp.nat,
        buyer=sp.address,
        unit_price=sp.mutez,
        remaining_qty=sp.nat,
        expiry=sp.timestamp,
    )
    ListingType: type = sp.record(price=sp.mutez, max_qty=sp.nat, min_bps=sp.nat)
    BalanceOfRequestType: type = sp.record(owner=sp.address, token_id=sp.nat)
    BalanceOfResponseType: type = sp.record(request=BalanceOfRequestType, balance=sp.nat)
    LedgerKeyType: type = sp.record(owner=sp.address, token_id=sp.nat)
    OperatorKeyType: type = sp.record(owner=sp.address, operator=sp.address, token_id=sp.nat)
    BlacklistKeyType: type = sp.record(owner=sp.address, token_id=sp.nat, blocked=sp.address)
    AllowlistKeyType: type = sp.record(token_id=sp.nat, address=sp.address)
    AllowlistEntryType: type = sp.record(
        max_qty=sp.nat,
        minted=sp.nat,
        price_override=sp.option[sp.mutez],
    )
    OperatorParamType: type = sp.variant(add_operator=OperatorKeyType, remove_operator=OperatorKeyType)
    TransferTxType: type = sp.record(to_=sp.address, token_id=sp.nat, amount=sp.nat)
    TransferBatchItemType: type = sp.record(from_=sp.address, txs=sp.list[TransferTxType])

    TokenConfigType: type = sp.record(
        creator=sp.address,
        mint_model=sp.nat,
        mint_end=sp.option[sp.timestamp],
        mint_paused=sp.bool,
        minted=sp.nat,
        max_supply=sp.option[sp.nat],
        mint_price=sp.option[sp.mutez],
        base_price=sp.option[sp.mutez],
        price_increment=sp.option[sp.mutez],
        step_size=sp.option[sp.nat],
        allowlist_end=sp.option[sp.timestamp],
        royalty_recipient=sp.address,
        royalty_bps=sp.nat,
        min_offer_per_unit_mutez=sp.mutez,
    )

    AllowlistEntryParam: type = sp.record(
        address=sp.address,
        max_qty=sp.nat,
        price_override=sp.option[sp.mutez],
    )

    class BowersUnifiedFA2(sp.Contract):
        def __init__(self, admin, metadata):
            self.data.admin = admin
            self.data.metadata = metadata
            self.data.ledger = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, sp.nat])
            self.data.token_metadata = sp.cast(
                sp.big_map(),
                sp.big_map[sp.nat, sp.record(token_id=sp.nat, token_info=sp.map[sp.string, sp.bytes])],
            )
            self.data.token_config = sp.cast(sp.big_map(), sp.big_map[sp.nat, TokenConfigType])
            self.data.token_allowlist = sp.cast(sp.big_map(), sp.big_map[AllowlistKeyType, AllowlistEntryType])
            self.data.operators = sp.cast(sp.big_map(), sp.big_map[OperatorKeyType, sp.unit])
            self.data.next_token_id = sp.nat(0)
            self.data.listings = sp.cast(sp.big_map(), sp.big_map[LedgerKeyType, ListingType])
            self.data.offers = sp.cast(sp.big_map(), sp.big_map[sp.nat, OfferType])
            self.data.next_offer_id = sp.nat(0)
            self.data.claimable = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.mutez])
            self.data.blacklist = sp.cast(sp.big_map(), sp.big_map[BlacklistKeyType, sp.unit])
            self.data.contract_blocklist = sp.cast(sp.big_map(), sp.big_map[sp.address, sp.unit])

        @sp.entrypoint
        def set_admin(self, new_admin):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(new_admin, sp.address)
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            self.data.admin = new_admin

        # ---- Admin mint ----

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

            self.data.token_config[tid] = sp.record(
                creator=self.data.admin,
                mint_model=sp.nat(0),
                mint_end=None,
                mint_paused=True,
                minted=params.supply,
                max_supply=sp.Some(params.supply),
                mint_price=None,
                base_price=None,
                price_increment=None,
                step_size=None,
                allowlist_end=None,
                royalty_recipient=params.royalty_recipient,
                royalty_bps=params.royalty_bps,
                min_offer_per_unit_mutez=params.min_offer_per_unit_mutez,
            )

            lk = sp.record(owner=self.data.admin, token_id=tid)
            cb = self.data.ledger.get(lk, default=sp.nat(0))
            self.data.ledger[lk] = cb + params.supply
            sp.emit(sp.record(i=tid, t=self.data.admin, s=params.supply), tag="mint")

        # ---- create_token: OE (mint_model=1) or BC (mint_model=2) ----

        @sp.entrypoint
        def create_token(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(
                params,
                sp.record(
                    metadata_uri=sp.bytes,
                    creator=sp.address,
                    mint_model=sp.nat,
                    mint_price=sp.option[sp.mutez],
                    base_price=sp.option[sp.mutez],
                    price_increment=sp.option[sp.mutez],
                    step_size=sp.option[sp.nat],
                    max_supply=sp.option[sp.nat],
                    mint_end=sp.option[sp.timestamp],
                    allowlist_end=sp.option[sp.timestamp],
                    royalty_recipient=sp.address,
                    royalty_bps=sp.nat,
                    min_offer_per_unit_mutez=sp.mutez,
                ),
            )
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.mint_model == 1 or params.mint_model == 2, "BAD_MINT_MODEL"
            assert params.royalty_bps <= 10_000, "BPS_TOO_HIGH"

            mp = params.mint_price
            bp = params.base_price
            pi = params.price_increment
            ss = params.step_size
            ms = params.max_supply

            if params.mint_model == 1:
                assert mp.is_some(), "OE_NEEDS_MINT_PRICE"
                assert not bp.is_some(), "OE_NO_BASE"
            else:
                assert bp.is_some(), "BC_NEEDS_BASE"
                assert pi.is_some(), "BC_NEEDS_INC"
                assert ss.is_some(), "BC_NEEDS_STEP"
                assert ms.is_some(), "BC_NEEDS_MAX"
                step = ss.unwrap_some()
                max_s = ms.unwrap_some()
                assert step > 0, "STEP_ZERO"
                assert max_s > 0, "ZERO_SUPPLY"

            tid = self.data.next_token_id
            self.data.next_token_id += 1

            token_info = {"": params.metadata_uri, "decimals": sp.bytes("0x30")}
            self.data.token_metadata[tid] = sp.record(token_id=tid, token_info=token_info)

            self.data.token_config[tid] = sp.record(
                creator=params.creator,
                mint_model=params.mint_model,
                mint_end=params.mint_end,
                mint_paused=False,
                minted=sp.nat(0),
                max_supply=params.max_supply,
                mint_price=params.mint_price,
                base_price=params.base_price,
                price_increment=params.price_increment,
                step_size=params.step_size,
                allowlist_end=params.allowlist_end,
                royalty_recipient=params.royalty_recipient,
                royalty_bps=params.royalty_bps,
                min_offer_per_unit_mutez=params.min_offer_per_unit_mutez,
            )

        @sp.entrypoint
        def set_mint_price(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, mint_price=sp.mutez))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            assert cfg.mint_model == 1, "NOT_OE"
            cfg.mint_price = sp.Some(params.mint_price)
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
        def set_mint_end(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, mint_end=sp.option[sp.timestamp]))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            cfg.mint_end = params.mint_end
            self.data.token_config[params.token_id] = cfg

        @sp.entrypoint
        def mint_editions(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, qty=sp.nat, to_=sp.address))
            assert params.qty > 0, "BAD_QTY"
            assert not (params.to_ in self.data.contract_blocklist), "BLOCKED"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            cfg = self.data.token_config[params.token_id]
            assert cfg.mint_model == 1 or cfg.mint_model == 2, "ADMIN_ONLY"

            me = cfg.mint_end
            if me.is_some():
                assert sp.now <= me.unwrap_some(), "MINT_CLOSED"
            assert not cfg.mint_paused, "MINT_CLOSED"

            total = sp.mutez(0)

            if cfg.mint_model == 1:
                ms_opt = cfg.max_supply
                if ms_opt.is_some():
                    cap = ms_opt.unwrap_some()
                    assert cfg.minted + params.qty <= cap, "MAX_SUPPLY"

                price_per = cfg.mint_price.unwrap_some()
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
                total = sp.split_tokens(price_per, params.qty, 1)

            else:
                ms2 = cfg.max_supply.unwrap_some()
                assert cfg.minted + params.qty <= ms2, "MAX_SUPPLY"
                bp = cfg.base_price.unwrap_some()
                inc = cfg.price_increment.unwrap_some()
                ss = cfg.step_size.unwrap_some()
                i = sp.nat(0)
                while i < params.qty:
                    edition_index = cfg.minted + i
                    step_index = sp.fst(sp.ediv(edition_index, ss).unwrap_some())
                    total = total + bp + sp.split_tokens(inc, step_index, 1)
                    i += 1

            assert sp.amount == total, "BAD_PAYMENT"

            lk = sp.record(owner=params.to_, token_id=params.token_id)
            self.data.ledger[lk] = (
                self.data.ledger.get(lk, default=sp.nat(0)) + params.qty
            )
            self.data.claimable[cfg.creator] = (
                self.data.claimable.get(cfg.creator, default=sp.mutez(0)) + total
            )
            cfg.minted = cfg.minted + params.qty
            self.data.token_config[params.token_id] = cfg
            sp.emit(sp.record(token_id=params.token_id, to_=params.to_, qty=params.qty, paid=total), tag="mint")

        # ---- Allowlist ----

        @sp.entrypoint
        def set_allowlist(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(params, sp.record(token_id=sp.nat, entries=sp.list[AllowlistEntryParam]))
            assert sp.sender == self.data.admin, "NOT_ADMIN"
            assert params.token_id in self.data.token_config, "TOKEN_UNDEFINED"
            for e in params.entries:
                key = sp.record(token_id=params.token_id, address=e.address)
                self.data.token_allowlist[key] = sp.record(
                    max_qty=e.max_qty,
                    minted=sp.nat(0),
                    price_override=e.price_override,
                )

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

        # ---- FA2 ----

        @sp.entrypoint
        def balance_of(self, params):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            sp.cast(
                params,
                sp.record(requests=sp.list[BalanceOfRequestType], callback=sp.contract[sp.list[BalanceOfResponseType]]),
            )
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

        # ---- Marketplace ----

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
            cfg = self.data.token_config[params.token_id]
            rr = cfg.royalty_recipient
            ry = sp.split_tokens(tp, cfg.royalty_bps, 10_000)
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

        @sp.entrypoint
        def make_offer(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, qty=sp.nat, expiry=sp.timestamp))
            assert params.qty > 0, "BAD_QTY"
            assert not (sp.sender in self.data.contract_blocklist), "BLOCKED"
            assert params.expiry > sp.now, "BAD_EXPIRY"
            cfg = self.data.token_config[params.token_id]
            assert sp.amount >= sp.split_tokens(cfg.min_offer_per_unit_mutez, params.qty, 1), "OFFER_TOO_LOW"
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
            cfg = self.data.token_config[tid]
            rr = cfg.royalty_recipient
            ry = sp.split_tokens(pt, cfg.royalty_bps, 10_000)
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

        @sp.entrypoint
        def withdraw(self):
            assert sp.amount == sp.mutez(0), "NO_TEZ"
            amount = self.data.claimable.get(sp.sender, default=sp.mutez(0))
            assert amount > sp.mutez(0), "NO_FUNDS"
            self.data.claimable[sp.sender] = sp.mutez(0)
            sp.send(sp.sender, amount)

        # ---- Views ----

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
        def get_token_config(self, token_id):
            sp.cast(token_id, sp.nat)
            return self.data.token_config[token_id]

        @sp.onchain_view
        def get_current_price(self, token_id):
            sp.cast(token_id, sp.nat)
            result = sp.mutez(0)
            if token_id in self.data.token_config:
                cfg = self.data.token_config[token_id]
                mp = cfg.mint_price
                if cfg.mint_model == 1 and mp.is_some():
                    result = mp.unwrap_some()
                else:
                    bp_opt = cfg.base_price
                    ss_opt = cfg.step_size
                    pi_opt = cfg.price_increment
                    if cfg.mint_model == 2 and bp_opt.is_some() and ss_opt.is_some():
                        ss = ss_opt.unwrap_some()
                        inc = pi_opt.unwrap_some()
                        step_index = sp.fst(sp.ediv(cfg.minted, ss).unwrap_some())
                        result = bp_opt.unwrap_some() + sp.split_tokens(inc, step_index, 1)
            return result

        @sp.onchain_view
        def get_allowlist_entry(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, address=sp.address))
            key = sp.record(token_id=params.token_id, address=params.address)
            result = sp.cast(None, sp.option[AllowlistEntryType])
            if key in self.data.token_allowlist:
                result = sp.Some(self.data.token_allowlist[key])
            return result

        @sp.onchain_view
        def is_allowlisted(self, params):
            sp.cast(params, sp.record(token_id=sp.nat, address=sp.address))
            key = sp.record(token_id=params.token_id, address=params.address)
            return key in self.data.token_allowlist


def bytes_of_string(s):
    return sp.bytes("0x" + s.encode("utf-8").hex())


@sp.add_test()
def test():
    scenario = sp.test_scenario("BowersUnifiedFA2", main)
    admin = sp.test_account("admin")
    alice = sp.test_account("alice")
    bob = sp.test_account("bob")
    c = main.BowersUnifiedFA2(
        admin=admin.address,
        metadata=sp.scenario_utils.metadata_of_url("https://example.com"),
    )
    scenario += c

    # Admin mint
    c.mint(
        metadata_uri=bytes_of_string("ipfs://QmAdmin"),
        supply=10,
        royalty_recipient=admin.address,
        royalty_bps=500,
        min_offer_per_unit_mutez=sp.mutez(1000),
        _sender=admin,
    )

    # Create OE token
    c.create_token(
        metadata_uri=bytes_of_string("ipfs://QmOE"),
        creator=alice.address,
        mint_model=1,
        mint_price=sp.Some(sp.tez(1)),
        base_price=None,
        price_increment=None,
        step_size=None,
        max_supply=None,
        mint_end=None,
        allowlist_end=None,
        royalty_recipient=alice.address,
        royalty_bps=1000,
        min_offer_per_unit_mutez=sp.mutez(500),
        _sender=admin,
    )

    # Create BC token
    c.create_token(
        metadata_uri=bytes_of_string("ipfs://QmBC"),
        creator=alice.address,
        mint_model=2,
        mint_price=None,
        base_price=sp.Some(sp.tez(1)),
        price_increment=sp.Some(sp.mutez(100_000)),
        step_size=sp.Some(10),
        max_supply=sp.Some(100),
        mint_end=None,
        allowlist_end=None,
        royalty_recipient=alice.address,
        royalty_bps=750,
        min_offer_per_unit_mutez=sp.mutez(2000),
        _sender=admin,
    )

    c.mint_editions(token_id=1, qty=2, to_=bob.address, _sender=bob, _amount=sp.tez(2))
    c.mint_editions(token_id=2, qty=10, to_=bob.address, _sender=bob, _amount=sp.tez(10))
