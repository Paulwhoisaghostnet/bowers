import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, ExternalLink, Paintbrush, Download, Hexagon, Layers, Gem, Users, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/wallet-context";
import { shortenAddress } from "@/lib/tezos";
import type { Contract } from "@shared/schema";

const styleIcons: Record<string, typeof Layers> = {
  "fa2-basic": Layers,
  "fa2-royalties": Gem,
  "fa2-multiminter": Users,
  "fa2-full": Crown,
};

function ContractCard({ contract }: { contract: Contract }) {
  const [, navigate] = useLocation();
  const Icon = styleIcons[contract.styleId] || Hexagon;

  return (
    <Card className="p-4 hover-elevate cursor-pointer group" data-testid={`card-contract-${contract.id}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 dark:bg-primary/20">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{contract.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">
              {shortenAddress(contract.kt1Address)}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {contract.symbol}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="text-[10px]">
          {contract.styleId.replace("fa2-", "FA2 ")}
        </Badge>
        {contract.royaltiesEnabled && (
          <Badge variant="secondary" className="text-[10px]">
            Royalties
          </Badge>
        )}
        {contract.minterListEnabled && (
          <Badge variant="secondary" className="text-[10px]">
            Multi-Minter
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {contract.tokenCount} token{contract.tokenCount !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://ghostnet.tzkt.io/${contract.kt1Address}`, "_blank");
            }}
            data-testid={`button-view-explorer-${contract.id}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/mint/${contract.id}`);
            }}
            data-testid={`button-mint-${contract.id}`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/api/contracts/${contract.id}/config`, "_blank");
            }}
            data-testid={`button-download-config-${contract.id}`}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  const [, navigate] = useLocation();
  const { address } = useWallet();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <Hexagon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-1">No collections yet</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {address
          ? "Deploy your first NFT collection contract on Tezos. Choose a contract style and configure it with no code."
          : "Connect your Tezos wallet to get started with deploying NFT collection contracts."}
      </p>
      {address && (
        <Button onClick={() => navigate("/create")} data-testid="button-create-first-collection">
          <Plus className="w-4 h-4 mr-2" />
          Create New Collection
        </Button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <Skeleton className="w-10 h-10 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-20" />
        </Card>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { address } = useWallet();
  const [, navigate] = useLocation();

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", address || ""],
    enabled: !!address,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            My Contracts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your deployed NFT collection contracts
          </p>
        </div>
        {address && contracts && contracts.length > 0 && (
          <Button onClick={() => navigate("/create")} data-testid="button-create-collection">
            <Plus className="w-4 h-4 mr-2" />
            New Collection
          </Button>
        )}
      </div>

      {!address ? (
        <EmptyState />
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : !contracts || contracts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </div>
      )}
    </div>
  );
}
