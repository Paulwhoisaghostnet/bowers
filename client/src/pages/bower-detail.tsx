import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft,
  Bird,
  UserPlus,
  Bell,
  BellOff,
  ExternalLink,
  Hexagon,
  Wallet,
  Loader2,
  Grid3X3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useNetwork } from "@/lib/network-context";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CONTRACT_STYLES } from "@shared/schema";
import type { Bower, User, Contract } from "@shared/schema";
import { TokenCard } from "@/components/token-card";
import { withdraw } from "@/lib/tezos/marketplace";
import { isMintOnlyStyle } from "./create-collection/types";

type BowerDetail = Bower & { user: User | null };

interface TokensResponse {
  contract: Contract;
  tokens: Array<{
    tokenId: number;
    metadata: {
      name?: string;
      description?: string;
      artifactUri?: string;
      displayUri?: string;
      thumbnailUri?: string;
      mimeType?: string;
      creators?: string[];
      tags?: string[];
    };
    imageUrl: string;
    owners: Array<{ address: string; balance: number }>;
    listing?: {
      tokenId: number;
      owner: string;
      price: number;
      maxQty: number;
      minBps: number;
    };
    offers: Array<{
      offerId: number;
      tokenId: number;
      buyer: string;
      pricePerUnit: number;
      qty: number;
      expiry: string;
    }>;
    tokenConfig?: {
      tokenId: number;
      creator: string;
      mintPrice: number;
      mintEnd: string | null;
      mintPaused: boolean;
      maxSupply: number | null;
      currentSupply: number;
    };
  }>;
  claimable: Array<{ address: string; amount: number }>;
}

const OE_STYLE_IDS = [
  "bowers-open-edition",
  "bowers-mint-oe",
  "bowers-allowlist",
  "bowers-mint-allowlist",
  "bowers-bonding-curve",
  "bowers-mint-bonding-curve",
  "bowers-unified",
];

