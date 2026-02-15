import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { shortenAddress } from "./tezos";

interface WalletContextType {
  address: string | null;
  shortAddress: string;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  shortAddress: "",
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getActiveAccount } = await import("./tezos");
        const addr = await getActiveAccount();
        if (!cancelled && addr) setAddress(addr);
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { connectWallet } = await import("./tezos");
      const addr = await connectWallet();
      setAddress(addr);
    } catch (e) {
      console.error("Wallet connection failed:", e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const { disconnectWallet } = await import("./tezos");
      await disconnectWallet();
    } catch {
    }
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        shortAddress: address ? shortenAddress(address) : "",
        isConnecting,
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
