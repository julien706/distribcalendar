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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { MapPin, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { STATUS_CONFIG } from "@/lib/statusConfig";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
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
  const PAGE_SIZE = 1000;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | null>(null);
  const [streetFilter, setStreetFilter] = useState<string | null>(null);
  const [streets, setStreets] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchAddresses = async (reset: boolean = false) => {
    if (reset) setLoading(true);

    const currentPage = reset ? 0 : page;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    let query = supabase.from("addresses").select("*").order("street_name").range(start, end);

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
      setAddresses((prev) => (reset ? (data || []) : [...prev, ...(data || [])]));
      setHasMore((data?.length || 0) === PAGE_SIZE);
      
      // Extract unique street names for filter on reset
      if (reset) {
        const uniqueStreets = Array.from(new Set((data || []).map(addr => addr.street_name))).sort();
        setStreets(uniqueStreets);
      }
    }
    if (reset) setLoading(false);
  };

  useEffect(() => {
    // Reset pagination on filter changes
    setPage(0);
    setHasMore(true);
    setAddresses([]);
    fetchAddresses(true);

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
          setPage(0);
          setHasMore(true);
          fetchAddresses(true);
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

  const handleDeleteAll = async () => {
    const { error } = await supabase.from("addresses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Toutes les adresses ont été supprimées");
      setAddresses([]);
      setStreets([]);
    }
  };

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">Adresses</h2>
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={() => { setPage(0); setHasMore(true); setAddresses([]); fetchAddresses(true); }} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="destructive" className="h-9 w-9">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer toutes les adresses ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Toutes les adresses et leur historique seront définitivement supprimés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer tout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs sm:text-sm font-medium mb-2 block">Filtrer par statut</label>
          <div className="overflow-x-auto pb-2 -mx-3 px-3">
            <div className="flex gap-2 min-w-max">
              <Button
                size="sm"
                variant={filter === null ? "default" : "outline"}
                onClick={() => setFilter(null)}
                className="h-8 text-xs whitespace-nowrap touch-manipulation"
              >
                Toutes ({addresses.length})
              </Button>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={filter === key ? "default" : "outline"}
                    onClick={() => setFilter(key as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited")}
                    className="h-8 text-xs gap-1 whitespace-nowrap touch-manipulation"
                  >
                    <Icon className="h-3 w-3" />
                    {config.label} ({statusCounts[key] || 0})
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs sm:text-sm font-medium mb-2 block">Filtrer par rue</label>
          <div className="overflow-x-auto pb-2 -mx-3 px-3">
            <div className="flex gap-2 min-w-max">
              <Button
                size="sm"
                variant={streetFilter === null ? "default" : "outline"}
                onClick={() => setStreetFilter(null)}
                className="h-8 text-xs whitespace-nowrap touch-manipulation"
              >
                Toutes les rues
              </Button>
              {streets.slice(0, 10).map((street) => (
                <Button
                  key={street}
                  size="sm"
                  variant={streetFilter === street ? "default" : "outline"}
                  onClick={() => setStreetFilter(street)}
                  className="h-8 text-xs whitespace-nowrap touch-manipulation"
                >
                  {street}
                </Button>
              ))}
              {streets.length > 10 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs whitespace-nowrap"
                  disabled
                >
                  +{streets.length - 10} autres
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Chargement...
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Aucune adresse trouvée
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors touch-manipulation active:scale-[0.98]"
              onClick={() => onSelectAddress(address)}
            >
              <CardHeader className="pb-3 px-3 py-3 sm:px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm sm:text-base truncate">
                      {address.street_number || ""} {address.street_name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 truncate">
                      <MapPin className="inline h-3 w-3 mr-1" />
                      {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                    </CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANTS[address.status as keyof typeof STATUS_VARIANTS] || "secondary"} className="shrink-0 text-xs">
                    {(() => {
                      const config = STATUS_CONFIG[address.status as keyof typeof STATUS_CONFIG];
                      if (config) {
                        const Icon = config.icon;
                        return (
                          <span className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            <span className="hidden sm:inline">{config.label}</span>
                          </span>
                        );
                      }
                      return address.status;
                    })()}
                  </Badge>
                </div>
              </CardHeader>
              {address.observations && (
                <CardContent className="pt-0 px-3 pb-3 sm:px-4">
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {address.observations}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}

          {hasMore && (
            <div className="pt-2 flex justify-center">
              <Button
                variant="outline"
                onClick={async () => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  await fetchAddresses(false);
                }}
                className="touch-manipulation"
              >
                Charger plus
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
