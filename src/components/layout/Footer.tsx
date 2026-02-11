import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t bg-secondary/30">
      <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span className="text-primary">Creator</span>Rail AI
        </div>
        <nav className="flex gap-6">
          <Link to="/feed" className="hover:text-foreground transition-colors">Feed</Link>
          <Link to="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
          <Link to="/rewards" className="hover:text-foreground transition-colors">Rewards</Link>
        </nav>
        <p>Built on BNB Chain</p>
      </div>
    </footer>
  );
}
