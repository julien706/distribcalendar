import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPopupContent } from "./MapPopup";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
};

const STATUS_COLORS = {
  pending: "#94a3b8",
  done: "#22c55e",
  retry_first: "#f59e0b",
  retry_second: "#f59e0b",
  refused: "#ef4444",
  uninhabited: "#64748b",
};

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current).setView([49.048, 4.122], 14);

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      const color = STATUS_COLORS[address.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
      
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
    </div>
  );
}
