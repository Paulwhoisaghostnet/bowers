import { AlertCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WizardState } from "./types";

export function StepDeploy({
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
            This will create a new contract on the Tezos Ghostnet network.
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
