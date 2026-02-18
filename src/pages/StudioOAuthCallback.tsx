/**
 * Minimal callback page loaded inside the X OAuth popup.
 * Reads the code/state from the URL and relays them back to the parent
 * window using BroadcastChannel (works even when window.opener is lost
 * due to X's multi-hop redirect chain).
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function StudioOAuthCallback() {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDesc = params.get("error_description");

    const message = error
      ? { type: "x-oauth-error", error: errorDesc || error }
      : code && state
      ? { type: "x-oauth-complete", code, state }
      : { type: "x-oauth-error", error: "Missing OAuth parameters" };

    // Primary: postMessage to opener (same-origin popups)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(message, window.location.origin);
        window.close();
        return;
      } catch {
        // opener exists but blocked — fall through to BroadcastChannel
      }
    }

    // Fallback: BroadcastChannel — survives X's multi-hop redirect chain
    try {
      const bc = new BroadcastChannel("x_oauth_channel");
      bc.postMessage(message);
      bc.close();
    } catch {
      // BroadcastChannel not supported — last resort: store in localStorage
      localStorage.setItem("x_oauth_result", JSON.stringify(message));
    }

    if (message.type === "x-oauth-error") {
      setErrMsg((message as any).error || "Verification failed");
      setStatus("error");
    } else {
      setStatus("done");
    }

    // Try to close — if the browser blocks it, show a "close this tab" message
    window.close();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Completing verification…</p>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <p className="font-medium">X account verified!</p>
            <p className="text-sm text-muted-foreground">You can close this window.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="font-medium text-destructive">Verification failed</p>
            <p className="text-sm text-muted-foreground">{errMsg}</p>
            <p className="text-xs text-muted-foreground">You can close this window and try again.</p>
          </>
        )}
      </div>
    </div>
  );
}

