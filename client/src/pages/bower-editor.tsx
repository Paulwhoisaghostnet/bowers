import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bird, Save, Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import type { Bower, Contract } from "@shared/schema";

const LAYOUTS = [
  { value: "standard", label: "Standard" },
  { value: "minimal", label: "Minimal" },
  { value: "showcase", label: "Showcase" },
  { value: "gallery", label: "Gallery" },
];

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#1e293b", "#64748b", "#0f172a",
];

export default function BowerEditor() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: existingBower, isLoading: bowerLoading } = useQuery<Bower | null>({
    queryKey: ["/api/bowers/me"],
    enabled: isAuthenticated,
  });

  const { data: myContracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/user/me"],
    enabled: isAuthenticated,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [layout, setLayout] = useState("standard");
  const [contractId, setContractId] = useState<string>("");

  useEffect(() => {
    if (existingBower) {
      setTitle(existingBower.title);
      setDescription(existingBower.description || "");
      setThemeColor(existingBower.themeColor || "#6366f1");
      setLayout(existingBower.layout);
      setContractId(existingBower.contractId || "");
    }
  }, [existingBower]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { title, description, themeColor, layout, contractId: contractId || null };
      if (existingBower) {
        const res = await apiRequest("PUT", `/api/bowers/${existingBower.id}`, body);
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/bowers", body);
        return await res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bowers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bowers/me"] });
      toast({ title: existingBower ? "Bower Updated" : "Bower Created", description: "Your bower has been saved." });
    },
    onError: (err: Error) => {
      if (isUnauthorizedError(err)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading || bowerLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canSave = title.trim().length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-bower-editor-title">
          {existingBower ? "Edit Your Bower" : "Create Your Bower"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Design your personal showcase for the marketplace. Each artist gets one bower.
        </p>
      </div>

      <div
        className="rounded-md p-6 mb-6 transition-colors"
        style={{ backgroundColor: themeColor }}
      >
        <div className="relative z-10">
          <div className="absolute inset-0 bg-black/20 rounded-md -m-6 p-6" />
          <div className="relative flex items-center gap-3">
            <Bird className="w-8 h-8 text-white drop-shadow" />
            <div>
              <h2 className="text-xl font-bold text-white drop-shadow">{title || "Your Bower"}</h2>
              <p className="text-xs text-white/70">{user?.firstName} {user?.lastName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Bower Title</Label>
          <Input
            id="title"
            placeholder="My Art Gallery"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-bower-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Tell visitors about your collection and artistic vision..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            data-testid="input-bower-description"
          />
        </div>

        <div className="space-y-2">
          <Label>Theme Color</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`w-8 h-8 rounded-md transition-transform ${
                  themeColor === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : ""
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setThemeColor(c)}
                data-testid={`button-color-${c.slice(1)}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Layout</Label>
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger data-testid="select-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Featured Collection</Label>
          {contractsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : !myContracts || myContracts.length === 0 ? (
            <Card className="p-4">
              <p className="text-xs text-muted-foreground text-center">
                No contracts yet. Deploy a collection first, then feature it here.
              </p>
            </Card>
          ) : (
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger data-testid="select-contract">
                <SelectValue placeholder="Select a collection" />
              </SelectTrigger>
              <SelectContent>
                {myContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          className="w-full"
          disabled={!canSave || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          data-testid="button-save-bower"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : existingBower ? "Update Bower" : "Create Bower"}
        </Button>
      </div>
    </div>
  );
}
