import { AlertCircle, Rocket, Loader2, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/lib/network-context";
import type { WizardState } from "./types";
import type { OriginationEstimate } from "@/lib/tezos";

export function StepDeploy({
  state,
  onDeploy,
  isDeploying,
  error,
  estimate,
  estimateError,
  isEstimating,
}: {
  state: WizardState;
  onDeploy: () => void;
  isDeploying: boolean;
  error: string | null;
  estimate: OriginationEstimate | null;
  estimateError: string | null;
  isEstimating: boolean;
}) {
  const { isMainnet } = useNetwork();
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
          <p className="text-sm text-muted-foreground mb-4">
            You&apos;ll be asked to sign the origination transaction in your Beacon wallet.
            This will create a new contract on the Tezos {isMainnet ? "Mainnet" : "Ghostnet"} network.
            {isMainnet && (
              <span className="block mt-1 text-amber-500 font-medium">
                This is Mainnet — the transaction will cost real tez.
              </span>
            )}
          </p>

          {isEstimating && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Estimating deployment cost...
            </div>
          )}

          {estimateError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 mb-4">
              <p className="text-sm text-destructive">
                Cost estimation failed: {estimateError}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can still attempt deployment &mdash; the wallet will estimate on its own.
              </p>
            </div>
          )}

          {estimate && (
            <div className="rounded-md bg-muted/50 border px-4 py-3 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Estimated Deployment Cost</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">Gas Limit</span>
                <span className="text-right font-mono">{estimate.gasLimit.toLocaleString()}</span>
                <span className="text-muted-foreground">Storage Limit</span>
                <span className="text-right font-mono">{estimate.storageLimit.toLocaleString()}</span>
                <span className="text-muted-foreground">Network Fee</span>
                <span className="text-right font-mono">{(estimate.suggestedFeeMutez / 1_000_000).toFixed(6)} tez</span>
                <span className="text-muted-foreground">Storage Burn</span>
                <span className="text-right font-mono">{(estimate.burnFeeMutez / 1_000_000).toFixed(6)} tez</span>
                <span className="text-muted-foreground font-medium border-t pt-1">Total Cost</span>
                <span className="text-right font-mono font-medium border-t pt-1">{estimate.totalCostTez} tez</span>
              </div>
            </div>
          )}

          <Button
            size="lg"
            onClick={onDeploy}
            disabled={isEstimating}
            data-testid="button-deploy-contract"
          >
            <Rocket className="w-4 h-4 mr-2" />
            Deploy Contract
          </Button>
        </div>
      )}
    </div>
  );
}
