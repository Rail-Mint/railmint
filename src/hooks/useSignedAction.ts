import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that signs a message with the connected wallet before invoking an edge function.
 * This proves wallet ownership server-side, preventing impersonation.
 */
export function useSignedAction() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const invokeWithSignature = useCallback(
    async (
      functionName: string,
      body: Record<string, unknown>,
      walletAddress?: string,
    ) => {
      const wallet = walletAddress || address;
      if (!wallet) throw new Error("Wallet not connected");

      const timestamp = Date.now();
      const message = `RailMintAI Action\nFunction: ${functionName}\nWallet: ${wallet}\nTimestamp: ${timestamp}`;

      const signature = await signMessageAsync({ message, account: wallet as `0x${string}` });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          ...body,
          wallet_address: wallet,
          signature,
          sign_timestamp: timestamp,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    [signMessageAsync, address],
  );

  return { invokeWithSignature };
}
