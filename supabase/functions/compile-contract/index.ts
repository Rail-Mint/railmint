import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compile a single flattened Solidity contract using solc
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    return json({ error: error.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
