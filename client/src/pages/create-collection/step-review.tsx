import { Hexagon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CONTRACT_STYLES } from "@shared/schema";
import type { WizardState } from "./types";
import { styleIcons } from "./types";

export function StepReview({ state }: { state: WizardState }) {
  const selectedStyle = CONTRACT_STYLES.find((s) => s.id === state.styleId);
  const Icon = styleIcons[state.styleId] || Hexagon;

  const items = [
    { label: "Contract Style", value: selectedStyle?.name || "" },
    { label: "Collection Name", value: state.name },
    { label: "Symbol", value: state.symbol },
    { label: "Admin Model", value: state.adminModel === "single" ? "Single Admin" : "Multi-Sig" },
    ...(state.royaltiesEnabled
      ? [{ label: "Royalties", value: `${state.royaltyPercent}%` }]
      : []),
    { label: "Minter Allowlist", value: state.minterListEnabled ? "Enabled" : "Disabled" },
    ...(state.metadataBaseUri
      ? [{ label: "Metadata Base URI", value: state.metadataBaseUri }]
      : []),
    { label: "Network", value: "Ghostnet (Testnet)" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Review & Deploy</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Confirm your collection details before deploying.
      </p>

      <Card className="p-5 max-w-lg">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b">
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 dark:bg-primary/20">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{state.name || "Untitled"}</h3>
            <p className="text-xs text-muted-foreground">{selectedStyle?.name} v{selectedStyle?.version}</p>
          </div>
        </div>

        <div className="space-y-3">
          {items.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
