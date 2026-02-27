import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { shortenAddress } from "./tezos";
import type { WalletProviderName } from "./tezos";
import { useToast } from "@/hooks/use-toast";

interface WalletContextType {
  address: string | null;
  shortAddress: string;
  isConnecting: boolean;
  providerName: WalletProviderName | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  shortAddress: "",
  isConnecting: false,
  providerName: null,
  connect: async () => {},
  disconnect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [providerName, setProviderName] = useState<WalletProviderName | null>(null);
  const { toast } = useToast();

  const refreshProvider = useCallback(async () => {
    try {
      const { getActiveProviderName } = await import("./tezos");
      setProviderName(getActiveProviderName());
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getActiveAccount, getActiveProviderName } = await import("./tezos");
        const addr = await getActiveAccount();
        if (!cancelled) {
          if (addr) setAddress(addr);
          setProviderName(getActiveProviderName());
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { connectWallet, getActiveProviderName } = await import("./tezos");
      const addr = await connectWallet();
      setAddress(addr);
      setProviderName(getActiveProviderName());
      toast({
        title: "Wallet connected",
        description: `Connected: ${addr.slice(0, 8)}...${addr.slice(-6)}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Wallet connection failed";
      console.error("Wallet connection failed:", e);
      toast({
        title: "Connection failed",
        description: msg.includes("Aborted") || msg.includes("rejected")
          ? "You declined or closed the wallet prompt."
          : msg + " If the wallet prompt didn't appear, check for a popup blocker.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      const { disconnectWallet } = await import("./tezos");
      await disconnectWallet();
    } catch {}
    setAddress(null);
    setProviderName(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        shortAddress: address ? shortenAddress(address) : "",
        isConnecting,
        providerName,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
