import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route, Navigation, MapPin, Clock, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

type RouteOptimizerProps = {
  open: boolean;
  onClose: () => void;
  onRouteGenerated: (route: Address[]) => void;
  userLocation?: { lat: number; lng: number };
};

export default function RouteOptimizer({ open, onClose, onRouteGenerated, userLocation }: RouteOptimizerProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(new Set());
  const [optimizedRoute, setOptimizedRoute] = useState<Address[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPendingAddresses();
    }
  }, [open]);

  const fetchPendingAddresses = async () => {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("status", "pending")
      .order("street_name");

    if (error) {
      toast.error("Erreur lors du chargement des adresses");
      return;
    }

    setAddresses(data || []);
  };

  const toggleAddress = (id: string) => {
    const newSelected = new Set(selectedAddresses);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAddresses(newSelected);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const optimizeRoute = () => {
    setIsOptimizing(true);
    
    const selected = addresses.filter(addr => selectedAddresses.has(addr.id));
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins une adresse");
      setIsOptimizing(false);
      return;
    }

    // Nearest neighbor algorithm
    const route: Address[] = [];
    const remaining = [...selected];
    
    let currentPoint = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: selected[0].latitude, lng: selected[0].longitude };

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      remaining.forEach((addr, index) => {
        const distance = calculateDistance(
          currentPoint.lat,
          currentPoint.lng,
          addr.latitude,
          addr.longitude
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      const nearest = remaining[nearestIndex];
      route.push(nearest);
      currentPoint = { lat: nearest.latitude, lng: nearest.longitude };
      remaining.splice(nearestIndex, 1);
    }

    setOptimizedRoute(route);
    setIsOptimizing(false);
    toast.success(`Itinéraire optimisé avec ${route.length} adresses`);
  };

  const calculateTotalDistance = () => {
    if (optimizedRoute.length === 0) return 0;
    
    let total = 0;
    let prevPoint = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: optimizedRoute[0].latitude, lng: optimizedRoute[0].longitude };

    optimizedRoute.forEach(addr => {
      total += calculateDistance(prevPoint.lat, prevPoint.lng, addr.latitude, addr.longitude);
      prevPoint = { lat: addr.latitude, lng: addr.longitude };
    });

    return total.toFixed(2);
  };

  const applyRoute = () => {
    onRouteGenerated(optimizedRoute);
    toast.success("Itinéraire appliqué sur la carte");
    onClose();
  };

  const selectAll = () => {
    setSelectedAddresses(new Set(addresses.map(a => a.id)));
  };

  const deselectAll = () => {
    setSelectedAddresses(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Planification d'itinéraire
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll}>
                Tout sélectionner
              </Button>
              <Button size="sm" variant="outline" onClick={deselectAll}>
                Tout désélectionner
              </Button>
            </div>
            <Badge variant="secondary">
              {selectedAddresses.size} sélectionnée(s)
            </Badge>
          </div>

          {/* Address List */}
          {optimizedRoute.length === 0 ? (
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <Card
                    key={addr.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedAddresses.has(addr.id) 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-accent"
                    }`}
                    onClick={() => toggleAddress(addr.id)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">
                        {addr.street_number} {addr.street_name}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <>
              {/* Optimized Route Display */}
              <div className="flex items-center justify-between p-3 bg-accent rounded-md">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Distance totale: {calculateTotalDistance()} km</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOptimizedRoute([])}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              </div>

              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-2">
                  {optimizedRoute.map((addr, index) => (
                    <Card key={addr.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div className="flex items-center gap-2 flex-1">
                          <MapPin className="h-4 w-4" />
                          <span className="font-medium">
                            {addr.street_number} {addr.street_name}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            {optimizedRoute.length === 0 ? (
              <Button onClick={optimizeRoute} disabled={isOptimizing || selectedAddresses.size === 0}>
                <Navigation className="h-4 w-4 mr-2" />
                {isOptimizing ? "Optimisation..." : "Optimiser l'itinéraire"}
              </Button>
            ) : (
              <Button onClick={applyRoute}>
                <Route className="h-4 w-4 mr-2" />
                Appliquer sur la carte
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
