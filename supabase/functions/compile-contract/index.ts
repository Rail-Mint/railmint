import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { contractName, source } = await req.json();
    if (!contractName || !source) {
      return json({ error: "contractName and source required" }, 400);
    }

    console.log(`Compiling ${contractName}...`);

    const solc = (await import("https://esm.sh/solc@0.8.28?bundle")).default;
    const input = {
      language: "Solidity",
      sources: { [`${contractName}.sol`]: { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "paris",
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors?.some((e: any) => e.severity === "error")) {
      throw new Error(JSON.stringify(output.errors.filter((e: any) => e.severity === "error").map((e: any) => e.formattedMessage)));
    }

    const contract = output.contracts[`${contractName}.sol`][contractName];
    console.log(`Compiled ${contractName} successfully`);

    return json({
      contractName,
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
    });
  } catch (error: any) {
    console.error("Compile error:", error);
    return json({ error: "Compilation failed" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
