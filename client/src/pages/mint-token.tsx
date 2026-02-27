import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Paintbrush,
  Hexagon,
  ExternalLink,
  X,
  Eye,
  EyeOff,
  Link2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/lib/wallet-context";
import { useNetwork } from "@/lib/network-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { shortenAddress, mintToken } from "@/lib/tezos";
import { ipfsToHttp } from "@/lib/ipfs";
import { FileDropZone } from "@/components/file-drop-zone";
import { CONTRACT_STYLES } from "@shared/schema";
import { styleIcons, hasCreateTokenFlow, isMintOnlyStyle } from "./create-collection/types";
import type { Contract } from "@shared/schema";

export default function MintToken() {
  const [, params] = useRoute("/mint/:id");
  const [, navigate] = useLocation();
  const { address } = useWallet();
  const { toast } = useToast();
  const { explorerBaseUrl } = useNetwork();

  const [tokenName, setTokenName] = useState("");
  const [description, setDescription] = useState("");
  const [artifactUri, setArtifactUri] = useState("");
  const [displayUri, setDisplayUri] = useState("");
  const [thumbnailUri, setThumbnailUri] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [editions, setEditions] = useState("1");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [attributes, setAttributes] = useState("[]");
  const [manualMode, setManualMode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [royaltyRecipient, setRoyaltyRecipient] = useState("");
  const [royaltyBps, setRoyaltyBps] = useState("500");
  const [minOfferMutez, setMinOfferMutez] = useState("100000");
  const [mintPriceTez, setMintPriceTez] = useState("0");
  const [maxSupply, setMaxSupply] = useState("");

  const { data: contract, isLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts/detail", params?.id],
    enabled: !!params?.id,
  });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const isCreateToken = contract ? hasCreateTokenFlow(contract.styleId) : false;
  const isMintOnly = contract ? isMintOnlyStyle(contract.styleId) : false;

  const mintMutation = useMutation({
    mutationFn: async () => {
      if (!contract || !address) throw new Error("Not ready");

      await mintToken({
        contractAddress: contract.kt1Address,
        styleId: contract.styleId,
        tokenName,
        description,
        artifactUri,
        displayUri,
        thumbnailUri,
        mimeType,
        editions: parseInt(editions) || 1,
        creators: [address],
        tags,
        attributes,
        owner: address,
        royaltyRecipient: royaltyRecipient || address,
        royaltyBps: parseInt(royaltyBps) || 500,
        minOfferPerUnitMutez: parseInt(minOfferMutez) || 100000,
        mintPriceMutez: Math.round(parseFloat(mintPriceTez || "0") * 1_000_000),
        maxSupply: maxSupply ? parseInt(maxSupply) : null,
      });

      const res = await apiRequest("POST", `/api/contracts/${params?.id}/mint`, {
        contractId: params?.id,
        tokenName,
        description,
        artifactUri,
        displayUri,
        thumbnailUri,
        mimeType,
        editions: parseInt(editions) || 1,
        tags,
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
      setMimeType("");
      setEditions("1");
      setTags([]);
      setTagInput("");
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
      <div className="p-6 max-w-4xl mx-auto">
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
        <p className="text-sm text-muted-foreground mb-4">
          This contract doesn&apos;t exist or has been removed.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const Icon = styleIcons[contract.styleId] || Hexagon;
  const canMint = tokenName.trim() && artifactUri.trim() && mimeType;
  const previewImageUrl = artifactUri && mimeType?.startsWith("image/")
    ? ipfsToHttp(artifactUri)
    : displayUri
    ? ipfsToHttp(displayUri)
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/")}
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
              <h2 className="font-semibold">{contract.name}</h2>
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
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Paintbrush className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Mint New Token</h2>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tokenName">Token Name *</Label>
                <Input
                  id="tokenName"
                  placeholder="My Artwork #1"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editions">Editions</Label>
                <Input
                  id="editions"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={editions}
                  onChange={(e) => setEditions(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Number of copies to mint
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your artwork..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={manualMode}
                onCheckedChange={setManualMode}
                id="manualMode"
              />
              <Label htmlFor="manualMode" className="text-sm cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  I already have IPFS links
                </span>
              </Label>
            </div>

            {manualMode ? (
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-2">
                  <Label htmlFor="artifactUri">Artifact URI (IPFS) *</Label>
                  <Input
                    id="artifactUri"
                    placeholder="ipfs://Qm..."
                    value={artifactUri}
                    onChange={(e) => setArtifactUri(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mimeType">MIME Type *</Label>
                  <Input
                    id="mimeType"
                    placeholder="image/png"
                    value={mimeType}
                    onChange={(e) => setMimeType(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayUri">Display URI</Label>
                    <Input
                      id="displayUri"
                      placeholder="ipfs://Qm..."
                      value={displayUri}
                      onChange={(e) => setDisplayUri(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thumbnailUri">Thumbnail URI</Label>
                    <Input
                      id="thumbnailUri"
                      placeholder="ipfs://Qm..."
                      value={thumbnailUri}
                      onChange={(e) => setThumbnailUri(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FileDropZone
                  label="Artwork File *"
                  accept="image/*,video/*,audio/*,model/*,application/pdf,text/html"
                  maxSizeMB={50}
                  value={artifactUri}
                  onUploaded={(result) => {
                    setArtifactUri(result.uri);
                    setMimeType(result.mimeType);
                    if (result.mimeType.startsWith("image/")) {
                      if (!displayUri) setDisplayUri(result.uri);
                      if (!thumbnailUri) setThumbnailUri(result.uri);
                    }
                  }}
                  onClear={() => {
                    setArtifactUri("");
                    setMimeType("");
                  }}
                />

                {mimeType && !mimeType.startsWith("image/") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileDropZone
                      label="Display Image (preview)"
                      accept="image/*"
                      maxSizeMB={10}
                      compact
                      value={displayUri}
                      onUploaded={(result) => {
                        setDisplayUri(result.uri);
                        if (!thumbnailUri) setThumbnailUri(result.uri);
                      }}
                      onClear={() => setDisplayUri("")}
                    />
                    <FileDropZone
                      label="Thumbnail"
                      accept="image/*"
                      maxSizeMB={5}
                      compact
                      value={thumbnailUri}
                      onUploaded={(result) => setThumbnailUri(result.uri)}
                      onClear={() => setThumbnailUri("")}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Add a tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
              />
              <p className="text-xs text-muted-foreground">
                Optional JSON array of token attributes
              </p>
            </div>

            {isCreateToken && (
              <div className="rounded-md border p-4 space-y-4">
                <h3 className="text-sm font-semibold">Mint Settings</h3>
                <p className="text-xs text-muted-foreground">
                  Configure the mint price and supply for this token. These are set when the token is created on-chain.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mintPriceTez">Mint Price (tez)</Label>
                    <Input
                      id="mintPriceTez"
                      type="number"
                      min={0}
                      step="0.01"
                      value={mintPriceTez}
                      onChange={(e) => setMintPriceTez(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = free mint
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxSupply">Max Supply</Label>
                    <Input
                      id="maxSupply"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxSupply}
                      onChange={(e) => setMaxSupply(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank for unlimited editions
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-md border p-4 space-y-4">
              <h3 className="text-sm font-semibold">Market Rules</h3>
              <p className="text-xs text-muted-foreground">
                Set royalties{isMintOnly ? "" : " and minimum offer"} for this token. These rules apply to all secondary sales.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="royaltyBps">Royalty Rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="royaltyBps"
                      type="number"
                      min={0}
                      max={10000}
                      value={royaltyBps}
                      onChange={(e) => setRoyaltyBps(e.target.value)}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">bps</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({((parseInt(royaltyBps) || 0) / 100).toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minOfferMutez">Min Offer</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="minOfferMutez"
                      type="number"
                      min={1}
                      value={minOfferMutez}
                      onChange={(e) => setMinOfferMutez(e.target.value)}
                      className="w-36"
                    />
                    <span className="text-sm text-muted-foreground">mutez</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {((parseInt(minOfferMutez) || 0) / 1000000).toFixed(6)} tez
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="royaltyRecipient">Royalty Recipient</Label>
                <Input
                  id="royaltyRecipient"
                  placeholder={address ? `${address.slice(0, 10)}... (defaults to your wallet)` : "tz1..."}
                  value={royaltyRecipient}
                  onChange={(e) => setRoyaltyRecipient(e.target.value)}
                />
                {address && !royaltyRecipient && (
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use your connected wallet
                  </p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!canMint || mintMutation.isPending || !address}
              onClick={() => mintMutation.mutate()}
            >
              <Paintbrush className="w-4 h-4 mr-2" />
              {mintMutation.isPending
                ? "Minting..."
                : `Mint ${parseInt(editions) > 1 ? `${editions} Editions` : "Token"}`}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Token Preview</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          {showPreview && (
            <Card className="overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                {previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt="Token preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Hexagon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Upload artwork to see preview
                    </p>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="font-medium text-sm truncate">
                  {tokenName || "Untitled"}
                </p>
                {description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  {mimeType && (
                    <Badge variant="outline" className="text-[10px]">
                      {mimeType}
                    </Badge>
                  )}
                  {parseInt(editions) > 1 && (
                    <Badge variant="secondary" className="text-[10px]">
                      x{editions}
                    </Badge>
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tags.slice(0, 5).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[9px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {tags.length > 5 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{tags.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
