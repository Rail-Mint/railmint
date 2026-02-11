import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import "@rainbow-me/rainbowkit/styles.css";

import { config } from "@/lib/wagmi";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Feed from "./pages/Feed";
import PostDetail from "./pages/PostDetail";
import Leaderboard from "./pages/Leaderboard";
import Rewards from "./pages/Rewards";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RainbowKitWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  const sharedTheme = {
    accentColor: 'hsl(45, 93%, 47%)',
    accentColorForeground: '#0f172a',
    borderRadius: 'large' as const,
    fontStack: 'rounded' as const,
    overlayBlur: 'small' as const,
  };

  return (
    <RainbowKitProvider theme={resolvedTheme === 'dark' ? darkTheme(sharedTheme) : lightTheme(sharedTheme)}>
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
            <BrowserRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/post/:id" element={<PostDetail />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/rewards" element={<Rewards />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </RainbowKitWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  </ThemeProvider>
);

export default App;
