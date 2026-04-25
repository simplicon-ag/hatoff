import { useState } from "react";
import { Loader2, Sparkles, RotateCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsByHandles, type ShopifyProduct } from "@/lib/shopify";
import { LookSetBuilder } from "@/components/LookSetBuilder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  productHandle: string;
  productTitle: string;
}

interface GeneratedItem {
  handle: string;
  title: string;
  vendor: string;
  role: string;
  image: string | null;
}

interface GenerateResponse {
  rationale: string;
  anchor: { handle: string; title: string };
  items: GeneratedItem[];
}

const OCCASIONS = [
  { id: "business", label: "Business" },
  { id: "smart-casual", label: "Smart Casual" },
  { id: "casual", label: "Casual" },
  { id: "freizeit", label: "Freizeit" },
  { id: "abend", label: "Abend / Event" },
] as const;

type OccasionId = (typeof OCCASIONS)[number]["id"];

export const AiStyleGenerator = ({ productHandle, productTitle }: Props) => {
  const [occasion, setOccasion] = useState<OccasionId>("smart-casual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [setProducts, setSetProducts] = useState<ShopifyProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSetProducts([]);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<GenerateResponse>(
        "style-generator",
        { body: { productHandle, occasion } },
      );

      if (fnError) {
        // Try to read structured error message from response
        type FnErr = { context?: { json?: () => Promise<{ error?: string }> } };
        const ctx = (fnError as unknown as FnErr).context;
        let serverMsg: string | undefined;
        try {
          const parsed = await ctx?.json?.();
          serverMsg = parsed?.error;
        } catch {
          /* ignore */
        }
        throw new Error(serverMsg ?? fnError.message ?? "Generierung fehlgeschlagen");
      }
      if (!data) throw new Error("Keine Antwort erhalten");

      // Client-side safeguard: filter out anything that looks like an accessory
      // (belt, scarf, tie, cap, hat, socks, pocket square) — even if the model
      // ignored the prompt instruction.
      const ACCESSORY_RE = /(g[üu]rtel|belt|krawatte|fliege|tie|einstecktuch|m[üu]tze|cap|hut|schal|tuch|socke|sock)/i;
      const cleanedItems = data.items.filter(
        (i) => !ACCESSORY_RE.test(`${i.title} ${i.role}`),
      );
      if (cleanedItems.length < 2) {
        throw new Error("Zu wenig passende Stücke gefunden — bitte erneut generieren.");
      }
      const cleaned: GenerateResponse = { ...data, items: cleanedItems };

      // Fetch full Shopify product objects (incl. variants) for anchor + items
      const allHandles = [productHandle, ...cleaned.items.map((i) => i.handle)];
      const fullProducts = await fetchProductsByHandles(allHandles);
      if (fullProducts.length < 2) throw new Error("Produkte konnten nicht geladen werden");

      setResult(cleaned);
      setSetProducts(fullProducts);
      toast.success("Look generiert", { position: "top-right" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      toast.error("Stil-Generierung fehlgeschlagen", {
        description: msg,
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container-editorial border-t border-border py-16">
      <div className="rounded-lg border border-border bg-card p-6 md:p-10">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              AI Stylist
            </p>
            <h2 className="mt-1 font-display text-2xl md:text-3xl">
              Style mit diesem Stück
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Wähle einen Anlass — wir kombinieren <span className="font-medium text-foreground">{productTitle}</span> mit
              passenden Stücken aus dem Store zu einem kompletten Look.
            </p>
          </div>
        </div>

        {/* Occasion selector */}
        <div className="mt-6">
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Anlass
          </p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOccasion(o.id)}
                disabled={loading}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm transition-colors",
                  occasion === o.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary",
                  loading && "opacity-50",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate / regenerate button */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stylist arbeitet...
              </>
            ) : result ? (
              <>
                <RotateCw className="mr-2 h-4 w-4" />
                Anderen Style generieren
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Style generieren lassen
              </>
            )}
          </Button>
          {!result && !loading && !error && (
            <p className="text-xs text-muted-foreground">
              Dauert ca. 5–10 Sekunden.
            </p>
          )}
        </div>

        {error && !loading && (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && setProducts.length > 0 && !loading && (
          <div className="mt-8 space-y-6">
            <blockquote className="border-l-2 border-primary pl-4 text-sm italic leading-relaxed text-foreground/85">
              {result.rationale}
            </blockquote>

            {/* Role hints — small list */}
            <div className="flex flex-wrap gap-2">
              {result.items.map((it) => (
                <span
                  key={it.handle}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] uppercase tracking-wider text-foreground/75"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  {it.role}
                </span>
              ))}
            </div>

            <LookSetBuilder
              products={setProducts}
              lookTitle={`${productTitle} · ${OCCASIONS.find((o) => o.id === occasion)?.label}`}
            />
          </div>
        )}
      </div>
    </section>
  );
};
