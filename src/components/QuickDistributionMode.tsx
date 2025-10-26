import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  X, 
  Navigation, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Home
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
};

type QuickDistributionModeProps = {
  onClose: () => void;
  route?: Address[];
};

export default function QuickDistributionMode({ onClose, route }: QuickDistributionModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>(route || []);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stats, setStats] = useState({ done: 0, refused: 0, total: 0 });
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!route || route.length === 0) {
      fetchPendingAddresses();
    } else {
      updateStats();
    }
    initMap();
    startGeolocation();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    updateStats();
  }, [addresses]);

  useEffect(() => {
    if (mapRef.current && addresses.length > 0 && currentIndex < addresses.length) {
      const current = addresses[currentIndex];
      mapRef.current.setView([current.latitude, current.longitude], 18);
      
      // Update marker
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer !== userMarkerRef.current) {
          mapRef.current!.removeLayer(layer);
        }
      });

      const marker = L.marker([current.latitude, current.longitude], {
        icon: L.divIcon({
          html: `<div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold shadow-lg">${currentIndex + 1}</div>`,
          className: "",
          iconSize: [32, 32],
        }),
      }).addTo(mapRef.current);
    }
  }, [currentIndex, addresses]);

  const initMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([48.8566, 2.3522], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap',
    }).addTo(mapRef.current);
  };

  const startGeolocation = () => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLocation);

          if (mapRef.current) {
            if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([newLocation.lat, newLocation.lng]);
            } else {
              userMarkerRef.current = L.marker([newLocation.lat, newLocation.lng], {
                icon: L.divIcon({
                  html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>',
                  className: "",
                  iconSize: [16, 16],
                }),
              }).addTo(mapRef.current);
            }
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  };

  const fetchPendingAddresses = async () => {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("status", "pending")
      .order("street_name");

    if (error) {
      toast.error("Erreur lors du chargement");
      return;
    }

    setAddresses(data || []);
  };

  const updateStats = () => {
    const done = addresses.filter(a => a.status === "done").length;
    const refused = addresses.filter(a => a.status === "refused").length;
    setStats({ done, refused, total: addresses.length });
  };

  const updateAddressStatus = async (status: "done" | "refused" | "pending" | "no_answer" | "retry_first" | "retry_second" | "uninhabited") => {
    if (currentIndex >= addresses.length) return;

    const address = addresses[currentIndex];
    const { error } = await supabase
      .from("addresses")
      .update({ 
        status, 
        last_visit_date: new Date().toISOString() 
      })
      .eq("id", address.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }

    const updatedAddresses = [...addresses];
    updatedAddresses[currentIndex] = { ...address, status };
    setAddresses(updatedAddresses);

    toast.success("Statut mis à jour");
    
    // Auto next
    if (currentIndex < addresses.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 500);
    }
  };

  const navigateToAddress = () => {
    if (currentIndex >= addresses.length) return;
    const addr = addresses[currentIndex];
    const url = `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`;
    window.open(url, "_blank");
  };

  const currentAddress = addresses[currentIndex];
  const isLastAddress = currentIndex === addresses.length - 1;

  if (!currentAddress) {
    return (
      <div className="fixed inset-0 z-[12000] bg-background flex items-center justify-center">
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
          <h2 className="text-2xl font-bold">Distribution terminée !</h2>
          <div className="space-y-2">
            <p className="text-lg">✅ Distribués: {stats.done}</p>
            <p className="text-lg">❌ Refusés: {stats.refused}</p>
            <p className="text-lg">📍 Total: {stats.total}</p>
          </div>
          <Button onClick={onClose} className="mt-4">
            <Home className="h-4 w-4 mr-2" />
            Retour à la carte
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[12000] bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Distribution rapide</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-50">
            ✅ {stats.done}
          </Badge>
          <Badge variant="outline" className="bg-red-50">
            ❌ {stats.refused}
          </Badge>
          <Badge variant="secondary">
            {currentIndex + 1}/{addresses.length}
          </Badge>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>

      {/* Address Info Card */}
      <Card className="m-4 p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold">
                {currentAddress.street_number} {currentAddress.street_name}
              </h3>
            </div>
            {currentAddress.observations && (
              <p className="text-sm text-muted-foreground">
                {currentAddress.observations}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            #{currentIndex + 1}
          </Badge>
        </div>

        {/* Navigation Button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={navigateToAddress}
        >
          <Navigation className="h-4 w-4 mr-2" />
          Naviguer vers cette adresse
        </Button>

        {/* Status Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-16 bg-green-500 hover:bg-green-600 text-white text-lg"
            onClick={() => updateAddressStatus("done")}
          >
            <CheckCircle2 className="h-6 w-6 mr-2" />
            Distribué
          </Button>
          <Button
            size="lg"
            variant="destructive"
            className="h-16 text-lg"
            onClick={() => updateAddressStatus("refused")}
          >
            <XCircle className="h-6 w-6 mr-2" />
            Refusé
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={isLastAddress}
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
