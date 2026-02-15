import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wallet, Plus, Trash2, Star, StarOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import type { Wallet as WalletType } from "@shared/schema";

export default function WalletsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { address: connectedAddress, connect } = useWallet();
  const { toast } = useToast();
  const [label, setLabel] = useState("");

  const { data: walletsList, isLoading } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [authLoading, isAuthenticated]);

  const addMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await apiRequest("POST", "/api/wallets", { address, label: label || undefined });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setLabel("");
      toast({ title: "Wallet Added", description: "Your wallet has been linked to your account." });
    },
    onError: (err: Error) => {
      if (isUnauthorizedError(err)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/wallets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Wallet Removed" });
    },
  });

  const primaryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/wallets/${id}/primary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Primary Wallet Updated" });
    },
  });

  const alreadyLinked = walletsList?.some((w) => w.address === connectedAddress);

  if (authLoading || isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-wallets-title">My Wallets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Link Tezos wallets to your account. Each wallet's contracts will appear in your dashboard.
        </p>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-sm mb-3">Add Wallet</h3>
        {connectedAddress ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-mono text-muted-foreground">{connectedAddress}</span>
            </div>
            {!alreadyLinked && (
              <div className="space-y-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  placeholder="e.g. Main wallet"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  data-testid="input-wallet-label"
                />
                <Button
                  onClick={() => addMutation.mutate(connectedAddress)}
                  disabled={addMutation.isPending}
                  data-testid="button-link-wallet"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {addMutation.isPending ? "Linking..." : "Link This Wallet"}
                </Button>
              </div>
            )}
            {alreadyLinked && (
              <p className="text-xs text-muted-foreground">This wallet is already linked to your account.</p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">Connect your Tezos wallet first, then link it to your account.</p>
            <Button onClick={connect} data-testid="button-connect-wallet-to-link">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {walletsList && walletsList.length > 0 ? (
          walletsList.map((w) => (
            <Card key={w.id} className="p-4" data-testid={`card-wallet-${w.id}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">{w.address.slice(0, 10)}...{w.address.slice(-6)}</span>
                      {w.isPrimary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                    </div>
                    {w.label && <p className="text-xs text-muted-foreground">{w.label}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!w.isPrimary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => primaryMutation.mutate(w.id)}
                      data-testid={`button-set-primary-${w.id}`}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMutation.mutate(w.id)}
                    data-testid={`button-remove-wallet-${w.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8">
            <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No wallets linked yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
