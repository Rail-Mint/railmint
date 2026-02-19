import {
	darkTheme,
	lightTheme,
	RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { InlineLoader } from "@/components/ui/page-loader";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@rainbow-me/rainbowkit/styles.css";

import { AppLayout } from "@/components/layout/AppLayout";
import { config } from "@/lib/wagmi";

const Index = lazy(() => import("./pages/Index"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Feed = lazy(() => import("./pages/Feed"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Studio = lazy(() => import("./pages/Studio"));
const StudioOAuthCallback = lazy(() => import("./pages/StudioOAuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
	<div className="flex min-h-screen items-center justify-center">
		<InlineLoader label="Loading page..." />
	</div>
);

function RainbowKitWrapper({ children }: { children: React.ReactNode }) {
	const { resolvedTheme } = useTheme();

	const sharedTheme = {
		accentColor: "hsl(45, 93%, 47%)",
		accentColorForeground: "#0f172a",
		borderRadius: "large" as const,
		fontStack: "rounded" as const,
		overlayBlur: "small" as const,
	};

	return (
		<RainbowKitProvider
			theme={
				resolvedTheme === "dark"
					? darkTheme(sharedTheme)
					: lightTheme(sharedTheme)
			}
		>
			{children}
		</RainbowKitProvider>
	);
}

const App = () => (
	<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
		<WagmiProvider config={config}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitWrapper>
					<TooltipProvider>
						<Toaster />
						<Sonner />
						<BrowserRouter
							future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
						>
							<Suspense fallback={<RouteFallback />}>
								<Routes>
									<Route
										path="/studio/oauth-callback"
										element={<StudioOAuthCallback />}
									/>
									<Route path="/studio/*" element={<Studio />} />
									<Route element={<AppLayout />}>
										<Route path="/" element={<Index />} />
										<Route path="/onboarding" element={<Onboarding />} />
										<Route path="/feed" element={<Feed />} />
										<Route path="/post/:id" element={<PostDetail />} />
										<Route path="/leaderboard" element={<Leaderboard />} />
										<Route path="/rewards" element={<Rewards />} />
										<Route path="*" element={<NotFound />} />
									</Route>
								</Routes>
							</Suspense>
						</BrowserRouter>
					</TooltipProvider>
				</RainbowKitWrapper>
			</QueryClientProvider>
		</WagmiProvider>
	</ThemeProvider>
);

export default App;
