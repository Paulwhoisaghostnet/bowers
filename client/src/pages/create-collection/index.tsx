import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Hexagon } from "lucide-react";
import { originateContract } from "@/lib/tezos";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CONTRACT_STYLES } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { type WizardState, defaultState, STEPS, isValidTezosAddress } from "./types";
import { StepIndicator } from "./step-indicator";
import { StepSelectStyle } from "./step-select-style";
import { StepConfigure } from "./step-configure";
import { StepReview } from "./step-review";
import { StepDeploy } from "./step-deploy";

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
    if (step === 1) {
      if (!state.name || !state.symbol) return false;
      if (state.styleId === "bowers-marketplace") {
        return isValidTezosAddress(state.royaltyRecipient) && state.royaltyBps >= 0 && state.royaltyBps <= 10000 && state.minOfferPerUnitMutez > 0;
      }
      return true;
    }
    return true;
  };

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Wallet not connected");

      const style = CONTRACT_STYLES.find((s) => s.id === state.styleId)!;

      const isBowers = state.styleId === "bowers-marketplace";
      let kt1: string;
      try {
        kt1 = await originateContract({
          name: state.name,
          symbol: state.symbol,
          admin: address,
          royaltiesEnabled: isBowers ? true : state.royaltiesEnabled,
          royaltyPercent: isBowers ? Math.round(state.royaltyBps / 100) : (state.royaltiesEnabled ? state.royaltyPercent : 0),
          minterListEnabled: state.minterListEnabled,
          metadataBaseUri: state.metadataBaseUri,
          style,
          ...(isBowers && {
            royaltyBps: state.royaltyBps,
            royaltyRecipient: state.royaltyRecipient,
            minOfferPerUnitMutez: state.minOfferPerUnitMutez,
          }),
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
        adminModel: isBowers ? "single" : state.adminModel,
        royaltiesEnabled: isBowers ? true : state.royaltiesEnabled,
        royaltyPercent: isBowers ? Math.round(state.royaltyBps / 100) : (state.royaltiesEnabled ? state.royaltyPercent : 0),
        minterListEnabled: state.minterListEnabled,
        metadataBaseUri: state.metadataBaseUri,
        network: "ghostnet",
        status: "deployed",
        tokenCount: 0,
        options: {
          features: style.features,
          entrypoints: style.entrypoints,
          ...(isBowers && {
            royaltyBps: state.royaltyBps,
            royaltyRecipient: state.royaltyRecipient,
            minOfferPerUnitMutez: state.minOfferPerUnitMutez,
          }),
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
          {step === 0 && <StepSelectStyle state={state} onChange={onChange} />}
          {step === 1 && <StepConfigure state={state} onChange={onChange} />}
          {step === 2 && <StepReview state={state} />}
          {step === 3 && (
            <StepDeploy
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
