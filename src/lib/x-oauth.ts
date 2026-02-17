/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 flows.
 */

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

const TWITTER_CLIENT_ID_KEY = "VITE_TWITTER_CLIENT_ID";

/**
 * Build the Twitter OAuth 2.0 authorization URL with PKCE.
 * Stores code_verifier in sessionStorage for the callback.
 */
export async function buildXOAuthUrl(redirectUri: string): Promise<string> {
  const clientId = import.meta.env.VITE_TWITTER_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Twitter Client ID not configured");

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Persist for the callback
  sessionStorage.setItem("x_oauth_verifier", codeVerifier);

  const state = crypto.randomUUID();
  sessionStorage.setItem("x_oauth_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://x.com/i/oauth2/authorize?${params.toString()}`;
}
