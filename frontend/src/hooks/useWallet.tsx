import * as React from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";

interface WalletContextValue {
  status: "unavailable" | "disconnected" | "connecting" | "connected" | "error";
  address: string | null;
  chainId: number | null;
  errorMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  getSigner: () => Promise<JsonRpcSigner>;
  switchChain: (chainId: number) => Promise<void>;
}

const WalletContext = React.createContext<WalletContextValue | null>(null);

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps): JSX.Element {
  const [status, setStatus] = React.useState<WalletContextValue["status"]>(() =>
    typeof window !== "undefined" && window.ethereum ? "disconnected" : "unavailable"
  );
  const [address, setAddress] = React.useState<string | null>(null);
  const [chainId, setChainId] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const readWalletState = React.useCallback(async (): Promise<void> => {
    const ethereum = getInjectedEthereum();
    if (!ethereum) {
      setStatus("unavailable");
      setAddress(null);
      setChainId(null);
      return;
    }

    const provider = new BrowserProvider(ethereum);
    const [accounts, network] = await Promise.all([
      ethereum.request({ method: "eth_accounts" }),
      provider.getNetwork()
    ]);
    const accountList = normalizeAccounts(accounts);
    setAddress(accountList[0] ?? null);
    setChainId(Number(network.chainId));
    setStatus(accountList.length > 0 ? "connected" : "disconnected");
    setErrorMessage(null);
  }, []);

  React.useEffect(() => {
    void readWalletState().catch((error) => {
      setStatus("error");
      setErrorMessage(getErrorMessage(error, "Unable to read wallet state."));
    });
  }, [readWalletState]);

  React.useEffect(() => {
    const ethereum = getInjectedEthereum();
    if (!ethereum?.on) return;

    const handleAccountsChanged = (accounts: unknown): void => {
      const accountList = normalizeAccounts(accounts);
      setAddress(accountList[0] ?? null);
      setStatus(accountList.length > 0 ? "connected" : "disconnected");
      setErrorMessage(null);
    };
    const handleChainChanged = (nextChainId: unknown): void => {
      setChainId(parseChainId(nextChainId));
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = React.useCallback(async (): Promise<void> => {
    const ethereum = getInjectedEthereum();
    if (!ethereum) {
      setStatus("unavailable");
      setErrorMessage("No injected wallet was found. Install MetaMask or another EIP-1193 wallet.");
      return;
    }

    setStatus("connecting");
    setErrorMessage(null);
    try {
      const provider = new BrowserProvider(ethereum);
      const accounts = normalizeAccounts(await ethereum.request({ method: "eth_requestAccounts" }));
      const network = await provider.getNetwork();
      setAddress(accounts[0] ?? null);
      setChainId(Number(network.chainId));
      setStatus(accounts.length > 0 ? "connected" : "disconnected");
    } catch (error) {
      setStatus("error");
      setErrorMessage(getErrorMessage(error, "Wallet connection was rejected or failed."));
    }
  }, []);

  const disconnect = React.useCallback((): void => {
    setAddress(null);
    setStatus(getInjectedEthereum() ? "disconnected" : "unavailable");
    setErrorMessage(null);
  }, []);

  const getSigner = React.useCallback(async (): Promise<JsonRpcSigner> => {
    const ethereum = getInjectedEthereum();
    if (!ethereum) {
      throw new Error("No injected wallet was found.");
    }

    const provider = new BrowserProvider(ethereum);
    return provider.getSigner();
  }, []);

  const switchChain = React.useCallback(async (targetChainId: number): Promise<void> => {
    const ethereum = getInjectedEthereum();
    if (!ethereum) {
      throw new Error("No injected wallet was found.");
    }

    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(targetChainId) }]
    });
    setChainId(targetChainId);
  }, []);

  const value = React.useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      errorMessage,
      connect,
      disconnect,
      getSigner,
      switchChain
    }),
    [address, chainId, connect, disconnect, errorMessage, getSigner, status, switchChain]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = React.useContext(WalletContext);
  if (!value) {
    throw new Error("useWallet must be used within WalletProvider.");
  }
  return value;
}

function getInjectedEthereum(): Window["ethereum"] | undefined {
  return typeof window === "undefined" ? undefined : window.ethereum;
}

function normalizeAccounts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const normalized = value.trim();
    const parsed = normalized.startsWith("0x") ? Number.parseInt(normalized, 16) : Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return fallback;
}
