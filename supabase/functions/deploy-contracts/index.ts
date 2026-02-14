import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
} from "npm:viem@2.45.3";
import { privateKeyToAccount } from "npm:viem@2.45.3/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bscTestnet = defineChain({
  id: 97,
  name: "BSC Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://data-seed-prebsc-1-s1.binance.org:8545"] },
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://testnet.bscscan.com" },
  },
  testnet: true,
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const step = body.step || "balance";

    const privateKey = Deno.env.get("BNB_TESTNET_PRIVATE_KEY");
    if (!privateKey) {
      return new Response(
        JSON.stringify({ error: "BNB_TESTNET_PRIVATE_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = privateKeyToAccount(
      (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
    );

    const publicClient = createPublicClient({ chain: bscTestnet, transport: http() });
    const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http() });

    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`Deployer: ${account.address}, Balance: ${balance} wei`);

    if (step === "balance") {
      return json({ deployer: account.address, balance: balance.toString(), balanceBNB: Number(balance) / 1e18 });
    }

    if (balance === 0n) {
      return json({ error: "No tBNB balance" }, 400);
    }

    // step=deploy: deploy a contract with provided abi + bytecode + optional args
    if (step === "deploy") {
      const { abi, bytecode, args, name } = body;
      if (!abi || !bytecode) return json({ error: "abi and bytecode required" }, 400);

      console.log(`Deploying ${name || "contract"}...`);
      const hash = await walletClient.deployContract({
        abi,
        bytecode: (bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`) as `0x${string}`,
        args: args || [],
      });
      console.log(`Tx: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Deployed ${name || "contract"} at: ${receipt.contractAddress}`);
      return json({ address: receipt.contractAddress, txHash: hash, name });
    }

    return json({ error: "Invalid step. Use 'balance' or 'deploy'" }, 400);
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
