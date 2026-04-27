import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type LikeState = { liked: boolean; count: number };

const cache = new Map<string, LikeState>();
const inflight = new Map<string, Promise<LikeState>>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(slug: string, state: LikeState) {
  cache.set(slug, state);
  emit();
}

async function fetchStatus(slug: string): Promise<LikeState> {
  const existing = inflight.get(slug);
  if (existing) return existing;
  const p = (async () => {
    const { data, error } = await supabase.functions.invoke("look-like", {
      body: { slug, action: "status" },
    });
    if (error) throw error;
    const next: LikeState = {
      liked: !!data?.liked,
      count: Number(data?.count ?? 0),
    };
    setState(slug, next);
    return next;
  })().finally(() => inflight.delete(slug));
  inflight.set(slug, p);
  return p;
}

async function toggleLike(slug: string): Promise<LikeState> {
  const current = cache.get(slug) ?? { liked: false, count: 0 };
  // optimistic
  const optimistic: LikeState = {
    liked: !current.liked,
    count: Math.max(0, current.count + (current.liked ? -1 : 1)),
  };
  setState(slug, optimistic);
  try {
    const { data, error } = await supabase.functions.invoke("look-like", {
      body: { slug, action: "toggle" },
    });
    if (error) throw error;
    const next: LikeState = {
      liked: !!data?.liked,
      count: Number(data?.count ?? 0),
    };
    setState(slug, next);
    return next;
  } catch (e) {
    // rollback
    setState(slug, current);
    toast.error("Like konnte nicht gespeichert werden");
    throw e;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLookLikes(slug: string | undefined) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (slug ? cache.get(slug) : undefined),
    () => undefined,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    if (cache.has(slug)) return;
    setLoading(true);
    fetchStatus(slug)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const toggle = useCallback(() => {
    if (!slug) return Promise.resolve();
    return toggleLike(slug).catch(() => {});
  }, [slug]);

  return {
    liked: snapshot?.liked ?? false,
    count: snapshot?.count ?? 0,
    loading,
    toggle,
  };
}
