import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Heart, Menu, User, X } from "lucide-react";
import { Logo } from "./Logo";
import { CartDrawer } from "./CartDrawer";
import { GlobalSearch } from "./GlobalSearch";
import { TopTrustBar } from "./TopTrustBar";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";

const navItems = [
  { to: "/neuheiten", label: "New In" },
  { to: "/shop", label: "Shop" },
  { to: "/looks", label: "Looks" },
  { to: "/sale", label: "Sale", accent: true },
  { to: "/club", label: "Club" },
];

export const SiteHeader = () => {
  const { user } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-background">
      <TopTrustBar />

      {/* Brand-Zeile: Logo zentriert, Icons rechts, Burger links (Mobile) */}
      <div
        className={`border-b transition-all duration-300 ${
          scrolled ? "border-border" : "border-transparent"
        }`}
      >
        <div className="container-editorial relative flex h-28 items-center justify-between md:h-40">
          {/* Mobile Burger links */}
          <button
            className="inline-flex h-10 w-10 items-center justify-center text-foreground hover:bg-secondary md:hidden"
            onClick={() => setOpen((s) => !s)}
            aria-label="Menü"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo zentriert */}
          <Link
            to="/"
            aria-label="HATOFF Startseite"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center"
          >
            <Logo />
          </Link>

          {/* Icons rechts */}
          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch />
            <Link
              to="/wunschliste"
              aria-label="Wunschliste"
              className="relative inline-flex h-10 w-10 items-center justify-center text-foreground hover:bg-secondary"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              to={user ? "/club/mein-konto" : "/auth"}
              aria-label={user ? "Mein Konto" : "Anmelden"}
              className="inline-flex h-10 w-10 items-center justify-center text-foreground hover:bg-secondary"
            >
              <User className="h-5 w-5" />
            </Link>
            <CartDrawer />
          </div>
        </div>

        {/* Desktop-Nav: Zeile darunter, zentriert */}
        <nav
          className="hidden border-t border-border md:block"
          aria-label="Hauptnavigation"
        >
          <div className="container-editorial flex h-12 items-center justify-center gap-10">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-[13px] font-medium uppercase tracking-[0.12em] transition-colors ${
                    item.accent
                      ? "text-destructive hover:text-destructive/80"
                      : isActive
                        ? "text-primary"
                        : "text-foreground/85 hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container-editorial flex flex-col gap-1 py-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`px-2 py-3 text-base font-medium uppercase tracking-wide hover:bg-secondary ${
                  item.accent ? "text-destructive" : "text-foreground/90"
                }`}
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
