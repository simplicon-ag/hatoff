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

// Coalescing: sammle Handle-Anfragen über kurze Zeitfenster und bündle sie
// in einen einzigen Edge-Function-Aufruf. Verhindert, dass z. B. 18 ProductCards
// auf einer Seite gleichzeitig 18 Edge-Calls auslösen → 503.
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let flushResolve: (() => void) | null = null;
const COALESCE_MS = 50;

function scheduleFlush(): Promise<void> {
  if (!flushPromise) {
    flushPromise = new Promise<void>((resolve) => {
      flushResolve = resolve;
    });
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(runFlush, COALESCE_MS);
  return flushPromise;
}

async function runFlush() {
  flushTimer = null;
  const handles = Array.from(pending);
  pending.clear();
  const resolve = flushResolve;
  flushPromise = null;
  flushResolve = null;
  if (handles.length === 0) {
    resolve?.();
    return;
  }
  // In Server-Batches à 4 splitten, parallel max. 2 Requests an den Edge schicken.
  const chunks: string[][] = [];
  for (let i = 0; i < handles.length; i += BATCH_SIZE) {
    chunks.push(handles.slice(i, i + BATCH_SIZE));
  }
  const REQUEST_CONCURRENCY = 2;
  for (let i = 0; i < chunks.length; i += REQUEST_CONCURRENCY) {
    const batch = chunks.slice(i, i + REQUEST_CONCURRENCY);
    await Promise.all(
      batch.map(async (chunk) => {
        try {
          const { data, error } = await supabase.functions.invoke("product-price", {
            body: { handles: chunk },
          });
          if (error) throw error;
          const rawPrices: LivePrice[] = data?.prices ?? [];
          for (const p of rawPrices) memCache.set(p.handle, normalizeLivePrice(p));
        } catch (err) {
          console.warn("product-price chunk failed", err);
        }
      }),
    );
  }
  resolve?.();
}

function normalizeLivePrice(price: LivePrice): LivePrice {
  return {
    ...price,
    // Sales werden ausschliesslich in Shopify (Variant compareAtPrice) gepflegt.
    // Der Brand-Scrape liefert weiterhin den CHF-Anzeigepreis, aber nie Sale-Status.
    on_sale: false,
    original_price_chf: null,
    original_price_eur: null,
  };
}

/**
 * Lädt Live-Preise für eine Liste von Handles vom product-price Edge-Endpoint.
 * - Chunkt grosse Listen in kleine Batches (max. 4 pro Request) — verhindert
 *   Edge-Function-Timeouts bei vielen unbekannten Handles.
 * - Hält bereits geholte Preise in einem Modul-internen Cache.
 * - Fehler werden geschluckt, damit ein einzelner Edge-Fehler die UI nicht crasht.
 */
const BATCH_SIZE = 4;

async function fetchPrices(handles: string[]): Promise<LivePrice[]> {
  const missing = handles.filter((h) => !memCache.has(h));
  if (missing.length === 0) {
    return handles.map((h) => memCache.get(h)!).filter(Boolean).map(normalizeLivePrice);
  }

  // Anfragen, die bereits laufen: deren Promise wiederverwenden
  const waitFor: Promise<unknown>[] = [];
  const newOnes: string[] = [];
  for (const h of missing) {
    const existing = inflight.get(h);
    if (existing) {
      waitFor.push(existing);
    } else {
      newOnes.push(h);
    }
  }

  if (newOnes.length > 0) {
    for (const h of newOnes) pending.add(h);
    const flushP = scheduleFlush();
    for (const h of newOnes) {
      const p = flushP.then(() => memCache.get(h) ?? null);
      inflight.set(h, p);
      p.finally(() => {
        if (inflight.get(h) === p) inflight.delete(h);
      });
      waitFor.push(p);
    }
  }

  await Promise.all(waitFor);

  return handles.map((h) => memCache.get(h)!).filter(Boolean).map(normalizeLivePrice);
}

/** Erzeugt einen synthetischen LivePrice aus einem gültigen Shopify-Preis. */
function shopifyAsLivePrice(handle: string, amount: number): LivePrice {
  return {
    handle,
    brand: "shopify",
    source_url: null,
    raw_price_eur: null,
    display_price_chf: amount,
    original_price_eur: null,
    original_price_chf: null,
    on_sale: false,
    status: "ok",
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Hook: Live-Preise für mehrere Produkt-Handles.
 * - Wenn `shopifyPrices[handle] > 0` übergeben wird, wird dieser Preis bevorzugt
 *   und kein Edge-Call ausgelöst (Shopify ist Source of Truth).
 * - Sonst wird der Preis von der Edge-Function (Brand-Scrape) geholt.
 * Gibt eine Map zurück: handle → LivePrice
 */
export function useLivePrices(
  handles: string[],
  shopifyPrices?: Record<string, number>,
) {
  const key = handles.join("|");
  const shopifyKey = shopifyPrices
    ? handles.map((h) => `${h}:${shopifyPrices[h] ?? ""}`).join("|")
    : "";
  const stableHandles = useMemo(() => handles, [key]);

  // Handles, die NICHT vom Shopify-Preis abgedeckt sind → brauchen Edge-Call
  const handlesNeedingFetch = useMemo(
    () =>
      stableHandles.filter((h) => {
        const sp = shopifyPrices?.[h];
        return !(typeof sp === "number" && sp > 0);
      }),
    [stableHandles, shopifyKey],
  );

  const buildInitial = (): Record<string, LivePrice> => {
    const out: Record<string, LivePrice> = {};
    for (const h of stableHandles) {
      const sp = shopifyPrices?.[h];
      if (typeof sp === "number" && sp > 0) {
        out[h] = shopifyAsLivePrice(h, sp);
        continue;
      }
      const cached = memCache.get(h);
      if (cached) out[h] = normalizeLivePrice(cached);
    }
    return out;
  };

  const [prices, setPrices] = useState<Record<string, LivePrice>>(buildInitial);
  const [loading, setLoading] = useState(() =>
    handlesNeedingFetch.some((h) => !memCache.has(h)),
  );

  useEffect(() => {
    // Shopify-Preise sofort einspielen (z. B. wenn Produkte später nachgeladen werden)
    setPrices((prev) => {
      const next = { ...prev };
      for (const h of stableHandles) {
        const sp = shopifyPrices?.[h];
        if (typeof sp === "number" && sp > 0) next[h] = shopifyAsLivePrice(h, sp);
      }
      return next;
    });

    if (handlesNeedingFetch.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(handlesNeedingFetch.some((h) => !memCache.has(h)));
    fetchPrices(handlesNeedingFetch)
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
  }, [key, shopifyKey]);

  return { prices, loading };
}

/** Hook: Live-Preis für genau ein Produkt. */
export function useLivePrice(handle: string | undefined, shopifyPrice?: number) {
  const handles = handle ? [handle] : [];
  const shopifyPrices =
    handle && typeof shopifyPrice === "number" ? { [handle]: shopifyPrice } : undefined;
  const { prices, loading } = useLivePrices(handles, shopifyPrices);
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
