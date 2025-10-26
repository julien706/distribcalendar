import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

const STATUS_COLORS = {
  pending: "#94a3b8",
  done: "#22c55e",
  retry_first: "#f59e0b",
  retry_second: "#f59e0b",
  refused: "#ef4444",
  uninhabited: "#64748b",
};

// Create custom marker icons
const createMarkerIcon = (color: string) => {
  return L.divIcon({
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
};

function MapUpdater({ addresses }: { addresses: Address[] }) {
  const map = useMap();

  useEffect(() => {
    if (addresses.length > 0) {
      const bounds = L.latLngBounds(
        addresses.map((addr) => [addr.latitude, addr.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [addresses, map]);

  return null;
}

export default function MapView() {
  const [addresses, setAddresses] = useState<Address[]>([]);

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

  return (
    <div className="relative w-full h-screen">
      <MapContainer
        center={[49.048, 4.122]}
        zoom={14}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {addresses.map((address) => {
          const color = STATUS_COLORS[address.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
          
          return (
            <Marker
              key={address.id}
              position={[address.latitude, address.longitude]}
              icon={createMarkerIcon(color)}
            >
              <Popup>
                <div className="p-2">
                  <strong className="text-base">
                    {address.street_number || ""} {address.street_name}
                  </strong>
                  <br />
                  <span className="text-sm">Statut: {address.status}</span>
                  {address.observations && (
                    <>
                      <br />
                      <span className="text-sm text-muted-foreground">
                        {address.observations}
                      </span>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        <MapUpdater addresses={addresses} />
      </MapContainer>
    </div>
  );
}
