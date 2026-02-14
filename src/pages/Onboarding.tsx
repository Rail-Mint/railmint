import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Bot, CheckCircle2, Sparkles, Wand2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { keccak256, toHex } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { XIcon } from "@/components/ui/x-icon";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useToast } from "@/hooks/use-toast";
import { useRegisterCreator } from "@/hooks/useCreatorRegistry";
import { useContractStatus } from "@/hooks/useContractStatus";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
	x_handle: z
		.string()
		.min(1, "X handle is required")
		.regex(/^@?[\w]+$/, "Invalid handle"),
	clone_name: z.string().min(2, "Clone name must be at least 2 characters"),
	persona_text: z
		.string()
		.min(20, "Describe your persona in at least 20 characters"),
	prompt_template: z
		.string()
		.min(10, "Prompt template must be at least 10 characters"),
});

type FormValues = z.infer<typeof schema>;
type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const ONBOARDING_ANALYTICS_KEY = "railmindai.onboarding.analytics.v1";

const tonePresets = [
	{
		id: "strategist",
		label: "Strategist",
		description: "Data-backed, practical, market-aware",
		personaLead: "A sharp BNB ecosystem strategist",
	},
	{
		id: "builder",
		label: "Builder",
		description: "Hands-on, technical, implementation-focused",
		personaLead: "A practical Web3 builder",
	},
	{
		id: "educator",
		label: "Educator",
		description: "Clear explanations for broad audiences",
		personaLead: "A clear and trusted crypto educator",
	},
] as const;

const focusPresets = [
	{ id: "defi", label: "DeFi opportunities" },
	{ id: "security", label: "Security best practices" },
	{ id: "tooling", label: "Builder tooling and workflows" },
	{ id: "ecosystem", label: "BNB ecosystem updates" },
] as const;

const goalPresets = [
	{ id: "engage", label: "Engagement", desc: "Spark comments and shares" },
	{ id: "teach", label: "Education", desc: "Teach with clarity" },
	{
		id: "credibility",
		label: "Credibility",
		desc: "Build trust with evidence",
	},
] as const;

const activationPerks = [
	"Save this clone to your wallet profile",
	"Unlock studio and posting tools",
] as const;

interface StarterPack {
	id: string;
	label: string;
	description: string;
	toneId: string;
	focusId: string;
	goalId: string;
	note: string;
	cloneName: string;
	isCustom?: boolean;
}

const CUSTOM_STARTER_PACKS_KEY =
	"railmintai.onboarding.custom-starter-packs.v1";
const LEGACY_CUSTOM_STARTER_PACKS_KEY =
	"railmindai.onboarding.custom-starter-packs.v1";

const starterPacks: StarterPack[] = [
	{
		id: "defi-analyst",
		label: "DeFi Analyst",
		description: "Market-aware alpha and protocol breakdowns",
		toneId: "strategist",
		focusId: "defi",
		goalId: "credibility",
		note: "Prioritize concise protocol comparisons and risk awareness.",
		cloneName: "RailMint DeFi Analyst",
	},
	{
		id: "security-educator",
		label: "Security Educator",
		description: "Threat modeling and practical safety checklists",
		toneId: "educator",
		focusId: "security",
		goalId: "teach",
		note: "Always include one concrete defensive action.",
		cloneName: "RailMint Security Guide",
	},
	{
		id: "builder-operator",
		label: "Builder Operator",
		description: "Build logs, tooling tips, and workflow clarity",
		toneId: "builder",
		focusId: "tooling",
		goalId: "engage",
		note: "Keep examples implementation-first with measurable outcomes.",
		cloneName: "RailMint Builder Ops",
	},
];

type AnalyticsStep = 1 | 2 | 3;

interface OnboardingAnalytics {
	sessionsStarted: number;
	completed: number;
	stepViews: Record<AnalyticsStep, number>;
	exits: Record<AnalyticsStep, number>;
	updatedAt: string;
}

function defaultAnalytics(): OnboardingAnalytics {
	return {
		sessionsStarted: 0,
		completed: 0,
		stepViews: { 1: 0, 2: 0, 3: 0 },
		exits: { 1: 0, 2: 0, 3: 0 },
		updatedAt: new Date().toISOString(),
	};
}

function buildCloneProfile(
	toneId: string,
	focusId: string,
	goalId: string,
	customNote: string,
) {
	const tone = tonePresets.find((item) => item.id === toneId) ?? tonePresets[0];
	const focus =
		focusPresets.find((item) => item.id === focusId) ?? focusPresets[0];
	const goal = goalPresets.find((item) => item.id === goalId) ?? goalPresets[0];

	const noteSegment = customNote.trim()
		? ` Keep this nuance in voice: ${customNote.trim()}.`
		: "";

	const personaText = `${tone.personaLead} focused on ${focus.label.toLowerCase()}. Communicate in concise, high-signal language with actionable takeaways. Primary objective: ${goal.desc.toLowerCase()}.${noteSegment}`;

	const promptTemplate = `Write a high-quality post about {{topic}} for the BNB ecosystem. Tone: ${tone.label}. Focus: ${focus.label}. Objective: ${goal.label}. Include one concrete insight and one practical next step.`;

	return { personaText, promptTemplate };
}

