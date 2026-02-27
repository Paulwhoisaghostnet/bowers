import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STYLES } from "@shared/schema";
import { FileDropZone } from "@/components/file-drop-zone";
import type { WizardState } from "./types";

export function StepConfigure({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const selectedStyle = CONTRACT_STYLES.find((s) => s.id === state.styleId);
  const isCustom = state.styleId === "bowers-custom";
  const isOpenEdition =
    state.styleId === "bowers-open-edition" ||
    (isCustom && state.selectedModules.includes("open-edition-mint"));
  const isBondingCurve =
    state.styleId === "bowers-bonding-curve" ||
    (isCustom && state.selectedModules.includes("bonding-curve-mint"));
  const hasAllowlist =
    state.styleId === "bowers-allowlist" ||
    (isCustom && state.selectedModules.includes("allowlist"));
  const hasAdminMint = isCustom && state.selectedModules.includes("admin-mint");
  const mintModelCount = [isOpenEdition, isBondingCurve, hasAdminMint].filter(Boolean).length;
  const isMultiMint = isCustom && mintModelCount >= 2;
  const hasSplitPayments = isCustom && state.selectedModules.includes("split-payments");
  const isMintOnly =
    state.styleId === "bowers-mint-oe" ||
    state.styleId === "bowers-mint-allowlist" ||
    state.styleId === "bowers-mint-bonding-curve";

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
          <p className="text-xs text-muted-foreground">
            Collection-level metadata for indexing (objkt/teia). Not a per-token ticker. Max 8 chars.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="collectionDescription">Description</Label>
          <Textarea
            id="collectionDescription"
            placeholder="Describe your collection..."
            value={state.collectionDescription}
            onChange={(e) => onChange({ collectionDescription: e.target.value })}
            rows={3}
            data-testid="input-collection-description"
          />
        </div>

        <FileDropZone
          label="Cover Image"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          maxSizeMB={10}
          value={state.coverImageUri}
          onUploaded={(result) => onChange({ coverImageUri: result.uri })}
          onClear={() => onChange({ coverImageUri: "" })}
        />

        <div className="space-y-2">
          <Label htmlFor="homepage">Homepage URL (optional)</Label>
          <Input
            id="homepage"
            placeholder="https://yoursite.com"
            value={state.homepage}
            onChange={(e) => onChange({ homepage: e.target.value })}
            data-testid="input-collection-homepage"
          />
          <p className="text-xs text-muted-foreground">
            Link to your website or project page
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {isMintOnly
                  ? "Mint & Blocklist"
                  : isMultiMint
                  ? "Multi-Model & Marketplace Settings"
                  : isBondingCurve
                  ? "Bonding Curve & Marketplace Settings"
                  : hasAllowlist
                  ? "Allowlist & Marketplace Settings"
                  : isOpenEdition
                  ? "Open Edition & Marketplace Settings"
                  : "Marketplace Settings"}
              </h3>
              <Badge variant="secondary" className="text-[10px]">Bowers</Badge>
            </div>

            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium">Contract blocklist</p>
              <p className="text-xs text-muted-foreground">
                After deployment you can block addresses at the contract level (block_address / unblock_address). Blocked addresses cannot transfer, receive, buy, or mint — enforced in FA2 transfer so objkt/teia purchases fail at the token contract.
              </p>
            </div>

            {isMultiMint && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Multiple Mint Models</p>
                <p className="text-xs text-muted-foreground">
                  You can use admin mint, open edition, and bonding curve in the same collection. When minting or creating a token, choose the mint model per-token.
                </p>
              </div>
            )}

            {isOpenEdition && !isBondingCurve && !isMultiMint && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Open Edition Minting</p>
                <p className="text-xs text-muted-foreground">
                  Anyone can mint editions by paying the mint price you set per token.
                  Offers must be at least 100% of the current mint price. Offers auto-expire after 7 days.
                </p>
              </div>
            )}

            {hasAllowlist && !isMultiMint && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Allowlist Phase</p>
                <p className="text-xs text-muted-foreground">
                  Set an allowlist and end time per token after deployment. Only allowlisted addresses can mint during the phase; then public minting opens.
                </p>
              </div>
            )}

            {isBondingCurve && !isMultiMint && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Bonding Curve Minting</p>
                <p className="text-xs text-muted-foreground">
                  When you create a token, set base price, price increment, and step size. Price increases as more editions are minted. Configure per token after deployment.
                </p>
              </div>
            )}

            {hasSplitPayments && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Split Payments</p>
                <p className="text-xs text-muted-foreground">
                  Multi-recipient royalty splits are selected at the module level. A single royalty recipient is used at deployment; split configuration may be supported in a future contract version.
                </p>
              </div>
            )}

            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium">Royalties & Minimum Offer</p>
              <p className="text-xs text-muted-foreground">
                Royalty rate, royalty recipient, and minimum offer are set per-token when you create or mint a token after deployment. Each item in your collection can have its own market rules.
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}
