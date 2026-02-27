import { CONTRACT_STYLES } from "@shared/schema";
import { StyleCard } from "./style-card";
import type { WizardState } from "./types";

const MINT_ONLY_IDS = ["bowers-mint-oe", "bowers-mint-allowlist", "bowers-mint-bonding-curve"];
const MINT_AND_MARKET_IDS = ["bowers-open-edition", "bowers-allowlist", "bowers-bonding-curve", "bowers-unified"];
const MARKETPLACE_ONLY_IDS = ["bowers-marketplace"];
const CUSTOM_IDS = ["bowers-custom"];

function groupStyles() {
  const all = CONTRACT_STYLES;
  return {
    mintOnly: all.filter((s) => MINT_ONLY_IDS.includes(s.id)),
    mintAndMarket: all.filter((s) => MINT_AND_MARKET_IDS.includes(s.id)),
    marketplaceOnly: all.filter((s) => MARKETPLACE_ONLY_IDS.includes(s.id)),
    custom: all.filter((s) => CUSTOM_IDS.includes(s.id)),
  };
}

export function StepSelectStyle({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const { mintOnly, mintAndMarket, marketplaceOnly, custom } = groupStyles();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Choose a Contract Style</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Select the type of NFT contract that best fits your collection. Mint-only contracts are lighter; sell on objkt or teia. All-in-one includes built-in marketplace.
      </p>

      {mintOnly.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Mint only (sell on objkt / teia)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mintOnly.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={state.styleId === style.id}
                onSelect={() => onChange({ styleId: style.id })}
              />
            ))}
          </div>
        </div>
      )}

      {mintAndMarket.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Mint + marketplace (all-in-one)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mintAndMarket.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={state.styleId === style.id}
                onSelect={() => onChange({ styleId: style.id })}
              />
            ))}
          </div>
        </div>
      )}

      {marketplaceOnly.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Marketplace only</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketplaceOnly.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={state.styleId === style.id}
                onSelect={() => onChange({ styleId: style.id })}
              />
            ))}
          </div>
        </div>
      )}

      {custom.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Custom</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {custom.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={state.styleId === style.id}
                onSelect={() => onChange({ styleId: style.id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
