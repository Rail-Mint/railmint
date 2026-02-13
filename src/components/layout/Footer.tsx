import { BrandMark } from "@/components/branding/BrandMark";

export function Footer() {
	return (
		<footer className="border-t border-border/70 bg-gradient-to-b from-secondary/20 to-secondary/35">
			<div className="container flex flex-col items-center justify-between gap-4 py-8 text-center text-sm text-muted-foreground md:flex-row md:text-left">
				<BrandMark showTagline className="justify-center md:justify-start" />
				<p>RailMintAI · Built on BNB Chain</p>
			</div>
		</footer>
	);
}
