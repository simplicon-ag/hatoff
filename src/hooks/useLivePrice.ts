import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LivePrice {
  handle: string;
  brand: string;
  source_url: string | null;
  raw_price_eur: number | null;
  display_price_chf: number;
  original_price_eur: number | null;
  original_price_chf: number | null;
  on_sale: boolean;
  status: "ok" | "fallback" | "not_found";
  fetched_at: string;
}

// Modul-Cache: vermeidet mehrfache Requests pro Session
const memCache = new Map<string, LivePrice>();
const inflight = new Map<string, Promise<LivePrice | null>>();

/**
 * Lädt Live-Preise für eine Liste von Handles vom product-price Edge-Endpoint.
 * - Liest erst den DB-Cache (über die Edge-Function selbst — die fragt zuerst die Tabelle)
 * - Hält bereits geholte Preise in einem Modul-internen Cache
 */
async function fetchPrices(handles: string[]): Promise<LivePrice[]> {
  const missing = handles.filter((h) => !memCache.has(h));
  if (missing.length === 0) {
    return handles.map((h) => memCache.get(h)!).filter(Boolean);
  }

  // Bereits laufende Requests für einzelne Handles wiederverwenden
  const newOnes = missing.filter((h) => !inflight.has(h));

  if (newOnes.length > 0) {
    const promise = (async () => {
      const { data, error } = await supabase.functions.invoke("product-price", {
        body: { handles: newOnes },
      });
      if (error) throw error;
      const prices: LivePrice[] = data?.prices ?? [];
      for (const p of prices) memCache.set(p.handle, p);
      return prices;
    })();

    // Inflight-Marker für jeden Handle setzen
    for (const h of newOnes) {
      inflight.set(
        h,
        promise.then((arr) => arr.find((p) => p.handle === h) ?? null),
      );
    }
    // Nach Abschluss alle inflight-Einträge entfernen
    promise.finally(() => {
      for (const h of newOnes) inflight.delete(h);
    });
  }

  // Auf alle relevanten Inflights warten
  await Promise.all(missing.map((h) => inflight.get(h)).filter(Boolean));

  return handles.map((h) => memCache.get(h)!).filter(Boolean);
}

/**
 * Hook: Live-Preise für mehrere Produkt-Handles.
 * Gibt eine Map zurück: handle → LivePrice
 */
export function useLivePrices(handles: string[]) {
  const key = handles.join("|");
  const stableHandles = useMemo(() => handles, [key]);
  const [prices, setPrices] = useState<Record<string, LivePrice>>(() => {
    const out: Record<string, LivePrice> = {};
    for (const h of stableHandles) {
      const cached = memCache.get(h);
      if (cached) out[h] = cached;
    }
    return out;
  });
  const [loading, setLoading] = useState(() =>
    stableHandles.some((h) => !memCache.has(h)),
  );

  useEffect(() => {
    if (stableHandles.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(stableHandles.some((h) => !memCache.has(h)));
    fetchPrices(stableHandles)
      .then((arr) => {
        if (cancelled) return;
        const map: Record<string, LivePrice> = {};
        for (const p of arr) map[p.handle] = p;
        setPrices((prev) => ({ ...prev, ...map }));
      })
      .catch((err) => {
        console.warn("useLivePrices error", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { prices, loading };
}

/** Hook: Live-Preis für genau ein Produkt. */
export function useLivePrice(handle: string | undefined) {
  const handles = handle ? [handle] : [];
  const { prices, loading } = useLivePrices(handles);
  return { price: handle ? prices[handle] : undefined, loading };
}

/** Formatierung für die Anzeige. */
export function formatLivePrice(price?: LivePrice | null): string | null {
  if (!price) return null;
  return `CHF ${price.display_price_chf.toFixed(2)}`;
}

/** Formatierung des Originalpreises (UVP). */
export function formatOriginalPrice(price?: LivePrice | null): string | null {
  if (!price || !price.on_sale || price.original_price_chf == null) return null;
  return `CHF ${price.original_price_chf.toFixed(2)}`;
}

/** Rabatt in Prozent (gerundet), oder null wenn nicht im Sale. */
export function discountPercent(price?: LivePrice | null): number | null {
  if (!price || !price.on_sale || !price.original_price_chf) return null;
  const diff = price.original_price_chf - price.display_price_chf;
  if (diff <= 0) return null;
  return Math.round((diff / price.original_price_chf) * 100);
}
