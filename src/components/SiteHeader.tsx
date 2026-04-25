import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { CartDrawer } from "./CartDrawer";

const navItems = [
  { to: "/looks", label: "Looks" },
  { to: "/shop", label: "Shop" },
  { to: "/sale", label: "Sale", highlight: true },
  { to: "/anlass/buero", label: "Anlässe" },
  { to: "/marken", label: "Marken" },
  { to: "/magazin", label: "Magazin" },
];

export const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-all duration-300 ${
        scrolled ? "bg-background/85 backdrop-blur-md border-border" : "bg-background border-transparent"
      }`}
    >
      <div className="container-editorial flex h-24 items-center justify-between md:h-32">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium tracking-wide transition-colors ${
                  item.highlight
                    ? isActive
                      ? "text-destructive"
                      : "text-destructive/90 hover:text-destructive"
                    : isActive
                      ? "text-primary"
                      : "text-foreground/80 hover:text-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <CartDrawer />
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-secondary md:hidden"
            onClick={() => setOpen((s) => !s)}
            aria-label="Menü"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container-editorial flex flex-col gap-1 py-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};
