import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AddressWithApartments = {
  id: string;
  street_name: string;
  street_number: string | null;
  status: string;
  is_building: boolean | null;
  apartment_count: number | null;
  zone_id: string | null;
  apartments?: Array<{
    id: string;
    status: string;
  }>;
};

export function useAddressesWithApartments() {
  return useQuery({
    queryKey: ['addresses-with-apartments'],
    queryFn: async () => {
      // Fetch addresses
      const { data: addresses, error: addrError } = await supabase
        .from("addresses")
        .select("id, street_name, street_number, status, is_building, apartment_count, zone_id");

      if (addrError) throw addrError;

      // Fetch all apartments
      const { data: apartments, error: aptError } = await supabase
        .from("apartments")
        .select("id, address_id, status");

      if (aptError) throw aptError;

      // Group apartments by address_id
      const apartmentsByAddress = apartments?.reduce((acc, apt) => {
        if (!acc[apt.address_id]) acc[apt.address_id] = [];
        acc[apt.address_id].push(apt);
        return acc;
      }, {} as Record<string, typeof apartments>) || {};

      // Attach apartments to addresses
      const addressesWithApts = addresses?.map(addr => ({
        ...addr,
        apartments: apartmentsByAddress[addr.id] || []
      })) || [];

      // Calculate totals
      const normalAddresses = addressesWithApts.filter(a => !a.is_building);
      const buildings = addressesWithApts.filter(a => a.is_building);
      const totalApartments = buildings.reduce((sum, b) => sum + (b.apartments?.length || 0), 0);
      const effectiveTotal = normalAddresses.length + totalApartments;

      // Calculate status counts (apartments counted individually)
      const statusCounts: Record<string, number> = {};
      
      normalAddresses.forEach(addr => {
        statusCounts[addr.status] = (statusCounts[addr.status] || 0) + 1;
      });

      buildings.forEach(building => {
        building.apartments?.forEach(apt => {
          statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
        });
      });

      return {
        addresses: addressesWithApts,
        normalCount: normalAddresses.length,
        buildingCount: buildings.length,
        apartmentCount: totalApartments,
        effectiveTotal,
        statusCounts
      };
    },
    staleTime: 1 * 60 * 1000,
  });
}
