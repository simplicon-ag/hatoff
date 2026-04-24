import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className = "" }: LogoProps) => (
  <Link to="/" className={`group inline-flex items-baseline gap-1 ${className}`} aria-label="HATOFF Startseite">
    <span className="font-display text-2xl tracking-tight text-foreground transition-colors group-hover:text-primary">
      HATOFF
    </span>
    <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">style</span>
  </Link>
);
