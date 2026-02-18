import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles, Twitter } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { keccak256, toHex } from "viem";
import { z } from "zod";
import { useSignedAction } from "@/hooks/useSignedAction";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useContractStatus } from "@/hooks/useContractStatus";
import { useRegisterCreator } from "@/hooks/useCreatorRegistry";
import { supabase } from "@/integrations/supabase/client";
import { buildXOAuthUrl } from "@/lib/x-oauth";

const schema = z.object({
  clone_name: z.string().min(2, "At least 2 characters"),
  persona_text: z.string().min(20, "At least 20 characters"),
  prompt_template: z.string().min(10, "At least 10 characters"),
});

type FormValues = z.infer<typeof schema>;
type Step = 1 | 2 | 3 | 4;

const tonePresets = [
  { id: "strategist", label: "Strategist", lead: "A sharp BNB ecosystem strategist" },
  { id: "builder", label: "Builder", lead: "A practical Web3 builder" },
  { id: "educator", label: "Educator", lead: "A clear and trusted crypto educator" },
] as const;

const focusPresets = [
  { id: "defi", label: "DeFi opportunities" },
  { id: "security", label: "Security best practices" },
  { id: "tooling", label: "Builder tooling" },
  { id: "ecosystem", label: "BNB ecosystem updates" },
] as const;

const goalPresets = [
  { id: "engage", label: "Engagement", desc: "Spark comments and shares" },
  { id: "teach", label: "Education", desc: "Teach with clarity" },
  { id: "credibility", label: "Credibility", desc: "Build trust with evidence" },
] as const;

interface Props {
  address: string;
  onComplete: () => void;
}

