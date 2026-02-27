import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Tag,
  ShoppingCart,
  HandCoins,
  Send,
  Wallet,
  Pause,
  Play,
  Settings2,
  Hexagon,
  Loader2,
  Coins,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  setListing,
  cancelListing,
  buy,
  makeOffer,
  acceptOffer,
  closeOffer,
  withdraw,
  transfer,
} from "@/lib/tezos/marketplace";
import { mintEditions, setMintPaused } from "@/lib/tezos/open-edition";

export interface TokenOwner {
  address: string;
  balance: number;
}

export interface TokenListing {
  tokenId: number;
  owner: string;
  price: number;
  maxQty: number;
  minBps: number;
}

export interface TokenOffer {
  offerId: number;
  tokenId: number;
  buyer: string;
  pricePerUnit: number;
  qty: number;
  expiry: string;
}

export interface TokenConfig {
  tokenId: number;
  creator: string;
  mintPrice: number;
  mintEnd: string | null;
  mintPaused: boolean;
  maxSupply: number | null;
  currentSupply: number;
}

export interface TokenCardProps {
  contractAddress: string;
  contractId: string;
  tokenId: number;
  name: string;
  imageUrl: string;
  mimeType?: string;
  description?: string;
  owners: TokenOwner[];
  listing?: TokenListing;
  offers: TokenOffer[];
  tokenConfig?: TokenConfig;
  walletAddress?: string;
  isOpenEdition?: boolean;
}

function mutezToTez(mutez: number): string {
  return (mutez / 1_000_000).toFixed(6).replace(/\.?0+$/, "");
}

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  loading,
  variant = "outline",
  size = "sm",
}: {
  icon: any;
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: "outline" | "default" | "destructive" | "secondary";
  size?: "sm" | "xs";
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </Button>
  );
}

