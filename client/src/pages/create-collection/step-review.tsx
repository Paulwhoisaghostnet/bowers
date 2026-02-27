import { Hexagon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CONTRACT_STYLES,
  CONTRACT_MODULES,
  resolveStyleFromModules,
  computeModuleAggregates,
} from "@shared/schema";
import { ipfsToHttp } from "@/lib/ipfs";
import { useNetwork } from "@/lib/network-context";
import type { WizardState } from "./types";
import { styleIcons } from "./types";

export function StepReview({ state }: { state: WizardState }) {
  const { network, isMainnet } = useNetwork();
  const isCustom = state.styleId === "bowers-custom";
  const resolvedStyleId = isCustom
    ? resolveStyleFromModules(state.selectedModules)
    : state.styleId;
  const selectedStyle = CONTRACT_STYLES.find(
    (s) => s.id === (isCustom ? "bowers-custom" : state.styleId)
  );
  const deployStyle = CONTRACT_STYLES.find((s) => s.id === resolvedStyleId);
  const Icon = styleIcons[isCustom ? resolvedStyleId : state.styleId] || styleIcons[state.styleId] || Hexagon;
  const isOpenEdition =
    state.styleId === "bowers-open-edition" ||
    (isCustom && state.selectedModules.includes("open-edition-mint"));
  const isBondingCurve =
    state.styleId === "bowers-bonding-curve" ||
    (isCustom && state.selectedModules.includes("bonding-curve-mint"));
  const isAllowlist =
    state.styleId === "bowers-allowlist" ||
    (isCustom && state.selectedModules.includes("allowlist"));
  const hasAdminMint = isCustom && state.selectedModules.includes("admin-mint");
  const mintModelLabels: string[] = [];
  if (isCustom) {
    if (hasAdminMint) mintModelLabels.push("Admin Mint");
    if (isOpenEdition) mintModelLabels.push("Open Edition");
    if (isBondingCurve) mintModelLabels.push("Bonding Curve");
    if (isAllowlist) mintModelLabels.push("Allowlist");
  }
  const customAggregates = isCustom
    ? computeModuleAggregates(state.selectedModules)
    : null;

  const items = [
    { label: "Contract Style", value: selectedStyle?.name || "" },
    { label: "Collection Name", value: state.name },
    { label: "Symbol", value: state.symbol },
  ];

  if (state.collectionDescription) {
    items.push({ label: "Description", value: state.collectionDescription.length > 60 ? state.collectionDescription.slice(0, 60) + "..." : state.collectionDescription });
  }

  if (state.coverImageUri) {
    items.push({ label: "Cover Image", value: "Uploaded to IPFS" });
  }

  if (state.homepage) {
    items.push({ label: "Homepage", value: state.homepage });
  }

  if (mintModelLabels.length > 0) {
    items.push({ label: "Minting Model", value: mintModelLabels.join(", ") });
    items.push({ label: "Offer Expiry", value: "Fixed 7-day auto-expiry" });
  } else if (isAllowlist) {
    items.push({ label: "Minting Model", value: "Allowlist (phased then public minting)" });
    items.push({ label: "Offer Expiry", value: "Fixed 7-day auto-expiry" });
  } else if (isBondingCurve) {
    items.push({ label: "Minting Model", value: "Bonding Curve (price increases with supply)" });
    items.push({ label: "Offer Expiry", value: "Fixed 7-day auto-expiry" });
  } else if (isOpenEdition) {
    items.push({ label: "Minting Model", value: "Open Edition (public minting)" });
    items.push({ label: "Offer Expiry", value: "Fixed 7-day auto-expiry" });
  }
  items.push(
    { label: "Market Rules", value: "Set per-token (royalty, min offer)" },
  );

  if (isCustom && customAggregates) {
    items.push({
      label: "Modules",
      value: `${state.selectedModules.length} selected (~${customAggregates.estimatedKB} KB)`,
    });
    items.push({
      label: "Deploys As",
      value: deployStyle?.name || resolvedStyleId,
    });
  }

  items.push({ label: "Network", value: isMainnet ? "Mainnet (Production)" : "Ghostnet (Testnet)" });
  items.push({ label: "IPFS Metadata", value: "Auto-uploaded at deploy time" });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Review & Deploy</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Confirm your collection details before deploying.
      </p>

      <Card className="p-5 max-w-lg">
        <div className="flex items-start gap-3 mb-5 pb-4 border-b">
          {state.coverImageUri ? (
            <img
              src={ipfsToHttp(state.coverImageUri)}
              alt="Cover"
              className="w-12 h-12 rounded-md object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 dark:bg-primary/20">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          )}
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

        <div className="mt-5 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Contract Features</p>
          <div className="flex flex-wrap gap-1">
            {(customAggregates?.features ?? selectedStyle?.features ?? []).map(
              (f) => (
                <Badge key={f} variant="outline" className="text-[10px]">
                  {f}
                </Badge>
              )
            )}
          </div>
        </div>

        {isCustom && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Selected Modules
            </p>
            <div className="flex flex-wrap gap-1">
              {state.selectedModules.map((id) => {
                const mod = CONTRACT_MODULES.find((m) => m.id === id);
                return (
                  <Badge key={id} variant="secondary" className="text-[10px]">
                    {mod?.name || id}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
