import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTRACT_STYLES } from "@shared/schema";
import type { WizardState } from "./types";

export function StepConfigure({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const selectedStyle = CONTRACT_STYLES.find((s) => s.id === state.styleId);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Configure Your Collection</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Set the details for your {selectedStyle?.name || ""} collection contract.
      </p>

      <div className="space-y-5 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="name">Collection Name</Label>
          <Input
            id="name"
            placeholder="My Art Collection"
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            data-testid="input-collection-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="symbol">Token Symbol</Label>
          <Input
            id="symbol"
            placeholder="MYART"
            value={state.symbol}
            onChange={(e) => onChange({ symbol: e.target.value.toUpperCase() })}
            maxLength={8}
            data-testid="input-collection-symbol"
          />
          <p className="text-xs text-muted-foreground">Short identifier for your tokens (max 8 chars)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminModel">Admin Model</Label>
          <Select value={state.adminModel} onValueChange={(v) => onChange({ adminModel: v })}>
            <SelectTrigger data-testid="select-admin-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Admin</SelectItem>
              <SelectItem value="multi">Multi-Sig Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedStyle?.entrypoints.setRoyalties && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Royalties</Label>
                <p className="text-xs text-muted-foreground">Earn on secondary sales</p>
              </div>
              <Switch
                checked={state.royaltiesEnabled}
                onCheckedChange={(v) => onChange({ royaltiesEnabled: v })}
                data-testid="switch-royalties"
              />
            </div>
            {state.royaltiesEnabled && (
              <div className="space-y-2 pl-4">
                <Label htmlFor="royaltyPercent">Royalty Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="royaltyPercent"
                    type="number"
                    min={0}
                    max={25}
                    value={state.royaltyPercent}
                    onChange={(e) => onChange({ royaltyPercent: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    data-testid="input-royalty-percent"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedStyle?.entrypoints.addMinter && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Minter Allowlist</Label>
              <p className="text-xs text-muted-foreground">Allow other wallets to mint</p>
            </div>
            <Switch
              checked={state.minterListEnabled}
              onCheckedChange={(v) => onChange({ minterListEnabled: v })}
              data-testid="switch-minter-list"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="metadataBaseUri">Metadata Base URI (optional)</Label>
          <Input
            id="metadataBaseUri"
            placeholder="ipfs://..."
            value={state.metadataBaseUri}
            onChange={(e) => onChange({ metadataBaseUri: e.target.value })}
            data-testid="input-metadata-uri"
          />
          <p className="text-xs text-muted-foreground">
            IPFS or HTTP base URI for token metadata
          </p>
        </div>
      </div>
    </div>
  );
}
