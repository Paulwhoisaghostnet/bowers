import {
  ShieldCheck,
  Coins,
  Tag,
  HandCoins,
  Ban,
  Hexagon,
  AlertTriangle,
  ListChecks,
  TrendingUp,
  Layers,
  Split,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  CONTRACT_MODULES,
  MAX_CONTRACT_SIZE_KB,
  computeModuleAggregates,
  validateModuleSelection,
} from "@shared/contract-styles";
import type { WizardState } from "./types";

const moduleIcons: Record<string, LucideIcon> = {
  "fa2-core": Hexagon,
  royalties: Coins,
  "admin-mint": Coins,
  "open-edition-mint": Coins,
  allowlist: ListChecks,
  "bonding-curve-mint": TrendingUp,
  "batch-ops": Layers,
  "split-payments": Split,
  listings: Tag,
  offers: HandCoins,
  blacklist: Ban,
};

const categoryLabels: Record<string, string> = {
  core: "Core",
  mint: "Minting Model",
  market: "Marketplace",
  admin: "Admin Tools",
};

const categoryOrder = ["core", "mint", "market", "admin"];

export function StepModules({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const selected = state.selectedModules;
  const { estimatedKB, features, entrypoints, views } =
    computeModuleAggregates(selected);
  const errors = validateModuleSelection(selected);
  const sizePercent = Math.min(100, (estimatedKB / MAX_CONTRACT_SIZE_KB) * 100);

  const toggle = (moduleId: string) => {
    const mod = CONTRACT_MODULES.find((m) => m.id === moduleId);
    if (!mod || mod.required) return;

    let next: string[];
    if (selected.includes(moduleId)) {
      next = selected.filter((id) => id !== moduleId);
      const dependents = CONTRACT_MODULES.filter(
        (m) => m.requires.includes(moduleId) && next.includes(m.id)
      );
      for (const dep of dependents) {
        next = next.filter((id) => id !== dep.id);
      }
    } else {
      next = [...selected, moduleId];
      for (const conflict of mod.conflicts) {
        next = next.filter((id) => id !== conflict);
      }
      for (const req of mod.requires) {
        if (!next.includes(req)) next.push(req);
      }
    }
    onChange({ selectedModules: next });
  };

  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    label: categoryLabels[cat],
    modules: CONTRACT_MODULES.filter((m) => m.category === cat),
  }));

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Configure Modules</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Select the features you want in your contract. Toggle modules on or off
        to build a contract that fits your needs.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {grouped.map(({ category, label, modules }) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3">{label}</h3>
              <div className="space-y-2">
                {modules.map((mod) => {
                  const Icon = moduleIcons[mod.id] || ShieldCheck;
                  const isSelected = selected.includes(mod.id);
                  const isDisabled = mod.required;

                  return (
                    <Card
                      key={mod.id}
                      className={`p-3 transition-all ${
                        isSelected
                          ? "ring-1 ring-primary/50 bg-primary/5"
                          : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {mod.name}
                              </span>
                              {mod.required && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px]"
                                >
                                  Required
                                </Badge>
                              )}
                              <Badge
                                variant="secondary"
                                className="text-[9px]"
                              >
                                ~{mod.estimatedKB} KB
                              </Badge>
                            </div>
                            <Switch
                              checked={isSelected}
                              onCheckedChange={() => toggle(mod.id)}
                              disabled={isDisabled}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {mod.description}
                          </p>
                          {mod.entrypoints.length > 0 && isSelected && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {mod.entrypoints.map((ep) => (
                                <Badge
                                  key={ep}
                                  variant="outline"
                                  className="text-[9px] font-mono"
                                >
                                  {ep}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <Card className="p-4 space-y-4">
              <h3 className="text-sm font-semibold">Contract Summary</h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Estimated Size
                  </span>
                  <span className="font-medium">
                    ~{estimatedKB} / {MAX_CONTRACT_SIZE_KB} KB
                  </span>
                </div>
                <Progress
                  value={sizePercent}
                  className="h-2"
                />
                {sizePercent > 85 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Approaching Tezos size limit
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {selected.length} modules selected
                </p>
                <p className="text-xs text-muted-foreground">
                  {entrypoints.length} entrypoints &middot; {views.length}{" "}
                  views
                </p>
              </div>

              {features.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Features
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {features.map((f) => (
                      <Badge
                        key={f}
                        variant="secondary"
                        className="text-[9px]"
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {errors.length > 0 && (
              <Card className="p-3 border-destructive/50 bg-destructive/5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {errors.map((err, i) => (
                      <p
                        key={i}
                        className="text-xs text-destructive"
                      >
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
