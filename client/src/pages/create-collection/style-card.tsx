import { Hexagon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ContractStyle } from "@shared/schema";
import { styleIcons } from "./types";

export function StyleCard({
  style,
  selected,
  onSelect,
}: {
  style: ContractStyle;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = styleIcons[style.id] || Hexagon;

  return (
    <Card
      className={`p-4 cursor-pointer hover-elevate transition-all ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onSelect}
      data-testid={`card-style-${style.id}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-md ${
            selected ? "bg-primary text-primary-foreground" : "bg-primary/10 dark:bg-primary/20 text-primary"
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{style.name}</h3>
              {style.recommended && (
                <Badge variant="default" className="text-[10px]">Recommended</Badge>
              )}
            </div>
            <Badge variant="outline" className="text-[10px]">
              v{style.version}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {style.description}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {style.features.map((f) => (
          <Badge key={f} variant="secondary" className="text-[10px]">
            {f}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
