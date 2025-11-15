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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { MapPin, RefreshCw, Search, Building2, Home } from "lucide-react";
import { toast } from "sonner";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import StatisticsCard from "./StatisticsCard";
import { Input } from "./ui/input";
import { useAddressesWithApartments } from "@/hooks/useAddressesWithApartments";

type AddressOrApartment = {
  id: string;
  type: 'address' | 'apartment';
  // Champs communs
  street_name: string;
  street_number: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
  csv_data: any;
  // Champs spécifiques aux appartements
  apartment_name?: string;
  building_name?: string | null;
  parent_address_id?: string;
  // Champs spécifiques aux adresses
  is_building?: boolean | null;
  apartment_count?: number | null;
};

const STATUS_VARIANTS = {
  pending: "secondary",
  done: "default",
  retry_first: "outline",
  retry_second: "outline",
  refused: "destructive",
  uninhabited: "secondary",
} as const;

export default function AddressList({ onSelectAddress }: { onSelectAddress: (address: any) => void }) {
  const PAGE_SIZE = 100;
  const [addresses, setAddresses] = useState<AddressOrApartment[]>([]);
  const { data: stats } = useAddressesWithApartments();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | null>(null);
  const [streetFilter, setStreetFilter] = useState<string | null>(null);
  const [streets, setStreets] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchStreets = async () => {
    let allStreets: string[] = [];
    let start = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("addresses")
        .select("street_name")
        .order("street_name")
        .range(start, start + batchSize - 1);

      if (error) {
        toast.error("Erreur lors du chargement des rues");
        break;
      }

      if (data && data.length > 0) {
        allStreets = [...allStreets, ...data.map(addr => addr.street_name)];
        start += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    const uniqueStreets = Array.from(new Set(allStreets)).sort();
    setStreets(uniqueStreets);
  };

  const fetchCities = async () => {
    let allCities: string[] = [];
    let start = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("addresses")
        .select("city")
        .not("city", "is", null)
        .range(start, start + batchSize - 1);

      if (error) {
        toast.error("Erreur lors du chargement des villes");
        break;
      }

      if (data && data.length > 0) {
        const cities = data
          .map(addr => addr.city)
          .filter(Boolean);
        allCities = [...allCities, ...cities];
        start += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    const uniqueCities = Array.from(new Set(allCities)).sort();
    setCities(uniqueCities as string[]);
  };

  const fetchTotalCount = async () => {
    // Compter les adresses normales (pas des immeubles)
    let addressQuery = supabase
      .from("addresses")
      .select("*", { count: "exact", head: true })
      .eq("is_building", false);

    if (filter) addressQuery = addressQuery.eq("status", filter);
    if (streetFilter) addressQuery = addressQuery.eq("street_name", streetFilter);
    if (cityFilter) addressQuery = addressQuery.eq("city", cityFilter);
    if (debouncedSearch) {
      addressQuery = addressQuery.or(`street_name.ilike.%${debouncedSearch}%,street_number.ilike.%${debouncedSearch}%`);
    }

    const { count: normalCount } = await addressQuery;

    // Compter les appartements des immeubles
    let apartmentQuery = supabase
      .from('apartments')
      .select('id, address_id, status, addresses!inner(street_name, city)', { count: "exact", head: true });

    if (filter) apartmentQuery = apartmentQuery.eq("status", filter);
    if (streetFilter) apartmentQuery = apartmentQuery.eq("addresses.street_name", streetFilter);
    if (cityFilter) apartmentQuery = apartmentQuery.eq("addresses.city", cityFilter);

    const { count: apartmentCount } = await apartmentQuery;

    setTotalCount((normalCount || 0) + (apartmentCount || 0));
  };

  const fetchStatusCounts = async () => {
    const statuses = Object.keys(STATUS_CONFIG);
    const results = await Promise.all(
      statuses.map(async (s) => {
        // Compter adresses normales
        let addressQuery = supabase
          .from("addresses")
          .select("*", { count: "exact", head: true })
          .eq("status", s as any)
          .eq("is_building", false);

        if (streetFilter) addressQuery = addressQuery.eq("street_name", streetFilter);
        if (cityFilter) addressQuery = addressQuery.eq("city", cityFilter);
        if (debouncedSearch) {
          addressQuery = addressQuery.or(`street_name.ilike.%${debouncedSearch}%,street_number.ilike.%${debouncedSearch}%`);
        }

        const { count: normalCount } = await addressQuery;

        // Compter appartements
        let apartmentQuery = supabase
          .from('apartments')
          .select('id, address_id, status, addresses!inner(street_name, city)', { count: "exact", head: true })
          .eq("status", s as any);

        if (streetFilter) apartmentQuery = apartmentQuery.eq("addresses.street_name", streetFilter);
        if (cityFilter) apartmentQuery = apartmentQuery.eq("addresses.city", cityFilter);

        const { count: apartmentCount } = await apartmentQuery;

        return [s, (normalCount || 0) + (apartmentCount || 0)] as [string, number];
      })
    );

    setStatusCounts(Object.fromEntries(results));
  };
  const fetchAddresses = async (reset: boolean = false) => {
    if (reset) setLoading(true);

    const currentPage = reset ? 0 : page;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    // 1. Fetch addresses avec filtres
    let addressQuery = supabase
      .from("addresses")
      .select("*")
      .order("street_name")
      .range(start, end);

    if (streetFilter) addressQuery = addressQuery.eq("street_name", streetFilter);
    if (cityFilter) addressQuery = addressQuery.eq("city", cityFilter);
    if (debouncedSearch) {
      addressQuery = addressQuery.or(`street_name.ilike.%${debouncedSearch}%,street_number.ilike.%${debouncedSearch}%`);
    }

    const { data: addressesData, error: addrError } = await addressQuery;
    
    if (addrError) {
      toast.error("Erreur lors du chargement des adresses");
      if (reset) setLoading(false);
      return;
    }

    // 2. Fetch apartments pour ces adresses
    const addressIds = addressesData?.map(a => a.id) || [];
    const { data: apartmentsData } = await supabase
      .from('apartments')
      .select('*')
      .in('address_id', addressIds);

    // 3. Construire liste unifiée
    const unifiedList: AddressOrApartment[] = [];

    addressesData?.forEach(addr => {
      if (addr.is_building) {
        // Pour un immeuble, ajouter ses appartements
        const buildingApartments = apartmentsData?.filter(apt => apt.address_id === addr.id) || [];
        
        buildingApartments.forEach(apt => {
          // Appliquer filtre de statut
          if (!filter || apt.status === filter) {
            unifiedList.push({
              id: apt.id,
              type: 'apartment',
              street_name: addr.street_name,
              street_number: addr.street_number,
              city: addr.city,
              latitude: addr.latitude,
              longitude: addr.longitude,
              status: apt.status,
              observations: apt.observations,
              csv_data: addr.csv_data,
              apartment_name: apt.name,
              building_name: addr.building_name,
              parent_address_id: addr.id,
            });
          }
        });
      } else {
        // Pour une adresse normale, l'ajouter directement
        if (!filter || addr.status === filter) {
          unifiedList.push({
            id: addr.id,
            type: 'address',
            street_name: addr.street_name,
            street_number: addr.street_number,
            city: addr.city,
            latitude: addr.latitude,
            longitude: addr.longitude,
            status: addr.status,
            observations: addr.observations,
            csv_data: addr.csv_data,
            is_building: addr.is_building,
            apartment_count: addr.apartment_count,
          });
        }
      }
    });

    setAddresses((prev) => (reset ? unifiedList : [...prev, ...unifiedList]));
    setHasMore((addressesData?.length || 0) === PAGE_SIZE);
    if (reset) setLoading(false);
  };

  useEffect(() => {
    fetchStreets();
    fetchCities();
  }, []);

  useEffect(() => {
    // Reset pagination on filter changes
    setPage(0);
    setHasMore(true);
    setAddresses([]);
    fetchAddresses(true);
    fetchTotalCount();
    fetchStatusCounts();

    const addressChannel = supabase
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
          fetchStreets();
          fetchCities();
          fetchTotalCount();
          fetchStatusCounts();
        }
      )
      .subscribe();

    const apartmentChannel = supabase
      .channel("apartments-list-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "apartments",
        },
        () => {
          setPage(0);
          setHasMore(true);
          fetchAddresses(true);
          fetchTotalCount();
          fetchStatusCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(addressChannel);
      supabase.removeChannel(apartmentChannel);
    };
  }, [filter, streetFilter, cityFilter, debouncedSearch]);

  // Les compteurs par statut proviennent du backend (tous les résultats, pas seulement la page courante)
  // statusCounts est géré par l'état via fetchStatusCounts

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">Adresses</h2>
        <Button size="icon" variant="outline" onClick={() => { setPage(0); setHasMore(true); setAddresses([]); fetchAddresses(true); }} className="h-9 w-9">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <StatisticsCard 
        totalAddresses={stats?.effectiveTotal || totalCount} 
        statusCounts={stats?.statusCounts || statusCounts} 
      />

      <div className="space-y-3">
        <div>
          <label className="text-xs sm:text-sm font-medium mb-2 block">Rechercher une adresse</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Chercher par rue ou numéro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

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
                Toutes ({totalCount})
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
          <Select
            value={streetFilter || "all"}
            onValueChange={(value) => setStreetFilter(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une rue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les rues ({streets.length})</SelectItem>
              {streets.map((street) => (
                <SelectItem key={street} value={street}>
                  {street}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs sm:text-sm font-medium mb-2 block">Filtrer par ville</label>
          <Select
            value={cityFilter || "all"}
            onValueChange={(value) => setCityFilter(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une ville" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes ({cities.length})</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {addresses.map((item) => (
            <Card
              key={`${item.type}-${item.id}`}
              className="cursor-pointer hover:bg-accent/50 transition-colors touch-manipulation active:scale-[0.98]"
              onClick={() => onSelectAddress(item)}
            >
              <CardHeader className="pb-3 px-3 py-3 sm:px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      {/* Icône différenciée */}
                      {item.type === 'apartment' ? (
                        <Building2 className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      
                      {/* Nom de l'adresse */}
                      <span className="truncate">
                        {item.street_number || ""} {item.street_name}
                      </span>
                      
                      {/* Badge appartement */}
                      {item.type === 'apartment' && item.apartment_name && (
                        <Badge variant="outline" className="ml-1 text-xs shrink-0">
                          {item.apartment_name}
                        </Badge>
                      )}
                    </CardTitle>
                    
                    {/* Nom du bâtiment pour les appartements */}
                    {item.type === 'apartment' && item.building_name && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {item.building_name}
                      </div>
                    )}
                    
                    {/* Ville et coordonnées */}
                    <div className="text-xs mt-1 space-y-0.5 text-muted-foreground">
                      {item.city && (
                        <div className="truncate font-medium text-foreground/70">
                          {item.city}
                        </div>
                      )}
                      <div className="truncate">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Badge de statut */}
                  <Badge 
                    variant={STATUS_VARIANTS[item.status as keyof typeof STATUS_VARIANTS] || "secondary"}
                    className="shrink-0 text-xs"
                  >
                    {(() => {
                      const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];
                      if (config) {
                        const Icon = config.icon;
                        return (
                          <span className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            <span className="hidden sm:inline">{config.label}</span>
                          </span>
                        );
                      }
                      return item.status;
                    })()}
                  </Badge>
                </div>
              </CardHeader>
              {item.observations && (
                <CardContent className="pt-0 px-3 pb-3 sm:px-4">
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    {item.observations}
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
