export function getRequiredEnv(key: string): string {
	const value = Deno.env.get(key);
	if (!value) throw new Error(`Missing ${key}`);
	return value;
}

export function getOptionalEnv(key: string): string | undefined {
	return Deno.env.get(key);
}

export function getOptionalIntEnv(key: string, fallback: number): number {
	const raw = Deno.env.get(key);
	if (!raw) return fallback;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return fallback;
	return parsed;
}

export function getSupabaseUrl(): string {
	return getRequiredEnv("SUPABASE_URL");
}

export function getServiceRoleKey(): string {
	return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}
