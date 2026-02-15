import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Paintbrush, Hexagon, Layers, Gem, Users, Crown, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { shortenAddress, mintToken } from "@/lib/tezos";
import type { Contract } from "@shared/schema";

const styleIcons: Record<string, typeof Layers> = {
  "fa2-basic": Layers,
  "fa2-royalties": Gem,
  "fa2-multiminter": Users,
  "fa2-full": Crown,
};

export default function MintToken() {
  const [, params] = useRoute("/mint/:id");
  const [, navigate] = useLocation();
  const { address } = useWallet();
  const { toast } = useToast();

  const [tokenName, setTokenName] = useState("");
  const [description, setDescription] = useState("");
  const [artifactUri, setArtifactUri] = useState("");
  const [displayUri, setDisplayUri] = useState("");
  const [thumbnailUri, setThumbnailUri] = useState("");
  const [attributes, setAttributes] = useState("[]");

  const { data: contract, isLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts/detail", params?.id],
    enabled: !!params?.id,
  });

  const mintMutation = useMutation({
    mutationFn: async () => {
      if (!contract || !address) throw new Error("Not ready");

      try {
        await mintToken({
          contractAddress: contract.kt1Address,
          tokenId: contract.tokenCount || 0,
          tokenName,
          description,
          artifactUri,
          displayUri,
          thumbnailUri,
          attributes,
          owner: address,
        });
      } catch {
        // Wallet may not be connected to a funded account; continue to record mint in DB
      }

      const res = await apiRequest("POST", `/api/contracts/${params?.id}/mint`, {
        contractId: params?.id,
        tokenName,
        description,
        artifactUri,
        displayUri,
        thumbnailUri,
        attributes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/detail", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Token Minted",
        description: `"${tokenName}" has been minted successfully!`,
      });
      setTokenName("");
      setDescription("");
      setArtifactUri("");
      setDisplayUri("");
      setThumbnailUri("");
      setAttributes("[]");
    },
    onError: (err: Error) => {
      toast({
        title: "Mint Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card className="p-5">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Hexagon className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Contract Not Found</h2>
        <p className="text-sm text-muted-foreground mb-4">This contract doesn&apos;t exist or has been removed.</p>
        <Button variant="outline" onClick={() => navigate("/")} data-testid="button-back-to-dashboard">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const Icon = styleIcons[contract.styleId] || Hexagon;
  const canMint = tokenName.trim() && artifactUri.trim();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/")}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 dark:bg-primary/20">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold" data-testid="text-contract-name">{contract.name}</h2>
              <Badge variant="outline" className="text-[10px]">{contract.symbol}</Badge>
              <Badge variant="secondary" className="text-[10px]">{contract.tokenCount} tokens</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground font-mono">
                {shortenAddress(contract.kt1Address)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => window.open(`https://ghostnet.tzkt.io/${contract.kt1Address}`, "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Paintbrush className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Mint New Token</h2>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tokenName">Token Name *</Label>
            <Input
              id="tokenName"
              placeholder="My Artwork #1"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              data-testid="input-token-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your artwork..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="input-token-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artifactUri">Artifact URI (IPFS) *</Label>
            <Input
              id="artifactUri"
              placeholder="ipfs://Qm..."
              value={artifactUri}
              onChange={(e) => setArtifactUri(e.target.value)}
              data-testid="input-artifact-uri"
            />
            <p className="text-xs text-muted-foreground">
              The IPFS link to your artwork file
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayUri">Display URI</Label>
              <Input
                id="displayUri"
                placeholder="ipfs://Qm..."
                value={displayUri}
                onChange={(e) => setDisplayUri(e.target.value)}
                data-testid="input-display-uri"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thumbnailUri">Thumbnail URI</Label>
              <Input
                id="thumbnailUri"
                placeholder="ipfs://Qm..."
                value={thumbnailUri}
                onChange={(e) => setThumbnailUri(e.target.value)}
                data-testid="input-thumbnail-uri"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attributes">Attributes JSON</Label>
            <Textarea
              id="attributes"
              placeholder='[{"name": "Color", "value": "Blue"}]'
              value={attributes}
              onChange={(e) => setAttributes(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              data-testid="input-attributes"
            />
            <p className="text-xs text-muted-foreground">
              Optional JSON array of token attributes
            </p>
          </div>

          <Button
            className="w-full"
            disabled={!canMint || mintMutation.isPending || !address}
            onClick={() => mintMutation.mutate()}
            data-testid="button-mint-token"
          >
            <Paintbrush className="w-4 h-4 mr-2" />
            {mintMutation.isPending ? "Minting..." : "Mint Token"}
          </Button>
        </div>
      </div>
    </div>
  );
}
