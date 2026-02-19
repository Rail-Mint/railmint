export const corsHeaders: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function handlePreflight(request: Request): Response | null {
	if (request.method !== "OPTIONS") {
		return null;
	}

	return new Response(null, { headers: corsHeaders });
}

export function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			...corsHeaders,
			"Content-Type": "application/json",
		},
	});
}

export function errorResponse(message: string, status = 400): Response {
	return jsonResponse({ error: message }, status);
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch {
		throw new Error("Invalid JSON body");
	}
}
