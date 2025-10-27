import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusType } from "@/lib/statusConfig";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
  csv_data?: any | null;
  zone_id?: string | null;
  created_at?: string;
  updated_at?: string;
  last_visit_date?: string | null;
};

export function useAddresses(statusFilter?: StatusType[]) {
  return useQuery({
    queryKey: ['addresses', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("addresses")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Address[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });
}