export function StudioOnboarding({ address, onComplete }: Props) {
  const { toast } = useToast();
  const { mode: contractMode } = useContractStatus();
  const { registerCreator, isDeployed: contractsDeployed } = useRegisterCreator();
  const { invokeWithSignature } = useSignedAction();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [verifyingX, setVerifyingX] = useState(false);
  const [selectedTone, setSelectedTone] = useState("strategist");
  const [selectedFocus, setSelectedFocus] = useState("defi");
  const [selectedGoal, setSelectedGoal] = useState("engage");
  const [customNote, setCustomNote] = useState("");
  const popupRef = useRef<Window | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clone_name: "RailMint Strategist",
      persona_text: "",
      prompt_template: "",
    },
  });

  // Auto-build persona & prompt from selections
  const profile = useMemo(() => {
    const tone = tonePresets.find((t) => t.id === selectedTone) ?? tonePresets[0];
    const focus = focusPresets.find((f) => f.id === selectedFocus) ?? focusPresets[0];
    const goal = goalPresets.find((g) => g.id === selectedGoal) ?? goalPresets[0];
    const note = customNote.trim() ? ` Keep this nuance: ${customNote.trim()}.` : "";

    return {
      persona: `${tone.lead} focused on ${focus.label.toLowerCase()}. Communicate in concise, high-signal language with actionable takeaways. Primary objective: ${goal.desc.toLowerCase()}.${note}`,
      prompt: `Write a high-quality post about {{topic}} for the BNB ecosystem. Tone: ${tone.label}. Focus: ${focus.label}. Objective: ${goal.label}. Include one concrete insight and one practical next step.`,
    };
  }, [selectedTone, selectedFocus, selectedGoal, customNote]);

  useEffect(() => {
    form.setValue("persona_text", profile.persona, { shouldDirty: true });
    form.setValue("prompt_template", profile.prompt, { shouldDirty: true });
  }, [profile, form]);

  // Early check: wallet already registered → skip onboarding
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("creators")
        .select("id")
        .ilike("wallet_address", address)
        .maybeSingle();
      if (!cancelled && data) {
        toast({ title: "Profile already exists", description: "Redirecting to your studio..." });
        onComplete();
      }
    })();
    return () => { cancelled = true; };
  }, [address, onComplete, toast]);

  /** Validate identity fields AND check for duplicates before advancing to step 2 */
  const handleIdentityNext = useCallback(async () => {
    const valid = await form.trigger(["clone_name"]);
    if (!valid) return;

    setCheckingIdentity(true);
    try {
      const cloneName = form.getValues("clone_name").trim();

      const [nameRes, walletRes] = await Promise.all([
        supabase.from("creators").select("id").ilike("clone_name", cloneName).maybeSingle(),
        supabase.from("creators").select("id").ilike("wallet_address", address).maybeSingle(),
      ]);

      if (walletRes.data) {
        toast({ title: "Profile already exists", description: "Redirecting to your studio..." });
        onComplete();
        return;
      }
      if (nameRes.data) {
        toast({ title: "Clone name taken", description: `"${cloneName}" is already in use. Choose a different name.`, variant: "destructive" });
        return;
      }

      setStep(2);
    } catch {
      toast({ title: "Check failed", description: "Could not verify uniqueness. Try again.", variant: "destructive" });
    } finally {
      setCheckingIdentity(false);
    }
  }, [form, address, onComplete, toast]);

  const handleCreate = useCallback(async () => {
    const values = form.getValues();
    const result = schema.safeParse(values);
    if (!result.success) {
      toast({ title: "Validation error", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const profileHash = keccak256(
        toHex(JSON.stringify({ persona: values.persona_text, prompt: values.prompt_template })),
      );

      if (contractsDeployed) {
        try {
          registerCreator("", profileHash as `0x${string}`);
        } catch {
          console.warn("On-chain registration skipped in mock mode");
        }
      }

      await invokeWithSignature("upsert-creator", {
        x_handle: null,
        clone_name: values.clone_name.trim(),
        persona_text: values.persona_text.trim(),
        prompt_template: values.prompt_template.trim(),
      }, address);

      toast({ title: "Clone created!", description: `${values.clone_name} is ready.` });
      setStep(4);
    } catch (err: any) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("clone name is already") || msg.includes("name is already taken")) {
        toast({ title: "Name conflict", description: "This clone name was just taken. Choose a different name.", variant: "destructive" });
        setStep(1);
        setSaving(false);
        return;
      }
      if (msg.includes("wallet") && (msg.includes("already registered") || msg.includes("already exists"))) {
        toast({ title: "Profile already exists", description: "Redirecting to your studio..." });
        onComplete();
        return;
      }
      toast({ title: "Creation failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, address, contractsDeployed, registerCreator, toast, onComplete, invokeWithSignature]);

  // Listen for OAuth result via postMessage OR BroadcastChannel
  // (BroadcastChannel is needed when window.opener is lost after X's multi-hop redirects)
  useEffect(() => {
    const handleOAuthMessage = async (message: { type: string; code?: string; state?: string; error?: string }) => {
      if (!message.type?.startsWith("x-oauth")) return;

      popupRef.current?.close();
      popupRef.current = null;

      if (message.type === "x-oauth-error") {
        toast({
          title: "Verification failed",
          description: message.error || "X OAuth error",
          variant: "destructive",
        });
        setVerifyingX(false);
        return;
      }

      if (message.type === "x-oauth-complete") {
        const { code, state } = message;
        const savedState = localStorage.getItem("x_oauth_state");
        if (state !== savedState) {
          toast({ title: "Verification failed", description: "Invalid OAuth state", variant: "destructive" });
          setVerifyingX(false);
          return;
        }
        const codeVerifier = localStorage.getItem("x_oauth_verifier");
        if (!codeVerifier) {
          toast({ title: "Verification failed", description: "Missing PKCE verifier", variant: "destructive" });
          setVerifyingX(false);
          return;
        }
        localStorage.removeItem("x_oauth_state");
        localStorage.removeItem("x_oauth_verifier");

        try {
          await invokeWithSignature("x-verify", {
            code,
            code_verifier: codeVerifier,
            redirect_uri: "https://railmint.lovable.app/studio/oauth-callback",
          }, address);
          toast({ title: "X account verified!", description: "Your X account is now linked." });
          onComplete();
        } catch (err: any) {
          toast({
            title: "Verification failed",
            description: err.message || "Could not verify X account",
            variant: "destructive",
          });
        } finally {
          setVerifyingX(false);
        }
      }
    };

    const postMessageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handleOAuthMessage(event.data);
    };
    window.addEventListener("message", postMessageHandler);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("x_oauth_channel");
      bc.onmessage = (event) => handleOAuthMessage(event.data);
    } catch {}

    const pollInterval = setInterval(() => {
      const raw = localStorage.getItem("x_oauth_result");
      if (raw) {
        localStorage.removeItem("x_oauth_result");
        try { handleOAuthMessage(JSON.parse(raw)); } catch {}
      }
    }, 500);

    return () => {
      window.removeEventListener("message", postMessageHandler);
      bc?.close();
      clearInterval(pollInterval);
    };
  }, [address, invokeWithSignature, onComplete, toast]);

  const handleVerifyX = useCallback(async () => {
    setVerifyingX(true);
    try {
      const redirectUri = "https://railmint.lovable.app/studio/oauth-callback";
      const authUrl = await buildXOAuthUrl(redirectUri);

      const width = 500;
      const height = 660;
      const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
      const popup = window.open(
        authUrl,
        "x_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`,
      );

      if (!popup) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site, then try again.",
          variant: "destructive",
        });
        setVerifyingX(false);
        return;
      }
      popupRef.current = popup;
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message || "Could not start X verification",
        variant: "destructive",
      });
      setVerifyingX(false);
    }
  }, [toast]);

  const steps = [
    { id: 1, label: "Identity" },
    { id: 2, label: "Voice" },
    { id: 3, label: "Review" },
    { id: 4, label: "Verify X" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                step >= s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
            </div>
            <span className={`text-sm hidden sm:inline ${step >= s.id ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle>Set your identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Clone Name</label>
                  <Input {...form.register("clone_name")} className="border-border/40" />
                  {form.formState.errors.clone_name && (
                    <p className="mt-1 text-xs text-destructive">{form.formState.errors.clone_name.message}</p>
                  )}
                </div>
                <Button
                  onClick={handleIdentityNext}
                  disabled={checkingIdentity}
                  className="w-full gap-2"
                >
                  {checkingIdentity && <Loader2 className="h-4 w-4 animate-spin" />}
                  {checkingIdentity ? "Checking…" : "Continue to Voice →"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle>Configure your voice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Tone</label>
                  <div className="grid grid-cols-3 gap-2">
                    {tonePresets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTone(t.id)}
                        className={`rounded-xl border p-3 text-left text-sm transition-all ${
                          selectedTone === t.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Focus</label>
                  <div className="grid grid-cols-2 gap-2">
                    {focusPresets.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFocus(f.id)}
                        className={`rounded-xl border p-3 text-left text-sm transition-all ${
                          selectedFocus === f.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Goal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {goalPresets.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGoal(g.id)}
                        className={`rounded-xl border p-3 text-left text-sm transition-all ${
                          selectedGoal === g.id
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <p className="font-medium">{g.label}</p>
                        <p className="text-xs text-muted-foreground">{g.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Custom nuance (optional)</label>
                  <Textarea
                    placeholder="Any extra tone hint?"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    rows={2}
                    className="border-border/40"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={() => setStep(3)} className="flex-1">Review →</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle>Review & Create</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReviewField label="Clone Name" value={form.getValues("clone_name")} />
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Persona</p>
                  <p className="text-sm">{form.getValues("persona_text")}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Prompt Template</p>
                  <p className="text-sm">{form.getValues("prompt_template")}</p>
                </div>
                {contractMode === "mock" && (
                  <div className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                    Mock Mode — On-chain registration will be skipped
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={handleCreate} disabled={saving} className="flex-1 gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Creating..." : "Create Clone"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/[0.03]">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Clone Created
                </div>
                <CardTitle className="text-2xl">Verify your X account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Connect your X account via OAuth to prove you own it.
                  This links your wallet to your real X identity.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button onClick={handleVerifyX} disabled={verifyingX} className="gap-2">
                    {verifyingX ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Twitter className="h-4 w-4" />
                    )}
                    {verifyingX ? "Verifying..." : "Verify with X"}
                  </Button>
                  <Button variant="outline" onClick={onComplete}>
                    Skip for now →
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can also verify later from your Profile settings.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
