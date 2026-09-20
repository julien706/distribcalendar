import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign, Round } from "@/lib/campaign";

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return (data || []) as Campaign[];
    },
  });
}

export function useActiveCampaign() {
  return useQuery({
    queryKey: ["campaign-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return (data as Campaign) || null;
    },
  });
}

export function useOpenRound(campaignId?: string) {
  return useQuery({
    queryKey: ["round-open", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .eq("campaign_id", campaignId!)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as Round) || null;
    },
    refetchInterval: 60_000,
  });
}

export function useRoundTotals(roundId?: string) {
  return useQuery({
    queryKey: ["round-totals", roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("amount")
        .eq("round_id", roundId!);
      if (error) throw error;
      const total = (data || []).reduce((s, d: { amount: number }) => s + Number(d.amount), 0);
      return { total, count: data?.length || 0 };
    },
    refetchInterval: 30_000,
  });
}

export function useInvalidateCampaignData() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["campaigns"] });
    qc.invalidateQueries({ queryKey: ["campaign-active"] });
    qc.invalidateQueries({ queryKey: ["round-open"] });
    qc.invalidateQueries({ queryKey: ["round-totals"] });
    qc.invalidateQueries({ queryKey: ["campaign-balance"] });
  };
}
