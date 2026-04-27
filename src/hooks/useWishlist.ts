import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface WishlistItem {
  id: string;
  product_handle: string;
  product_title: string;
  product_image: string | null;
  vendor: string | null;
  price_amount: number | null;
  price_currency: string | null;
  created_at: string;
}

export interface WishlistAddInput {
  productHandle: string;
  productTitle: string;
  productImage?: string | null;
  vendor?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
}

let cache: WishlistItem[] | null = null;
const listeners = new Set<(items: WishlistItem[]) => void>();

const setCache = (items: WishlistItem[]) => {
  cache = items;
  listeners.forEach((l) => l(items));
};

export function useWishlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>(cache ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const l = (next: WishlistItem[]) => setItems(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCache([]);
      return;
    }
    setLoading(true);
    supabase
      .from("wishlist_items")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setCache(data as WishlistItem[]);
        setLoading(false);
      });
  }, [user]);

  const has = useCallback(
    (handle: string) => items.some((i) => i.product_handle === handle),
    [items],
  );

  const add = useCallback(
    async (input: WishlistAddInput) => {
      if (!user) {
        toast.error("Bitte einloggen, um zur Wunschliste hinzuzufügen", {
          position: "top-right",
        });
        return false;
      }
      const optimistic: WishlistItem = {
        id: `tmp-${input.productHandle}`,
        product_handle: input.productHandle,
        product_title: input.productTitle,
        product_image: input.productImage ?? null,
        vendor: input.vendor ?? null,
        price_amount: input.priceAmount ?? null,
        price_currency: input.priceCurrency ?? null,
        created_at: new Date().toISOString(),
      };
      setCache([optimistic, ...(cache ?? [])]);

      const { data, error } = await supabase
        .from("wishlist_items")
        .insert({
          user_id: user.id,
          product_handle: input.productHandle,
          product_title: input.productTitle,
          product_image: input.productImage ?? null,
          vendor: input.vendor ?? null,
          price_amount: input.priceAmount ?? null,
          price_currency: input.priceCurrency ?? null,
        })
        .select()
        .single();

      if (error) {
        // revert
        setCache((cache ?? []).filter((i) => i.product_handle !== input.productHandle));
        toast.error("Konnte nicht gespeichert werden", { position: "top-right" });
        return false;
      }
      setCache([
        data as WishlistItem,
        ...(cache ?? []).filter((i) => i.product_handle !== input.productHandle),
      ]);
      return true;
    },
    [user],
  );

  const remove = useCallback(
    async (handle: string) => {
      if (!user) return false;
      const before = cache ?? [];
      setCache(before.filter((i) => i.product_handle !== handle));
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", user.id)
        .eq("product_handle", handle);
      if (error) {
        setCache(before);
        toast.error("Konnte nicht entfernt werden", { position: "top-right" });
        return false;
      }
      return true;
    },
    [user],
  );

  const toggle = useCallback(
    async (input: WishlistAddInput) => {
      if (has(input.productHandle)) {
        const ok = await remove(input.productHandle);
        if (ok) toast("Aus Wunschliste entfernt", { position: "top-right" });
        return false;
      }
      const ok = await add(input);
      if (ok) toast.success("In Wunschliste gespeichert", { position: "top-right" });
      return ok;
    },
    [has, add, remove],
  );

  return { items, loading, has, add, remove, toggle, count: items.length };
}
