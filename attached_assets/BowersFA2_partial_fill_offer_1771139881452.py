import smartpy as sp

@sp.module
def main():

    ####################################################################
    # Types
    ####################################################################

    OfferType = sp.TRecord(
        token_id=sp.TNat,
        buyer=sp.TAddress,
        unit_price=sp.TMutez,          # fixed per-unit price (enforced at creation)
        remaining_qty=sp.TNat,         # remaining quantity to fill
        remaining_amount=sp.TMutez,    # remaining funds to be paid out/refunded
        expiry=sp.TTimestamp,
        active=sp.TBool,
        required_rejections=sp.TNat,   # snapshot of owner_count at creation
        rejected_count=sp.TNat
    ).layout(
        ("token_id",
         ("buyer",
          ("unit_price",
           ("remaining_qty",
            ("remaining_amount",
             ("expiry",
              ("active", ("required_rejections", "rejected_count")))))))))
    )

    BalanceOfRequestType = sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id"))
    BalanceOfResponseType = sp.TRecord(request=BalanceOfRequestType, balance=sp.TNat).layout(("request", "balance"))

    OperatorParamType = sp.TVariant(
        add_operator=sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id"))),
        remove_operator=sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id")))
    )

    TransferTxType = sp.TRecord(to_=sp.TAddress, token_id=sp.TNat, amount=sp.TNat).layout(("to_", ("token_id", "amount")))
    TransferBatchItemType = sp.TRecord(from_=sp.TAddress, txs=sp.TList(TransferTxType)).layout(("from_", "txs"))

    ####################################################################
    # Contract
    ####################################################################

    class BowersFA2(sp.Contract):

        def __init__(self, admin, metadata, royalty_recipient, royalty_bps, min_offer_per_unit_mutez):
            sp.verify(royalty_bps <= 10_000, "ROYALTY_BPS_TOO_HIGH")

            self.init(
                # FA2 core
                admin=admin,

                ledger=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")),
                    tvalue=sp.TNat
                ),

                token_supply=sp.big_map(tkey=sp.TNat, tvalue=sp.TNat),

                token_metadata=sp.big_map(
                    tkey=sp.TNat,
                    tvalue=sp.TRecord(token_id=sp.TNat, token_info=sp.TMap(sp.TString, sp.TBytes)).layout(("token_id", "token_info"))
                ),

                operators=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id"))),
                    tvalue=sp.TUnit
                ),

                next_token_id=sp.nat(0),

                # Owner registry
                token_owners=sp.big_map(
                    tkey=sp.TRecord(token_id=sp.TNat, owner=sp.TAddress).layout(("token_id", "owner")),
                    tvalue=sp.TUnit
                ),
                owner_count=sp.big_map(tkey=sp.TNat, tvalue=sp.TNat),

                # Listings / controls (owner-scoped)
                prices=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")),
                    tvalue=sp.TMutez
                ),
                max_buy_qty=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")),
                    tvalue=sp.TNat
                ),
                min_offer_bps_of_list=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")),
                    tvalue=sp.TNat
                ),

                # Offers (token-wide, PARTIAL FILL)
                offers=sp.big_map(tkey=sp.TNat, tvalue=OfferType),
                next_offer_id=sp.nat(0),

                offer_rejections=sp.big_map(
                    tkey=sp.TRecord(offer_id=sp.TNat, owner=sp.TAddress).layout(("offer_id", "owner")),
                    tvalue=sp.TUnit
                ),

                # Pull payments
                claimable=sp.big_map(tkey=sp.TAddress, tvalue=sp.TMutez),

                # Owner-scoped blacklist
                blacklist=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat, blocked=sp.TAddress).layout(("owner", ("token_id", "blocked"))),
                    tvalue=sp.TUnit
                ),

                # Config
                royalty_recipient=royalty_recipient,
                royalty_bps=royalty_bps,
                min_offer_per_unit_mutez=min_offer_per_unit_mutez,
                metadata=metadata
            )

        ################################################################
        # Helpers
        ################################################################

        def bal(self, owner, token_id):
            return self.data.ledger.get(sp.record(owner=owner, token_id=token_id), 0)

        def credit(self, addr, amount):
            self.data.claimable[addr] = self.data.claimable.get(addr, sp.mutez(0)) + amount

        def is_blacklisted(self, owner, token_id, actor):
            return self.data.blacklist.contains(sp.record(owner=owner, token_id=token_id, blocked=actor))

        def mul_mutez_nat(self, m, n):
            return sp.split_tokens(m, n, 1)  # m * n

        def owner_key(self, token_id, owner):
            return sp.record(token_id=token_id, owner=owner)

        def price_key(self, owner, token_id):
            return sp.record(owner=owner, token_id=token_id)

        def get_owner_count_internal(self, token_id):
            return self.data.owner_count.get(token_id, 0)

        def set_owner_present(self, token_id, owner, present):
            k = self.owner_key(token_id, owner)
            count = self.get_owner_count_internal(token_id)

            sp.if present:
                sp.if ~self.data.token_owners.contains(k):
                    self.data.token_owners[k] = sp.unit
                    self.data.owner_count[token_id] = count + 1
            sp.else:
                sp.if self.data.token_owners.contains(k):
                    del self.data.token_owners[k]
                    sp.verify(count > 0, "OWNER_COUNT_UNDERFLOW")
                    self.data.owner_count[token_id] = count - 1

        def set_bal(self, owner, token_id, new_bal):
            key = sp.record(owner=owner, token_id=token_id)
            old_bal = self.bal(owner, token_id)

            sp.if new_bal == 0:
                sp.if self.data.ledger.contains(key):
                    del self.data.ledger[key]
            sp.else:
                self.data.ledger[key] = new_bal

            sp.if (old_bal == 0) & (new_bal > 0):
                self.set_owner_present(token_id, owner, True)
            sp.if (old_bal > 0) & (new_bal == 0):
                self.set_owner_present(token_id, owner, False)

                # clear listing when owner exits holdings
                pk = self.price_key(owner, token_id)
                sp.if self.data.prices.contains(pk):
                    del self.data.prices[pk]

        def require_owner(self, token_id):
            sp.verify(self.bal(sp.sender, token_id) > 0, "NOT_OWNER")

        def require_operator_or_owner(self, owner, token_id):
            sp.if owner != sp.sender:
                key = sp.record(owner=owner, operator=sp.sender, token_id=token_id)
                sp.verify(self.data.operators.contains(key), "NOT_OPERATOR")

        def get_max_buy_qty(self, owner, token_id):
            return self.data.max_buy_qty.get(self.price_key(owner, token_id), 0)

        def get_min_offer_bps(self, owner, token_id):
            return self.data.min_offer_bps_of_list.get(self.price_key(owner, token_id), 0)

        def owner_floor_total(self, owner, token_id, qty):
            """
            returns (enabled, floor_total_mutez)
            enabled iff owner has listing AND bps>0
            """
            pk = self.price_key(owner, token_id)
            bps = self.get_min_offer_bps(owner, token_id)

            sp.if (bps > 0) & self.data.prices.contains(pk):
                list_total = self.mul_mutez_nat(self.data.prices[pk], qty)
                floor_total = sp.split_tokens(list_total, bps, 10_000)
                return sp.pair(True, floor_total)
            sp.else:
                return sp.pair(False, sp.mutez(0))

        ################################################################
        # Events
        ################################################################

        def emit(self, tag, payload):
            sp.emit(payload, tag=tag)

        ################################################################
        # FA2 entrypoints
        ################################################################

        @sp.entrypoint
        def balance_of(self, params):
            sp.set_type(params, sp.TRecord(
                requests=sp.TList(BalanceOfRequestType),
                callback=sp.TContract(sp.TList(BalanceOfResponseType))
            ).layout(("requests", "callback")))

            responses = sp.local("responses", sp.list(t=BalanceOfResponseType))
            sp.for req in params.requests:
                responses.value.push(sp.record(request=req, balance=self.bal(req.owner, req.token_id)))
            sp.transfer(responses.value, sp.mutez(0), params.callback)

        @sp.entrypoint
        def update_operators(self, params):
            sp.set_type(params, sp.TList(OperatorParamType))

            sp.for update in params:
                sp.if update.is_variant("add_operator"):
                    op = update.add_operator
                    sp.verify(op.owner == sp.sender, "NOT_OWNER")
                    self.data.operators[sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id)] = sp.unit
                    self.emit("fa2_operator_added", sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id))
                sp.else:
                    op = update.remove_operator
                    sp.verify(op.owner == sp.sender, "NOT_OWNER")
                    k = sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id)
                    sp.verify(self.data.operators.contains(k), "NO_SUCH_OPERATOR")
                    del self.data.operators[k]
                    self.emit("fa2_operator_removed", sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id))

        @sp.entrypoint
        def transfer(self, batch):
            sp.set_type(batch, sp.TList(TransferBatchItemType))

            sp.for tx in batch:
                owner = tx.from_
                sp.for t in tx.txs:
                    self.require_operator_or_owner(owner, t.token_id)
                    sp.verify(t.amount > 0, "BAD_AMOUNT")
                    sp.verify(self.bal(owner, t.token_id) >= t.amount, "INSUFFICIENT_BALANCE")

                    self.set_bal(owner, t.token_id, self.bal(owner, t.token_id) - t.amount)
                    self.set_bal(t.to_, t.token_id, self.bal(t.to_, t.token_id) + t.amount)

                    self.emit("fa2_transfer", sp.record(from_=owner, to_=t.to_, token_id=t.token_id, amount=t.amount))

        ################################################################
        # Minting
        ################################################################

        @sp.entrypoint
        def mint(self, params):
            sp.set_type(params, sp.TRecord(
                to_=sp.TAddress,
                supply=sp.TNat,
                token_info=sp.TMap(sp.TString, sp.TBytes)
            ).layout(("to_", ("supply", "token_info"))))

            sp.verify(sp.sender == self.data.admin, "NOT_ADMIN")
            sp.verify(params.supply > 0, "ZERO_SUPPLY")

            token_id = self.data.next_token_id
            self.data.next_token_id += 1

            self.data.token_supply[token_id] = params.supply
            self.data.token_metadata[token_id] = sp.record(token_id=token_id, token_info=params.token_info)

            self.set_bal(params.to_, token_id, self.bal(params.to_, token_id) + params.supply)

            self.emit("minted", sp.record(token_id=token_id, to_=params.to_, supply=params.supply))

        ################################################################
        # Listings / Controls (owner-scoped)
        ################################################################

        @sp.entrypoint
        def set_price(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, price_per_unit=sp.TMutez).layout(("token_id", "price_per_unit")))

            self.require_owner(params.token_id)
            sp.verify(params.price_per_unit > sp.mutez(0), "BAD_PRICE")
            self.data.prices[self.price_key(sp.sender, params.token_id)] = params.price_per_unit
            self.emit("price_set", sp.record(owner=sp.sender, token_id=params.token_id, price_per_unit=params.price_per_unit))

        @sp.entrypoint
        def clear_price(self, token_id):
            sp.set_type(token_id, sp.TNat)

            self.require_owner(token_id)
            pk = self.price_key(sp.sender, token_id)
            sp.if self.data.prices.contains(pk):
                del self.data.prices[pk]
                self.emit("price_cleared", sp.record(owner=sp.sender, token_id=token_id))

        @sp.entrypoint
        def set_max_buy_qty(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, max_qty=sp.TNat).layout(("token_id", "max_qty")))

            self.require_owner(params.token_id)
            self.data.max_buy_qty[self.price_key(sp.sender, params.token_id)] = params.max_qty
            self.emit("max_buy_qty_set", sp.record(owner=sp.sender, token_id=params.token_id, max_qty=params.max_qty))

        @sp.entrypoint
        def set_min_offer_percent_of_list(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, min_bps=sp.TNat).layout(("token_id", "min_bps")))

            self.require_owner(params.token_id)
            sp.verify(params.min_bps <= 10_000, "BPS_TOO_HIGH")
            self.data.min_offer_bps_of_list[self.price_key(sp.sender, params.token_id)] = params.min_bps
            self.emit("min_offer_bps_set", sp.record(owner=sp.sender, token_id=params.token_id, min_bps=params.min_bps))

        ################################################################
        # Instant buy from a specific owner listing
        ################################################################

        @sp.entrypoint
        def buy(self, params):
            sp.set_type(params, sp.TRecord(owner=sp.TAddress, token_id=sp.TNat, qty=sp.TNat).layout(("owner", ("token_id", "qty"))))

            sp.verify(params.qty > 0, "BAD_QTY")
            sp.verify(~self.is_blacklisted(params.owner, params.token_id, sp.sender), "BLACKLISTED")

            pk = self.price_key(params.owner, params.token_id)
            sp.verify(self.data.prices.contains(pk), "NOT_FOR_SALE")

            max_qty = self.get_max_buy_qty(params.owner, params.token_id)
            sp.if max_qty > 0:
                sp.verify(params.qty <= max_qty, "EXCEEDS_MAX_BUY_QTY")

            sp.verify(self.bal(params.owner, params.token_id) >= params.qty, "OWNER_INSUFFICIENT")

            total_price = self.mul_mutez_nat(self.data.prices[pk], params.qty)
            sp.verify(sp.amount == total_price, "WRONG_PRICE")

            royalty = sp.split_tokens(total_price, self.data.royalty_bps, 10_000)
            payout = total_price - royalty

            self.credit(self.data.royalty_recipient, royalty)
            self.credit(params.owner, payout)

            self.set_bal(params.owner, params.token_id, self.bal(params.owner, params.token_id) - params.qty)
            self.set_bal(sp.sender, params.token_id, self.bal(sp.sender, params.token_id) + params.qty)

            self.emit("bought", sp.record(
                buyer=sp.sender, owner=params.owner, token_id=params.token_id, qty=params.qty,
                total=total_price, royalty=royalty
            ))

        ################################################################
        # Token-wide Offers (PARTIAL FILL)
        ################################################################

        @sp.entrypoint
        def make_offer(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, qty=sp.TNat, expiry=sp.TTimestamp).layout(("token_id", ("qty", "expiry"))))

            sp.verify(params.qty > 0, "BAD_QTY")
            sp.verify(params.expiry > sp.now, "BAD_EXPIRY")

            min_total = self.mul_mutez_nat(self.data.min_offer_per_unit_mutez, params.qty)
            sp.verify(sp.amount >= min_total, "OFFER_TOO_LOW")

            oc = self.get_owner_count_internal(params.token_id)
            sp.verify(oc > 0, "NO_OWNERS")

            # unit_price = floor(amount / qty), enforce exact divisibility
            unit_price = sp.local("unit_price", sp.split_tokens(sp.amount, 1, params.qty))
            sp.verify(self.mul_mutez_nat(unit_price.value, params.qty) == sp.amount, "AMOUNT_NOT_DIVISIBLE_BY_QTY")
            sp.verify(unit_price.value > sp.mutez(0), "UNIT_PRICE_ZERO")

            offer_id = self.data.next_offer_id
            self.data.next_offer_id += 1

            self.data.offers[offer_id] = sp.record(
                token_id=params.token_id,
                buyer=sp.sender,
                unit_price=unit_price.value,
                remaining_qty=params.qty,
                remaining_amount=sp.amount,
                expiry=params.expiry,
                active=True,
                required_rejections=oc,
                rejected_count=0
            )

            self.emit("offer_made", sp.record(
                offer_id=offer_id,
                token_id=params.token_id,
                buyer=sp.sender,
                unit_price=unit_price.value,
                qty=params.qty,
                amount=sp.amount,
                expiry=params.expiry,
                required_rejections=oc
            ))

        @sp.entrypoint
        def reject_offer(self, offer_id):
            sp.set_type(offer_id, sp.TNat)

            o = sp.local("o", self.data.offers[offer_id])
            sp.verify(o.value.active, "NOT_ACTIVE")
            sp.verify(self.bal(sp.sender, o.value.token_id) > 0, "NOT_OWNER")

            rej_key = sp.record(offer_id=offer_id, owner=sp.sender)
            sp.verify(~self.data.offer_rejections.contains(rej_key), "ALREADY_REJECTED")

            self.data.offer_rejections[rej_key] = sp.unit
            o.value.rejected_count += 1

            self.emit("offer_rejected", sp.record(
                offer_id=offer_id,
                token_id=o.value.token_id,
                owner=sp.sender,
                rejected_count=o.value.rejected_count,
                required_rejections=o.value.required_rejections
            ))

            sp.if o.value.rejected_count >= o.value.required_rejections:
                o.value.active = False

                sp.if o.value.remaining_amount > sp.mutez(0):
                    self.credit(o.value.buyer, o.value.remaining_amount)

                self.emit("offer_refunded_all_rejected", sp.record(
                    offer_id=offer_id,
                    token_id=o.value.token_id,
                    buyer=o.value.buyer,
                    amount=o.value.remaining_amount
                ))

                o.value.remaining_amount = sp.mutez(0)
                o.value.remaining_qty = 0

            self.data.offers[offer_id] = o.value

        @sp.entrypoint
        def cancel_offer(self, offer_id):
            sp.set_type(offer_id, sp.TNat)

            o = sp.local("o", self.data.offers[offer_id])
            sp.verify(o.value.active, "NOT_ACTIVE")
            sp.verify(o.value.buyer == sp.sender, "NOT_BUYER")

            o.value.active = False

            sp.if o.value.remaining_amount > sp.mutez(0):
                self.credit(o.value.buyer, o.value.remaining_amount)

            self.emit("offer_cancelled", sp.record(
                offer_id=offer_id,
                token_id=o.value.token_id,
                buyer=o.value.buyer,
                refunded=o.value.remaining_amount,
                remaining_qty=o.value.remaining_qty
            ))

            o.value.remaining_amount = sp.mutez(0)
            o.value.remaining_qty = 0
            self.data.offers[offer_id] = o.value

        @sp.entrypoint
        def accept_offer(self, params):
            sp.set_type(params, sp.TRecord(offer_id=sp.TNat, accept_qty=sp.TNat).layout(("offer_id", "accept_qty")))

            o = sp.local("o", self.data.offers[params.offer_id])
            sp.verify(o.value.active, "NOT_ACTIVE")
            sp.verify(sp.now <= o.value.expiry, "OFFER_EXPIRED")

            sp.verify(params.accept_qty > 0, "BAD_ACCEPT_QTY")
            sp.verify(params.accept_qty <= o.value.remaining_qty, "ACCEPT_EXCEEDS_REMAINING")

            token_id = o.value.token_id
            sp.verify(self.bal(sp.sender, token_id) >= params.accept_qty, "INSUFFICIENT_BALANCE")
            sp.verify(~self.is_blacklisted(sp.sender, token_id, o.value.buyer), "BLACKLISTED")

            pay_total = sp.local("pay_total", self.mul_mutez_nat(o.value.unit_price, params.accept_qty))
            sp.verify(pay_total.value > sp.mutez(0), "PAY_ZERO")
            sp.verify(pay_total.value <= o.value.remaining_amount, "OFFER_AMOUNT_UNDERFLOW")

            # owner-specific percent-of-list floor for this accepted qty
            floor = self.owner_floor_total(sp.sender, token_id, params.accept_qty)
            sp.if floor.fst:
                sp.verify(pay_total.value >= floor.snd, "BELOW_OWNER_PERCENT_FLOOR")

            royalty = sp.split_tokens(pay_total.value, self.data.royalty_bps, 10_000)
            payout = pay_total.value - royalty

            self.credit(self.data.royalty_recipient, royalty)
            self.credit(sp.sender, payout)

            # token transfer
            self.set_bal(sp.sender, token_id, self.bal(sp.sender, token_id) - params.accept_qty)
            self.set_bal(o.value.buyer, token_id, self.bal(o.value.buyer, token_id) + params.accept_qty)

            # reduce offer (safe due to verified <=)
            o.value.remaining_qty = sp.as_nat(o.value.remaining_qty - params.accept_qty)
            o.value.remaining_amount = o.value.remaining_amount - pay_total.value

            self.emit("offer_partially_accepted", sp.record(
                offer_id=params.offer_id,
                token_id=token_id,
                owner=sp.sender,
                buyer=o.value.buyer,
                accept_qty=params.accept_qty,
                pay_total=pay_total.value,
                royalty=royalty,
                remaining_qty=o.value.remaining_qty,
                remaining_amount=o.value.remaining_amount
            ))

            sp.if o.value.remaining_qty == 0:
                o.value.active = False

                sp.if o.value.remaining_amount > sp.mutez(0):
                    self.credit(o.value.buyer, o.value.remaining_amount)
                    self.emit("offer_closed_refund_dust", sp.record(
                        offer_id=params.offer_id,
                        token_id=token_id,
                        buyer=o.value.buyer,
                        amount=o.value.remaining_amount
                    ))
                    o.value.remaining_amount = sp.mutez(0)

                self.emit("offer_fully_filled", sp.record(
                    offer_id=params.offer_id,
                    token_id=token_id,
                    buyer=o.value.buyer
                ))

            self.data.offers[params.offer_id] = o.value

        @sp.entrypoint
        def sweep_expired_offer(self, offer_id):
            sp.set_type(offer_id, sp.TNat)

            o = sp.local("o", self.data.offers[offer_id])
            sp.verify(o.value.active, "NOT_ACTIVE")
            sp.verify(sp.now > o.value.expiry, "NOT_EXPIRED")

            o.value.active = False

            sp.if o.value.remaining_amount > sp.mutez(0):
                self.credit(o.value.buyer, o.value.remaining_amount)

            self.emit("offer_swept_expired", sp.record(
                offer_id=offer_id,
                token_id=o.value.token_id,
                buyer=o.value.buyer,
                refunded=o.value.remaining_amount,
                remaining_qty=o.value.remaining_qty
            ))

            o.value.remaining_amount = sp.mutez(0)
            o.value.remaining_qty = 0
            self.data.offers[offer_id] = o.value

        ################################################################
        # Blacklist (owner-scoped per token)
        ################################################################

        @sp.entrypoint
        def blacklist_address(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, blocked=sp.TAddress).layout(("token_id", "blocked")))
            self.require_owner(params.token_id)
            self.data.blacklist[sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked)] = sp.unit
            self.emit("blacklisted", sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked))

        @sp.entrypoint
        def unblacklist_address(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, blocked=sp.TAddress).layout(("token_id", "blocked")))
            self.require_owner(params.token_id)
            key = sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked)
            sp.if self.data.blacklist.contains(key):
                del self.data.blacklist[key]
                self.emit("unblacklisted", sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked))

        ################################################################
        # Withdraw (pull payments)
        ################################################################

        @sp.entrypoint
        def withdraw(self):
            amount = self.data.claimable.get(sp.sender, sp.mutez(0))
            sp.verify(amount > sp.mutez(0), "NO_FUNDS")
            self.data.claimable[sp.sender] = sp.mutez(0)
            sp.send(sp.sender, amount)
            self.emit("withdrawn", sp.record(owner=sp.sender, amount=amount))

        ################################################################
        # On-chain views
        ################################################################

        @sp.onchain_view()
        def get_price(self, params):
            sp.set_type(params, sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")))
            sp.result(self.data.prices.get(sp.record(owner=params.owner, token_id=params.token_id), sp.mutez(0)))

        @sp.onchain_view()
        def get_controls(self, params):
            sp.set_type(params, sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")))
            pk = sp.record(owner=params.owner, token_id=params.token_id)
            sp.result(sp.record(
                max_buy_qty=self.data.max_buy_qty.get(pk, 0),
                min_offer_bps_of_list=self.data.min_offer_bps_of_list.get(pk, 0)
            ))

        @sp.onchain_view()
        def get_offer(self, offer_id):
            sp.set_type(offer_id, sp.TNat)
            sp.result(self.data.offers[offer_id])

        @sp.onchain_view()
        def has_rejected(self, params):
            sp.set_type(params, sp.TRecord(offer_id=sp.TNat, owner=sp.TAddress).layout(("offer_id", "owner")))
            sp.result(self.data.offer_rejections.contains(sp.record(offer_id=params.offer_id, owner=params.owner)))

        @sp.onchain_view()
        def is_owner(self, params):
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, owner=sp.TAddress).layout(("token_id", "owner")))
            sp.result(self.data.token_owners.contains(sp.record(token_id=params.token_id, owner=params.owner)))

        @sp.onchain_view()
        def get_owner_count(self, token_id):
            sp.set_type(token_id, sp.TNat)
            sp.result(self.data.owner_count.get(token_id, 0))

        @sp.onchain_view()
        def is_blacklisted_view(self, params):
            sp.set_type(params, sp.TRecord(owner=sp.TAddress, token_id=sp.TNat, actor=sp.TAddress).layout(("owner", ("token_id", "actor"))))
            sp.result(self.is_blacklisted(params.owner, params.token_id, params.actor))