export function TokenCard({
  contractAddress,
  contractId,
  tokenId,
  name,
  imageUrl,
  mimeType,
  description,
  owners,
  listing,
  offers,
  tokenConfig,
  walletAddress,
  isOpenEdition,
}: TokenCardProps) {
  const { toast } = useToast();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "tokens"] });
  };

  const isOwner = walletAddress
    ? owners.some((o) => o.address === walletAddress && o.balance > 0)
    : false;
  const myBalance =
    owners.find((o) => o.address === walletAddress)?.balance ?? 0;
  const isAdmin = walletAddress && tokenConfig?.creator === walletAddress;
  const myOffers = walletAddress
    ? offers.filter((o) => o.buyer === walletAddress)
    : [];

  const [listDialog, setListDialog] = useState(false);
  const [listPrice, setListPrice] = useState("");
  const [listQty, setListQty] = useState("1");

  const [buyDialog, setBuyDialog] = useState(false);
  const [buyQty, setBuyQty] = useState("1");

  const [offerDialog, setOfferDialog] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerQty, setOfferQty] = useState("1");

  const [transferDialog, setTransferDialog] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferQty, setTransferQty] = useState("1");

  const [mintDialog, setMintDialog] = useState(false);
  const [mintQty, setMintQty] = useState("1");

  const txMutation = useMutation({
    mutationFn: async (fn: () => Promise<string>) => fn(),
    onSuccess: (opHash) => {
      toast({ title: "Transaction Confirmed", description: `Op: ${opHash.slice(0, 12)}...` });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Transaction Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleList = () => {
    const priceMutez = Math.round(parseFloat(listPrice) * 1_000_000);
    const qty = parseInt(listQty) || 1;
    txMutation.mutate(() => setListing(contractAddress, tokenId, priceMutez, qty, 0));
    setListDialog(false);
  };

  const handleCancelListing = () => {
    txMutation.mutate(() => cancelListing(contractAddress, tokenId));
  };

  const handleBuy = () => {
    if (!listing) return;
    const qty = parseInt(buyQty) || 1;
    const total = listing.price * qty;
    txMutation.mutate(() => buy(contractAddress, listing.owner, tokenId, qty, total));
    setBuyDialog(false);
  };

  const handleMakeOffer = () => {
    const totalMutez = Math.round(parseFloat(offerAmount) * 1_000_000);
    const qty = parseInt(offerQty) || 1;
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    txMutation.mutate(() => makeOffer(contractAddress, tokenId, qty, expiry, totalMutez));
    setOfferDialog(false);
  };

  const handleAcceptOffer = (offerId: number, qty: number) => {
    txMutation.mutate(() => acceptOffer(contractAddress, offerId, qty));
  };

  const handleCloseOffer = (offerId: number) => {
    txMutation.mutate(() => closeOffer(contractAddress, offerId));
  };

  const handleWithdraw = () => {
    txMutation.mutate(() => withdraw(contractAddress));
  };

  const handleTransfer = () => {
    if (!walletAddress) return;
    const qty = parseInt(transferQty) || 1;
    txMutation.mutate(() =>
      transfer(contractAddress, walletAddress, transferTo, tokenId, qty)
    );
    setTransferDialog(false);
  };

  const handleMintEditions = () => {
    if (!walletAddress || !tokenConfig) return;
    const qty = parseInt(mintQty) || 1;
    const total = tokenConfig.mintPrice * qty;
    txMutation.mutate(() =>
      mintEditions(contractAddress, tokenId, qty, walletAddress, total)
    );
    setMintDialog(false);
  };

  const handleTogglePause = () => {
    if (!tokenConfig) return;
    txMutation.mutate(() =>
      setMintPaused(contractAddress, tokenId, !tokenConfig.mintPaused)
    );
  };

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className="aspect-square bg-muted relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Hexagon className="w-10 h-10 text-muted-foreground/20" />
          </div>
        )}
        {listing && (
          <div className="absolute bottom-2 left-2 right-2">
            <Badge className="bg-primary/90 text-primary-foreground text-xs">
              {mutezToTez(listing.price)} tez
              {listing.maxQty > 1 && ` · ${listing.maxQty} avail`}
            </Badge>
          </div>
        )}
        {tokenConfig && !tokenConfig.mintPaused && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-[10px]">
              Mint: {mutezToTez(tokenConfig.mintPrice)} tez
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{name || `#${tokenId}`}</p>
            {description && (
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {description}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            #{tokenId}
          </Badge>
        </div>

        {owners.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            {owners.slice(0, 2).map((o) => (
              <span key={o.address}>
                {shortenAddr(o.address)} ({o.balance})
                {isOwner && o.address === walletAddress && " (you)"}
              </span>
            ))}
            {owners.length > 2 && <span> +{owners.length - 2} more</span>}
          </div>
        )}

        {offers.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            {offers.length} offer{offers.length !== 1 ? "s" : ""}
            {isOwner && " — tap to review"}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {/* Owner actions */}
          {isOwner && !listing && (
            <Dialog open={listDialog} onOpenChange={setListDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Tag className="w-3 h-3" /> List
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>List for Sale</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Price (tez)</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="1.0"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={myBalance}
                      value={listQty}
                      onChange={(e) => setListQty(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      You own {myBalance}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleList}
                    disabled={!listPrice || txMutation.isPending}
                  >
                    {txMutation.isPending ? "Listing..." : "Confirm Listing"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isOwner && listing && listing.owner === walletAddress && (
            <ActionButton
              icon={Tag}
              label="Cancel Listing"
              onClick={handleCancelListing}
              loading={txMutation.isPending}
              variant="destructive"
            />
          )}

          {isOwner && (
            <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Send className="w-3 h-3" /> Transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>Transfer Token</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Recipient Address</Label>
                    <Input
                      placeholder="tz1..."
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={myBalance}
                      value={transferQty}
                      onChange={(e) => setTransferQty(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleTransfer}
                    disabled={!transferTo || txMutation.isPending}
                  >
                    {txMutation.isPending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Offer accept (owner sees incoming offers) */}
          {isOwner &&
            offers
              .filter((o) => o.buyer !== walletAddress)
              .slice(0, 2)
              .map((o) => (
                <ActionButton
                  key={o.offerId}
                  icon={HandCoins}
                  label={`Accept ${mutezToTez(o.pricePerUnit * o.qty)} tez`}
                  onClick={() => handleAcceptOffer(o.offerId, o.qty)}
                  loading={txMutation.isPending}
                  variant="default"
                />
              ))}

          {/* Non-owner: Buy */}
          {!isOwner && listing && (
            <Dialog open={buyDialog} onOpenChange={setBuyDialog}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-1.5 text-xs">
                  <ShoppingCart className="w-3 h-3" /> Buy {mutezToTez(listing.price)} tez
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>Buy Token</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={listing.maxQty}
                      value={buyQty}
                      onChange={(e) => setBuyQty(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {listing.maxQty} available at {mutezToTez(listing.price)} tez each
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    Total: {mutezToTez(listing.price * (parseInt(buyQty) || 1))} tez
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleBuy}
                    disabled={txMutation.isPending}
                  >
                    {txMutation.isPending ? "Buying..." : "Confirm Purchase"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Non-owner: Make offer */}
          {!isOwner && (
            <Dialog open={offerDialog} onOpenChange={setOfferDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <HandCoins className="w-3 h-3" /> Offer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>Make Offer</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Total Amount (tez)</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      min="0"
                      placeholder="0.5"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={offerQty}
                      onChange={(e) => setOfferQty(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Offers auto-expire after 7 days
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleMakeOffer}
                    disabled={!offerAmount || txMutation.isPending}
                  >
                    {txMutation.isPending ? "Submitting..." : "Submit Offer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Cancel my own offers */}
          {myOffers.map((o) => (
            <ActionButton
              key={o.offerId}
              icon={HandCoins}
              label={`Cancel ${mutezToTez(o.pricePerUnit * o.qty)} tez offer`}
              onClick={() => handleCloseOffer(o.offerId)}
              loading={txMutation.isPending}
              variant="destructive"
            />
          ))}

          {/* Open Edition: Mint */}
          {isOpenEdition && tokenConfig && !tokenConfig.mintPaused && (
            <Dialog open={mintDialog} onOpenChange={setMintDialog}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-1.5 text-xs">
                  <Coins className="w-3 h-3" /> Mint {mutezToTez(tokenConfig.mintPrice)} tez
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>Mint Editions</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={mintQty}
                      onChange={(e) => setMintQty(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {mutezToTez(tokenConfig.mintPrice)} tez each
                      {tokenConfig.maxSupply && ` · ${tokenConfig.currentSupply}/${tokenConfig.maxSupply} minted`}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    Total: {mutezToTez(tokenConfig.mintPrice * (parseInt(mintQty) || 1))} tez
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleMintEditions}
                    disabled={txMutation.isPending}
                  >
                    {txMutation.isPending ? "Minting..." : "Confirm Mint"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Admin: pause/resume minting */}
          {isAdmin && tokenConfig && (
            <ActionButton
              icon={tokenConfig.mintPaused ? Play : Pause}
              label={tokenConfig.mintPaused ? "Resume Mint" : "Pause Mint"}
              onClick={handleTogglePause}
              loading={txMutation.isPending}
              variant="secondary"
            />
          )}
        </div>
      </div>
    </Card>
  );
}
