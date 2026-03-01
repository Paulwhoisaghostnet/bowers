import { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Hexagon } from "lucide-react";
import { originateContract, estimateOrigination, type OriginationEstimate } from "@/lib/tezos";
import { uploadMetadataToIPFS } from "@/lib/ipfs";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import { useNetwork } from "@/lib/network-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CONTRACT_STYLES,
  MAX_CONTRACT_SIZE_KB,
  resolveStyleFromModules,
  computeModuleAggregates,
  validateModuleSelection,
} from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import {
  type WizardState,
  defaultState,
  getSteps,
} from "./types";
import { StepIndicator } from "./step-indicator";
import { StepSelectStyle } from "./step-select-style";
import { StepModules } from "./step-modules";
import { StepConfigure } from "./step-configure";
import { StepReview } from "./step-review";
import { StepDeploy } from "./step-deploy";

export default function CreateCollection() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(defaultState);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { address, connect, isConnecting } = useWallet();
  const { toast } = useToast();
  const { network } = useNetwork();
  const [, navigate] = useLocation();

  const [estimate, setEstimate] = useState<OriginationEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const isCustom = state.styleId === "bowers-custom";
  const steps = useMemo(() => getSteps(state.styleId), [state.styleId]);

  const currentStepName = steps[step] || "";

  const onChange = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * For custom contracts, resolve the actual deployable style from modules.
   * For presets, use the selected style directly.
   */
  const getDeployStyle = useCallback(() => {
    if (isCustom) {
      const resolvedId = resolveStyleFromModules(state.selectedModules);
      return CONTRACT_STYLES.find((s) => s.id === resolvedId)!;
    }
    return CONTRACT_STYLES.find((s) => s.id === state.styleId)!;
  }, [isCustom, state.styleId, state.selectedModules]);

  useEffect(() => {
    const currentStep = steps[step];
    if (currentStep !== "Deploy" || !address) return;

    let cancelled = false;
    setEstimate(null);
    setEstimateError(null);
    setIsEstimating(true);

    const style = getDeployStyle();
    estimateOrigination({
      name: state.name,
      symbol: state.symbol,
      admin: address,
      royaltiesEnabled: true,
      royaltyPercent: 0,
      minterListEnabled: false,
      metadataBaseUri: "ipfs://placeholder",
      style,
    })
      .then((est) => {
        if (!cancelled) setEstimate(est);
      })
      .catch((err) => {
        if (!cancelled) setEstimateError(err?.message || "Unknown estimation error");
      })
      .finally(() => {
        if (!cancelled) setIsEstimating(false);
      });

    return () => { cancelled = true; };
  }, [step, steps, address, state.name, state.symbol, getDeployStyle]);

  const canProceed = () => {
    if (currentStepName === "Contract Style") return !!state.styleId;
    if (currentStepName === "Modules") {
      if (validateModuleSelection(state.selectedModules).length > 0) return false;
      const { estimatedKB } = computeModuleAggregates(state.selectedModules);
      return estimatedKB <= MAX_CONTRACT_SIZE_KB;
    }
    if (currentStepName === "Configuration") {
      return !!(state.name && state.symbol);
    }
    return true;
  };

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");

      const style = getDeployStyle();

      const tzip16Metadata: Record<string, unknown> = {
        name: state.name,
        description: state.collectionDescription || state.name,
        version: style.version,
        interfaces: ["TZIP-012", "TZIP-016", "TZIP-021"],
        authors: [address],
      };
      if (state.coverImageUri) tzip16Metadata.imageUri = state.coverImageUri;
      if (state.homepage) tzip16Metadata.homepage = state.homepage;

      const pinResult = await uploadMetadataToIPFS(tzip16Metadata);
      const metadataBaseUri = pinResult.uri;

      const kt1 = await originateContract({
        name: state.name,
        symbol: state.symbol,
        admin: address,
        royaltiesEnabled: true,
        royaltyPercent: 0,
        minterListEnabled: false,
        metadataBaseUri,
        style,
      });

      const { features, entrypoints: eps } = isCustom
        ? computeModuleAggregates(state.selectedModules)
        : { features: style.features, entrypoints: Object.values(style.entrypoints) };

      const res = await apiRequest("POST", "/api/contracts", {
        kt1Address: kt1,
        styleId: isCustom ? resolveStyleFromModules(state.selectedModules) : state.styleId,
        styleVersion: style.version,
        ownerAddress: address,
        name: state.name,
        symbol: state.symbol,
        adminModel: "single",
        royaltiesEnabled: true,
        royaltyPercent: 0,
        minterListEnabled: false,
        metadataBaseUri,
        network,
        status: "deployed",
        tokenCount: 0,
        options: {
          features,
          entrypoints: style.entrypoints,
          selectedModules: isCustom ? state.selectedModules : undefined,
        },
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Contract Deployed",
        description:
          "Your NFT collection contract has been deployed successfully!",
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

  const lastStepIndex = steps.length - 1;
  const deployStepName = "Deploy";
  const reviewStepName = "Review";
  const isDeployStep = currentStepName === deployStepName;
  const isReviewStep = currentStepName === reviewStepName;

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
        <Button
          onClick={() => connect()}
          disabled={isConnecting}
          data-testid="button-connect-to-create"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <StepIndicator currentStep={step} steps={steps} />

      <AnimatePresence mode="wait">
        <motion.div
          key={`${state.styleId}-${step}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentStepName === "Contract Style" && (
            <StepSelectStyle state={state} onChange={onChange} />
          )}
          {currentStepName === "Modules" && (
            <StepModules state={state} onChange={onChange} />
          )}
          {currentStepName === "Configuration" && (
            <StepConfigure state={state} onChange={onChange} />
          )}
          {currentStepName === "Review" && (
            <StepReview state={state} />
          )}
          {currentStepName === "Deploy" && (
            <StepDeploy
              state={state}
              onDeploy={handleDeploy}
              isDeploying={deployMutation.isPending}
              error={deployError}
              estimate={estimate}
              estimateError={estimateError}
              isEstimating={isEstimating}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {!isDeployStep && (
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
            onClick={() => setStep((s) => Math.min(lastStepIndex, s + 1))}
            disabled={!canProceed()}
            data-testid="button-wizard-next"
          >
            {isReviewStep ? "Proceed to Deploy" : "Next"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
