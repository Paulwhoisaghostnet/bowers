import { CONTRACT_STYLES } from "@shared/schema";
import { StyleCard } from "./style-card";
import type { WizardState } from "./types";

export function StepSelectStyle({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Choose a Contract Style</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Select the type of NFT contract that best fits your collection needs.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONTRACT_STYLES.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            selected={state.styleId === style.id}
            onSelect={() => {
              const s = CONTRACT_STYLES.find((cs) => cs.id === style.id)!;
              onChange({
                styleId: style.id,
                royaltiesEnabled: s.entrypoints.setRoyalties !== undefined || style.id === "bowers-marketplace",
                minterListEnabled: s.entrypoints.addMinter !== undefined,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
