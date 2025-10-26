import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPopupContent } from "./MapPopup";
import { Button } from "./ui/button";
import { Navigation, Lasso, X, Trash2, MapPin } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import AddAddressDialog from "./AddAddressDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
  csv_data?: any | null;
};

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const markersMapRef = useRef<Record<string, L.Marker>>({});
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [lassoMode, setLassoMode] = useState(false);
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAddressCoords, setNewAddressCoords] = useState<{ lat: number; lng: number } | null>(null);

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

    // Initialize draw control
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle map clicks for adding addresses
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      console.log("Map clicked, addMode:", addMode);
      if (addMode) {
        console.log("Setting new address coords:", e.latlng.lat, e.latlng.lng);
        setNewAddressCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        setShowAddDialog(true);
      }
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [addMode]);

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

  const toggleAddMode = () => {
    if (lassoMode) {
      toast.info("Désactivez le mode lasso d'abord");
      return;
    }
    setAddMode(!addMode);
    if (!addMode) {
      toast.info("Mode ajout activé - Cliquez sur la carte pour ajouter une adresse");
    } else {
      toast.info("Mode ajout désactivé");
    }
  };

  const toggleLassoMode = () => {
    if (!mapRef.current || !drawnItemsRef.current) return;

    if (addMode) {
      toast.info("Désactivez le mode ajout d'abord");
      return;
    }

    if (!lassoMode) {
      // Enable lasso mode
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: {
              color: '#3b82f6',
              fillOpacity: 0.2,
            },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItemsRef.current,
          remove: false,
        },
      });

      mapRef.current.addControl(drawControl);
      drawControlRef.current = drawControl;

      // Handle polygon creation
      mapRef.current.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer;
        drawnItemsRef.current?.addLayer(layer);

        // Get polygon bounds
        const polygon = layer.getLatLngs()[0];
        console.log("Polygon created:", polygon);
        console.log("Total addresses:", addresses.length);

        // Find markers inside polygon
        const selected: string[] = [];
        addresses.forEach((address) => {
          const point = L.latLng(address.latitude, address.longitude);
          const isInside = isPointInPolygon(point, polygon);
          console.log(`Address ${address.street_name} ${address.street_number}: lat=${address.latitude}, lng=${address.longitude}, inside=${isInside}`);
          if (isInside) {
            selected.push(address.id);
          }
        });

        console.log("Selected addresses:", selected.length, selected);
        setSelectedAddresses(selected);
        if (selected.length > 0) {
          toast.info(`${selected.length} adresse(s) sélectionnée(s)`);
        } else {
          toast.info("Aucune adresse sélectionnée");
          drawnItemsRef.current?.clearLayers();
        }
      });

      setLassoMode(true);
      toast.info("Mode lasso activé - Dessinez un polygone");
    } else {
      // Disable lasso mode
      if (drawControlRef.current) {
        mapRef.current.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      mapRef.current.off(L.Draw.Event.CREATED);
      drawnItemsRef.current?.clearLayers();
      setLassoMode(false);
      setSelectedAddresses([]);
      toast.info("Mode lasso désactivé");
    }
  };

  const isPointInPolygon = (point: L.LatLng, polygon: L.LatLng[]) => {
    let inside = false;
    const x = point.lng; // longitude
    const y = point.lat; // latitude

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  };

  const handleDeleteSelected = async () => {
    console.log("Deleting addresses:", selectedAddresses);
    try {
      const { data, error } = await supabase
        .from("addresses")
        .delete()
        .in("id", selectedAddresses)
        .select();

      console.log("Delete result:", { data, error });

      if (error) throw error;

      toast.success(`${selectedAddresses.length} adresse(s) supprimée(s)`);
      setSelectedAddresses([]);
      setShowDeleteDialog(false);
      drawnItemsRef.current?.clearLayers();
      
      // Disable lasso mode after deletion
      if (lassoMode) {
        toggleLassoMode();
      }
    } catch (error) {
      console.error("Error deleting addresses:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleCancelSelection = () => {
    setShowDeleteDialog(false);
    setSelectedAddresses([]);
    drawnItemsRef.current?.clearLayers();
  };

  // Fetch addresses
  useEffect(() => {
    const PAGE_SIZE = 1000;

    const fetchAddresses = async () => {
      let all: Address[] = [];
      let page = 0;

      while (true) {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("addresses")
          .select("*")
          .order("street_name")
          .range(start, end);

        if (error) {
          toast.error("Erreur lors du chargement des adresses");
          break;
        }

        all = all.concat(data || []);

        if (!data || data.length < PAGE_SIZE) break;
        page += 1;
      }

      setAddresses(all);
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

    // Update cursor style based on addMode
    const container = mapRef.current.getContainer();
    if (addMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    markersMapRef.current = {};

    // Add new markers
    const bounds: L.LatLngBoundsExpression = [];
    
    addresses.forEach((address) => {
      const statusConfig = STATUS_CONFIG[address.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
      const color = statusConfig.color;
      const isSelected = selectedAddresses.includes(address.id);
      
      // Determine if this is a manually added address (no csv_data)
      const isManuallyAdded = !address.csv_data;
      
      // Create custom icon with selection ring
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: ${isManuallyAdded ? '2px' : '50%'};
          ${isSelected ? 'box-shadow: 0 0 0 4px hsl(var(--primary) / 0.5), 0 2px 4px rgba(0,0,0,0.3); transform: scale(1.08);' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.3);'}
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

      // Create marker
      const marker = L.marker([address.latitude, address.longitude], { icon })
        .addTo(mapRef.current!);

      // Click to toggle selection in lasso mode
      marker.on('click', (e: any) => {
        if (!lassoMode) return;
        try {
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
        } catch {}
        setSelectedAddresses((prev) =>
          prev.includes(address.id)
            ? prev.filter((id) => id !== address.id)
            : [...prev, address.id]
        );
        marker.closePopup();
      });

      // Bind popup with interactive content only when not in lasso mode
      if (!lassoMode) {
        const popupContent = createPopupContent(address, handleStatusChange);
        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: "custom-popup",
        });
      }

      markersRef.current.push(marker);
      markersMapRef.current[address.id] = marker;
      bounds.push([address.latitude, address.longitude]);
    });

      // Fit map to markers
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [addresses, lassoMode, addMode]);

  // Update marker visuals when selection changes
  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(markersMapRef.current).forEach(([id, marker]) => {
      const addr = addresses.find((a) => a.id === id);
      if (!addr) return;
      const statusConfig = STATUS_CONFIG[addr.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
      const color = statusConfig.color;
      const isSelected = selectedAddresses.includes(id);
      const isManuallyAdded = !addr.csv_data;
      
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: ${isManuallyAdded ? '2px' : '50%'};
          ${isSelected ? 'box-shadow: 0 0 0 4px hsl(var(--primary) / 0.5), 0 2px 4px rgba(0,0,0,0.3); transform: scale(1.08);' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.3);'}
          cursor: pointer;
          transition: transform 0.2s;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      marker.setIcon(icon);
    });
  }, [selectedAddresses, addresses]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainerRef} className="absolute inset-0" />
      
      {/* Control Buttons */}
      <div className="absolute bottom-24 right-4 z-[12000] pointer-events-auto flex flex-col gap-2 items-end">
        {selectedAddresses.length > 0 && (
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            className="h-12 rounded-full shadow-lg px-4 flex items-center gap-2"
          >
            <Trash2 className="h-5 w-5" />
            Supprimer ({selectedAddresses.length})
          </Button>
        )}
        <Button
          onClick={toggleAddMode}
          size="icon"
          variant={addMode ? "default" : "outline"}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          {addMode ? (
            <X className="h-5 w-5" />
          ) : (
            <MapPin className="h-5 w-5" />
          )}
        </Button>
        <Button
          onClick={toggleLassoMode}
          size="icon"
          variant={lassoMode ? "default" : "outline"}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          {lassoMode ? (
            <X className="h-5 w-5" />
          ) : (
            <Lasso className="h-5 w-5" />
          )}
        </Button>
        <Button
          onClick={handleGeolocate}
          disabled={isLocating}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <Navigation className={`h-5 w-5 ${isLocating ? "animate-pulse" : ""}`} />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer les adresses sélectionnées ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer {selectedAddresses.length} adresse(s).
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSelection}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Address Dialog */}
      {newAddressCoords && (
        <AddAddressDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          latitude={newAddressCoords.lat}
          longitude={newAddressCoords.lng}
          onSuccess={() => {
            setAddMode(false);
            setNewAddressCoords(null);
          }}
        />
      )}
    </div>
  );
}
