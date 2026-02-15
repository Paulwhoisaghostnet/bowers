import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STYLES } from "@shared/schema";
import { useWallet } from "@/lib/wallet-context";
import type { WizardState } from "./types";
import { isValidTezosAddress, isBowersStyle } from "./types";

export function StepConfigure({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const selectedStyle = CONTRACT_STYLES.find((s) => s.id === state.styleId);
  const isBowers = isBowersStyle(state.styleId);
  const isOpenEdition = state.styleId === "bowers-open-edition";
  const { address } = useWallet();

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

        {!isBowers && (
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
        )}

        {isBowers && (
          <div className="rounded-md border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {isOpenEdition ? "Open Edition & Marketplace Settings" : "Marketplace Settings"}
              </h3>
              <Badge variant="secondary" className="text-[10px]">Bowers</Badge>
            </div>

            {isOpenEdition && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Open Edition Minting</p>
                <p className="text-xs text-muted-foreground">
                  Anyone can mint editions by paying the mint price you set per token.
                  Offers must be at least 100% of the current mint price. Offers auto-expire after 7 days.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="royaltyBps">Royalty Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="royaltyBps"
                  type="number"
                  min={0}
                  max={10000}
                  value={state.royaltyBps}
                  onChange={(e) => onChange({ royaltyBps: Math.min(10000, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="w-28"
                  data-testid="input-royalty-bps"
                />
                <span className="text-sm text-muted-foreground">bps</span>
                <span className="text-xs text-muted-foreground ml-2">({(state.royaltyBps / 100).toFixed(2)}%)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Basis points (100 bps = 1%). Applied to all secondary sales and accepted offers.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="royaltyRecipient">Royalty Recipient Address</Label>
              <Input
                id="royaltyRecipient"
                placeholder="tz1..."
                value={state.royaltyRecipient}
                onChange={(e) => onChange({ royaltyRecipient: e.target.value })}
                data-testid="input-royalty-recipient"
              />
              {address && !state.royaltyRecipient && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => onChange({ royaltyRecipient: address })}
                  data-testid="button-use-my-wallet"
                >
                  Use my wallet ({address.slice(0, 8)}...{address.slice(-4)})
                </button>
              )}
              {state.royaltyRecipient && !isValidTezosAddress(state.royaltyRecipient) && (
                <p className="text-xs text-destructive">
                  Enter a valid Tezos address (tz1/tz2/tz3/KT1)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Address that receives royalties from all sales. Typically your own wallet.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minOfferPerUnit">Minimum Offer Per Token</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="minOfferPerUnit"
                  type="number"
                  min={1}
                  value={state.minOfferPerUnitMutez}
                  onChange={(e) => onChange({ minOfferPerUnitMutez: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-36"
                  data-testid="input-min-offer-mutez"
                />
                <span className="text-sm text-muted-foreground">mutez</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum amount (in mutez) a buyer must offer per token unit. 1,000,000 mutez = 1 tez.
                Current: {(state.minOfferPerUnitMutez / 1000000).toFixed(6)} tez
              </p>
            </div>
          </div>
        )}

        {!isBowers && selectedStyle?.entrypoints.setRoyalties && (
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

        {!isBowers && selectedStyle?.entrypoints.addMinter && (
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
