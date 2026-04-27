import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const SiteFooter = () => {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="container-editorial grid gap-12 py-16 md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <Logo />
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            HATOFF kuratiert komplette Looks für Männer, die wissen, was sie wollen — aber nicht jeden Tag eine
            Stunde im Schrank verbringen möchten.
          </p>
          <form
            className="flex max-w-md gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <Input type="email" required placeholder="Deine E-Mail" className="bg-background" />
            <Button type="submit" variant="default">
              Stil-Brief
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">Ein kurzer Brief pro Woche. Looks, Anlässe, Inspiration.</p>
        </div>

        <div className="space-y-3 text-sm">
          <h4 className="font-display text-base">Entdecken</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/looks" className="hover:text-primary">Alle Looks</Link></li>
            <li><Link to="/shop" className="hover:text-primary">Shop</Link></li>
            <li><Link to="/sale" className="hover:text-primary">Sale</Link></li>
            <li><Link to="/saison/fs-2026" className="hover:text-primary">F/S 2026</Link></li>
            <li><Link to="/saison/hw-2026" className="hover:text-primary">H/W 2026</Link></li>
            <li><Link to="/marken" className="hover:text-primary">Marken</Link></li>
            <li><Link to="/magazin" className="hover:text-primary">Magazin</Link></li>
          </ul>
        </div>

        <div className="space-y-3 text-sm">
          <h4 className="font-display text-base">Service</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/groessentabellen" className="hover:text-primary">Grössentabellen</Link></li>
          </ul>
        </div>

        {typeof window !== "undefined" && window.location.hostname.endsWith("lovable.app") && (
          <div className="md:col-span-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-4 text-[10px] tracking-wider text-muted-foreground/40">
              <Link to="/admin/import" className="hover:text-muted-foreground">Admin · Import</Link>
              <span aria-hidden="true">·</span>
              <Link to="/admin/looks" className="hover:text-muted-foreground">Looks</Link>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border">
        <div className="container-editorial flex flex-col items-start justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} HATOFF — Kuratiertes Männer-Outfit-Universum.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary">Impressum</a>
            <a href="#" className="hover:text-primary">Datenschutz</a>
            <a href="#" className="hover:text-primary">AGB</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
