import { getRequiredEnv, getSupabaseUrl } from "./env.ts";

let openRouterFailures = 0;
let geminiKeyIndex = 0;

export function shouldUseGeminiFallback(): boolean {
  return openRouterFailures >= 3;
}

export function recordOpenRouterFailure() {
  openRouterFailures++;
  console.warn(
    `[Failover] OpenRouter failure recorded. Total failures: ${openRouterFailures}`
  );
}

function getNextGeminiKey(): string {
  const keysStr =
    Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEYS") || "";
  const keys = keysStr
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0)
    throw new Error("GEMINI_API_KEY is not configured for fallback");

  const key = keys[geminiKeyIndex % keys.length];
  geminiKeyIndex++;
  return key;
}

export async function fetchChatCompletionWithFailover(
  requestPayload: any,
  signal?: AbortSignal,
  retryCount: number = 0
): Promise<Response> {
  let url =
    Deno.env.get("OPENROUTER_API_URL") ||
    "https://openrouter.ai/api/v1/chat/completions";
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  let authHeader = openRouterKey ? `Bearer ${openRouterKey}` : "";

  const payload = { ...requestPayload };

  // If failover is active, switch to Gemini's OpenAI-compatible endpoint
  if (shouldUseGeminiFallback() || !openRouterKey) {
    url =
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    authHeader = `Bearer ${getNextGeminiKey()}`;
    if (typeof payload.model === "string") {
      // Remove the 'google/' prefix for the native Gemini endpoint
      payload.model = payload.model.replace("google/", "");
      // Map future/fictional models from the UI to existing ones
      if (payload.model === "gemini-3-pro")
        payload.model = "gemini-3-pro-preview";
      else if (payload.model === "gemini-3-flash")
        payload.model = "gemini-3-flash-preview";
    }
  } else {
    // Even for OpenRouter, if the UI sent gemini-3-pro, it fails. We should map it to a valid model
    if (typeof payload.model === "string") {
      if (payload.model === "google/gemini-3-pro")
        payload.model = "google/gemini-2.5-pro";
      else if (payload.model === "google/gemini-3-flash")
        payload.model = "google/gemini-2.5-flash";
    }
  }

  const headers = {
    Authorization: authHeader,
    "Content-Type": "application/json",
    "HTTP-Referer": getSupabaseUrl(),
    "X-Title": "RailMintAI",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `LLM fetch failed (${response.status}): ${errText.slice(0, 200)}`
      );
    }
    return response;
  } catch (error) {
    // If we are still using OpenRouter and it fails, record it
    if (!shouldUseGeminiFallback() && openRouterKey) {
      recordOpenRouterFailure();

      // If we haven't exceeded retry limits for this specific call, retry immediately
      if (retryCount < 3) {
        console.warn(
          `[Failover] Retrying request (Attempt ${retryCount + 1})...`
        );
        return fetchChatCompletionWithFailover(
          requestPayload,
          signal,
          retryCount + 1
        );
      }
    } else if (shouldUseGeminiFallback() && retryCount < 3) {
      // If we are already in Gemini mode, and it failed, we might want to rotate key and try again
      console.warn(
        `[Failover] Gemini request failed. Rotating key and retrying (Attempt ${
          retryCount + 1
        })...`
      );
      return fetchChatCompletionWithFailover(
        requestPayload,
        signal,
        retryCount + 1
      );
    }

    throw error;
  }
}
