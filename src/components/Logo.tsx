import logoUrl from "@/assets/logo-hatoff.svg";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className = "" }: LogoProps) => (
  <span
    className={`inline-flex items-center ${className}`}
    aria-label="HATOFF"
  >
    <img
      src={logoUrl}
      alt="HATOFF"
      className="h-20 w-auto md:h-28 transition-opacity hover:opacity-80 dark:invert"
      draggable={false}
    />
  </span>
);
