import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Hexagon,
  ExternalLink,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Paintbrush,
  Pause,
  Play,
  DollarSign,
  UserCog,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  CalendarClock,
  ListChecks,
  Trash2,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/lib/wallet-context";
import { useNetwork } from "@/lib/network-context";
import { useToast } from "@/hooks/use-toast";
import { blockAddress, unblockAddress, setAdmin, setMintPaused, setMintPrice, setMintEnd } from "@/lib/tezos/blocklist";
import { setAllowlist, clearAllowlist, setAllowlistEnd, type AllowlistEntry } from "@/lib/tezos/allowlist";
import { withdraw } from "@/lib/tezos/marketplace";
import { CONTRACT_STYLES } from "@shared/schema";
import { styleIcons, hasCreateTokenFlow, hasAllowlistControls, isBondingCurveStyle } from "./create-collection/types";
import type { Contract } from "@shared/schema";

export default function ManageContract() {
  const [, params] = useRoute("/manage/:id");
  const [, navigate] = useLocation();
  const { address } = useWallet();
  const { toast } = useToast();
  const { explorerBaseUrl } = useNetwork();
  const qc = useQueryClient();
  const contractId = params?.id;

  const [blockInput, setBlockInput] = useState("");
  const [unblockInput, setUnblockInput] = useState("");
  const [newAdminInput, setNewAdminInput] = useState("");
  const [pauseTokenId, setPauseTokenId] = useState("");
  const [priceTokenId, setPriceTokenId] = useState("");
  const [newPriceTez, setNewPriceTez] = useState("");
  const [copied, setCopied] = useState(false);

  const [mintEndTokenId, setMintEndTokenId] = useState("");
  const [mintEndDate, setMintEndDate] = useState("");

  const [alTokenId, setAlTokenId] = useState("");
  const [alEntryAddr, setAlEntryAddr] = useState("");
  const [alEntryMaxQty, setAlEntryMaxQty] = useState("1");
  const [alEntryPriceOverride, setAlEntryPriceOverride] = useState("");
  const [alEntries, setAlEntries] = useState<AllowlistEntry[]>([]);
  const [alClearTokenId, setAlClearTokenId] = useState("");
  const [alEndTokenId, setAlEndTokenId] = useState("");
  const [alEndDate, setAlEndDate] = useState("");

  const { data: contract, isLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts/detail", contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/detail/${contractId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Contract not found");
      return res.json();
    },
    enabled: !!contractId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/contracts/detail", contractId] });
    qc.invalidateQueries({ queryKey: ["/api/contracts"] });
  };

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return blockAddress(contract.kt1Address, blockInput.trim());
    },
    onSuccess: (opHash) => {
      toast({ title: "Address Blocked", description: `Op: ${opHash.slice(0, 12)}...` });
      setBlockInput("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Block Failed", description: err.message, variant: "destructive" });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return unblockAddress(contract.kt1Address, unblockInput.trim());
    },
    onSuccess: (opHash) => {
      toast({ title: "Address Unblocked", description: `Op: ${opHash.slice(0, 12)}...` });
      setUnblockInput("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Unblock Failed", description: err.message, variant: "destructive" });
    },
  });

  const adminMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return setAdmin(contract.kt1Address, newAdminInput.trim());
    },
    onSuccess: (opHash) => {
      toast({ title: "Admin Transferred", description: `Op: ${opHash.slice(0, 12)}...` });
      setNewAdminInput("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Transfer Failed", description: err.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!contract) throw new Error("No contract");
      return setMintPaused(contract.kt1Address, parseInt(pauseTokenId), paused);
    },
    onSuccess: (opHash) => {
      toast({ title: "Mint State Updated", description: `Op: ${opHash.slice(0, 12)}...` });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const priceMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      const mutez = Math.round(parseFloat(newPriceTez) * 1_000_000);
      return setMintPrice(contract.kt1Address, parseInt(priceTokenId), mutez);
    },
    onSuccess: (opHash) => {
      toast({ title: "Price Updated", description: `Op: ${opHash.slice(0, 12)}...` });
      setNewPriceTez("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Price Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return withdraw(contract.kt1Address);
    },
    onSuccess: (opHash) => {
      toast({ title: "Withdrawal Confirmed", description: `Op: ${opHash.slice(0, 12)}...` });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" });
    },
  });

  const mintEndMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      const end = mintEndDate ? new Date(mintEndDate).toISOString() : null;
      return setMintEnd(contract.kt1Address, parseInt(mintEndTokenId), end);
    },
    onSuccess: (opHash) => {
      toast({ title: "Mint End Updated", description: `Op: ${opHash.slice(0, 12)}...` });
      setMintEndDate("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const alSetMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return setAllowlist(contract.kt1Address, parseInt(alTokenId), alEntries);
    },
    onSuccess: (opHash) => {
      toast({ title: "Allowlist Set", description: `Op: ${opHash.slice(0, 12)}...` });
      setAlEntries([]);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Set Allowlist Failed", description: err.message, variant: "destructive" });
    },
  });

  const alClearMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      return clearAllowlist(contract.kt1Address, parseInt(alClearTokenId));
    },
    onSuccess: (opHash) => {
      toast({ title: "Allowlist Cleared", description: `Op: ${opHash.slice(0, 12)}...` });
      setAlClearTokenId("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Clear Failed", description: err.message, variant: "destructive" });
    },
  });

  const alEndMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      const end = alEndDate ? new Date(alEndDate).toISOString() : null;
      return setAllowlistEnd(contract.kt1Address, parseInt(alEndTokenId), end);
    },
    onSuccess: (opHash) => {
      toast({ title: "Allowlist End Updated", description: `Op: ${opHash.slice(0, 12)}...` });
      setAlEndDate("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const addAlEntry = () => {
    const addr = alEntryAddr.trim();
    if (!addr) return;
    setAlEntries((prev) => [
      ...prev,
      {
        address: addr,
        max_qty: parseInt(alEntryMaxQty) || 1,
        price_override: alEntryPriceOverride
          ? Math.round(parseFloat(alEntryPriceOverride) * 1_000_000)
          : null,
      },
    ]);
    setAlEntryAddr("");
    setAlEntryMaxQty("1");
    setAlEntryPriceOverride("");
  };

  const removeAlEntry = (idx: number) => {
    setAlEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const copyAddress = () => {
    if (contract) {
      navigator.clipboard.writeText(contract.kt1Address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-40 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Hexagon className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Contract Not Found</h2>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const Icon = styleIcons[contract.styleId] || Hexagon;
  const styleName = CONTRACT_STYLES.find((s) => s.id === contract.styleId)?.name ?? contract.styleId;
  const isOwner = address && contract.ownerAddress === address;
  const hasTokenConfig = hasCreateTokenFlow(contract.styleId);
  const hasAllowlist = hasAllowlistControls(contract.styleId);
  const isBonding = isBondingCurveStyle(contract.styleId);
  const styleMetadata = CONTRACT_STYLES.find((s) => s.id === contract.styleId);
  const hasSetAdmin = !!styleMetadata?.entrypoints.setAdmin;

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold mb-1">Not Authorized</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Only the contract owner can manage this contract. Connect the owner wallet to proceed.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(`/collection/${contract.id}`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Collection
      </Button>

      <Card className="p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 dark:bg-primary/20 shrink-0">
            <Icon className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold">{contract.name}</h1>
              <Badge variant="outline" className="text-xs">{contract.symbol}</Badge>
              <Badge variant="secondary" className="text-xs">{styleName}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{contract.kt1Address}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={copyAddress}>
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => window.open(`${explorerBaseUrl}/${contract.kt1Address}`, "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="blocklist" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="blocklist">
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Blocklist
          </TabsTrigger>
          {hasTokenConfig && (
            <TabsTrigger value="mint-config">
              <Paintbrush className="w-3.5 h-3.5 mr-1.5" />
              Mint Config
            </TabsTrigger>
          )}
          {hasAllowlist && (
            <TabsTrigger value="allowlist">
              <ListChecks className="w-3.5 h-3.5 mr-1.5" />
              Allowlist
            </TabsTrigger>
          )}
          {hasSetAdmin && (
            <TabsTrigger value="admin">
              <UserCog className="w-3.5 h-3.5 mr-1.5" />
              Admin
            </TabsTrigger>
          )}
          <TabsTrigger value="withdraw">
            <DollarSign className="w-3.5 h-3.5 mr-1.5" />
            Withdraw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blocklist">
          <Card className="p-5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-1">Contract-Level Blocklist</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Blocked addresses cannot transfer, receive, buy, or mint tokens under this contract.
                This is enforced at the FA2 transfer level, so even external marketplaces like objkt will reject blocked addresses.
              </p>

              <div className="space-y-4">
                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-destructive" />
                    <Label className="text-sm font-medium">Block an Address</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="tz1... or KT1..."
                      value={blockInput}
                      onChange={(e) => setBlockInput(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      onClick={() => blockMutation.mutate()}
                      disabled={!blockInput.trim() || blockMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      {blockMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldOff className="w-4 h-4 mr-1" />
                      )}
                      Block
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <Label className="text-sm font-medium">Unblock an Address</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="tz1... or KT1..."
                      value={unblockInput}
                      onChange={(e) => setUnblockInput(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      onClick={() => unblockMutation.mutate()}
                      disabled={!unblockInput.trim() || unblockMutation.isPending}
                      variant="outline"
                      size="sm"
                    >
                      {unblockMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4 mr-1" />
                      )}
                      Unblock
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {hasTokenConfig && (
          <TabsContent value="mint-config">
            <Card className="p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-1">Token Mint Configuration</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Pause/resume minting or update the mint price for individual tokens.
                </p>

                <div className="space-y-4">
                  <div className="rounded-md border p-4 space-y-3">
                    <Label className="text-sm font-medium">Pause / Resume Minting</Label>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="pauseTokenId" className="text-xs text-muted-foreground">Token ID</Label>
                        <Input
                          id="pauseTokenId"
                          type="number"
                          min={0}
                          placeholder="0"
                          value={pauseTokenId}
                          onChange={(e) => setPauseTokenId(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => pauseMutation.mutate(true)}
                        disabled={!pauseTokenId || pauseMutation.isPending}
                        variant="outline"
                        size="sm"
                      >
                        {pauseMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4 mr-1" />
                        )}
                        Pause
                      </Button>
                      <Button
                        onClick={() => pauseMutation.mutate(false)}
                        disabled={!pauseTokenId || pauseMutation.isPending}
                        variant="outline"
                        size="sm"
                      >
                        {pauseMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-1" />
                        )}
                        Resume
                      </Button>
                    </div>
                  </div>

                  {!isBonding && (
                    <div className="rounded-md border p-4 space-y-3">
                      <Label className="text-sm font-medium">Update Mint Price</Label>
                      <div className="flex items-end gap-2">
                        <div className="space-y-1 flex-1">
                          <Label htmlFor="priceTokenId" className="text-xs text-muted-foreground">Token ID</Label>
                          <Input
                            id="priceTokenId"
                            type="number"
                            min={0}
                            placeholder="0"
                            value={priceTokenId}
                            onChange={(e) => setPriceTokenId(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1 flex-1">
                          <Label htmlFor="newPriceTez" className="text-xs text-muted-foreground">New Price (tez)</Label>
                          <Input
                            id="newPriceTez"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="1.0"
                            value={newPriceTez}
                            onChange={(e) => setNewPriceTez(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => priceMutation.mutate()}
                          disabled={!priceTokenId || !newPriceTez || priceMutation.isPending}
                          size="sm"
                        >
                          {priceMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <DollarSign className="w-4 h-4 mr-1" />
                          )}
                          Set Price
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border p-4 space-y-3">
                    <Label className="text-sm font-medium">Set Mint End Date</Label>
                    <p className="text-xs text-muted-foreground">
                      Set or clear a deadline after which minting is closed for a token.
                    </p>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="mintEndTokenId" className="text-xs text-muted-foreground">Token ID</Label>
                        <Input
                          id="mintEndTokenId"
                          type="number"
                          min={0}
                          placeholder="0"
                          value={mintEndTokenId}
                          onChange={(e) => setMintEndTokenId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="mintEndDate" className="text-xs text-muted-foreground">End Date (blank = no deadline)</Label>
                        <Input
                          id="mintEndDate"
                          type="datetime-local"
                          value={mintEndDate}
                          onChange={(e) => setMintEndDate(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => mintEndMutation.mutate()}
                        disabled={!mintEndTokenId || mintEndMutation.isPending}
                        size="sm"
                      >
                        {mintEndMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CalendarClock className="w-4 h-4 mr-1" />
                        )}
                        {mintEndDate ? "Set End" : "Clear End"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}

        {hasAllowlist && (
          <TabsContent value="allowlist">
            <Card className="p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-1">Allowlist Management</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Manage the allowlist for phased drops. Allowlisted addresses can mint during the allowlist phase with optional per-address caps and price overrides.
                </p>

                <div className="space-y-4">
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-medium">Set Allowlist</Label>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="alTokenId" className="text-xs text-muted-foreground">Token ID</Label>
                      <Input
                        id="alTokenId"
                        type="number"
                        min={0}
                        placeholder="0"
                        value={alTokenId}
                        onChange={(e) => setAlTokenId(e.target.value)}
                        className="w-28"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <Input
                          placeholder="tz1..."
                          value={alEntryAddr}
                          onChange={(e) => setAlEntryAddr(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1 w-20">
                        <Label className="text-xs text-muted-foreground">Max Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={alEntryMaxQty}
                          onChange={(e) => setAlEntryMaxQty(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 w-28">
                        <Label className="text-xs text-muted-foreground">Price (tez)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Default"
                          value={alEntryPriceOverride}
                          onChange={(e) => setAlEntryPriceOverride(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={addAlEntry} disabled={!alEntryAddr.trim()}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {alEntries.length > 0 && (
                      <div className="rounded-md border divide-y">
                        {alEntries.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span className="font-mono truncate flex-1">{entry.address}</span>
                            <span className="text-muted-foreground mx-2">max: {entry.max_qty}</span>
                            <span className="text-muted-foreground mx-2">
                              {entry.price_override !== null
                                ? `${(entry.price_override / 1_000_000).toFixed(2)} tez`
                                : "default price"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeAlEntry(idx)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => alSetMutation.mutate()}
                      disabled={!alTokenId || alEntries.length === 0 || alSetMutation.isPending}
                      size="sm"
                    >
                      {alSetMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <ListChecks className="w-4 h-4 mr-1" />
                      )}
                      Set Allowlist ({alEntries.length} {alEntries.length === 1 ? "entry" : "entries"})
                    </Button>
                  </div>

                  <div className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-destructive" />
                      <Label className="text-sm font-medium">Clear Allowlist</Label>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="alClearTokenId" className="text-xs text-muted-foreground">Token ID</Label>
                        <Input
                          id="alClearTokenId"
                          type="number"
                          min={0}
                          placeholder="0"
                          value={alClearTokenId}
                          onChange={(e) => setAlClearTokenId(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => alClearMutation.mutate()}
                        disabled={!alClearTokenId || alClearMutation.isPending}
                        variant="destructive"
                        size="sm"
                      >
                        {alClearMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-medium">Set Allowlist End Date</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After this date, public open-edition minting opens for all.
                    </p>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="alEndTokenId" className="text-xs text-muted-foreground">Token ID</Label>
                        <Input
                          id="alEndTokenId"
                          type="number"
                          min={0}
                          placeholder="0"
                          value={alEndTokenId}
                          onChange={(e) => setAlEndTokenId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="alEndDate" className="text-xs text-muted-foreground">End Date (blank = no end)</Label>
                        <Input
                          id="alEndDate"
                          type="datetime-local"
                          value={alEndDate}
                          onChange={(e) => setAlEndDate(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => alEndMutation.mutate()}
                        disabled={!alEndTokenId || alEndMutation.isPending}
                        size="sm"
                      >
                        {alEndMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CalendarClock className="w-4 h-4 mr-1" />
                        )}
                        {alEndDate ? "Set End" : "Clear End"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}

        {hasSetAdmin && (
          <TabsContent value="admin">
            <Card className="p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-1">Transfer Admin Role</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Transfer admin ownership of this contract to a new address. This action is irreversible — the new admin will have full control.
                </p>

                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">This action cannot be undone</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="tz1... (new admin address)"
                      value={newAdminInput}
                      onChange={(e) => setNewAdminInput(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      onClick={() => adminMutation.mutate()}
                      disabled={!newAdminInput.trim() || adminMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      {adminMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCog className="w-4 h-4 mr-1" />
                      )}
                      Transfer
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="withdraw">
          <Card className="p-5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-1">Withdraw Claimable Balance</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Claim any accumulated tez from mint sales or marketplace royalties. The balance is held in the contract until you withdraw.
              </p>

              <Button
                onClick={() => withdrawMutation.mutate()}
                disabled={withdrawMutation.isPending}
              >
                {withdrawMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="w-4 h-4 mr-2" />
                )}
                Withdraw Claimable Balance
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 mt-6 pt-4 border-t">
        <Button variant="outline" onClick={() => navigate(`/collection/${contract.id}`)}>
          View Collection
        </Button>
        <Button variant="outline" onClick={() => navigate(`/mint/${contract.id}`)}>
          <Paintbrush className="w-4 h-4 mr-1.5" />
          Mint Token
        </Button>
      </div>
    </div>
  );
}
