import { Bot, CheckCircle2, Edit3, Save, User, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { CreatorProfile } from "@/hooks/useStudioData";

const profileSchema = z.object({
  clone_name: z.string().min(2, "Clone name must be at least 2 characters").max(60),
  x_handle: z.string().regex(/^@?[\w]*$/, "Invalid X handle").max(30).optional().or(z.literal("")),
  persona_text: z.string().min(20, "Persona must be at least 20 characters").max(1000),
  prompt_template: z.string().min(10, "Prompt template must be at least 10 characters").max(1000),
});

interface Props {
  profile: CreatorProfile;
  onProfileUpdate: (updated: NonNullable<CreatorProfile>) => void;
}

export function StudioProfile({ profile, onProfileUpdate }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    clone_name: "",
    x_handle: "",
    persona_text: "",
    prompt_template: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setForm({
        clone_name: profile.clone_name,
        x_handle: profile.x_handle ?? "",
        persona_text: profile.persona_text,
        prompt_template: profile.prompt_template,
      });
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!profile?.id) return;

    const result = profileSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    const { error } = await supabase
      .from("creators")
      .update({
        clone_name: form.clone_name.trim(),
        x_handle: form.x_handle.trim() || null,
        persona_text: form.persona_text.trim(),
        prompt_template: form.prompt_template.trim(),
      })
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    onProfileUpdate({
      ...profile,
      clone_name: form.clone_name.trim(),
      x_handle: form.x_handle.trim() || null,
      persona_text: form.persona_text.trim(),
      prompt_template: form.prompt_template.trim(),
    });
    setEditing(false);
    toast({ title: "Profile saved" });
  }, [form, profile, onProfileUpdate, toast]);

  const handleCancel = useCallback(() => {
    if (profile) {
      setForm({
        clone_name: profile.clone_name,
        x_handle: profile.x_handle ?? "",
        persona_text: profile.persona_text,
        prompt_template: profile.prompt_template,
      });
    }
    setErrors({});
    setEditing(false);
  }, [profile]);

  if (!profile) return null;

  const walletShort = `${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}`;

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <Card className="border-border/40 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="-mt-10 space-y-4">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-card bg-primary/10">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div>
                {editing ? (
                  <div className="space-y-1">
                    <Input
                      value={form.clone_name}
                      onChange={(e) => setForm((f) => ({ ...f, clone_name: e.target.value }))}
                      className="h-8 text-lg font-bold border-border/40"
                    />
                    {errors.clone_name && <p className="text-xs text-destructive">{errors.clone_name}</p>}
                  </div>
                ) : (
                  <h2 className="text-xl font-bold">{profile.clone_name}</h2>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {editing ? (
                    <div>
                      <Input
                        value={form.x_handle}
                        onChange={(e) => setForm((f) => ({ ...f, x_handle: e.target.value }))}
                        placeholder="@handle"
                        className="h-7 text-sm border-border/40 w-40"
                      />
                      {errors.x_handle && <p className="text-xs text-destructive">{errors.x_handle}</p>}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{profile.x_handle || "No handle"}</span>
                  )}
                  {profile.x_verified && (
                    <Badge variant="outline" className="border-primary/40 text-primary text-[10px] px-1.5 py-0">
                      <CheckCircle2 className="mr-0.5 h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                    <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <InfoChip label="Wallet" value={walletShort} />
            <InfoChip label="Created" value={new Date(profile.x_verified_at ?? "").getTime() ? "Active" : "Pending"} />
          </div>
        </CardContent>
      </Card>

      {/* Persona */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Persona
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div>
              <Textarea
                rows={4}
                value={form.persona_text}
                onChange={(e) => setForm((f) => ({ ...f, persona_text: e.target.value }))}
                className="border-border/40"
              />
              {errors.persona_text && <p className="mt-1 text-xs text-destructive">{errors.persona_text}</p>}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{profile.persona_text}</p>
          )}
        </CardContent>
      </Card>

      {/* Prompt Template */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Prompt Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div>
              <Textarea
                rows={4}
                value={form.prompt_template}
                onChange={(e) => setForm((f) => ({ ...f, prompt_template: e.target.value }))}
                className="border-border/40"
              />
              {errors.prompt_template && <p className="mt-1 text-xs text-destructive">{errors.prompt_template}</p>}
            </div>
          ) : (
            <p className="text-sm leading-relaxed font-mono text-muted-foreground">{profile.prompt_template}</p>
          )}
        </CardContent>
      </Card>

      {/* X Verification CTA */}
      {!profile.x_verified && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Verify your X account</p>
              <p className="text-xs text-muted-foreground">
                Tweet <span className="font-mono">@RailMintAI verify {profile.x_handle}</span> to get verified.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const handle = (profile.x_handle ?? "").replace("@", "");
                const text = encodeURIComponent(`@RailMintAI verify @${handle}`);
                window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
              }}
            >
              Verify
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
