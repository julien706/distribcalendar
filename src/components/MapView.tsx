import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPopupContent } from "./MapPopup";
import { Button } from "./ui/button";
import { Navigation } from "lucide-react";
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

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map with increased zoom
    const map = L.map(mapContainerRef.current, {
      maxZoom: 22,
      minZoom: 3,
    }).setView([49.048, 4.122], 14);

    // Add tile layer with higher maxZoom
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 22,
      maxNativeZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleGeolocate = () => {
    if (!mapRef.current) return;

    setIsLocating(true);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Remove previous user location marker
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove();
          }

          // Create custom blue marker for user location
          const userIcon = L.divIcon({
            className: "user-location-marker",
            html: `<div style="
              width: 16px;
              height: 16px;
              background-color: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          // Add user location marker
          const marker = L.marker([latitude, longitude], { icon: userIcon })
            .bindPopup("<strong>Votre position</strong>")
            .addTo(mapRef.current!);

          userLocationMarkerRef.current = marker;

          // Center map on user location
          mapRef.current.setView([latitude, longitude], 18);

          toast.success("Position trouvée");
          setIsLocating(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast.error("Impossible d'obtenir votre position");
          setIsLocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      toast.error("Géolocalisation non supportée");
      setIsLocating(false);
    }
  };

  // Fetch addresses
  useEffect(() => {
    const fetchAddresses = async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .order("street_name");

      if (error) {
        toast.error("Erreur lors du chargement des adresses");
        return;
      }

      setAddresses(data || []);
    };

    fetchAddresses();

    const channel = supabase
      .channel("addresses-changes")
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
  }, []);

  // Update markers when addresses change
  useEffect(() => {
    if (!mapRef.current || addresses.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    const bounds: L.LatLngBoundsExpression = [];
    
    addresses.forEach((address) => {
      const statusConfig = STATUS_CONFIG[address.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
      const color = statusConfig.color;
      
      // Create custom icon
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Handle status change callback
      const handleStatusChange = (id: string, newStatus: string) => {
        setAddresses((prev) =>
          prev.map((addr) =>
            addr.id === id ? { ...addr, status: newStatus } : addr
          )
        );
      };

      // Create marker with interactive popup
      const marker = L.marker([address.latitude, address.longitude], { icon })
        .addTo(mapRef.current!);

      // Bind popup with interactive content
      const popupContent = createPopupContent(address, handleStatusChange);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: "custom-popup",
      });

      markersRef.current.push(marker);
      bounds.push([address.latitude, address.longitude]);
    });

    // Fit map to markers
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [addresses]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainerRef} className="absolute inset-0" />
      
      {/* GPS Location Button */}
      <div className="absolute bottom-24 right-4 z-[1000]">
        <Button
          onClick={handleGeolocate}
          disabled={isLocating}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <Navigation className={`h-5 w-5 ${isLocating ? "animate-pulse" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
