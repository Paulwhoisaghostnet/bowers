import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { RPC_URLS } from "./tezos/loaders";
import { setActiveNetwork } from "./tezos/wallet";

export type TezosNetwork = "shadownet" | "mainnet";

interface NetworkContextType {
  network: TezosNetwork;
  rpcUrl: string;
  explorerBaseUrl: string;
  setNetwork: (n: TezosNetwork) => void;
  isMainnet: boolean;
}

const EXPLORER_URLS: Record<TezosNetwork, string> = {
  shadownet: "https://shadownet.tzkt.io",
  mainnet: "https://tzkt.io",
};

const NetworkContext = createContext<NetworkContextType>({
  network: "shadownet",
  rpcUrl: RPC_URLS.shadownet,
  explorerBaseUrl: EXPLORER_URLS.shadownet,
  setNetwork: () => {},
  isMainnet: false,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<TezosNetwork>("shadownet");

  const setNetwork = useCallback((n: TezosNetwork) => {
    setNetworkState(n);
    setActiveNetwork(n);
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        network,
        rpcUrl: RPC_URLS[network] || RPC_URLS.shadownet,
        explorerBaseUrl: EXPLORER_URLS[network],
        setNetwork,
        isMainnet: network === "mainnet",
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
