/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { TARGET_CHAIN, TARGET_CHAIN_DECIMAL, TARGET_CHAIN_WALLET_PARAMS } from "./constants";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    toast.success("Wallet disconnected");
  }, []);

  const switchToTargetChain = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("Please install MetaMask or a compatible wallet");
      return false;
    }

    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN.chainId }],
      });
      toast.success(`Switched to ${TARGET_CHAIN.chainName}`);
      return true;
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [TARGET_CHAIN_WALLET_PARAMS],
          });
          toast.success(`${TARGET_CHAIN.chainName} added to MetaMask`);
          return true;
        } catch (addError: any) {
          if (addError.code !== 4001) {
            toast.error(addError.message || "Failed to add network");
          }
          return false;
        }
      }

      if (error.code !== 4001) {
        toast.error(error.message || "Failed to switch network");
      }
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("Please install MetaMask or a compatible wallet");
      return;
    }

    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      let prov = new ethers.BrowserProvider(ethereum);
      
      await prov.send("eth_requestAccounts", []);
      const initialNetwork = await prov.getNetwork();

      if (Number(initialNetwork.chainId) !== TARGET_CHAIN_DECIMAL) {
        await switchToTargetChain();
        prov = new ethers.BrowserProvider(ethereum);
      }

      const sig = await prov.getSigner();
      const addr = await sig.getAddress();
      const network = await prov.getNetwork();
      const resolvedChainId = Number(network.chainId);

      setProvider(prov);
      setSigner(sig);
      setAddress(addr);
      setChainId(resolvedChainId);

      if (resolvedChainId === TARGET_CHAIN_DECIMAL) {
        toast.success(`Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
      } else {
        toast.error(`Connected on the wrong network. Please switch to ${TARGET_CHAIN.chainName}.`);
      }

      ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          setAddress(accounts[0]);
        }
      });

      ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [disconnect, switchToTargetChain]);

  return {
    address,
    provider,
    signer,
    chainId,
    isConnecting,
    connect,
    disconnect,
    switchToTargetChain,
    isConnected: !!address,
  };
}
