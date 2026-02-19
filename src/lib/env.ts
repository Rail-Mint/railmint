import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const frontendEnvSchema = z.object({
	VITE_SUPABASE_URL: z.string().url(),
	VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
	VITE_BLOCKCHAIN_EXPLORER_BASE_URL: z.string().url(),
	VITE_CREATOR_REGISTRY_ADDRESS: addressSchema.optional(),
	VITE_CONTENT_PUBLISHING_ADDRESS: addressSchema.optional(),
	VITE_REWARD_DISTRIBUTOR_ADDRESS: addressSchema.optional(),
	VITE_WALLETCONNECT_PROJECT_ID: z.string().optional(),
});

const parsedFrontendEnv = frontendEnvSchema.safeParse(import.meta.env);

if (!parsedFrontendEnv.success) {
	const details = parsedFrontendEnv.error.issues
		.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
		.join("; ");
	throw new Error(`Invalid frontend environment variables: ${details}`);
}

export const frontendEnv = parsedFrontendEnv.data;
