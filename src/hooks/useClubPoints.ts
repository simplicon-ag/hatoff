import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tierForPoints, nextTier, progressToNext } from "@/lib/club-tiers";

export const useClubPoints = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["club-points", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_points");
      if (error) throw error;
      const points = data ?? 0;
      return {
        points,
        tier: tierForPoints(points),
        next: nextTier(points),
        progress: progressToNext(points),
      };
    },
  });
};

export interface PointsLedgerEntry {
  id: string;
  points: number;
  reason: string;
  created_at: string;
  meta: Record<string, unknown>;
}

export const usePointsHistory = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["club-points-history", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PointsLedgerEntry[]> => {
      const { data, error } = await supabase
        .from("club_points_ledger")
        .select("id, points, reason, created_at, meta")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as PointsLedgerEntry[];
    },
  });
};
