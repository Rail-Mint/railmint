import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/branding/BrandMark';

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-gradient-to-b from-secondary/20 to-secondary/35">
      <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <BrandMark showTagline />
        <nav className="flex gap-6">
          <Link to="/feed" className="hover:text-foreground transition-colors">Feed</Link>
          <Link to="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
          <Link to="/rewards" className="hover:text-foreground transition-colors">Rewards</Link>
        </nav>
        <p>RailMindAI · Built on BNB Chain</p>
      </div>
    </footer>
  );
}
