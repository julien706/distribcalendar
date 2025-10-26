import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
};

const STATUS_LABELS = {
  pending: "En attente",
  done: "Fait",
  retry_first: "À repasser 1ère fois",
  retry_second: "À repasser 2ème fois",
  refused: "Refus",
  uninhabited: "Inhabité",
};

const STATUS_VARIANTS = {
  pending: "secondary",
  done: "default",
  retry_first: "outline",
  retry_second: "outline",
  refused: "destructive",
  uninhabited: "secondary",
} as const;

export default function AddressList({ onSelectAddress }: { onSelectAddress: (address: Address) => void }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | null>(null);
  const [streetFilter, setStreetFilter] = useState<string | null>(null);
  const [streets, setStreets] = useState<string[]>([]);

  const fetchAddresses = async () => {
    setLoading(true);
    let query = supabase.from("addresses").select("*").order("street_name");

    if (filter) {
      query = query.eq("status", filter);
    }

    if (streetFilter) {
      query = query.eq("street_name", streetFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Erreur lors du chargement des adresses");
    } else {
      setAddresses(data || []);
      
      // Extract unique street names for filter
      if (!streetFilter) {
        const uniqueStreets = Array.from(new Set(data?.map(addr => addr.street_name) || [])).sort();
        setStreets(uniqueStreets);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAddresses();

    const channel = supabase
      .channel("addresses-list-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "addresses",
        },
        () => {
          fetchAddresses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, streetFilter]);

  const statusCounts = addresses.reduce((acc, addr) => {
    acc[addr.status] = (acc[addr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Adresses</h2>
        <Button size="icon" variant="outline" onClick={fetchAddresses}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Filtrer par statut</label>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filter === null ? "default" : "outline"}
              onClick={() => setFilter(null)}
            >
              Toutes ({addresses.length})
            </Button>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited")}
              >
                {label} ({statusCounts[key] || 0})
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Filtrer par rue</label>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={streetFilter === null ? "default" : "outline"}
              onClick={() => setStreetFilter(null)}
            >
              Toutes les rues
            </Button>
            {streets.slice(0, 10).map((street) => (
              <Button
                key={street}
                size="sm"
                variant={streetFilter === street ? "default" : "outline"}
                onClick={() => setStreetFilter(street)}
                className="text-xs"
              >
                {street}
              </Button>
            ))}
            {streets.length > 10 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled
              >
                +{streets.length - 10} autres
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement...
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucune adresse trouvée
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelectAddress(address)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {address.street_number || ""} {address.street_name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      <MapPin className="inline h-3 w-3 mr-1" />
                      {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                    </CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANTS[address.status as keyof typeof STATUS_VARIANTS] || "secondary"}>
                    {STATUS_LABELS[address.status as keyof typeof STATUS_LABELS]}
                  </Badge>
                </div>
              </CardHeader>
              {address.observations && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {address.observations}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
