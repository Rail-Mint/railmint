import {
	errorResponse,
	handlePreflight,
	jsonResponse,
	parseJsonBody,
} from "../_shared/http.ts";
import { verifyWalletSignature } from "../_shared/signature.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ToggleLikeBody = {
	wallet_address?: string;
	signature?: string;
	sign_timestamp?: number;
	post_id?: string;
	action?: "like" | "unlike" | "toggle" | string;
};

type ToggleLikeSupabaseClient = {
	from: (table: string) => {
		select: (columns: string) => {
			eq: (
				column: string,
				value: string,
			) => {
				eq: (
					column: string,
					value: string,
				) => {
					single: () => Promise<{ data: unknown; error: unknown }>;
					maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
				};
				single: () => Promise<{ data: unknown; error: unknown }>;
				maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
			};
		};
		insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
		delete: () => {
			eq: (column: string, value: string) => Promise<{ error: unknown }>;
		};
	};
};

Deno.serve(async (request: Request) => {
	const preflight = handlePreflight(request);
	if (preflight) return preflight;

	try {
		const body = await parseJsonBody<ToggleLikeBody>(request);

		const walletAddress = await verifyWalletSignature(body, "toggle-like");
		const normalizedWalletAddress = walletAddress.toLowerCase();

		const postId = String(body.post_id || "").trim();
		const action = String(body.action || "toggle").trim();

		if (!UUID_RE.test(postId)) {
			return errorResponse("Invalid post ID format", 400);
		}
		if (!["like", "unlike", "toggle"].includes(action)) {
			return errorResponse(
				"Invalid action. Use 'like', 'unlike', or 'toggle'",
				400,
			);
		}

		const supabase = createServiceRoleClient() as ToggleLikeSupabaseClient;

		const { data: post, error: postError } = await supabase
			.from("posts")
			.select("id")
			.eq("id", postId)
			.single();

		if (postError || !post) {
			return errorResponse("Post not found", 404);
		}

		const { data: existingLike } = await supabase
			.from("likes")
			.select("id")
			.eq("post_id", postId)
			.eq("wallet_address", normalizedWalletAddress)
			.maybeSingle();
		const existingLikeId = (existingLike as { id?: string } | null)?.id;

		let liked = false;

		if (action === "toggle") {
			if (existingLikeId) {
				const { error } = await supabase
					.from("likes")
					.delete()
					.eq("id", existingLikeId);
				if (error) throw error;
				liked = false;
			} else {
				const { error } = await supabase.from("likes").insert({
					post_id: postId,
					wallet_address: normalizedWalletAddress,
				});
				if (error) throw error;
				liked = true;
			}
		} else if (action === "like") {
			if (!existingLikeId) {
				const { error } = await supabase.from("likes").insert({
					post_id: postId,
					wallet_address: normalizedWalletAddress,
				});
				if (error) throw error;
			}
			liked = true;
		} else {
			if (existingLikeId) {
				const { error } = await supabase
					.from("likes")
					.delete()
					.eq("id", existingLikeId);
				if (error) throw error;
			}
			liked = false;
		}

		return jsonResponse({ success: true, liked });
	} catch (e) {
		const errorId = crypto.randomUUID().slice(0, 8);
		console.error(
			`[toggle-like:${errorId}]`,
			e instanceof Error ? e.message : e,
		);
		const msg =
			e instanceof Error && /signature|expired|wallet/i.test(e.message)
				? e.message
				: "Operation failed";
		return jsonResponse({ error: msg, error_id: errorId }, 400);
	}
});
