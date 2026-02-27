import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Hexagon,
  ExternalLink,
  Paintbrush,
  Settings2,
  Wallet,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/wallet-context";
import { useNetwork } from "@/lib/network-context";
import { useToast } from "@/hooks/use-toast";
import { shortenAddress } from "@/lib/tezos";
import { ipfsToHttp } from "@/lib/ipfs";
import { withdraw } from "@/lib/tezos/marketplace";
import { TokenCard } from "@/components/token-card";
import { queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { styleIcons, isMintOnlyStyle } from "./create-collection/types";
import type { Contract } from "@shared/schema";

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

export default function CollectionPage() {
  const [, params] = useRoute("/collection/:id");
  const [, navigate] = useLocation();
  const { address } = useWallet();
  const { toast } = useToast();
  const { explorerBaseUrl } = useNetwork();
  const contractId = params?.id;

  const { data, isLoading, error } = useQuery<TokensResponse>({
    queryKey: ["/api/contracts", contractId, "tokens"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/tokens`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load collection");
      return res.json();
    },
    enabled: !!contractId,
    staleTime: 30_000,
  });

  const myClaimable = address
    ? data?.claimable.find((c) => c.address === address)
    : null;

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!data?.contract) throw new Error("No contract");
      return withdraw(data.contract.kt1Address);
    },
    onSuccess: (opHash) => {
      toast({
        title: "Withdrawal Confirmed",
        description: `Op: ${opHash.slice(0, 12)}...`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/contracts", contractId, "tokens"],
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-32 w-full mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Hexagon className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Collection Not Found</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {(error as Error)?.message || "This collection could not be loaded."}
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const { contract, tokens } = data;
  const Icon = styleIcons[contract.styleId] || Hexagon;
  const isOpenEdition = contract.styleId === "bowers-open-edition" ||
    contract.styleId === "bowers-mint-oe" ||
    contract.styleId === "bowers-allowlist" ||
    contract.styleId === "bowers-mint-allowlist" ||
    contract.styleId === "bowers-bonding-curve" ||
    contract.styleId === "bowers-mint-bonding-curve" ||
    contract.styleId === "bowers-unified";
  const isOwner = address && contract.ownerAddress === address;
  const metadataUri = contract.metadataBaseUri;
  const coverUrl = metadataUri ? ipfsToHttp(metadataUri) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Button variant="ghost" className="mb-4" onClick={() => navigate("/")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Dashboard
      </Button>

      <Card className="p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 dark:bg-primary/20 shrink-0">
            <Icon className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold">{contract.name}</h1>
              <Badge variant="outline" className="text-xs">
                {contract.symbol}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {tokens.length} token{tokens.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-xs">
                {shortenAddress(contract.kt1Address)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() =>
                  window.open(
                    `${explorerBaseUrl}/${contract.kt1Address}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/manage/${contract.id}`)}
                >
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                  Manage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/mint/${contract.id}`)}
                >
                  <Paintbrush className="w-3.5 h-3.5 mr-1.5" />
                  Mint
                </Button>
              </>
            )}
          </div>
        </div>

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

      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Hexagon className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No tokens yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isOwner
              ? "Mint your first token to get started."
              : "This collection doesn't have any tokens yet."}
          </p>
          {isOwner && (
            <Button onClick={() => navigate(`/mint/${contract.id}`)}>
              <Paintbrush className="w-4 h-4 mr-2" />
              Mint First Token
            </Button>
          )}
        </div>
      ) : (
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
              walletAddress={address ?? undefined}
              isOpenEdition={isOpenEdition}
            />
          ))}
        </div>
      )}
    </div>
  );
}
