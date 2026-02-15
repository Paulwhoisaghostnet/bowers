import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { STEPS } from "./types";

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                i < currentStep
                  ? "bg-primary text-primary-foreground"
                  : i === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:inline ${
                i === currentStep ? "font-semibold" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 ${
                  i < currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <Progress value={((currentStep + 1) / STEPS.length) * 100} className="h-1" />
    </div>
  );
}
