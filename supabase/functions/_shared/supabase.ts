/// <reference path="./deno.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey, getSupabaseUrl } from "./env.ts";

export function createServiceRoleClient() {
	return createClient(getSupabaseUrl(), getServiceRoleKey());
}
