import { Link } from "react-router-dom";
import logoUrl from "@/assets/logo-hatoff.svg";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className = "" }: LogoProps) => (
  <Link
    to="/"
    className={`group inline-flex items-center ${className}`}
    aria-label="HATOFF Startseite"
  >
    <img
      src={logoUrl}
      alt="HATOFF"
      className="h-16 w-auto md:h-24 transition-opacity group-hover:opacity-80 dark:invert"
    />
  </Link>
);
