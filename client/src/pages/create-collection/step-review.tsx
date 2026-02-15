import { Hexagon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STYLES } from "@shared/schema";
import type { WizardState } from "./types";
import { styleIcons } from "./types";

export function StepReview({ state }: { state: WizardState }) {
  const selectedStyle = CONTRACT_STYLES.find((s) => s.id === state.styleId);
  const Icon = styleIcons[state.styleId] || Hexagon;
  const isBowersMarketplace = state.styleId === "bowers-marketplace";

  const items = [
    { label: "Contract Style", value: selectedStyle?.name || "" },
    { label: "Collection Name", value: state.name },
    { label: "Symbol", value: state.symbol },
  ];

  if (isBowersMarketplace) {
    items.push(
      { label: "Royalty Rate", value: `${state.royaltyBps} bps (${(state.royaltyBps / 100).toFixed(2)}%)` },
      { label: "Royalty Recipient", value: state.royaltyRecipient ? `${state.royaltyRecipient.slice(0, 10)}...${state.royaltyRecipient.slice(-6)}` : "Not set" },
      { label: "Min Offer Per Token", value: `${state.minOfferPerUnitMutez.toLocaleString()} mutez (${(state.minOfferPerUnitMutez / 1000000).toFixed(6)} tez)` },
    );
  } else {
    items.push(
      { label: "Admin Model", value: state.adminModel === "single" ? "Single Admin" : "Multi-Sig" },
    );
    if (state.royaltiesEnabled) {
      items.push({ label: "Royalties", value: `${state.royaltyPercent}%` });
    }
    items.push({ label: "Minter Allowlist", value: state.minterListEnabled ? "Enabled" : "Disabled" });
  }

  if (state.metadataBaseUri) {
    items.push({ label: "Metadata Base URI", value: state.metadataBaseUri });
  }

  items.push({ label: "Network", value: "Ghostnet (Testnet)" });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Review & Deploy</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Confirm your collection details before deploying.
      </p>

      <Card className="p-5 max-w-lg">
        <div className="flex items-start gap-3 mb-5 pb-4 border-b">
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 dark:bg-primary/20">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{state.name || "Untitled"}</h3>
              {selectedStyle?.recommended && (
                <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{selectedStyle?.name} v{selectedStyle?.version}</p>
          </div>
        </div>

        <div className="space-y-3">
          {items.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground shrink-0">{label}</span>
              <span className="text-sm font-medium text-right truncate">{value}</span>
            </div>
          ))}
        </div>

        {isBowersMarketplace && (
          <div className="mt-5 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Marketplace Entrypoints</p>
            <div className="flex flex-wrap gap-1">
              {selectedStyle?.features.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
