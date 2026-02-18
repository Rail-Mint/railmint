import { Bot, CheckCircle2, Edit3, Loader2, Save, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { XIcon } from "@/components/ui/x-icon";
import { useToast } from "@/hooks/use-toast";
import { useSignedAction } from "@/hooks/useSignedAction";
import type { CreatorProfile } from "@/hooks/useStudioData";
import { buildXOAuthUrl } from "@/lib/x-oauth";

const profileSchema = z.object({
	clone_name: z
		.string()
		.min(2, "Clone name must be at least 2 characters")
		.max(60),
	persona_text: z
		.string()
		.min(20, "Persona must be at least 20 characters")
		.max(1000),
	prompt_template: z
		.string()
		.min(10, "Prompt template must be at least 10 characters")
		.max(1000),
});

interface Props {
	profile: CreatorProfile;
	onProfileUpdate: (updated: NonNullable<CreatorProfile>) => void;
}

export function StudioProfile({ profile, onProfileUpdate }: Props) {
	const { toast } = useToast();
	const { invokeWithSignature } = useSignedAction();
	const [editing, setEditing] = useState(false);
	const [verifyingX, setVerifyingX] = useState(false);
	const [form, setForm] = useState({
		clone_name: "",
		persona_text: "",
		prompt_template: "",
		bio: "",
		tags: [] as string[],
		interests: [] as string[],
		specialties: [] as string[],
		agentic_context_opt_in: false,
		news_enabled: false,
		news_topics: [] as string[],
		news_cadence: "daily" as "hourly" | "daily" | "weekly",
	});
	const [saving, setSaving] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const popupRef = useRef<Window | null>(null);
	const oauthHandledRef = useRef(false);

	// Detect if this is the OAuth callback — check URL params only (window.opener is null in Brave)
	const urlParams = new URLSearchParams(window.location.search);
	const isOAuthPopup = urlParams.has("code") || urlParams.has("error");

	useEffect(() => {
		if (profile) {
			setForm({
				clone_name: profile.clone_name,
				persona_text: profile.persona_text,
				prompt_template: profile.prompt_template,
				bio: (profile as any).bio || "",
				tags: (profile as any).tags || [],
				interests: (profile as any).interests || [],
				specialties: (profile as any).specialties || [],
				agentic_context_opt_in:
					(profile as any).agentic_context_opt_in || false,
				news_enabled: (profile as any).news_enabled || false,
				news_topics: (profile as any).news_topics || [],
				news_cadence: (profile as any).news_cadence || "daily",
			});
		}
	}, [profile]);

	const handleSave = useCallback(async () => {
		if (!profile?.id) return;

		const validation = profileSchema.safeParse(form);
		if (!validation.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of validation.error.issues) {
				fieldErrors[issue.path[0] as string] = issue.message;
			}
			setErrors(fieldErrors);
			return;
		}
		setErrors({});
		setSaving(true);

		try {
			await invokeWithSignature(
				"update-profile",
				{
					clone_name: form.clone_name.trim(),
					persona_text: form.persona_text.trim(),
					prompt_template: form.prompt_template.trim(),
					bio: form.bio.trim(),
					tags: form.tags.filter((t) => t.trim()),
					interests: form.interests.filter((i) => i.trim()),
					specialties: form.specialties.filter((s) => s.trim()),
					agentic_context_opt_in: form.agentic_context_opt_in,
					news_enabled: form.news_enabled,
					news_topics: form.news_topics.filter((t) => t.trim()),
					news_cadence: form.news_cadence,
				},
				profile.wallet_address,
			);

			onProfileUpdate({
				...profile,
				clone_name: form.clone_name.trim(),
				persona_text: form.persona_text.trim(),
				prompt_template: form.prompt_template.trim(),
				bio: form.bio.trim(),
				tags: form.tags.filter((t) => t.trim()),
				interests: form.interests.filter((i) => i.trim()),
				specialties: form.specialties.filter((s) => s.trim()),
				agentic_context_opt_in: form.agentic_context_opt_in,
				news_enabled: form.news_enabled,
				news_topics: form.news_topics.filter((t) => t.trim()),
				news_cadence: form.news_cadence,
			} as any);
			setEditing(false);
			toast({ title: "Profile saved" });
		} catch (err: any) {
			toast({
				title: "Save failed",
				description: err.message || "Unknown error",
				variant: "destructive",
			});
		} finally {
			setSaving(false);
		}
	}, [form, profile, onProfileUpdate, toast, invokeWithSignature]);

	const handleCancel = useCallback(() => {
		if (profile) {
			setForm({
				clone_name: profile.clone_name,
				persona_text: profile.persona_text,
				prompt_template: profile.prompt_template,
				bio: (profile as any).bio || "",
				tags: (profile as any).tags || [],
				interests: (profile as any).interests || [],
				specialties: (profile as any).specialties || [],
				agentic_context_opt_in:
					(profile as any).agentic_context_opt_in || false,
				news_enabled: (profile as any).news_enabled || false,
				news_topics: (profile as any).news_topics || [],
				news_cadence: (profile as any).news_cadence || "daily",
			});
		}
		setErrors({});
		setEditing(false);
	}, [profile]);

	// Handle OAuth callback params when X redirects back to /studio/profile inside the popup.
	// NOTE: window.opener is null in Brave due to privacy settings, so we broadcast via
	// BroadcastChannel instead and also attempt postMessage as a bonus.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get("code");
		const state = params.get("state");
		const error = params.get("error");

		if (!code && !error) return; // Not a callback

		// Remove params from URL immediately so we don't re-process on future renders
		window.history.replaceState({}, "", window.location.pathname);

		const message = error
			? {
					type: "x-oauth-error",
					error: params.get("error_description") || error,
				}
			: { type: "x-oauth-complete", code, state };

		// 1. Try postMessage to opener (works in Chrome/Firefox where opener is available)
		if (window.opener && !window.opener.closed) {
			try {
				window.opener.postMessage(message, window.location.origin);
			} catch {}
		}

		// 2. BroadcastChannel — works even when opener is null (Brave, Firefox strict mode)
		try {
			const bc = new BroadcastChannel("x_oauth_channel");
			bc.postMessage(message);
			bc.close();
		} catch {
			// 3. Last resort: localStorage polling
			localStorage.setItem("x_oauth_result", JSON.stringify(message));
		}

		// Always attempt to close the popup window
		window.close();
	}, []);

	const handleVerifyX = useCallback(async () => {
		if (!profile?.id) return;

		setVerifyingX(true);
		try {
			const redirectUri = `${window.location.origin}/studio/profile`;
			const authUrl = await buildXOAuthUrl(redirectUri);

			// Open as a centered popup
			const width = 500;
			const height = 660;
			const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
			const top = Math.round(
				window.screenY + (window.outerHeight - height) / 2,
			);
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
	}, [profile, toast]);

	// Listen for OAuth result from popup via postMessage OR BroadcastChannel
	// (BroadcastChannel is needed when window.opener is lost after X's multi-hop redirects)
	useEffect(() => {
		if (!profile) return;

		const handleOAuthMessage = async (message: {
			type: string;
			code?: string;
			state?: string;
			error?: string;
		}) => {
			if (!message.type?.startsWith("x-oauth")) return;

			// Guard against double-processing (postMessage + BroadcastChannel can both fire)
			if (oauthHandledRef.current) return;
			oauthHandledRef.current = true;

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
					toast({
						title: "Verification failed",
						description: "Invalid OAuth state",
						variant: "destructive",
					});
					setVerifyingX(false);
					return;
				}

				const codeVerifier = localStorage.getItem("x_oauth_verifier");
				if (!codeVerifier) {
					toast({
						title: "Verification failed",
						description: "Missing PKCE verifier",
						variant: "destructive",
					});
					setVerifyingX(false);
					return;
				}

				localStorage.removeItem("x_oauth_state");
				localStorage.removeItem("x_oauth_verifier");

				try {
					const data = await invokeWithSignature(
						"x-verify",
						{
							code,
							code_verifier: codeVerifier,
							redirect_uri: `${window.location.origin}/studio/profile`,
						},
						profile!.wallet_address,
					);

					onProfileUpdate({
						...profile!,
						x_handle: data.x_handle,
						x_verified: true,
						x_verified_at: new Date().toISOString(),
					});
					toast({
						title: "X account verified!",
						description: `Linked as ${data.x_handle}`,
					});
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

		// postMessage listener (same-origin popup)
		const postMessageHandler = (event: MessageEvent) => {
			if (event.origin !== window.location.origin) return;
			handleOAuthMessage(event.data);
		};
		window.addEventListener("message", postMessageHandler);

		// BroadcastChannel listener (cross-context, survives X redirect chain)
		let bc: BroadcastChannel | null = null;
		try {
			bc = new BroadcastChannel("x_oauth_channel");
			bc.onmessage = (event) => handleOAuthMessage(event.data);
		} catch {}

		// localStorage polling fallback (for very strict browsers)
		const pollInterval = setInterval(() => {
			const raw = localStorage.getItem("x_oauth_result");
			if (raw) {
				localStorage.removeItem("x_oauth_result");
				try {
					handleOAuthMessage(JSON.parse(raw));
				} catch {}
			}
		}, 500);

		return () => {
			window.removeEventListener("message", postMessageHandler);
			bc?.close();
			clearInterval(pollInterval);
		};
	}, [profile, invokeWithSignature, onProfileUpdate, toast]);

	// If this is the OAuth popup callback, render a minimal closing UI
	if (isOAuthPopup) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-6">
				<div className="flex flex-col items-center gap-4 text-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
					<p className="text-sm text-muted-foreground">
						Completing verification…
					</p>
					<p className="text-xs text-muted-foreground">
						This window will close automatically.
					</p>
				</div>
			</div>
		);
	}

	if (!profile) return null;

	const walletShort = `${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}`;

	return (
		<div className="space-y-6">
			{/* Identity card */}
			<Card className="border-border/40 overflow-hidden">
				<div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
				<CardContent className="-mt-10 space-y-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-card bg-primary/10">
								<User className="h-7 w-7 text-primary" />
							</div>
							<div>
								{editing ? (
									<div className="space-y-1">
										<Input
											value={form.clone_name}
											onChange={(e) =>
												setForm((f) => ({ ...f, clone_name: e.target.value }))
											}
											className="h-8 text-lg font-bold border-border/40"
										/>
										{errors.clone_name && (
											<p className="text-xs text-destructive">
												{errors.clone_name}
											</p>
										)}
									</div>
								) : (
									<h2 className="text-xl font-bold">{profile.clone_name}</h2>
								)}
								<div className="flex items-center gap-2 mt-0.5">
									{profile.x_verified && profile.x_handle && (
										<span className="text-sm text-muted-foreground">
											{profile.x_handle}
										</span>
									)}
									{profile.x_verified && (
										<Badge
											variant="outline"
											className="border-primary/40 text-primary text-[10px] px-1.5 py-0"
										>
											<CheckCircle2 className="mr-0.5 h-3 w-3" /> Verified
										</Badge>
									)}
								</div>
							</div>
						</div>
						<div className="flex gap-2">
							{editing ? (
								<>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleCancel}
										className="gap-1"
									>
										<X className="h-3.5 w-3.5" /> Cancel
									</Button>
									<Button
										size="sm"
										onClick={handleSave}
										disabled={saving}
										className="gap-1"
									>
										<Save className="h-3.5 w-3.5" />{" "}
										{saving ? "Saving…" : "Save"}
									</Button>
								</>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setEditing(true)}
									className="gap-1"
								>
									<Edit3 className="h-3.5 w-3.5" /> Edit
								</Button>
							)}
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						<InfoChip label="Wallet" value={walletShort} />
						<InfoChip
							label="Status"
							value={profile.x_verified ? "Verified" : "Pending"}
						/>
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
								onChange={(e) =>
									setForm((f) => ({ ...f, persona_text: e.target.value }))
								}
								className="border-border/40"
							/>
							{errors.persona_text && (
								<p className="mt-1 text-xs text-destructive">
									{errors.persona_text}
								</p>
							)}
						</div>
					) : (
						<p className="text-sm leading-relaxed text-muted-foreground">
							{profile.persona_text}
						</p>
					)}
				</CardContent>
			</Card>

			{/* Structured Profile Fields */}
			<Card className="border-border/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
						Profile Details
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Bio */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Bio
						</label>
						{editing ? (
							<div>
								<Textarea
									rows={3}
									maxLength={500}
									value={form.bio}
									onChange={(e) =>
										setForm((f) => ({ ...f, bio: e.target.value }))
									}
									placeholder="Brief bio about yourself..."
									className="border-border/40 resize-none"
								/>
								<p className="mt-1 text-xs text-muted-foreground text-right">
									{form.bio.length}/500
								</p>
							</div>
						) : (
							<p className="text-sm leading-relaxed text-muted-foreground">
								{(profile as any).bio || "No bio added yet"}
							</p>
						)}
					</div>

					{/* Tags */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Tags
						</label>
						{editing ? (
							<div>
								<Input
									value={form.tags.join(", ")}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											tags: e.target.value.split(",").map((t) => t.trim()),
										}))
									}
									placeholder="AI, Web3, DeFi, etc."
									className="border-border/40"
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									Separate tags with commas
								</p>
							</div>
						) : (
							<div className="flex flex-wrap gap-2">
								{((profile as any).tags || []).length > 0 ? (
									((profile as any).tags || []).map(
										(tag: string, idx: number) => (
											<Badge
												key={idx}
												variant="outline"
												className="border-border/40 text-xs"
											>
												{tag}
											</Badge>
										),
									)
								) : (
									<p className="text-sm text-muted-foreground">
										No tags added yet
									</p>
								)}
							</div>
						)}
					</div>

					{/* Interests */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Interests
						</label>
						{editing ? (
							<div>
								<Input
									value={form.interests.join(", ")}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											interests: e.target.value.split(",").map((i) => i.trim()),
										}))
									}
									placeholder="Machine Learning, NFTs, Gaming, etc."
									className="border-border/40"
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									Separate interests with commas
								</p>
							</div>
						) : (
							<div className="flex flex-wrap gap-2">
								{((profile as any).interests || []).length > 0 ? (
									((profile as any).interests || []).map(
										(interest: string, idx: number) => (
											<Badge
												key={idx}
												variant="outline"
												className="border-border/40 text-xs"
											>
												{interest}
											</Badge>
										),
									)
								) : (
									<p className="text-sm text-muted-foreground">
										No interests added yet
									</p>
								)}
							</div>
						)}
					</div>

					{/* Specialties */}
					<div className="space-y-1.5">
						<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							Specialties
						</label>
						{editing ? (
							<div>
								<Input
									value={form.specialties.join(", ")}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											specialties: e.target.value
												.split(",")
												.map((s) => s.trim()),
										}))
									}
									placeholder="Smart Contracts, UI Design, Technical Writing, etc."
									className="border-border/40"
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									Separate specialties with commas
								</p>
							</div>
						) : (
							<div className="flex flex-wrap gap-2">
								{((profile as any).specialties || []).length > 0 ? (
									((profile as any).specialties || []).map(
										(specialty: string, idx: number) => (
											<Badge
												key={idx}
												variant="outline"
												className="border-border/40 text-xs"
											>
												{specialty}
											</Badge>
										),
									)
								) : (
									<p className="text-sm text-muted-foreground">
										No specialties added yet
									</p>
								)}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Agentic Context Preferences */}
			<Card className="border-border/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
						Agentic Context Preferences
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Opt-in toggle */}
					<div className="flex items-center justify-between gap-4">
						<div className="flex-1">
							<label className="text-sm font-medium">
								Enable Context-Aware Agent
							</label>
							<p className="text-xs text-muted-foreground mt-0.5">
								Allow agent to use your profile, posts, and news for
								personalized responses
							</p>
						</div>
						{editing ? (
							<Switch
								checked={form.agentic_context_opt_in}
								onCheckedChange={(checked) =>
									setForm((f) => ({ ...f, agentic_context_opt_in: checked }))
								}
							/>
						) : (
							<Badge
								variant={
									(profile as any).agentic_context_opt_in
										? "default"
										: "outline"
								}
								className="text-xs"
							>
								{(profile as any).agentic_context_opt_in
									? "Enabled"
									: "Disabled"}
							</Badge>
						)}
					</div>

					{/* News preferences (conditionally shown) */}
					{(editing
						? form.agentic_context_opt_in
						: (profile as any).agentic_context_opt_in) && (
						<>
							<div className="flex items-center justify-between gap-4 pt-2 border-t border-border/40">
								<div className="flex-1">
									<label className="text-sm font-medium">
										Enable News Digests
									</label>
									<p className="text-xs text-muted-foreground mt-0.5">
										Receive curated news based on your interests
									</p>
								</div>
								{editing ? (
									<Switch
										checked={form.news_enabled}
										onCheckedChange={(checked) =>
											setForm((f) => ({ ...f, news_enabled: checked }))
										}
									/>
								) : (
									<Badge
										variant={
											(profile as any).news_enabled ? "default" : "outline"
										}
										className="text-xs"
									>
										{(profile as any).news_enabled ? "Enabled" : "Disabled"}
									</Badge>
								)}
							</div>

							{(editing
								? form.news_enabled
								: (profile as any).news_enabled) && (
								<>
									{/* News Topics */}
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
											News Topics
										</label>
										{editing ? (
											<div>
												<Input
													value={form.news_topics.join(", ")}
													onChange={(e) =>
														setForm((f) => ({
															...f,
															news_topics: e.target.value
																.split(",")
																.map((t) => t.trim())
																.filter((t) => t),
														}))
													}
													placeholder="AI, Web3, DeFi, NFTs, Gaming, etc."
													className="border-border/40"
												/>
												<p className="mt-1 text-xs text-muted-foreground">
													Separate topics with commas
												</p>
											</div>
										) : (
											<div className="flex flex-wrap gap-2">
												{((profile as any).news_topics || []).length > 0 ? (
													((profile as any).news_topics || []).map(
														(topic: string, idx: number) => (
															<Badge
																key={idx}
																variant="outline"
																className="border-border/40 text-xs"
															>
																{topic}
															</Badge>
														),
													)
												) : (
													<p className="text-sm text-muted-foreground">
														No topics selected
													</p>
												)}
											</div>
										)}
									</div>

									{/* Digest Cadence */}
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
											Digest Cadence
										</label>
										{editing ? (
											<Select
												value={form.news_cadence}
												onValueChange={(value: "hourly" | "daily" | "weekly") =>
													setForm((f) => ({ ...f, news_cadence: value }))
												}
											>
												<SelectTrigger className="border-border/40">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="hourly">Hourly</SelectItem>
													<SelectItem value="daily">Daily</SelectItem>
													<SelectItem value="weekly">Weekly</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<p className="text-sm text-muted-foreground capitalize">
												{(profile as any).news_cadence || "daily"}
											</p>
										)}
									</div>
								</>
							)}
						</>
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
								onChange={(e) =>
									setForm((f) => ({ ...f, prompt_template: e.target.value }))
								}
								className="border-border/40"
							/>
							{errors.prompt_template && (
								<p className="mt-1 text-xs text-destructive">
									{errors.prompt_template}
								</p>
							)}
						</div>
					) : (
						<p className="text-sm leading-relaxed font-mono text-muted-foreground">
							{profile.prompt_template}
						</p>
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
								Connect your X account to verify ownership
							</p>
						</div>
						<Button size="sm" disabled={verifyingX} onClick={handleVerifyX}>
							{verifyingX ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<XIcon className="mr-2 h-4 w-4" />
							)}
							{verifyingX ? "Verifying..." : "Verify with X"}
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
			<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<span className="text-xs font-medium">{value}</span>
		</div>
	);
}
