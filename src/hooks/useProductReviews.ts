import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductReview {
  id: string;
  product_handle: string;
  user_id: string;
  reviewer_name: string;
  rating: number;
  title: string;
  body: string;
  size_purchased: string | null;
  size_fit: "small" | "true" | "large" | null;
  would_recommend: boolean;
  verified_purchase: boolean;
  status: string;
  created_at: string;
}

export interface ReviewStats {
  count: number;
  avg_rating: number;
  count_5: number;
  count_4: number;
  count_3: number;
  count_2: number;
  count_1: number;
  count_recommend: number;
}

export const useProductReviews = (productHandle: string | undefined) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!productHandle) return;
    setLoading(true);
    const [reviewsRes, statsRes] = await Promise.all([
      supabase
        .from("product_reviews")
        .select("*")
        .eq("product_handle", productHandle)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("product_review_stats" as never)
        .select("*")
        .eq("product_handle", productHandle)
        .maybeSingle(),
    ]);
    setReviews((reviewsRes.data as ProductReview[]) ?? []);
    setStats((statsRes.data as ReviewStats | null) ?? null);
    setLoading(false);
  }, [productHandle]);

  useEffect(() => {
    void load();
  }, [load]);

  return { reviews, stats, loading, reload: load };
};