export default function Onboarding() {
	const { address, isConnected } = useAccount();
	const { disconnect, disconnectAsync } = useDisconnect();
	const handleDisconnect = async () => {
		try {
			await disconnectAsync();
		} catch {
			disconnect();
		}
	};
	const { toast } = useToast();
	const { mode: contractMode } = useContractStatus();
	const {
		registerCreator,
		hash,
		isPending,
		isConfirming,
		isSuccess,
		isDeployed: contractsDeployed,
		error: web3Error,
	} = useRegisterCreator();

	const [step, setStep] = useState<OnboardingStep>(1);
	const [loading, setLoading] = useState(false);
	const [selectedTone, setSelectedTone] = useState<string>(tonePresets[0].id);
	const [selectedFocus, setSelectedFocus] = useState<string>(
		focusPresets[0].id,
	);
	const [selectedGoal, setSelectedGoal] = useState<string>(goalPresets[0].id);
	const [selectedPack, setSelectedPack] = useState<string>(starterPacks[0].id);
	const [customStarterPacks, setCustomStarterPacks] = useState<StarterPack[]>(
		[],
	);
	const [customPackName, setCustomPackName] = useState("");
	const [customPackDescription, setCustomPackDescription] = useState("");
	const [editingCustomPackId, setEditingCustomPackId] = useState<string | null>(
		null,
	);
	const [customNote, setCustomNote] = useState("");
	const [manualOverride, setManualOverride] = useState(false);
	const [, setAnalytics] = useState<OnboardingAnalytics>(defaultAnalytics);
	const [awaitingWallet, setAwaitingWallet] = useState(false);
	const [showCustomStyleForm, setShowCustomStyleForm] = useState(false);
	const [web3TxHash, setWeb3TxHash] = useState<string | undefined>(undefined);

	const viewedStepRef = useRef<Set<AnalyticsStep>>(new Set());
	const currentStepRef = useRef<OnboardingStep>(1);
	const completedRef = useRef(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			x_handle: "",
			clone_name: "",
			persona_text: "",
			prompt_template: "",
		},
	});

	const profileOutput = useMemo(
		() =>
			buildCloneProfile(selectedTone, selectedFocus, selectedGoal, customNote),
		[selectedTone, selectedFocus, selectedGoal, customNote],
	);

	const allStarterPacks = useMemo(
		() => [...starterPacks, ...customStarterPacks],
		[customStarterPacks],
	);

	useEffect(() => {
		if (manualOverride) return;
		form.setValue("persona_text", profileOutput.personaText, {
			shouldValidate: false,
			shouldDirty: true,
		});
		form.setValue("prompt_template", profileOutput.promptTemplate, {
			shouldValidate: false,
			shouldDirty: true,
		});
	}, [form, profileOutput, manualOverride]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const raw =
			window.localStorage.getItem(CUSTOM_STARTER_PACKS_KEY) ??
			window.localStorage.getItem(LEGACY_CUSTOM_STARTER_PACKS_KEY);
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw) as StarterPack[];
			if (Array.isArray(parsed)) {
				setCustomStarterPacks(
					parsed.filter(
						(item) =>
							typeof item?.id === "string" &&
							typeof item?.label === "string" &&
							typeof item?.toneId === "string" &&
							typeof item?.focusId === "string" &&
							typeof item?.goalId === "string",
					),
				);

				if (!window.localStorage.getItem(CUSTOM_STARTER_PACKS_KEY)) {
					window.localStorage.setItem(CUSTOM_STARTER_PACKS_KEY, raw);
				}
			}
		} catch {
			setCustomStarterPacks([]);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(
			CUSTOM_STARTER_PACKS_KEY,
			JSON.stringify(customStarterPacks),
		);
	}, [customStarterPacks]);

	const progressMap: Record<OnboardingStep, number> = {
		1: 25,
		2: 50,
		3: 75,
		4: 90,
		5: 100,
	};
	const progressValue = progressMap[step];
	const progressCheckpoints = [
		{ id: 1, label: "Basics" },
		{ id: 2, label: "Voice" },
		{ id: 3, label: "Review" },
		{ id: 4, label: "Login" },
	] as const;
	const activePackLabel =
		allStarterPacks.find((pack) => pack.id === selectedPack)?.label ??
		starterPacks[0].label;
	const activeToneLabel =
		tonePresets.find((preset) => preset.id === selectedTone)?.label ??
		tonePresets[0].label;
	const activeFocusLabel =
		focusPresets.find((preset) => preset.id === selectedFocus)?.label ??
		focusPresets[0].label;
	const activeGoalLabel =
		goalPresets.find((preset) => preset.id === selectedGoal)?.label ??
		goalPresets[0].label;
	const personaPreview = form.watch("persona_text");
	const promptPreview = form.watch("prompt_template");
	const countWords = (value: string) =>
		value.trim().split(/\s+/).filter(Boolean).length;
	const personaWordCount = countWords(personaPreview);
	const promptWordCount = countWords(promptPreview);
	const previewStatus =
		personaWordCount >= 20 && promptWordCount >= 10 ? "Ready to save" : "Draft";
	const shortAddress = address
		? `${address.slice(0, 6)}...${address.slice(-4)}`
		: "Guest mode";

	function applyStarterPack(
		packId: string,
		options?: { preserveEditing?: boolean },
	) {
		const pack = allStarterPacks.find((item) => item.id === packId);
		if (!pack) return;

		setSelectedPack(pack.id);
		setSelectedTone(pack.toneId);
		setSelectedFocus(pack.focusId);
		setSelectedGoal(pack.goalId);
		setCustomNote(pack.note);
		setManualOverride(false);
		if (!options?.preserveEditing) {
			setEditingCustomPackId(null);
		}

		const currentName = form.getValues("clone_name").trim();
		if (!currentName) {
			form.setValue("clone_name", pack.cloneName, {
				shouldDirty: true,
				shouldValidate: false,
			});
		}
	}

	function saveCustomStarterPack() {
		const trimmedName = customPackName.trim();
		if (trimmedName.length < 2) {
			toast({
				title: "Pack name required",
				description: "Use at least 2 characters for custom starter pack name.",
				variant: "destructive",
			});
			return;
		}

		const customPack: StarterPack = {
			id: editingCustomPackId ?? `custom-${Date.now()}`,
			label: trimmedName,
			description:
				customPackDescription.trim() || "Custom onboarding starter pack",
			toneId: selectedTone,
			focusId: selectedFocus,
			goalId: selectedGoal,
			note: customNote,
			cloneName: form.getValues("clone_name") || `${trimmedName} Clone`,
			isCustom: true,
		};

		setCustomStarterPacks((current) => {
			if (editingCustomPackId) {
				return current.map((item) =>
					item.id === editingCustomPackId ? customPack : item,
				);
			}
			return [customPack, ...current];
		});

		setSelectedPack(customPack.id);
		setEditingCustomPackId(null);
		setCustomPackName("");
		setCustomPackDescription("");

		toast({
			title: editingCustomPackId ? "Custom pack updated" : "Custom pack saved",
			description: `${customPack.label} is ready for one-click reuse.`,
		});
	}

	function beginEditCustomPack(packId: string) {
		const pack = customStarterPacks.find((item) => item.id === packId);
		if (!pack) return;

		setEditingCustomPackId(pack.id);
		setCustomPackName(pack.label);
		setCustomPackDescription(pack.description);
		setStep(2);
		applyStarterPack(pack.id, { preserveEditing: true });
	}

	function removeCustomPack(packId: string) {
		setCustomStarterPacks((current) =>
			current.filter((item) => item.id !== packId),
		);

		if (selectedPack === packId) {
			setSelectedPack(starterPacks[0].id);
			applyStarterPack(starterPacks[0].id);
		}

		if (editingCustomPackId === packId) {
			setEditingCustomPackId(null);
			setCustomPackName("");
			setCustomPackDescription("");
		}

		toast({
			title: "Custom pack deleted",
			description: "The custom starter pack has been removed.",
		});
	}

	function updateAnalytics(
		mutator: (current: OnboardingAnalytics) => OnboardingAnalytics,
	) {
		setAnalytics((current) => {
			const next = mutator({
				...current,
				stepViews: { ...current.stepViews },
				exits: { ...current.exits },
				updatedAt: new Date().toISOString(),
			});
			if (typeof window !== "undefined") {
				window.localStorage.setItem(
					ONBOARDING_ANALYTICS_KEY,
					JSON.stringify(next),
				);
			}
			return next;
		});
	}

	useEffect(() => {
		if (typeof window === "undefined") return;

		const raw = window.localStorage.getItem(ONBOARDING_ANALYTICS_KEY);
		if (!raw) {
			updateAnalytics((current) => ({
				...current,
				sessionsStarted: current.sessionsStarted + 1,
			}));
			viewedStepRef.current.add(1);
			updateAnalytics((current) => {
				current.stepViews[1] += 1;
				return current;
			});
			return;
		}

		try {
			const parsed = JSON.parse(raw) as OnboardingAnalytics;
			setAnalytics({
				...defaultAnalytics(),
				...parsed,
				stepViews: {
					...defaultAnalytics().stepViews,
					...(parsed.stepViews ?? {}),
				},
				exits: {
					...defaultAnalytics().exits,
					...(parsed.exits ?? {}),
				},
			});
		} catch {
			setAnalytics(defaultAnalytics());
		}

		updateAnalytics((current) => ({
			...current,
			sessionsStarted: current.sessionsStarted + 1,
		}));
		viewedStepRef.current.add(1);
		updateAnalytics((current) => {
			current.stepViews[1] += 1;
			return current;
		});
	}, []);

	useEffect(() => {
		currentStepRef.current = step;

		if (step >= 1 && step <= 3) {
			const analyticStep = step as AnalyticsStep;
			if (!viewedStepRef.current.has(analyticStep)) {
				viewedStepRef.current.add(analyticStep);
				updateAnalytics((current) => {
					current.stepViews[analyticStep] += 1;
					return current;
				});
			}
		}
	}, [step]);

	useEffect(
		() => () => {
			if (completedRef.current) return;

			const currentStep = currentStepRef.current;
			if (currentStep >= 1 && currentStep <= 3) {
				const analyticStep = currentStep as AnalyticsStep;
				const raw = window.localStorage.getItem(ONBOARDING_ANALYTICS_KEY);
				let current = defaultAnalytics();
				if (raw) {
					try {
						current = {
							...current,
							...JSON.parse(raw),
						};
					} catch {
						current = defaultAnalytics();
					}
				}

				current.exits[analyticStep] = (current.exits[analyticStep] ?? 0) + 1;
				current.updatedAt = new Date().toISOString();
				window.localStorage.setItem(
					ONBOARDING_ANALYTICS_KEY,
					JSON.stringify(current),
				);
			}
		},
		[],
	);

	async function moveNext() {
		if (step === 1) {
			const valid = await form.trigger(["x_handle", "clone_name"]);
			if (!valid) return;
			setStep(2);
			return;
		}

		if (step === 2) {
			const valid = await form.trigger(["persona_text", "prompt_template"]);
			if (!valid) return;
			setStep(3);
		}
	}

	function moveBack() {
		if (step <= 1) return;
		if (step === 5) {
			setStep(3);
			return;
		}
		setStep((current) => (current - 1) as OnboardingStep);
	}

	async function handleSave() {
		if (!address) {
			setAwaitingWallet(true);
			setStep(4);
			toast({
				title: "One step left",
				description: "Connect your wallet to activate this clone.",
			});
			return;
		}

		const values = form.getValues();
		const valid = await form.trigger();
		if (!valid) return;

		setLoading(true);
		try {
			setAwaitingWallet(false);
			const handle = values.x_handle.startsWith("@")
				? values.x_handle
				: `@${values.x_handle}`;

			// Generate profile hash from creator data
			const profileData = JSON.stringify({
				clone_name: values.clone_name,
				persona_text: values.persona_text,
				prompt_template: values.prompt_template,
			});
			const profileHash = keccak256(toHex(profileData));

			// Attempt Web3 registration only if contracts are deployed
			if (contractsDeployed) {
				try {
					await registerCreator(handle, profileHash);
					toast({
						title: "Transaction pending",
						description: "Please confirm the transaction in your wallet...",
					});
					if (hash) {
						setWeb3TxHash(hash);
					}
				} catch (web3Err) {
					console.error("Web3 registration failed:", web3Err);
					toast({
						title: "Blockchain registration failed",
						description: "Falling back to database registration only.",
						variant: "destructive",
					});
				}
			} else {
				console.info("[Onboarding] Contracts not deployed, skipping on-chain registration");
			}

			// Always save to Supabase as fallback/backup
			const { error } = await supabase.from("creators").upsert(
				{
					wallet_address: address,
					x_handle: handle,
					clone_name: values.clone_name,
					persona_text: values.persona_text,
					prompt_template: values.prompt_template,
				},
				{ onConflict: "wallet_address" },
			);

			if (error) throw error;

			completedRef.current = true;
			updateAnalytics((current) => ({
				...current,
				completed: current.completed + 1,
			}));

			setStep(5);
			toast({
				title: "Clone created",
				description: web3TxHash
					? `Your AI clone is ready. Transaction: ${web3TxHash.slice(0, 10)}...`
					: "Your AI clone is ready to generate content.",
			});
		} catch (error: unknown) {
			const description =
				error instanceof Error
					? error.message
					: "Could not save clone right now.";
			toast({
				title: "Error",
				description,
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (awaitingWallet && isConnected && !loading) {
			void handleSave();
		}
	}, [awaitingWallet, isConnected, loading]);

	if (step === 4) {
		return (
			<div className="container px-4 py-12 sm:py-16">
				<div className="mx-auto max-w-4xl rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background/90 to-amber-50/35 p-6 text-center shadow-[0_25px_70px_-40px_rgba(245,158,11,0.75)] sm:p-8">
					<p className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
						<Sparkles className="h-3 w-3" /> Secure Activation
					</p>
					<h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
						One Last Tap to Activate
					</h1>
					<p className="mx-auto max-w-2xl text-muted-foreground">
						Your clone <strong>{form.getValues("clone_name")}</strong> is ready.
						Connect wallet login to save and unlock your studio.
					</p>

					{isPending && (
						<div className="mx-auto mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600">
							⏳ Transaction pending - please confirm in your wallet...
						</div>
					)}

					{isConfirming && (
						<div className="mx-auto mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-600">
							⏳ Confirming transaction on blockchain...
						</div>
					)}

					{isSuccess && web3TxHash && (
						<div className="mx-auto mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-600">
							✅ Blockchain registration successful!
							<a
								href={`https://testnet.bscscan.com/tx/${web3TxHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className="ml-2 underline"
							>
								View transaction
							</a>
						</div>
					)}

					{web3Error && (
						<div className="mx-auto mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">
							⚠️ Web3 registration failed: {web3Error.message}
							<br />
							<span className="text-xs">
								Falling back to database registration...
							</span>
						</div>
					)}

					<div className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-2 text-sm">
						{activationPerks.map((perk) => (
							<p
								key={perk}
								className="inline-flex items-center gap-2 text-center"
							>
								<CheckCircle2 className="h-4 w-4 text-primary" />
								<span>{perk}</span>
							</p>
						))}
					</div>
					<div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
						<ConnectWalletButton label="Login & Activate Clone" />
						<Button
							variant="outline"
							onClick={() => setStep(3)}
							className="w-full sm:w-auto"
						>
							Back to Review
						</Button>
					</div>
				</div>
			</div>
		);
	}

	if (step === 5) {
		return (
			<div className="container px-4 py-12 sm:py-16">
				<div className="mx-auto max-w-4xl rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background/90 to-amber-50/30 p-6 text-center shadow-[0_25px_70px_-40px_rgba(245,158,11,0.7)] sm:p-8">
					<CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-primary" />
					<h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
						Clone Ready
					</h1>
					<p className="mx-auto mb-6 max-w-2xl text-muted-foreground">
						Your clone <strong>{form.getValues("clone_name")}</strong> is active
						and synced to <strong>{shortAddress}</strong>.
					</p>

					{web3TxHash && (
						<div className="mx-auto mb-4 max-w-2xl rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
							<p className="font-semibold text-green-700">
								✅ Registered on blockchain
							</p>
							<a
								href={`https://testnet.bscscan.com/tx/${web3TxHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-1 inline-block text-xs text-green-600 underline hover:text-green-700"
							>
								View transaction: {web3TxHash.slice(0, 10)}...
								{web3TxHash.slice(-8)}
							</a>
						</div>
					)}

					<div className="mb-6 grid gap-2 rounded-2xl border border-border/70 bg-background/75 p-4 text-sm sm:grid-cols-3">
						<p>Profile saved</p>
						<p>Voice preset applied</p>
						<p>Studio unlocked</p>
					</div>
					<div className="flex flex-col justify-center gap-3 sm:flex-row">
						<Button asChild className="w-full sm:w-auto">
							<Link to="/studio">Open Studio</Link>
						</Button>
						<Button
							variant="outline"
							onClick={() => setStep(1)}
							className="w-full sm:w-auto"
						>
							Edit Setup
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container px-4 py-8 sm:py-12">
			<div className="mx-auto max-w-6xl">
				<div className="mb-6 rounded-3xl border border-border/70 bg-gradient-to-br from-background/95 via-background/90 to-amber-50/35 p-5 shadow-[0_22px_60px_-30px_rgba(245,158,11,0.55)] sm:p-7">
					<div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
						<div>
							<p className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
								<Sparkles className="h-3 w-3" /> Guided Setup
							</p>
							<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
								Launch Your Creator Clone
							</h1>
							<p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
								A clean 3-step flow: identity, voice, and activation. No wallet
								needed until the final step.
							</p>
						</div>
						<div className="rounded-2xl border border-border/70 bg-background/80 p-4">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p className="text-sm font-semibold">Session status</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{isConnected
											? "Wallet connected. You can activate instantly after review."
											: "Guest mode. Complete setup first, then login once to activate."}
									</p>
								</div>
								{isConnected ? (
									<button
										type="button"
										onClick={handleDisconnect}
										className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20"
									>
										Disconnect
									</button>
								) : null}
							</div>
							<div className="mt-3 flex items-center gap-2">
								<Badge variant="outline">Step {Math.min(step, 4)} of 4</Badge>
							</div>
						</div>
					</div>
					<div className="mt-6 flex items-center justify-between">
						<div className="flex w-full items-center">
							{progressCheckpoints.map((checkpoint, index) => {
								const isActive = step === checkpoint.id;
								const isCompleted = step > checkpoint.id;
								return (
									<div key={checkpoint.id} className="flex flex-1 items-center">
										<div className="flex flex-col items-center">
											<div
												className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
													isCompleted
														? "bg-primary text-primary-foreground"
														: isActive
															? "border-2 border-primary bg-primary/10 text-primary"
															: "border-2 border-muted-foreground/30 bg-background text-muted-foreground"
												}`}
											>
												{isCompleted ? (
													<svg
														className="h-4 w-4"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={3}
															d="M5 13l4 4L19 7"
														/>
													</svg>
												) : (
													checkpoint.id
												)}
											</div>
											<span
												className={`mt-2 text-xs font-medium ${
													isActive
														? "text-primary"
														: isCompleted
															? "text-foreground"
															: "text-muted-foreground"
												}`}
											>
												{checkpoint.label}
											</span>
										</div>
										{index < progressCheckpoints.length - 1 && (
											<div
												className={`mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300 ${
													isCompleted ? "bg-primary" : "bg-muted-foreground/20"
												}`}
											/>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</div>

				<Form {...form}>
					<motion.div
						key={`step-${step}`}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25 }}
					>
						{step === 1 ? (
							<Card className="border-border/70 bg-background/80 shadow-sm">
								<CardHeader className="flex flex-row items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Zap className="h-5 w-5 text-primary" />
									</div>
									<div>
										<CardTitle>Fast Setup</CardTitle>
										<CardDescription>
											Set your public identity, pick a preset, and move to
											preview.
										</CardDescription>
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<FormField
											control={form.control}
											name="x_handle"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="flex items-center gap-2">
														<XIcon className="h-4 w-4" />X Handle
													</FormLabel>
													<FormControl>
														<Input
															placeholder="@yourhandle"
															className="h-10"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="clone_name"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="flex items-center gap-2">
														<Bot className="h-4 w-4" />
														Clone Name
													</FormLabel>
													<FormControl>
														<Input
															placeholder="RailMint Strategist"
															className="h-10"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<Separator />

									<div>
										<div className="mb-2 flex items-center justify-between gap-2">
											<p className="text-sm font-medium">Starter Packs</p>
											<Badge variant="outline" className="text-[11px]">
												Recommended
											</Badge>
										</div>
										<p className="mb-2 text-xs text-muted-foreground">
											Choose one now. You can tune details in Voice Builder.
										</p>
										<div className="grid gap-2 sm:grid-cols-3">
											{allStarterPacks.map((pack) => (
												<button
													key={pack.id}
													type="button"
													onClick={() => applyStarterPack(pack.id)}
													className={`rounded-xl border px-3 py-2 text-left transition-colors ${
														selectedPack === pack.id
															? "border-primary/45 bg-primary/10"
															: "border-border/70 bg-background/70 hover:border-primary/30"
													}`}
												>
													<p className="text-sm font-semibold">
														{pack.label}
														{pack.isCustom ? (
															<span className="ml-1 rounded-full border border-primary/35 px-1.5 py-0.5 text-[10px] font-medium text-primary">
																Custom
															</span>
														) : null}
													</p>
													<p className="text-xs text-muted-foreground">
														{pack.description}
													</p>
												</button>
											))}

											<button
												type="button"
												onClick={() => {
													setSelectedPack("");
													setShowCustomStyleForm(true);
												}}
												className={`rounded-xl border-2 border-dashed px-3 py-2 text-left transition-colors ${
													showCustomStyleForm
														? "border-primary bg-primary/10"
														: "border-border/70 bg-background/70 hover:border-primary/50"
												}`}
											>
												<p className="text-sm font-semibold text-primary">
													+ Create Custom
												</p>
												<p className="text-xs text-muted-foreground">
													Design your own style
												</p>
											</button>
										</div>

										{showCustomStyleForm && (
											<div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
												<p className="mb-3 text-sm font-medium">
													Create Your Custom Style
												</p>
												<div className="space-y-3">
													<input
														type="text"
														placeholder="Style name (e.g., DeFi Alpha)"
														className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
														value={customPackName}
														onChange={(e) => setCustomPackName(e.target.value)}
													/>
													<div className="flex gap-2">
														<Button
															size="sm"
															onClick={() => {
																saveCustomStarterPack();
																setShowCustomStyleForm(false);
															}}
														>
															Create Style
														</Button>
														<Button
															size="sm"
															variant="outline"
															onClick={() => {
																setShowCustomStyleForm(false);
																setCustomPackName("");
															}}
														>
															Cancel
														</Button>
													</div>
												</div>
											</div>
										)}
									</div>

									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<div className="mb-2 flex items-center justify-between gap-2">
											<p className="text-sm font-medium">
												Custom Starter Packs
											</p>
											<Badge variant="outline" className="text-[11px]">
												{customStarterPacks.length} saved
											</Badge>
										</div>

										{customStarterPacks.length > 0 ? (
											<div className="grid gap-2 sm:grid-cols-2">
												{customStarterPacks.map((pack) => (
													<div
														key={`custom-${pack.id}`}
														className={`rounded-xl border p-3 transition-colors ${
															selectedPack === pack.id
																? "border-primary/45 bg-primary/10"
																: "border-border/70 bg-background/70"
														}`}
													>
														<button
															type="button"
															onClick={() => applyStarterPack(pack.id)}
															className="w-full text-left"
														>
															<p className="text-sm font-semibold">
																{pack.label}
															</p>
															<p className="text-xs text-muted-foreground">
																{pack.description}
															</p>
														</button>

														<div className="mt-2 flex items-center gap-2">
															<Button
																type="button"
																size="sm"
																variant="outline"
																onClick={() => beginEditCustomPack(pack.id)}
															>
																Edit
															</Button>
															<Button
																type="button"
																size="sm"
																variant="outline"
																className="border-destructive/35 text-destructive hover:bg-destructive/10"
																onClick={() => removeCustomPack(pack.id)}
															>
																Delete
															</Button>
														</div>
													</div>
												))}
											</div>
										) : (
											<div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
												No custom packs yet. Continue to{" "}
												<strong>Voice Builder</strong> and use
												<strong>Save as Custom Starter Pack</strong>.
											</div>
										)}

										<div className="mt-3 flex justify-end">
											<p className="text-xs text-muted-foreground">
												Tip: create or edit packs in Voice Builder, then reuse
												them here.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						) : null}

						{step === 2 ? (
							<div className="relative grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
								<div
									aria-hidden
									className="pointer-events-none absolute inset-x-10 -top-6 h-20 rounded-full bg-primary/20 blur-3xl"
								/>
								<Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-background/95 via-background/90 to-primary/5 shadow-[0_24px_60px_-40px_rgba(245,158,11,0.8)]">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Wand2 className="h-4 w-4 text-primary" /> Voice Builder
										</CardTitle>
										<CardDescription>
											Pick style presets. We auto-compose persona and prompt.
										</CardDescription>
										<Badge variant="outline" className="w-fit text-[11px]">
											Pack: {activePackLabel}
										</Badge>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3 sm:grid-cols-3">
											<div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
												<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													Tone
												</p>
												<p className="text-sm font-semibold">
													{activeToneLabel}
												</p>
											</div>
											<div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
												<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													Focus
												</p>
												<p className="text-sm font-semibold">
													{activeFocusLabel}
												</p>
											</div>
											<div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
												<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													Goal
												</p>
												<p className="text-sm font-semibold">
													{activeGoalLabel}
												</p>
											</div>
										</div>

										<div>
											<p className="mb-2 text-sm font-medium">Tone</p>
											<div className="grid gap-2 sm:grid-cols-3">
												{tonePresets.map((preset) => (
													<button
														key={preset.id}
														type="button"
														onClick={() => setSelectedTone(preset.id)}
														className={`rounded-xl border px-3 py-2 text-left transition-colors ${
															selectedTone === preset.id
																? "border-primary/45 bg-primary/10 shadow-[0_16px_35px_-24px_rgba(245,158,11,0.85)]"
																: "border-border/70 bg-background/70 hover:border-primary/30"
														}`}
													>
														<p className="text-sm font-semibold">
															{preset.label}
														</p>
														<p className="text-xs text-muted-foreground">
															{preset.description}
														</p>
													</button>
												))}
											</div>
										</div>

										<div>
											<p className="mb-2 text-sm font-medium">Primary Focus</p>
											<div className="grid gap-2 sm:grid-cols-2">
												{focusPresets.map((preset) => (
													<Button
														key={preset.id}
														type="button"
														variant={
															selectedFocus === preset.id
																? "default"
																: "outline"
														}
														onClick={() => setSelectedFocus(preset.id)}
														className="h-auto justify-start px-4 py-3"
													>
														{preset.label}
													</Button>
												))}
											</div>
										</div>

										<div>
											<p className="mb-2 text-sm font-medium">Primary Goal</p>
											<div className="grid gap-2 sm:grid-cols-3">
												{goalPresets.map((preset) => (
													<Button
														key={preset.id}
														type="button"
														variant={
															selectedGoal === preset.id ? "default" : "outline"
														}
														onClick={() => setSelectedGoal(preset.id)}
														className="h-auto px-4 py-3"
													>
														{preset.label}
													</Button>
												))}
											</div>
										</div>

										<FormItem>
											<FormLabel>Optional nuance</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Any extra tone hint? (optional)"
													rows={3}
													value={customNote}
													onChange={(event) =>
														setCustomNote(event.target.value)
													}
												/>
											</FormControl>
										</FormItem>

										<div className="rounded-xl border border-border/70 bg-background/70 p-3">
											<p className="mb-2 text-sm font-medium">
												Save as Custom Starter Pack
											</p>
											<div className="grid gap-2 sm:grid-cols-[1.2fr_1.6fr_auto]">
												<Input
													placeholder="Pack name"
													value={customPackName}
													onChange={(event) =>
														setCustomPackName(event.target.value)
													}
												/>
												<Input
													placeholder="Short description"
													value={customPackDescription}
													onChange={(event) =>
														setCustomPackDescription(event.target.value)
													}
												/>
												<Button
													type="button"
													variant="outline"
													onClick={saveCustomStarterPack}
												>
													{editingCustomPackId ? "Update" : "Save"}
												</Button>
											</div>
											<p className="mt-2 text-xs text-muted-foreground">
												Uses current tone/focus/goal and nuance selections.
											</p>
											{editingCustomPackId ? (
												<div className="mt-2 flex justify-end">
													<Button
														type="button"
														variant="ghost"
														onClick={() => {
															setEditingCustomPackId(null);
															setCustomPackName("");
															setCustomPackDescription("");
														}}
													>
														Cancel edit
													</Button>
												</div>
											) : null}
										</div>

										<Separator />

										<div className="space-y-3">
											<Button
												type="button"
												variant="ghost"
												onClick={() => setManualOverride((state) => !state)}
											>
												{manualOverride
													? "Hide Advanced"
													: "Show Advanced Editing"}
											</Button>

											{manualOverride ? (
												<div className="space-y-3">
													<FormField
														control={form.control}
														name="persona_text"
														render={({ field }) => (
															<FormItem>
																<FormLabel>Persona Text</FormLabel>
																<FormControl>
																	<Textarea
																		rows={4}
																		{...field}
																		onChange={(event) => {
																			setManualOverride(true);
																			field.onChange(event);
																		}}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>

													<FormField
														control={form.control}
														name="prompt_template"
														render={({ field }) => (
															<FormItem>
																<FormLabel>Prompt Template</FormLabel>
																<FormControl>
																	<Textarea
																		rows={3}
																		{...field}
																		onChange={(event) => {
																			setManualOverride(true);
																			field.onChange(event);
																		}}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>

													<Button
														type="button"
														variant="outline"
														onClick={() => {
															setManualOverride(false);
															form.setValue(
																"persona_text",
																profileOutput.personaText,
																{ shouldValidate: true },
															);
															form.setValue(
																"prompt_template",
																profileOutput.promptTemplate,
																{ shouldValidate: true },
															);
														}}
													>
														Rebuild from presets
													</Button>
												</div>
											) : null}
										</div>
									</CardContent>
								</Card>

								<Card className="border-primary/20 bg-gradient-to-br from-background/95 via-background/90 to-primary/5 shadow-[0_24px_60px_-40px_rgba(245,158,11,0.8)] xl:sticky xl:top-24">
									<CardHeader>
										<CardTitle>Live Clone Preview</CardTitle>
										<CardDescription>
											This is what will be saved and used for generation.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="grid gap-2 sm:grid-cols-3">
											<div className="rounded-lg border border-border/70 bg-background/80 p-2">
												<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													Persona
												</p>
												<p className="text-sm font-semibold">
													{personaWordCount} words
												</p>
											</div>
											<div className="rounded-lg border border-border/70 bg-background/80 p-2">
												<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													Prompt
												</p>
												<p className="text-sm font-semibold">
													{promptWordCount} words
												</p>
											</div>
											<div className="rounded-lg border border-border/70 bg-background/80 p-2">
												<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
													Status
												</p>
												<p className="text-sm font-semibold">{previewStatus}</p>
											</div>
										</div>

										<div className="rounded-xl border border-border/70 bg-background/70 p-3">
											<p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Persona
											</p>
											<p className="text-sm text-foreground">
												{personaPreview || "Persona preview appears here..."}
											</p>
										</div>

										<div className="rounded-xl border border-border/70 bg-background/70 p-3">
											<p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
												Prompt Template
											</p>
											<p className="text-sm text-foreground">
												{promptPreview ||
													"Prompt template preview appears here..."}
											</p>
										</div>
									</CardContent>
								</Card>
							</div>
						) : null}

						{step === 3 ? (
							<Card className="border-border/70 bg-background/80 shadow-sm">
								<CardHeader>
									<CardTitle>Final Review</CardTitle>
									<CardDescription>
										Confirm details, then create clone and continue to
										activation.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{!isConnected ? (
										<div className="rounded-xl border border-primary/35 bg-primary/10 p-3">
											<p className="text-sm font-semibold">Guest mode active</p>
											<p className="mt-1 text-sm text-muted-foreground">
												Create now, then login once on the next screen to
												activate.
											</p>
										</div>
									) : (
										<div className="rounded-xl border border-primary/35 bg-primary/10 p-3 text-sm text-muted-foreground">
											Wallet connected. Clone will activate immediately after
											save.
										</div>
									)}

									<div className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3 sm:grid-cols-2">
										<div>
											<p className="text-xs text-muted-foreground">X Handle</p>
											<p className="font-medium">{form.watch("x_handle")}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Clone Name
											</p>
											<p className="font-medium">{form.watch("clone_name")}</p>
										</div>
									</div>

									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Persona
										</p>
										<p className="text-sm">{form.watch("persona_text")}</p>
									</div>

									<div className="rounded-xl border border-border/70 bg-background/70 p-3">
										<p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Prompt Template
										</p>
										<p className="text-sm">{form.watch("prompt_template")}</p>
									</div>
								</CardContent>
							</Card>
						) : null}
					</motion.div>

					<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={moveBack}
							disabled={step === 1 || loading}
						>
							Back
						</Button>

						{step < 3 ? (
							<Button type="button" onClick={moveNext}>
								{step === 1 ? "Continue to Voice" : "Continue to Review"}
							</Button>
						) : (
							<Button type="button" onClick={handleSave} disabled={loading}>
								{loading ? "Saving..." : "Create Clone"}
							</Button>
						)}
					</div>
				</Form>
			</div>
		</div>
	);
}
