/**
 * Minimal callback page loaded inside the X OAuth popup.
 * Reads the code/state from the URL, posts them back to the opener, then closes.
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function StudioOAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (window.opener) {
      if (error) {
        window.opener.postMessage({ type: "x-oauth-error", error }, window.location.origin);
      } else if (code && state) {
        window.opener.postMessage({ type: "x-oauth-complete", code, state }, window.location.origin);
      } else {
        window.opener.postMessage({ type: "x-oauth-error", error: "Missing OAuth parameters" }, window.location.origin);
      }
      window.close();
    } else {
      // Fallback: not in a popup — redirect to studio/profile with params intact so the
      // existing useEffect in StudioProfile can pick them up.
      window.location.replace(`/studio/profile${window.location.search}`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Completing verification…</p>
      </div>
    </div>
  );
}
