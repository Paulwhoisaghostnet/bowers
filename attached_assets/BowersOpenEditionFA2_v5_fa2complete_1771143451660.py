import smartpy as sp

@sp.module
def main():

    ####################################################################
    # FA2 / TZIP-12 view types (widely used by indexers & wallets)
    ####################################################################

    BalanceOfRequestType = sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id"))
    BalanceOfResponseType = sp.TRecord(request=BalanceOfRequestType, balance=sp.TNat).layout(("request", "balance"))

    TransferTxType = sp.TRecord(to_=sp.TAddress, token_id=sp.TNat, amount=sp.TNat).layout(("to_", ("token_id", "amount")))
    TransferBatchItemType = sp.TRecord(from_=sp.TAddress, txs=sp.TList(TransferTxType)).layout(("from_", "txs"))

    OperatorParamType = sp.TVariant(
        add_operator=sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id"))),
        remove_operator=sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id")))
    )

    TokenMetadataType = sp.TRecord(
        token_id=sp.TNat,
        token_info=sp.TMap(sp.TString, sp.TBytes)
    ).layout(("token_id", "token_info"))

    ####################################################################
    # App Types
    ####################################################################

    OfferType = sp.TRecord(
        token_id=sp.TNat,
        buyer=sp.TAddress,
        unit_price=sp.TMutez,          # fixed per-unit price (enforced at creation)
        remaining_qty=sp.TNat,         # remaining quantity to fill
        remaining_amount=sp.TMutez,    # remaining funds to be paid out/refunded
        expiry=sp.TTimestamp,          # offer can be accepted only while now <= expiry
        created_at=sp.TTimestamp,      # for reference / analytics
        active=sp.TBool
    ).layout(("token_id", ("buyer", ("unit_price", ("remaining_qty", ("remaining_amount", ("expiry", ("created_at", "active"))))))))

    TokenConfigType = sp.TRecord(
        creator=sp.TAddress,
        mint_price=sp.TMutez,                 # price per edition (primary)
        mint_end=sp.TOption(sp.TTimestamp),   # None => forever
        mint_paused=sp.TBool                  # only meaningful when mint_end is None (forever)
    ).layout(("creator", ("mint_price", ("mint_end", "mint_paused"))))

    ####################################################################
    # Contract
    ####################################################################

    class BowersOpenEditionFA2(sp.Contract):
        """
        Open-edition minting (no premint):
          - Admin creates token_id and sets creator + mint_price.
          - Anyone can mint by paying mint_price * qty to receive editions.
          - Mint duration defaults to forever (mint_end=None).
          - If duration is forever, admin can pause/unpause minting per token.
          - Admin can set a finite mint_end timestamp (and can also set back to forever).

        Inherent market:
          - owner-scoped listings + instant buy
          - token-wide partial-fill offers (no owner-rejection scheme)
          - Offers have a FIXED lifetime of 7 days:
              - acceptable while now <= created_at + 7 days
              - buyer can cancel anytime (refund remaining)
              - admin can cancel ONLY after expiry (refund remaining)
          - offers must be >= 100% of current mint_price per edition (checked at offer creation)
          - owner-scoped blacklist (blocks buy + offer acceptance)
          - pull payments (claimable/withdraw)

        Global pause:
          - pauses ONLY minting (not listings/buy/offers)

        FA2 completeness:
          - TZIP-12 entrypoints: balance_of, transfer, update_operators
          - Common onchain views: get_balance, total_supply, all_tokens, is_operator, token_metadata
          - TZIP-16 contract metadata big_map string->bytes in storage
        """

        OFFER_LIFETIME_SECONDS = 7 * 24 * 60 * 60

        def __init__(self, admin, metadata, royalty_recipient, royalty_bps, min_offer_per_unit_mutez):
            sp.verify(royalty_bps <= 10_000, "ROYALTY_BPS_TOO_HIGH")

            # metadata must be a big_map(string, bytes) with at least "" -> bytes (TZIP-16)
            sp.set_type(metadata, sp.TBigMap(sp.TString, sp.TBytes))

            self.init(
                admin=admin,

                # TZIP-16 contract metadata
                metadata=metadata,

                # Global mint pause (does NOT affect market ops)
                minting_paused=False,

                # Royalties (applied to secondary market: buy + offer accept)
                royalty_recipient=royalty_recipient,
                royalty_bps=royalty_bps,

                # Offer config
                min_offer_per_unit_mutez=min_offer_per_unit_mutez,

                # FA2 core
                ledger=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat).layout(("owner", "token_id")),
                    tvalue=sp.TNat
                ),

                # total minted so far per token_id (open edition)
                token_supply=sp.big_map(tkey=sp.TNat, tvalue=sp.TNat),

                token_metadata=sp.big_map(tkey=sp.TNat, tvalue=TokenMetadataType),

                operators=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id"))),
                    tvalue=sp.TUnit
                ),

                next_token_id=sp.nat(0),

                # token config (creator + mint price + mint duration)
                token_config=sp.big_map(tkey=sp.TNat, tvalue=TokenConfigType),

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

                # Pull payments
                claimable=sp.big_map(tkey=sp.TAddress, tvalue=sp.TMutez),

                # Owner-scoped blacklist
                blacklist=sp.big_map(
                    tkey=sp.TRecord(owner=sp.TAddress, token_id=sp.TNat, blocked=sp.TAddress).layout(("owner", ("token_id", "blocked"))),
                    tvalue=sp.TUnit
                )
            )

        ################################################################
        # Helpers
        ################################################################

        def emit(self, tag, payload):
            sp.emit(payload, tag=tag)

        def only_admin(self):
            sp.verify(sp.sender == self.data.admin, "NOT_ADMIN")

        def no_tez(self):
            sp.verify(sp.amount == sp.mutez(0), "NO_TEZ")

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

                # Clear market settings when owner exits holdings (storage hygiene)
                pk = self.price_key(owner, token_id)
                sp.if self.data.prices.contains(pk):
                    del self.data.prices[pk]
                sp.if self.data.max_buy_qty.contains(pk):
                    del self.data.max_buy_qty[pk]
                sp.if self.data.min_offer_bps_of_list.contains(pk):
                    del self.data.min_offer_bps_of_list[pk]

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
            pk = self.price_key(owner, token_id)
            bps = self.get_min_offer_bps(owner, token_id)

            sp.if (bps > 0) & self.data.prices.contains(pk):
                list_total = self.mul_mutez_nat(self.data.prices[pk], qty)
                floor_total = sp.split_tokens(list_total, bps, 10_000)
                return sp.pair(True, floor_total)
            sp.else:
                return sp.pair(False, sp.mutez(0))

        def token_exists(self, token_id):
            return self.data.token_config.contains(token_id) & self.data.token_metadata.contains(token_id)

        def require_token(self, token_id):
            sp.verify(self.token_exists(token_id), "TOKEN_UNDEFINED")

        def mint_is_open(self, token_id):
            cfg = self.data.token_config[token_id]
            sp.if cfg.mint_end.is_some():
                return sp.now <= cfg.mint_end.open_some()
            sp.else:
                return ~cfg.mint_paused

        ################################################################
        # Admin controls
        ################################################################

        @sp.entrypoint
        def set_minting_paused(self, paused):
            """
            Global mint pause ONLY (does not affect market ops).
            """
            sp.set_type(paused, sp.TBool)
            self.no_tez()
            self.only_admin()
            self.data.minting_paused = paused
            self.emit("minting_paused_set", sp.record(paused=paused))

        ################################################################
        # FA2 standard entrypoints (TZIP-12)
        ################################################################

        @sp.entrypoint
        def balance_of(self, params):
            self.no_tez()
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
            self.no_tez()
            sp.set_type(params, sp.TList(OperatorParamType))
            sp.for update in params:
                sp.if update.is_variant("add_operator"):
                    op = update.add_operator
                    sp.verify(op.owner == sp.sender, "NOT_OWNER")
                    self.require_token(op.token_id)
                    self.data.operators[sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id)] = sp.unit
                    self.emit("fa2_operator_added", sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id))
                sp.else:
                    op = update.remove_operator
                    sp.verify(op.owner == sp.sender, "NOT_OWNER")
                    self.require_token(op.token_id)
                    k = sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id)
                    sp.verify(self.data.operators.contains(k), "NO_SUCH_OPERATOR")
                    del self.data.operators[k]
                    self.emit("fa2_operator_removed", sp.record(owner=op.owner, operator=op.operator, token_id=op.token_id))

        @sp.entrypoint
        def transfer(self, batch):
            """
            Standard FA2 transfer entrypoint (TZIP-12).
            """
            self.no_tez()
            sp.set_type(batch, sp.TList(TransferBatchItemType))
            sp.for tx in batch:
                owner = tx.from_
                sp.for t in tx.txs:
                    self.require_operator_or_owner(owner, t.token_id)
                    self.require_token(t.token_id)
                    sp.verify(t.amount > 0, "BAD_AMOUNT")
                    sp.verify(self.bal(owner, t.token_id) >= t.amount, "INSUFFICIENT_BALANCE")

                    self.set_bal(owner, t.token_id, self.bal(owner, t.token_id) - t.amount)
                    self.set_bal(t.to_, t.token_id, self.bal(t.to_, t.token_id) + t.amount)

                    self.emit("fa2_transfer", sp.record(from_=owner, to_=t.to_, token_id=t.token_id, amount=t.amount))

        ################################################################
        # Token creation + mint controls (open edition)
        ################################################################

        @sp.entrypoint
        def create_token(self, params):
            """
            Admin-only.

            params:
              token_info   : map(string, bytes)
              creator      : address
              mint_price   : mutez
              mint_end     : option(timestamp)   (None => forever)
            """
            self.no_tez()
            sp.set_type(params, sp.TRecord(
                token_info=sp.TMap(sp.TString, sp.TBytes),
                creator=sp.TAddress,
                mint_price=sp.TMutez,
                mint_end=sp.TOption(sp.TTimestamp)
            ).layout(("token_info", ("creator", ("mint_price", "mint_end")))))

            self.only_admin()

            token_id = self.data.next_token_id
            self.data.next_token_id += 1

            self.data.token_metadata[token_id] = sp.record(token_id=token_id, token_info=params.token_info)
            self.data.token_config[token_id] = sp.record(
                creator=params.creator,
                mint_price=params.mint_price,
                mint_end=params.mint_end,
                mint_paused=False
            )
            self.data.token_supply[token_id] = sp.nat(0)

            self.emit("token_created", sp.record(
                token_id=token_id,
                creator=params.creator,
                mint_price=params.mint_price,
                mint_end=params.mint_end
            ))

        @sp.entrypoint
        def set_mint_price(self, params):
            """
            Admin-only (collection owner controls pricing).
            """
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, mint_price=sp.TMutez).layout(("token_id", "mint_price")))
            self.only_admin()
            self.require_token(params.token_id)
            self.data.token_config[params.token_id].mint_price = params.mint_price
            self.emit("mint_price_set", sp.record(token_id=params.token_id, mint_price=params.mint_price))

        @sp.entrypoint
        def set_mint_end(self, params):
            """
            Admin-only. Set mint duration.
              - mint_end = None  => forever (default)
              - mint_end = Some(t) => minting allowed only while now <= t
            """
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, mint_end=sp.TOption(sp.TTimestamp)).layout(("token_id", "mint_end")))
            self.only_admin()
            self.require_token(params.token_id)

            self.data.token_config[params.token_id].mint_end = params.mint_end

            # If switching to finite duration, clear paused flag.
            sp.if params.mint_end.is_some():
                self.data.token_config[params.token_id].mint_paused = False

            self.emit("mint_end_set", sp.record(token_id=params.token_id, mint_end=params.mint_end))

        @sp.entrypoint
        def set_mint_paused_forever(self, params):
            """
            Admin-only.
            Only valid when mint_end is None (forever duration).
            """
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, paused=sp.TBool).layout(("token_id", "paused")))
            self.only_admin()
            self.require_token(params.token_id)

            cfg = self.data.token_config[params.token_id]
            sp.verify(cfg.mint_end.is_none(), "NOT_FOREVER_DURATION")

            cfg.mint_paused = params.paused
            self.data.token_config[params.token_id] = cfg

            self.emit("mint_paused_set", sp.record(token_id=params.token_id, paused=params.paused))

        @sp.entrypoint
        def mint_editions(self, params):
            """
            Anyone can mint by paying mint_price * qty.

            Primary proceeds:
              - 100% to token creator (no royalty split on mint)

            Global mint pause applies here only.
            """
            sp.set_type(params, sp.TRecord(
                token_id=sp.TNat,
                qty=sp.TNat,
                to_=sp.TOption(sp.TAddress)
            ).layout(("token_id", ("qty", "to_"))))

            sp.verify(~self.data.minting_paused, "MINTING_PAUSED")
            self.require_token(params.token_id)

            cfg = self.data.token_config[params.token_id]
            sp.verify(params.qty > 0, "BAD_QTY")
            sp.verify(cfg.mint_price > sp.mutez(0), "MINT_PRICE_ZERO")
            sp.verify(self.mint_is_open(params.token_id), "MINT_CLOSED")

            total_price = self.mul_mutez_nat(cfg.mint_price, params.qty)
            sp.verify(sp.amount == total_price, "WRONG_PRICE")

            to_addr = sp.local("to_addr", sp.sender)
            sp.if params.to_.is_some():
                to_addr.value = params.to_.open_some()

            self.credit(cfg.creator, total_price)

            self.data.token_supply[params.token_id] = self.data.token_supply.get(params.token_id, 0) + params.qty
            self.set_bal(to_addr.value, params.token_id, self.bal(to_addr.value, params.token_id) + params.qty)

            self.emit("minted_open_edition", sp.record(
                token_id=params.token_id,
                to_=to_addr.value,
                qty=params.qty,
                unit_price=cfg.mint_price,
                total=total_price,
                creator=cfg.creator
            ))

        ################################################################
        # Listings / Controls (owner-scoped)
        ################################################################

        @sp.entrypoint
        def set_price(self, params):
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, price_per_unit=sp.TMutez).layout(("token_id", "price_per_unit")))
            self.require_owner(params.token_id)
            sp.verify(params.price_per_unit > sp.mutez(0), "BAD_PRICE")
            self.data.prices[self.price_key(sp.sender, params.token_id)] = params.price_per_unit
            self.emit("price_set", sp.record(owner=sp.sender, token_id=params.token_id, price_per_unit=params.price_per_unit))

        @sp.entrypoint
        def clear_price(self, token_id):
            self.no_tez()
            sp.set_type(token_id, sp.TNat)
            self.require_owner(token_id)
            pk = self.price_key(sp.sender, token_id)
            sp.if self.data.prices.contains(pk):
                del self.data.prices[pk]
                self.emit("price_cleared", sp.record(owner=sp.sender, token_id=token_id))

        @sp.entrypoint
        def set_max_buy_qty(self, params):
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, max_qty=sp.TNat).layout(("token_id", "max_qty")))
            self.require_owner(params.token_id)
            self.data.max_buy_qty[self.price_key(sp.sender, params.token_id)] = params.max_qty
            self.emit("max_buy_qty_set", sp.record(owner=sp.sender, token_id=params.token_id, max_qty=params.max_qty))

        @sp.entrypoint
        def set_min_offer_percent_of_list(self, params):
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, min_bps=sp.TNat).layout(("token_id", "min_bps")))
            self.require_owner(params.token_id)
            sp.verify(params.min_bps <= 10_000, "BPS_TOO_HIGH")
            self.data.min_offer_bps_of_list[self.price_key(sp.sender, params.token_id)] = params.min_bps
            self.emit("min_offer_bps_set", sp.record(owner=sp.sender, token_id=params.token_id, min_bps=params.min_bps))

        ################################################################
        # Instant buy (qty editions) from a specific owner listing
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
        # Token-wide Offers (PARTIAL FILL, FIXED 7-DAY LIFETIME)
        ################################################################

        @sp.entrypoint
        def make_offer(self, params):
            """
            Offers always expire after 7 days. Buyer does NOT choose expiry.
            Buyer deposits sp.amount.
            unit_price = amount / qty, exact divisibility required.

            Gates for open editions:
              - unit_price must be >= current mint_price (100% minimum)
              - and must satisfy min_offer_per_unit_mutez (global floor)
            """
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, qty=sp.TNat).layout(("token_id", "qty")))
            self.require_token(params.token_id)

            sp.verify(params.qty > 0, "BAD_QTY")

            min_total = self.mul_mutez_nat(self.data.min_offer_per_unit_mutez, params.qty)
            sp.verify(sp.amount >= min_total, "OFFER_TOO_LOW")

            unit_price = sp.local("unit_price", sp.split_tokens(sp.amount, 1, params.qty))
            sp.verify(self.mul_mutez_nat(unit_price.value, params.qty) == sp.amount, "AMOUNT_NOT_DIVISIBLE_BY_QTY")
            sp.verify(unit_price.value > sp.mutez(0), "UNIT_PRICE_ZERO")

            mint_price = self.data.token_config[params.token_id].mint_price
            sp.verify(mint_price > sp.mutez(0), "MINT_PRICE_ZERO_FOR_OFFERS")
            sp.verify(unit_price.value >= mint_price, "OFFER_BELOW_MINT_PRICE")

            offer_id = self.data.next_offer_id
            self.data.next_offer_id += 1

            created_at = sp.now
            expiry = created_at.add_seconds(self.OFFER_LIFETIME_SECONDS)

            self.data.offers[offer_id] = sp.record(
                token_id=params.token_id,
                buyer=sp.sender,
                unit_price=unit_price.value,
                remaining_qty=params.qty,
                remaining_amount=sp.amount,
                expiry=expiry,
                created_at=created_at,
                active=True
            )

            self.emit("offer_made", sp.record(
                offer_id=offer_id,
                token_id=params.token_id,
                buyer=sp.sender,
                unit_price=unit_price.value,
                qty=params.qty,
                amount=sp.amount,
                created_at=created_at,
                expiry=expiry
            ))

        @sp.entrypoint
        def cancel_offer(self, offer_id):
            """
            Buyer cancels and receives remaining_amount back via claimable.
            """
            self.no_tez()
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
        def admin_cancel_expired_offer(self, offer_id):
            """
            Admin may cancel offers ONLY after they have expired (expiry passed).
            Refunds remaining_amount to buyer via claimable.
            """
            self.no_tez()
            sp.set_type(offer_id, sp.TNat)
            self.only_admin()

            o = sp.local("o", self.data.offers[offer_id])
            sp.verify(o.value.active, "NOT_ACTIVE")
            sp.verify(sp.now > o.value.expiry, "OFFER_NOT_EXPIRED")

            o.value.active = False

            sp.if o.value.remaining_amount > sp.mutez(0):
                self.credit(o.value.buyer, o.value.remaining_amount)

            self.emit("offer_admin_cancelled_expired", sp.record(
                offer_id=offer_id,
                token_id=o.value.token_id,
                buyer=o.value.buyer,
                refunded=o.value.remaining_amount,
                remaining_qty=o.value.remaining_qty,
                created_at=o.value.created_at,
                expiry=o.value.expiry
            ))

            o.value.remaining_amount = sp.mutez(0)
            o.value.remaining_qty = 0
            self.data.offers[offer_id] = o.value

        @sp.entrypoint
        def accept_offer(self, params):
            """
            Partial fill. Cannot accept after expiry.
            """
            self.no_tez()
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

            floor = self.owner_floor_total(sp.sender, token_id, params.accept_qty)
            sp.if floor.fst:
                sp.verify(pay_total.value >= floor.snd, "BELOW_OWNER_PERCENT_FLOOR")

            royalty = sp.split_tokens(pay_total.value, self.data.royalty_bps, 10_000)
            payout = pay_total.value - royalty

            self.credit(self.data.royalty_recipient, royalty)
            self.credit(sp.sender, payout)

            self.set_bal(sp.sender, token_id, self.bal(sp.sender, token_id) - params.accept_qty)
            self.set_bal(o.value.buyer, token_id, self.bal(o.value.buyer, token_id) + params.accept_qty)

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
                self.emit("offer_fully_filled", sp.record(
                    offer_id=params.offer_id,
                    token_id=token_id,
                    buyer=o.value.buyer
                ))

            self.data.offers[params.offer_id] = o.value

        ################################################################
        # Blacklist (owner-scoped per token)
        ################################################################

        @sp.entrypoint
        def blacklist_address(self, params):
            self.no_tez()
            sp.set_type(params, sp.TRecord(token_id=sp.TNat, blocked=sp.TAddress).layout(("token_id", "blocked")))
            self.require_owner(params.token_id)
            self.data.blacklist[sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked)] = sp.unit
            self.emit("blacklisted", sp.record(owner=sp.sender, token_id=params.token_id, blocked=params.blocked))

        @sp.entrypoint
        def unblacklist_address(self, params):
            self.no_tez()
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
            self.no_tez()
            amount = self.data.claimable.get(sp.sender, sp.mutez(0))
            sp.verify(amount > sp.mutez(0), "NO_FUNDS")
            self.data.claimable[sp.sender] = sp.mutez(0)
            sp.send(sp.sender, amount)
            self.emit("withdrawn", sp.record(owner=sp.sender, amount=amount))

        ################################################################
        # Onchain Views (TZIP-12 common set)
        ################################################################

        @sp.onchain_view()
        def get_balance(self, params):
            sp.set_type(params, BalanceOfRequestType)
            sp.result(self.bal(params.owner, params.token_id))

        @sp.onchain_view()
        def total_supply(self, token_id):
            sp.set_type(token_id, sp.TNat)
            sp.verify(self.token_exists(token_id), "TOKEN_UNDEFINED")
            sp.result(self.data.token_supply.get(token_id, 0))

        @sp.onchain_view()
        def all_tokens(self, unit):
            sp.set_type(unit, sp.TUnit)
            tokens = sp.local("tokens", sp.list(t=sp.TNat))
            sp.for i in sp.range(0, self.data.next_token_id):
                tokens.value.push(i)
            sp.result(tokens.value)

        @sp.onchain_view()
        def is_operator(self, params):
            sp.set_type(params, sp.TRecord(owner=sp.TAddress, operator=sp.TAddress, token_id=sp.TNat).layout(("owner", ("operator", "token_id"))))
            sp.result(self.data.operators.contains(sp.record(owner=params.owner, operator=params.operator, token_id=params.token_id)))

        @sp.onchain_view()
        def token_metadata(self, token_id):
            sp.set_type(token_id, sp.TNat)
            sp.verify(self.token_exists(token_id), "TOKEN_UNDEFINED")
            sp.result(self.data.token_metadata[token_id])

        ################################################################
        # App Views (nice-to-have)
        ################################################################

        @sp.onchain_view()
        def get_token_config(self, token_id):
            sp.set_type(token_id, sp.TNat)
            sp.result(self.data.token_config[token_id])

        @sp.onchain_view()
        def mint_open_view(self, token_id):
            sp.set_type(token_id, sp.TNat)
            self.require_token(token_id)
            sp.result(self.mint_is_open(token_id))

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