export default function BowerDetail() {
  const [, params] = useRoute("/bower/:id");
  const [, navigate] = useLocation();
  const { user: currentUser, isAuthenticated } = useAuth();
  const { explorerBaseUrl } = useNetwork();
  const { address: walletAddress, connect: connectWallet, isConnecting } = useWallet();
  const { toast } = useToast();

  const { data: bower, isLoading } = useQuery<BowerDetail>({
    queryKey: ["/api/bowers", params?.id],
    enabled: !!params?.id,
  });

  const { data: contract } = useQuery<Contract>({
    queryKey: ["/api/contracts/detail", bower?.contractId],
    enabled: !!bower?.contractId,
  });

  const { data: tokensData, isLoading: tokensLoading } = useQuery<TokensResponse>({
    queryKey: ["/api/contracts", contract?.id, "tokens"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contract!.id}/tokens`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load tokens");
      return res.json();
    },
    enabled: !!contract?.id,
    staleTime: 30_000,
  });

  const { data: following } = useQuery<{ id: string; user: User }[]>({
    queryKey: ["/api/following"],
    enabled: isAuthenticated,
  });

  const isFollowing = following?.some((f) => f.user.id === bower?.userId);
  const isBowerOwner = currentUser?.id === bower?.userId;

  const isOpenEdition = contract ? OE_STYLE_IDS.includes(contract.styleId) : false;
  const hasMarketplace = contract ? !isMintOnlyStyle(contract.styleId) && contract.styleId !== "bowers-custom" : false;

  const tokens = tokensData?.tokens ?? [];
  const myClaimable = walletAddress
    ? tokensData?.claimable.find((c) => c.address === walletAddress)
    : null;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!bower) return;
      if (isFollowing) {
        await apiRequest("DELETE", `/api/follow/${bower.userId}`);
      } else {
        await apiRequest("POST", "/api/follow", { followedId: bower.userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
      toast({ title: isFollowing ? "Unfollowed" : "Following", description: isFollowing ? "You will no longer receive updates." : "You'll be notified of bower activity." });
    },
  });

  const friendMutation = useMutation({
    mutationFn: async () => {
      if (!bower) return;
      await apiRequest("POST", "/api/friends/request", { addresseeId: bower.userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend Request Sent", description: "They'll need to accept your request." });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return withdraw(contract.kt1Address);
    },
    onSuccess: (opHash) => {
      toast({ title: "Withdrawal Confirmed", description: `Op: ${opHash.slice(0, 12)}...` });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contract?.id, "tokens"] });
    },
    onError: (err: Error) => {
      toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-48 w-full rounded-md mb-6" />
        <Skeleton className="h-24 w-full mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!bower) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Bird className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Bower Not Found</h2>
        <Button variant="outline" onClick={() => navigate("/marketplace")} data-testid="button-back-marketplace">
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const userName = bower.user
    ? [bower.user.firstName, bower.user.lastName].filter(Boolean).join(" ") || "Anonymous"
    : "Anonymous";
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/marketplace")} data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Marketplace
      </Button>

      {/* Hero banner */}
      <div
        className="rounded-md p-8 mb-6 relative"
        style={{ backgroundColor: bower.themeColor || "#6366f1" }}
      >
        <div className="absolute inset-0 bg-black/20 rounded-md" />
        <div className="relative z-10 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 ring-2 ring-white/30">
              <AvatarImage src={bower.user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow" data-testid="text-bower-title">
                {bower.title}
              </h1>
              <p className="text-sm text-white/80">{userName}</p>
            </div>
          </div>

          {isAuthenticated && !isBowerOwner && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white backdrop-blur"
                onClick={() => friendMutation.mutate()}
                disabled={friendMutation.isPending}
                data-testid="button-add-friend"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Add Friend
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white backdrop-blur"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                data-testid="button-follow"
              >
                {isFollowing ? <BellOff className="w-3.5 h-3.5 mr-1" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {bower.description && (
        <p className="text-sm text-muted-foreground mb-6">{bower.description}</p>
      )}

      {/* Contract info card */}
      {contract && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div>
              <h3 className="font-semibold" data-testid="text-featured-contract">{contract.name}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {contract.kt1Address.slice(0, 10)}...{contract.kt1Address.slice(-6)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{contract.symbol}</Badge>
              <Badge variant="outline" className="text-[10px]">{tokens.length} token{tokens.length !== 1 ? "s" : ""}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{CONTRACT_STYLES.find((s) => s.id === contract.styleId)?.name ?? contract.styleId}</Badge>
            {contract.royaltiesEnabled && <Badge variant="secondary" className="text-[10px]">Royalties</Badge>}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${explorerBaseUrl}/${contract.kt1Address}`, "_blank")}
              data-testid="button-view-on-explorer"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              View on Explorer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/collection/${contract.id}`)}
            >
              <Grid3X3 className="w-3.5 h-3.5 mr-1" />
              View Full Collection
            </Button>
          </div>

          {/* Claimable balance */}
          {myClaimable && myClaimable.amount > 0 && (
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Claimable Balance</p>
                <p className="text-lg font-bold text-primary">
                  {(myClaimable.amount / 1_000_000).toFixed(6)} tez
                </p>
              </div>
              <Button
                onClick={() => withdrawMutation.mutate()}
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4 mr-2" />
                )}
                Withdraw
              </Button>
            </div>
          )}
        </Card>
      )}

      {!contract && (
        <Card className="p-8 text-center">
          <Bird className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">This bower hasn't featured a collection yet.</p>
        </Card>
      )}

      {/* Wallet connection banner */}
      {contract && !walletAddress && tokens.length > 0 && (
        <Card className="p-4 mb-6 border-dashed">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Connect your wallet to interact</p>
                <p className="text-xs text-muted-foreground">
                  Buy, make offers, mint editions, and more
                </p>
              </div>
            </div>
            <Button onClick={connectWallet} disabled={isConnecting} size="sm">
              {isConnecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              Connect Wallet
            </Button>
          </div>
        </Card>
      )}

      {/* Token grid */}
      {contract && tokensLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      )}

      {contract && !tokensLoading && tokens.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Hexagon className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No tokens yet</h2>
          <p className="text-sm text-muted-foreground">
            This collection doesn't have any tokens yet. Check back soon.
          </p>
        </div>
      )}

      {contract && tokens.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {tokens.map((token) => (
            <TokenCard
              key={token.tokenId}
              contractAddress={contract.kt1Address}
              contractId={contract.id}
              tokenId={token.tokenId}
              name={token.metadata.name || `#${token.tokenId}`}
              imageUrl={token.imageUrl}
              mimeType={token.metadata.mimeType}
              description={token.metadata.description}
              owners={token.owners}
              listing={token.listing}
              offers={token.offers}
              tokenConfig={token.tokenConfig}
              walletAddress={walletAddress ?? undefined}
              isOpenEdition={isOpenEdition}
              hasMarketplace={hasMarketplace}
              onConnectWallet={!walletAddress ? connectWallet : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
