import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
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

const STATUS_COLORS = {
  pending: "#94a3b8",
  done: "#22c55e",
  retry_first: "#f59e0b",
  retry_second: "#f59e0b",
  refused: "#ef4444",
  uninhabited: "#64748b",
};

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState("");
  const [isTokenSet, setIsTokenSet] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    if (!isTokenSet || !mapContainer.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [4.122, 49.048],
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
    };
  }, [isTokenSet, mapboxToken]);

  useEffect(() => {
    if (!isTokenSet) return;

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
  }, [isTokenSet]);

  useEffect(() => {
    if (!map.current || addresses.length === 0) return;

    // Remove existing markers
    const markers = document.getElementsByClassName("mapboxgl-marker");
    while (markers[0]) {
      markers[0].remove();
    }

    // Add new markers
    addresses.forEach((address) => {
      const el = document.createElement("div");
      el.className = "w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-125";
      el.style.backgroundColor = STATUS_COLORS[address.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div class="p-2">
          <strong>${address.street_number || ""} ${address.street_name}</strong><br/>
          <span class="text-sm">Statut: ${address.status}</span>
          ${address.observations ? `<br/><span class="text-sm text-muted-foreground">${address.observations}</span>` : ""}
        </div>`
      );

      new mapboxgl.Marker(el)
        .setLngLat([address.longitude, address.latitude])
        .setPopup(popup)
        .addTo(map.current!);
    });

    // Fit bounds to show all markers
    if (addresses.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      addresses.forEach((addr) => {
        bounds.extend([addr.longitude, addr.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [addresses]);

  if (!isTokenSet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Token Mapbox requis</h2>
            <p className="text-sm text-muted-foreground">
              Obtenez votre token sur{" "}
              <a
                href="https://mapbox.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                mapbox.com
              </a>
            </p>
          </div>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="pk.eyJ1..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => {
                if (mapboxToken) {
                  setIsTokenSet(true);
                  toast.success("Token configuré avec succès");
                }
              }}
            >
              Valider
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
