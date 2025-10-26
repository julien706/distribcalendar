import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPopupContent } from "./MapPopup";
import { Button } from "./ui/button";
import { Navigation, Lasso, X, Trash2, MapPin, Layers, Move } from "lucide-react";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";
import AddAddressDialog from "./AddAddressDialog";
import EditAddressDialog from "./EditAddressDialog";
import StatusFilter from "./StatusFilter";
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
  const [statusFilter, setStatusFilter] = useState<StatusType[]>(() => {
    // Initialize with all statuses selected
    return Object.keys(STATUS_CONFIG) as StatusType[];
  });
  const [showNumbers, setShowNumbers] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [lassoMode, setLassoMode] = useState(false);
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAddressCoords, setNewAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const editMarkerRef = useRef<L.Marker | null>(null);
  
  // Map layers state
  const [currentLayer, setCurrentLayer] = useState<'osm' | 'satellite' | 'hybrid'>(() => {
    return (localStorage.getItem('mapLayer') as 'osm' | 'satellite' | 'hybrid') || 'osm';
  });
  const layersRef = useRef<{
    osm: L.TileLayer | null;
    satellite: L.TileLayer | null;
    hybrid: L.TileLayer | null;
    labels: L.TileLayer | null;
  }>({
    osm: null,
    satellite: null,
    hybrid: null,
    labels: null,
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map with increased zoom
    const map = L.map(mapContainerRef.current, {
      maxZoom: 22,
      minZoom: 3,
    }).setView([49.048, 4.122], 16);

    // Create all tile layers
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 22,
      maxNativeZoom: 19,
    });

    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 22,
        maxNativeZoom: 19,
      }
    );

    const labelsLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: '',
        maxZoom: 22,
        maxNativeZoom: 19,
      }
    );

    // Store layers in ref
    layersRef.current = {
      osm: osmLayer,
      satellite: satelliteLayer,
      hybrid: satelliteLayer,
      labels: labelsLayer,
    };

    // Add initial layer based on saved preference
    if (currentLayer === 'osm') {
      osmLayer.addTo(map);
    } else if (currentLayer === 'satellite') {
      satelliteLayer.addTo(map);
    } else if (currentLayer === 'hybrid') {
      satelliteLayer.addTo(map);
      labelsLayer.addTo(map);
    }

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

  const getContrastingTextColor = (hex: string) => {
    try {
      const c = hex.replace('#','');
      const r = parseInt(c.substring(0,2), 16);
      const g = parseInt(c.substring(2,4), 16);
      const b = parseInt(c.substring(4,6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 160 ? '#111827' : '#FFFFFF';
    } catch {
      return '#FFFFFF';
    }
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

  const toggleMapLayer = () => {
    if (!mapRef.current || !layersRef.current.osm || !layersRef.current.satellite || !layersRef.current.labels) return;

    const nextLayer: 'osm' | 'satellite' | 'hybrid' = 
      currentLayer === 'osm' ? 'satellite' : currentLayer === 'satellite' ? 'hybrid' : 'osm';

    // Remove current layers
    if (currentLayer === 'osm') {
      layersRef.current.osm.remove();
    } else if (currentLayer === 'satellite') {
      layersRef.current.satellite.remove();
    } else if (currentLayer === 'hybrid') {
      layersRef.current.satellite.remove();
      layersRef.current.labels.remove();
    }

    // Add new layers
    if (nextLayer === 'osm') {
      layersRef.current.osm.addTo(mapRef.current);
      toast.info("Vue Carte");
    } else if (nextLayer === 'satellite') {
      layersRef.current.satellite.addTo(mapRef.current);
      toast.info("Vue Satellite");
    } else if (nextLayer === 'hybrid') {
      layersRef.current.satellite.addTo(mapRef.current);
      layersRef.current.labels.addTo(mapRef.current);
      toast.info("Vue Hybride");
    }

    setCurrentLayer(nextLayer);
    localStorage.setItem('mapLayer', nextLayer);
  };

  const handleStartMove = () => {
    if (!editingAddress || !mapRef.current) return;
    
    setEditMode(true);
    setShowEditDialog(false);
    
    // Remove the marker from the map temporarily
    const marker = markersMapRef.current[editingAddress.id];
    if (marker) {
      marker.remove();
    }
    
    // Create draggable marker
    const statusConfig = STATUS_CONFIG[editingAddress.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const icon = L.divIcon({
      className: "custom-marker-edit",
      html: `<div style="
        width: 40px;
        height: 40px;
        background-color: ${statusConfig.color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      ">📍</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    
    const editMarker = L.marker([editingAddress.latitude, editingAddress.longitude], {
      icon,
      draggable: true,
    }).addTo(mapRef.current);
    
    editMarkerRef.current = editMarker;
    
    mapRef.current.setView([editingAddress.latitude, editingAddress.longitude], mapRef.current.getZoom());
    
    toast.info("Déplacez le marqueur à la nouvelle position");
  };

  const handleSaveMove = async () => {
    if (!editingAddress || !editMarkerRef.current) return;
    
    const newPos = editMarkerRef.current.getLatLng();
    
    try {
      const { error } = await supabase
        .from("addresses")
        .update({
          latitude: newPos.lat,
          longitude: newPos.lng,
        })
        .eq("id", editingAddress.id);
      
      if (error) throw error;
      
      toast.success("Position mise à jour avec succès");
      
      // Remove edit marker
      editMarkerRef.current.remove();
      editMarkerRef.current = null;
      
      setEditMode(false);
      setEditingAddress(null);
    } catch (error) {
      console.error("Error updating position:", error);
      toast.error("Erreur lors de la mise à jour de la position");
    }
  };

  const handleCancelMove = () => {
    if (editMarkerRef.current) {
      editMarkerRef.current.remove();
      editMarkerRef.current = null;
    }
    setEditMode(false);
    setEditingAddress(null);
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

    // Filter addresses based on selected statuses
    const filteredAddresses = addresses.filter((address) =>
      statusFilter.includes(address.status as StatusType)
    );

    // Add new markers
    const bounds: L.LatLngBoundsExpression = [];
    
    filteredAddresses.forEach((address) => {
      const statusConfig = STATUS_CONFIG[address.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
      const color = statusConfig.color;
      const isSelected = selectedAddresses.includes(address.id);
      
      // Determine if this is a manually added address (no csv_data)
      const isManuallyAdded = !address.csv_data;
      const textColor = getContrastingTextColor(color);
      
      // Create custom icon with selection ring
      const streetNumber = showNumbers ? (address.street_number || '') : '';
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 36px;
          height: 36px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: ${isManuallyAdded ? '4px' : '50%'};
          ${isSelected ? 'box-shadow: 0 0 0 4px hsl(var(--primary) / 0.5), 0 2px 4px rgba(0,0,0,0.3); transform: scale(1.08);' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.3);'}
          cursor: pointer;
          transition: transform 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: ${textColor};
          text-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.3);
          line-height: 1;
        ">${streetNumber}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      // Handle status change callback
      const handleStatusChange = (id: string, newStatus: string) => {
        setAddresses((prev) =>
          prev.map((addr) =>
            addr.id === id ? { ...addr, status: newStatus } : addr
          )
        );
      };

      // Handle edit address
      const handleEditAddress = (addr: Address) => {
        setEditingAddress(addr);
        setShowEditDialog(true);
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
      if (!lassoMode && !editMode) {
        const popupContent = createPopupContent(address, handleStatusChange, handleEditAddress);
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
  }, [addresses, lassoMode, addMode, statusFilter, showNumbers, editMode]);

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
      const textColor = getContrastingTextColor(color);
      const streetNumber = showNumbers ? (addr.street_number || '') : '';
      
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 36px;
          height: 36px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: ${isManuallyAdded ? '4px' : '50%'};
          ${isSelected ? 'box-shadow: 0 0 0 4px hsl(var(--primary) / 0.5), 0 2px 4px rgba(0,0,0,0.3); transform: scale(1.08);' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.3);'}
          cursor: pointer;
          transition: transform 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: ${textColor};
          text-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.3);
          line-height: 1;
        ">${streetNumber}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      marker.setIcon(icon);
    });
  }, [selectedAddresses, addresses, showNumbers]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0" />
      
      {/* Control Buttons - Mobile optimized */}
      <div className="absolute bottom-4 right-3 z-[12000] pointer-events-auto flex flex-col gap-2 sm:gap-3 items-end">
        {selectedAddresses.length > 0 && (
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            className="h-12 w-12 sm:h-auto sm:w-auto rounded-full shadow-lg sm:px-4 flex items-center justify-center sm:gap-2"
          >
            <Trash2 className="h-5 w-5" />
            <span className="hidden sm:inline">Supprimer ({selectedAddresses.length})</span>
          </Button>
        )}
        <StatusFilter
          selectedStatuses={statusFilter}
          onStatusChange={setStatusFilter}
          showNumbers={showNumbers}
          onShowNumbersChange={setShowNumbers}
        />
        <Button
          onClick={toggleAddMode}
          size="icon"
          variant={addMode ? "default" : "outline"}
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
          title="Ajouter une adresse"
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
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
          title="Sélection multiple"
        >
          {lassoMode ? (
            <X className="h-5 w-5" />
          ) : (
            <Lasso className="h-5 w-5" />
          )}
        </Button>
        <Button
          onClick={toggleMapLayer}
          size="icon"
          variant="outline"
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
          title={`Vue actuelle: ${currentLayer === 'osm' ? 'Carte' : currentLayer === 'satellite' ? 'Satellite' : 'Hybride'}`}
        >
          <Layers className="h-5 w-5" />
        </Button>
        <Button
          onClick={handleGeolocate}
          disabled={isLocating}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
          title="Ma position"
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

      {/* Edit Address Dialog */}
      <EditAddressDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        address={editingAddress}
        onSuccess={() => {
          setEditingAddress(null);
        }}
        onMoveRequest={handleStartMove}
      />

      {/* Edit Mode Controls */}
      {editMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[12000] pointer-events-auto flex gap-2 bg-white px-4 py-3 rounded-lg shadow-lg">
          <Button
            onClick={handleSaveMove}
            size="sm"
            className="gap-2"
          >
            <Move className="h-4 w-4" />
            Sauvegarder la position
          </Button>
          <Button
            onClick={handleCancelMove}
            size="sm"
            variant="outline"
          >
            <X className="h-4 w-4" />
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
