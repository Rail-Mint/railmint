/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 flows.
 */
import { supabase } from "@/integrations/supabase/client";

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

/**
 * Build the X OAuth 2.0 authorization URL via the x-oauth-start edge function.
 * Stores code_verifier and state in sessionStorage for the callback.
 */
export async function buildXOAuthUrl(redirectUri: string): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const { data, error } = await supabase.functions.invoke("x-oauth-start", {
    body: {
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // Persist for the callback
  sessionStorage.setItem("x_oauth_verifier", codeVerifier);
  sessionStorage.setItem("x_oauth_state", data.state);

  return data.authorization_url;
}
