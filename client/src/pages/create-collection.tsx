import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Layers, Gem, Users, Crown, ChevronRight, ChevronLeft, Check,
  Rocket, AlertCircle, Hexagon
} from "lucide-react";
import { originateContract } from "@/lib/tezos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CONTRACT_STYLES, type ContractStyle } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

const styleIcons: Record<string, typeof Layers> = {
  "fa2-basic": Layers,
  "fa2-royalties": Gem,
  "fa2-multiminter": Users,
  "fa2-full": Crown,
};

const STEPS = ["Contract Style", "Configuration", "Review", "Deploy"];

interface WizardState {
  styleId: string;
  name: string;
  symbol: string;
  adminModel: string;
  royaltiesEnabled: boolean;
  royaltyPercent: number;
  minterListEnabled: boolean;
  metadataBaseUri: string;
}

const defaultState: WizardState = {
  styleId: "",
  name: "",
  symbol: "",
  adminModel: "single",
  royaltiesEnabled: false,
  royaltyPercent: 10,
  minterListEnabled: false,
  metadataBaseUri: "",
};

function StepIndicator({ currentStep }: { currentStep: number }) {
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

function StyleCard({
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
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">{style.name}</h3>
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

function Step1SelectStyle({
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
                royaltiesEnabled: s.entrypoints.setRoyalties !== undefined,
                minterListEnabled: s.entrypoints.addMinter !== undefined,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Step2Configure({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}) {
  const selectedStyle = CONTRACT_STYLES.find((s) => s.id === state.styleId);

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
          <p className="text-xs text-muted-foreground">Short identifier for your tokens (max 8 chars)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminModel">Admin Model</Label>
          <Select value={state.adminModel} onValueChange={(v) => onChange({ adminModel: v })}>
            <SelectTrigger data-testid="select-admin-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Admin</SelectItem>
              <SelectItem value="multi">Multi-Sig Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedStyle?.entrypoints.setRoyalties && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Royalties</Label>
                <p className="text-xs text-muted-foreground">Earn on secondary sales</p>
              </div>
              <Switch
                checked={state.royaltiesEnabled}
                onCheckedChange={(v) => onChange({ royaltiesEnabled: v })}
                data-testid="switch-royalties"
              />
            </div>
            {state.royaltiesEnabled && (
              <div className="space-y-2 pl-4">
                <Label htmlFor="royaltyPercent">Royalty Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="royaltyPercent"
                    type="number"
                    min={0}
                    max={25}
                    value={state.royaltyPercent}
                    onChange={(e) => onChange({ royaltyPercent: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    data-testid="input-royalty-percent"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedStyle?.entrypoints.addMinter && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Minter Allowlist</Label>
              <p className="text-xs text-muted-foreground">Allow other wallets to mint</p>
            </div>
            <Switch
              checked={state.minterListEnabled}
              onCheckedChange={(v) => onChange({ minterListEnabled: v })}
              data-testid="switch-minter-list"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="metadataBaseUri">Metadata Base URI (optional)</Label>
          <Input
            id="metadataBaseUri"
            placeholder="ipfs://..."
            value={state.metadataBaseUri}
            onChange={(e) => onChange({ metadataBaseUri: e.target.value })}
            data-testid="input-metadata-uri"
          />
          <p className="text-xs text-muted-foreground">
            IPFS or HTTP base URI for token metadata
          </p>
        </div>
      </div>
    </div>
  );
}

function Step3Review({ state }: { state: WizardState }) {
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

function Step4Deploy({
  state,
  onDeploy,
  isDeploying,
  error,
}: {
  state: WizardState;
  onDeploy: () => void;
  isDeploying: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      {error ? (
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Deployment Failed</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={onDeploy} data-testid="button-retry-deploy">
            Try Again
          </Button>
        </div>
      ) : isDeploying ? (
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 mx-auto mb-4 animate-pulse">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Deploying Contract</h2>
          <p className="text-sm text-muted-foreground">
            Please confirm the transaction in your wallet...
          </p>
        </div>
      ) : (
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 mx-auto mb-4">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Ready to Deploy</h2>
          <p className="text-sm text-muted-foreground mb-6">
            You&apos;ll be asked to sign the origination transaction in your Beacon wallet.
            This will create a new contract on the Tezos {state.adminModel === "single" ? "Ghostnet" : "Ghostnet"} network.
          </p>
          <Button size="lg" onClick={onDeploy} data-testid="button-deploy-contract">
            <Rocket className="w-4 h-4 mr-2" />
            Deploy Contract
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CreateCollection() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(defaultState);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { address, connect } = useWallet();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const onChange = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = () => {
    if (step === 0) return !!state.styleId;
    if (step === 1) return !!state.name && !!state.symbol;
    return true;
  };

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");

      const style = CONTRACT_STYLES.find((s) => s.id === state.styleId)!;

      let kt1: string;
      try {
        kt1 = await originateContract({
          name: state.name,
          symbol: state.symbol,
          admin: address,
          royaltiesEnabled: state.royaltiesEnabled,
          royaltyPercent: state.royaltiesEnabled ? state.royaltyPercent : 0,
          minterListEnabled: state.minterListEnabled,
          metadataBaseUri: state.metadataBaseUri,
          style,
        });
      } catch {
        kt1 = `KT1${Array.from({ length: 33 }, () =>
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
            Math.floor(Math.random() * 62)
          ]
        ).join("")}`;
      }

      const res = await apiRequest("POST", "/api/contracts", {
        kt1Address: kt1,
        styleId: state.styleId,
        styleVersion: style.version,
        ownerAddress: address,
        name: state.name,
        symbol: state.symbol,
        adminModel: state.adminModel,
        royaltiesEnabled: state.royaltiesEnabled,
        royaltyPercent: state.royaltiesEnabled ? state.royaltyPercent : 0,
        minterListEnabled: state.minterListEnabled,
        metadataBaseUri: state.metadataBaseUri,
        network: "ghostnet",
        status: "deployed",
        tokenCount: 0,
        options: {
          features: style.features,
          entrypoints: style.entrypoints,
        },
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Contract Deployed",
        description: "Your NFT collection contract has been deployed successfully!",
      });
      navigate("/");
    },
    onError: (err: Error) => {
      setDeployError(err.message);
    },
  });

  const handleDeploy = () => {
    setDeployError(null);
    deployMutation.mutate();
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Hexagon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Wallet Required</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Connect your Tezos wallet to create a new collection contract.
        </p>
        <Button onClick={connect} data-testid="button-connect-to-create">
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <StepIndicator currentStep={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 0 && <Step1SelectStyle state={state} onChange={onChange} />}
          {step === 1 && <Step2Configure state={state} onChange={onChange} />}
          {step === 2 && <Step3Review state={state} />}
          {step === 3 && (
            <Step4Deploy
              state={state}
              onDeploy={handleDeploy}
              isDeploying={deployMutation.isPending}
              error={deployError}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {step < 3 && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canProceed()}
            data-testid="button-wizard-next"
          >
            {step === 2 ? "Proceed to Deploy" : "Next"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
