import { Layers, Gem, Users, Crown, type LucideIcon } from "lucide-react";

export const STEPS = ["Contract Style", "Configuration", "Review", "Deploy"];

export interface WizardState {
  styleId: string;
  name: string;
  symbol: string;
  adminModel: string;
  royaltiesEnabled: boolean;
  royaltyPercent: number;
  minterListEnabled: boolean;
  metadataBaseUri: string;
}

export const defaultState: WizardState = {
  styleId: "",
  name: "",
  symbol: "",
  adminModel: "single",
  royaltiesEnabled: false,
  royaltyPercent: 10,
  minterListEnabled: false,
  metadataBaseUri: "",
};

export const styleIcons: Record<string, LucideIcon> = {
  "fa2-basic": Layers,
  "fa2-royalties": Gem,
  "fa2-multiminter": Users,
  "fa2-full": Crown,
};
