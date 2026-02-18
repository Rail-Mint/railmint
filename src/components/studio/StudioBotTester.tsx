import { Bot, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSignedAction } from "@/hooks/useSignedAction";
import type { CreatorProfile } from "@/hooks/useStudioData";
import { supabase } from "@/integrations/supabase/client";

interface Props {
	profile: CreatorProfile;
	address: string | undefined;
}

function stripHtml(value: string) {
	return value.replace(/<[^>]*>/g, "");
}

export function StudioBotTester({ profile, address }: Props) {
	const { toast } = useToast();
	const { invokeWithSignature } = useSignedAction();
	const [selectedPersona, setSelectedPersona] = useState("clone");
	const [prompt, setPrompt] = useState("");
	const [running, setRunning] = useState(false);
	const [response, setResponse] = useState<string | null>(null);

	const personaOptions = useMemo(
		() => [
			{
				value: "clone",
				label: profile?.clone_name
					? `${profile.clone_name} (Clone persona)`
					: "Clone persona",
			},
		],
		[profile?.clone_name],
	);

	async function handleRun() {
		if (!address || !profile) {
			toast({
				title: "Wallet not connected",
				description: "Connect your wallet to run a test prompt.",
				variant: "destructive",
			});
			return;
		}

		const trimmedPrompt = prompt.trim();
		if (!trimmedPrompt) {
			toast({
				title: "Prompt required",
				description: "Enter a prompt to test your bot.",
				variant: "destructive",
			});
			return;
		}

		setRunning(true);
		try {
			const data = await invokeWithSignature(
				"generate-post",
				{
					topic: trimmedPrompt,
					length: "medium",
					model: "google/gemini-3-pro",
				},
				address,
			);

			if (data?.error) throw new Error(data.error);

		const { data: postData, error } = await supabase
				.from("posts")
				.select("content_text")
				.eq("id", data.post_id)
				.single();

			if (error) throw new Error(error.message);

			const raw = postData?.content_text || "";
			setResponse(raw || "(Empty response)");
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "An error occurred";
			toast({
				title: "Test run failed",
				description: message,
				variant: "destructive",
			});
		} finally {
			setRunning(false);
		}
	}

	return (
		<div className="space-y-6">
			<Card className="border-border/40">
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Bot className="h-5 w-5 text-primary" />
						Bot Tester
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-sm text-muted-foreground">
						Run a prompt through your clone to verify its responses. Results are
						ephemeral in this UI and not stored as test history.
					</div>

					<div className="grid gap-4 md:grid-cols-[220px,1fr]">
						<div className="space-y-2">
							<Label>Persona</Label>
							<Select
								value={selectedPersona}
								onValueChange={setSelectedPersona}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select persona" />
								</SelectTrigger>
								<SelectContent>
									{personaOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Only your clone persona is currently available.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="tester-prompt">Prompt</Label>
							<Textarea
								id="tester-prompt"
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
								placeholder="Ask your bot a question or give a prompt to test..."
								className="min-h-[140px]"
							/>
						</div>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-xs text-muted-foreground">
							Uses the existing generator with prompt-only input.
						</p>
						<Button onClick={handleRun} disabled={running}>
							{running ? (
								<span className="flex items-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Running...
								</span>
							) : (
								<span className="flex items-center gap-2">
									<Sparkles className="h-4 w-4" />
									Run Test
								</span>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card className="border-border/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Response</CardTitle>
				</CardHeader>
				<CardContent>
					{response ? (
						<div className="whitespace-pre-wrap rounded-xl border border-border/40 bg-card/80 p-4 text-sm">
							{response}
						</div>
					) : (
						<div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
							Run a prompt to see the bot response here.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
