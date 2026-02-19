type SupabaseClientLike = {
	auth: {
		getUser: (
			token: string,
		) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
	};
	from: (table: string) => {
		select: (columns: string) => {
			eq: (
				column: string,
				value: string,
			) => {
				maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
			};
		};
	};
};

function getRoleValue(roleRow: unknown): string | null {
	if (typeof roleRow !== "object" || roleRow === null || !("role" in roleRow)) {
		return null;
	}

	const role = (roleRow as { role?: unknown }).role;
	return typeof role === "string" ? role : null;
}

export async function requireAdmin(
	request: Request,
	supabase: SupabaseClientLike,
	serviceRoleKey: string,
): Promise<{ adminId: string }> {
	const authHeader = request.headers.get("authorization") ?? "";
	const apiKey = request.headers.get("apikey") ?? "";

	if (authHeader === `Bearer ${serviceRoleKey}` || apiKey === serviceRoleKey) {
		return { adminId: "service-role" };
	}

	if (!authHeader.startsWith("Bearer ")) {
		throw new Error("Unauthorized");
	}

	const token = authHeader.slice(7);
	const { data: userData, error: userError } =
		await supabase.auth.getUser(token);
	if (userError || !userData.user) {
		throw new Error("Unauthorized");
	}

	const { data: roleData, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", userData.user.id)
		.maybeSingle();

	if (roleError) {
		throw roleError;
	}

	if (getRoleValue(roleData) !== "admin") {
		throw new Error("Forbidden");
	}

	return { adminId: userData.user.id };
}
