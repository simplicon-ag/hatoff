import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { looks as staticLooks, type CuratedLook } from "@/data/looks";

export interface DbLookRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  welt: string | null;
  anlaesse: string[];
  product_handles: string[];
  anchor_handle: string | null;
  story: string | null;
  highlights: string[];
  hero_image_url: string | null;
  status: "draft" | "published" | "rejected";
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/** Convert a DB row into the same shape used by the rest of the app. */
function dbToCurated(row: DbLookRow): CuratedLook {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? "",
    welt: row.welt ?? "hemden",
    anlaesse: row.anlaesse ?? [],
    productHandles: row.product_handles ?? [],
    story: row.story ?? "",
    highlights: row.highlights ?? [],
    hero: row.hero_image_url ?? undefined,
  };
}

interface State {
  looks: CuratedLook[];
  loading: boolean;
}

/**
 * Returns merged list of:
 *   - DB looks with status='published' (newest first)
 *   - + statically curated looks from src/data/looks.ts
 *
 * DB-Slugs win over static slugs in case of collision.
 */
export function useCuratedLooks(): State {
  const [state, setState] = useState<State>({ looks: staticLooks, loading: true });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("curated_looks")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.warn("useCuratedLooks: failed to load DB looks", error);
        setState({ looks: staticLooks, loading: false });
        return;
      }
      const dbLooks = (data ?? []).map((r) => dbToCurated(r as DbLookRow));
      const dbSlugs = new Set(dbLooks.map((l) => l.slug));
      const merged = [...dbLooks, ...staticLooks.filter((l) => !dbSlugs.has(l.slug))];
      setState({ looks: merged, loading: false });
    })();
    return () => { active = false; };
  }, []);

  return state;
}
