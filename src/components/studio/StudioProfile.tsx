import { CheckCircle2, User } from "lucide-react";
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
    toast({ title: "Profile saved" });
  }, [form, profile, onProfileUpdate, toast]);

  if (!profile) return null;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          Profile & Persona
          {profile.x_verified && (
            <Badge variant="outline" className="ml-auto border-green-500/40 text-green-600 text-xs">
              <CheckCircle2 className="mr-1 h-3 w-3" /> X Verified
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Clone Name"
            value={form.clone_name}
            error={errors.clone_name}
            onChange={(v) => setForm((f) => ({ ...f, clone_name: v }))}
          />
          <Field
            label="X Handle"
            value={form.x_handle}
            error={errors.x_handle}
            placeholder="@yourhandle"
            onChange={(v) => setForm((f) => ({ ...f, x_handle: v }))}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Persona</label>
          <Textarea
            rows={4}
            value={form.persona_text}
            onChange={(e) => setForm((f) => ({ ...f, persona_text: e.target.value }))}
            className="border-border/40"
          />
          {errors.persona_text && (
            <p className="mt-1 text-xs text-destructive">{errors.persona_text}</p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">
            Prompt Template
          </label>
          <Textarea
            rows={4}
            value={form.prompt_template}
            onChange={(e) => setForm((f) => ({ ...f, prompt_template: e.target.value }))}
            className="border-border/40"
          />
          {errors.prompt_template && (
            <p className="mt-1 text-xs text-destructive">{errors.prompt_template}</p>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-muted-foreground">{label}</label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border-border/40"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
