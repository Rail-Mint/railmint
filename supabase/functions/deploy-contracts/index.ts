import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

async function requireAdmin(req: Request): Promise<string> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
  const apikey = req.headers.get("apikey")?.trim();

  if (serviceRoleKey && (auth === serviceRoleKey || apikey === serviceRoleKey)) {
    return "system";
  }

  if (!auth) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(auth);
  if (error || !user) throw new Error("Unauthorized");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();

  if (!roles) throw new Error("Admin access required");
  return user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    try {
      await requireAdmin(req);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Unauthorized" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const step = body.step || "balance";

    const privateKey = Deno.env.get("BNB_TESTNET_PRIVATE_KEY");
    if (!privateKey) {
      return json({ error: "Deployment key not configured" }, 400);
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
    console.error("deploy-contracts error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Operation failed" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
