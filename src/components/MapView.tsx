import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPopupContent } from "./MapPopup";
import { Button } from "./ui/button";
import { Navigation, Lasso, X, Trash2, MapPin, Layers, Route, Hexagon, Maximize, Target } from "lucide-react";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";
import { useAuth } from "@/contexts/AuthContext";
import AddAddressDialog from "./AddAddressDialog";
import EditManualAddressDialog from "./EditManualAddressDialog";
import StatusFilter from "./StatusFilter";
import RouteOptimizer from "./RouteOptimizer";
import CreateZoneDialog from "./CreateZoneDialog";
import EditZoneDialog from "./EditZoneDialog";
import { BuildingApartmentsDialog } from "./BuildingApartmentsDialog";
import { ConvertToBuildingDialog } from "./ConvertToBuildingDialog";
import { ConvertToAddressDialog } from "./ConvertToAddressDialog";
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
  zone_id?: string | null;
  city?: string | null;
  is_building?: boolean | null;
  building_name?: string | null;
  apartment_count?: number | null;
};

type Zone = {
  id: string;
  name: string;
  color: string;
  boundary_coordinates: any;
  team_id: string | null;
};

export default function MapView() {
  const { isAdmin } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const markersMapRef = useRef<Record<string, L.Marker>>({});
  const markerClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusType[]>(() => {
    const saved = localStorage.getItem('mapStatusFilter');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return Object.keys(STATUS_CONFIG) as StatusType[];
      }
    }
    return Object.keys(STATUS_CONFIG) as StatusType[];
  });
  const [showNumbers, setShowNumbers] = useState(() => {
    const saved = localStorage.getItem('mapShowNumbers');
    return saved !== null ? saved === 'true' : true;
  });
  const [isLocating, setIsLocating] = useState(false);
  const [gpsTracking, setGpsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const [lassoMode, setLassoMode] = useState(false);
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAddressCoords, setNewAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [movingAddressId, setMovingAddressId] = useState<string | null>(null);
  const [showEditManual, setShowEditManual] = useState(false);
  const [editingManual, setEditingManual] = useState<{ id: string; street_name: string; street_number: string | null; city: string | null; observations: string | null } | null>(null);
  const [showRouteOptimizer, setShowRouteOptimizer] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<Address[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Zone management state
  const [zones, setZones] = useState<Zone[]>([]);
  const [showZones, setShowZones] = useState(() => {
    const saved = localStorage.getItem('mapShowZones');
    return saved !== null ? saved === 'true' : false;
  });
  const zonesLayerRef = useRef<L.FeatureGroup | null>(null);
  const [zoneMode, setZoneMode] = useState(false);
  const [showCreateZone, setShowCreateZone] = useState(false);
  const [drawnZonePolygon, setDrawnZonePolygon] = useState<L.LatLng[] | null>(null);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [showEditZone, setShowEditZone] = useState(false);
  const [editingZoneShape, setEditingZoneShape] = useState(false);
  const editingZoneLayerRef = useRef<L.Polygon | null>(null);
  
  // Building management state
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [convertToBuildingOpen, setConvertToBuildingOpen] = useState(false);
  const [convertToAddressOpen, setConvertToAddressOpen] = useState(false);
  const [convertAddressId, setConvertAddressId] = useState<string | null>(null);
  
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

    // Create map with increased zoom and canvas rendering for better performance
    const map = L.map(mapContainerRef.current, {
      maxZoom: 22,
      minZoom: 3,
      preferCanvas: true,
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

    // Initialize zones layer
    const zonesLayer = new L.FeatureGroup();
    map.addLayer(zonesLayer);
    zonesLayerRef.current = zonesLayer;

    // Auto-locate user on startup (without centering map)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          
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

          const marker = L.marker([latitude, longitude], { icon: userIcon })
            .bindPopup("<strong>Votre position</strong>")
            .addTo(map);
          userLocationMarkerRef.current = marker;
        },
        (error) => {
          console.log("Geolocation on startup failed, using default location", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Persist status filter to localStorage
  useEffect(() => {
    localStorage.setItem('mapStatusFilter', JSON.stringify(statusFilter));
  }, [statusFilter]);

  // Persist show numbers to localStorage
  useEffect(() => {
    localStorage.setItem('mapShowNumbers', String(showNumbers));
  }, [showNumbers]);

  // Persist show zones to localStorage
  useEffect(() => {
    localStorage.setItem('mapShowZones', String(showZones));
  }, [showZones]);

  // Toggle double-click zoom during add mode to allow dblclick editing
  useEffect(() => {
    if (!mapRef.current) return;
    if (addMode) mapRef.current.doubleClickZoom.disable();
    else mapRef.current.doubleClickZoom.enable();
  }, [addMode]);

  // Handle map clicks for adding addresses
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (addMode) {
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

  // Event listeners for building dialogs
  useEffect(() => {
    const handleOpenBuilding = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSelectedBuildingId(customEvent.detail.addressId);
      setBuildingDialogOpen(true);
    };
    
    const handleConvertToBuilding = (e: Event) => {
      const customEvent = e as CustomEvent;
      setConvertAddressId(customEvent.detail.addressId);
      setConvertToBuildingOpen(true);
    };
    
    const handleConvertToAddress = (e: Event) => {
      const customEvent = e as CustomEvent;
      setConvertAddressId(customEvent.detail.addressId);
      setConvertToAddressOpen(true);
    };

    window.addEventListener('open-building-dialog', handleOpenBuilding);
    window.addEventListener('convert-to-building', handleConvertToBuilding);
    window.addEventListener('convert-to-address', handleConvertToAddress);

    return () => {
      window.removeEventListener('open-building-dialog', handleOpenBuilding);
      window.removeEventListener('convert-to-building', handleConvertToBuilding);
      window.removeEventListener('convert-to-address', handleConvertToAddress);
    };
  }, []);

  const handleGeolocate = () => {
    if (!mapRef.current) return;

    // Si le suivi est actif, le désactiver
    if (gpsTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsTracking(false);
      toast.info("Suivi GPS désactivé");
      return;
    }

    // Sinon, activer le suivi continu
    setIsLocating(true);

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Mettre à jour le marqueur utilisateur
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            const userIcon = L.divIcon({
              className: "user-location-marker",
              html: `<div style="
                width: 20px;
                height: 20px;
                background-color: #3b82f6;
                border: 4px solid white;
                border-radius: 50%;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
              "></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });

            const marker = L.marker([latitude, longitude], { icon: userIcon })
              .bindPopup("<strong>Votre position (suivi actif)</strong>")
              .addTo(mapRef.current!);

            userLocationMarkerRef.current = marker;
          }

          setUserLocation([latitude, longitude]);

          // Centrer la carte sur la position SANS dézoomer
          const currentZoom = mapRef.current!.getZoom();
          mapRef.current!.setView([latitude, longitude], currentZoom, {
            animate: true,
            duration: 0.5
          });

          if (!gpsTracking) {
            setGpsTracking(true);
            setIsLocating(false);
            toast.success("Suivi GPS activé");
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast.error("Impossible de suivre votre position");
          setIsLocating(false);
          setGpsTracking(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      watchIdRef.current = watchId;
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

    if (zoneMode) {
      toast.info("Désactivez le mode zone d'abord");
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

  const toggleZoneMode = () => {
    if (!mapRef.current || !drawnItemsRef.current) return;

    if (addMode) {
      toast.info("Désactivez le mode ajout d'abord");
      return;
    }

    if (lassoMode) {
      toast.info("Désactivez le mode lasso d'abord");
      return;
    }

    if (editingZoneShape) {
      toast.info("Désactivez l'édition de zone d'abord");
      return;
    }

    if (!zoneMode) {
      // Enable zone mode
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: {
              color: '#10B981',
              fillOpacity: 0.3,
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

      // Handle polygon creation for zone
      mapRef.current.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer;
        const polygon = layer.getLatLngs()[0];
        setDrawnZonePolygon(polygon);
        setShowCreateZone(true);
        drawnItemsRef.current?.addLayer(layer);
      });

      setZoneMode(true);
      toast.info("Mode zone activé - Dessinez un polygone pour définir une zone");
    } else {
      // Disable zone mode
      if (drawControlRef.current) {
        mapRef.current.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      mapRef.current.off(L.Draw.Event.CREATED);
      drawnItemsRef.current?.clearLayers();
      setZoneMode(false);
      setDrawnZonePolygon(null);
      toast.info("Mode zone désactivé");
    }
  };

  const startEditingZoneShape = (zone: Zone) => {
    if (!mapRef.current || !drawnItemsRef.current) return;

    // Disable other modes
    if (zoneMode) toggleZoneMode();
    if (lassoMode) toggleLassoMode();
    if (addMode) toggleAddMode();

    setEditingZone(zone);
    setEditingZoneShape(true);
    setShowEditZone(false);

    // Hide all existing zones temporarily
    zonesLayerRef.current?.clearLayers();

    // Convert zone boundary to LatLng format
    const latlngs: [number, number][] = zone.boundary_coordinates.map(coord => [coord[1], coord[0]]);
    
    // Create editable polygon
    const polygon = L.polygon(latlngs, {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.3,
      weight: 3,
    });

    polygon.addTo(drawnItemsRef.current);
    editingZoneLayerRef.current = polygon;

    // Enable editing with leaflet-draw
    const drawControl = new L.Control.Draw({
      draw: {
        polygon: false,
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

    // Fit bounds to the polygon
    mapRef.current.fitBounds(polygon.getBounds(), { padding: [50, 50] });

    toast.info("Modifiez la zone en déplaçant les points, puis cliquez sur Enregistrer");
  };

  const saveEditedZoneShape = async () => {
    if (!editingZone || !editingZoneLayerRef.current) return;

    try {
      const latlngs = editingZoneLayerRef.current.getLatLngs()[0] as L.LatLng[];
      const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);

      // Update zone boundary
      const { error } = await supabase
        .from("zones")
        .update({ boundary_coordinates: coordinates })
        .eq("id", editingZone.id);

      if (error) throw error;

      // Reassign addresses: find all addresses in the new boundary
      const addressesInZone = addresses.filter((addr) =>
        isPointInPolygon(L.latLng(addr.latitude, addr.longitude), latlngs)
      );

      if (addressesInZone.length > 0) {
        const addressIds = addressesInZone.map(addr => addr.id);
        const { error: updateError } = await supabase
          .from("addresses")
          .update({ zone_id: editingZone.id })
          .in("id", addressIds);

        if (updateError) throw updateError;
      }

      toast.success(`Forme de la zone et ${addressesInZone.length} adresse(s) mises à jour`);
      cancelEditingZoneShape();
    } catch (error) {
      console.error("Error updating zone shape:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const cancelEditingZoneShape = () => {
    if (!mapRef.current) return;

    // Remove draw control
    if (drawControlRef.current) {
      mapRef.current.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    // Clear editing layer
    if (editingZoneLayerRef.current) {
      drawnItemsRef.current?.removeLayer(editingZoneLayerRef.current);
      editingZoneLayerRef.current = null;
    }

    setEditingZoneShape(false);
    setEditingZone(null);
    
    // Restore zones visibility if enabled
    if (showZones) {
      // Trigger zones re-render
      const currentZones = zones;
      setZones([...currentZones]);
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
 
  // Unified icon creation to keep markers consistent (round + building badge)
  const createMarkerIcon = (addr: {
    status: string;
    street_number?: string | null;
    is_building?: boolean | null;
    apartment_count?: number | null;
    csv_data?: any;
  }, isSelected: boolean, showNumbersFlag: boolean) => {
    const statusConfig = STATUS_CONFIG[addr.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const color = statusConfig.color;
    const textColor = getContrastingTextColor(color);

    const apartmentCount = addr.apartment_count ?? 0;
    const isBuilding = (addr.is_building === true) || apartmentCount > 0;

    // Determine if manually added or imported
    const isManuallyAdded = addr.csv_data?.manually_added === true;
    const isImported = addr.csv_data?.imported === true;

    // 54px for buildings, 36px otherwise
    const markerSize = isBuilding ? 54 : 36;

    const streetNumber = showNumbersFlag ? (addr.street_number || '') : '';

    // Shape: square for manually added, round for imported/existing (NULL csv_data)
    const borderRadius = isManuallyAdded ? '4px' : '50%';

    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        width: ${markerSize}px;
        height: ${markerSize}px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: ${borderRadius};
        ${isSelected ? 'box-shadow: 0 0 0 4px hsl(var(--primary) / 0.5), 0 2px 4px rgba(0,0,0,0.3); transform: scale(1.08);' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.3);'}
        cursor: pointer;
        transition: transform 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: ${isBuilding ? '18px' : '13px'};
        font-weight: 700;
        color: ${textColor};
        text-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.3);
        line-height: 1;
        position: relative;
      ">
        ${isBuilding 
          ? `<div style="font-size: 24px;">🏢</div>
             ${streetNumber 
               ? `<div style="
                   position: absolute;
                   bottom: -12px;
                   left: 50%;
                   transform: translateX(-50%);
                   background: white;
                   color: #333;
                   border-radius: 12px;
                   padding: 4px 10px;
                   font-size: 12px;
                   font-weight: 700;
                   box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                   white-space: nowrap;
                   border: 2px solid ${color};
                 ">${streetNumber}</div>`
               : ''
             }
             <div style="
               position: absolute;
               top: -8px;
               right: -8px;
               background: white;
               color: #333;
               border-radius: 50%;
               width: 20px;
               height: 20px;
               display: flex;
               align-items: center;
               justify-content: center;
               font-size: 10px;
               font-weight: 700;
               box-shadow: 0 2px 4px rgba(0,0,0,0.2);
             ">${apartmentCount}</div>`
          : `${streetNumber}`
        }
      </div>`,
      iconSize: [markerSize, markerSize],
      iconAnchor: [markerSize / 2, markerSize / 2],
    });
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

  // Fetch addresses function (defined outside useEffect for reusability)
  const fetchAddresses = async () => {
    const PAGE_SIZE = 1000;
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

  // Fetch addresses on mount and subscribe to changes
  useEffect(() => {
    fetchAddresses();

    const addressesChannel = supabase
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

    // Subscription pour les changements d'appartements
    const apartmentsChannel = supabase
      .channel("apartments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "apartments",
        },
        () => {
          fetchAddresses(); // Rafraîchir les adresses quand un appartement change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(addressesChannel);
      supabase.removeChannel(apartmentsChannel);
    };
  }, []);

  // Fetch and display zones
  useEffect(() => {
    const fetchZones = async () => {
      const { data, error } = await supabase.from("zones").select("*");
      if (!error && data) {
        setZones(data);
      }
    };

    fetchZones();

    const channel = supabase
      .channel("zones-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "zones",
        },
        () => {
          fetchZones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Render zones on map
  useEffect(() => {
    if (!mapRef.current || !zonesLayerRef.current) return;

    // Clear existing zones
    zonesLayerRef.current.clearLayers();

    if (!showZones) return;

    // Add zones to map
    zones.forEach((zone) => {
      if (!zone.boundary_coordinates || zone.boundary_coordinates.length < 3) return;

      // Convert coordinates back to LatLng format
      const latlngs: [number, number][] = zone.boundary_coordinates.map(coord => [coord[1], coord[0]]);
      
      // Create polygon (interactive only in zone mode)
      const isInteractive = isAdmin && zoneMode;
      const polygon = L.polygon(latlngs, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.15,
        weight: 1.5,
        opacity: 0.6,
        interactive: isInteractive,
        pane: 'overlayPane'
      });

      // Event handlers only if interactive
      if (isInteractive) {
        polygon.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          setEditingZone(zone);
          setShowEditZone(true);
          toast.info(`Zone: ${zone.name}`);
        });

        polygon.on('mouseover', function() {
          this.setStyle({
            fillOpacity: 0.3,
            weight: 3
          });
        });

        polygon.on('mouseout', function() {
          this.setStyle({
            fillOpacity: 0.15,
            weight: 1.5
          });
        });
      }

      // Ajouter un tooltip permanent pour voir le nom de la zone
      if (zone.name) {
        const bounds = polygon.getBounds();
        const center = bounds.getCenter();
        
        L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'zone-label',
          interactive: false
        })
          .setContent(`<span style="
            font-size: 11px;
            font-weight: 600;
            color: ${zone.color};
            text-shadow: 1px 1px 2px white, -1px -1px 2px white;
            pointer-events: none;
          ">${zone.name}</span>`)
          .setLatLng(center)
          .addTo(zonesLayerRef.current!);
      }
      
      polygon.addTo(zonesLayerRef.current!);
    });
  }, [zones, showZones, isAdmin, zoneMode]);

  // Memoize filtered addresses to avoid recalculation
  const filteredAddresses = useMemo(() => {
    return addresses.filter((addr) => statusFilter.includes(addr.status as StatusType));
  }, [addresses, statusFilter]);

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

    // Clear existing markers and cluster
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    markersMapRef.current = {};
    
    // Remove old cluster if exists
    if (markerClusterRef.current) {
      mapRef.current.removeLayer(markerClusterRef.current);
    }
    
    // Create new marker cluster group with optimized settings
    markerClusterRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 120,
      disableClusteringAtZoom: 18,
      spiderfyDistanceMultiplier: 1.5,
      animate: true,
      animateAddingMarkers: false,
    });

    // Add new markers
    const bounds: L.LatLngBoundsExpression = [];
    
    filteredAddresses.forEach((address) => {
      const isSelected = selectedAddresses.includes(address.id);
      
      // Determine if manually added (needed for drag/edit behavior)
      const hasImportedData = address.csv_data && (
        address.csv_data.imported === true ||
        address.csv_data.commune_nom ||
        address.csv_data.voie_nom ||
        (typeof address.csv_data === 'object' && Object.keys(address.csv_data).length > 0)
      );
      const isManuallyAdded = !hasImportedData;
      
      // Create custom icon with unified function
      const icon = createMarkerIcon(address, isSelected, showNumbers);

      // Handle status change callback
      const handleStatusChange = (id: string, newStatus: string) => {
        setAddresses((prev) =>
          prev.map((addr) =>
            addr.id === id ? { ...addr, status: newStatus } : addr
          )
        );
      };

      // Create marker
      const marker = L.marker([address.latitude, address.longitude], { icon });

      // Click behavior: move in add mode for manual entries, select in lasso mode
      marker.on('click', (e: any) => {
        try {
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
        } catch {}
        
        if (addMode && isManuallyAdded) {
          // Enable dragging to move this marker
          if ((marker as any).dragging && typeof (marker as any).dragging.enable === 'function') {
            (marker as any).dragging.enable();
          }
          setMovingAddressId(address.id);
          toast.info('Déplacez le marqueur puis relâchez pour enregistrer');
          return;
        }
        
        if (lassoMode) {
          setSelectedAddresses((prev) =>
            prev.includes(address.id)
              ? prev.filter((id) => id !== address.id)
              : [...prev, address.id]
          );
          marker.closePopup();
        }
      });

      // Enable dragging directly in add mode for manual addresses
      if (addMode && isManuallyAdded) {
        if ((marker as any).dragging && typeof (marker as any).dragging.enable === 'function') {
          (marker as any).dragging.enable();
        }
      }

      // Save new position on drag end when in add mode for manual addresses
      marker.on('dragend', async () => {
        // Only save if in add mode and address is manually added
        if (!addMode || !isManuallyAdded) return;
        
        const pos = marker.getLatLng();
        try {
          const { error } = await supabase
            .from('addresses')
            .update({ latitude: pos.lat, longitude: pos.lng })
            .eq('id', address.id);
          if (error) throw error;
          toast.success('Position mise à jour');
          setMovingAddressId(null);
        } catch (err) {
          console.error('Error updating position', err);
          toast.error("Erreur lors de la mise à jour de la position");
        }
      });

      // Open edit dialog on right click (context menu) or double click when in add mode
      const openEdit = (e: any) => {
        if (!(addMode && isManuallyAdded)) return;
        try {
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
        } catch {}
        setEditingManual({ id: address.id, street_name: address.street_name, street_number: address.street_number, city: address.city || null, observations: address.observations || null });
        setShowEditManual(true);
      };
      marker.on('contextmenu', openEdit);
      marker.on('dblclick', openEdit);

      // Lazy load popup with interactive content only when clicked (not in lasso/add mode)
      if (!lassoMode && !addMode) {
        marker.on('popupopen', () => {
          const popupContent = createPopupContent(
            address, 
            handleStatusChange, 
            address.latitude, 
            address.longitude,
            fetchAddresses
          );
          marker.setPopupContent(popupContent);
        });
        marker.bindPopup('', {
          maxWidth: 300,
          className: "custom-popup",
        });
      }

      markersRef.current.push(marker);
      markersMapRef.current[address.id] = marker;
      bounds.push([address.latitude, address.longitude]);
      
      // Add to cluster
      markerClusterRef.current!.addLayer(marker);
    });

    // Add cluster to map
    if (markerClusterRef.current) {
      mapRef.current.addLayer(markerClusterRef.current);
    }
  }, [filteredAddresses, lassoMode, addMode, showNumbers]);

  // Update marker visuals when selection changes
  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(markersMapRef.current).forEach(([id, marker]) => {
      const addr = addresses.find((a) => a.id === id);
      if (!addr) return;
      const isSelected = selectedAddresses.includes(id);
      const icon = createMarkerIcon(addr, isSelected, showNumbers);
      marker.setIcon(icon);
    });
  }, [selectedAddresses, addresses, showNumbers]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0" />
      
      {/* Indicateur de suivi GPS actif */}
      {gpsTracking && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Target className="h-4 w-4" />
          <span className="text-sm font-medium">Suivi GPS actif</span>
        </div>
      )}
      
      {/* Closest Address Button - Bottom Left */}
      <div className="absolute bottom-20 left-3 z-[12000] pointer-events-auto">
        <Button
          onClick={() => {
            if (!userLocation || addresses.length === 0) {
              toast.error("Aucune position GPS disponible");
              return;
            }
            
            // Find closest address
            let minDistance = Infinity;
            let closestAddress: Address | null = null;
            
            addresses.forEach(addr => {
              const distance = Math.sqrt(
                Math.pow(addr.latitude - userLocation[0], 2) + 
                Math.pow(addr.longitude - userLocation[1], 2)
              );
              if (distance < minDistance) {
                minDistance = distance;
                closestAddress = addr;
              }
            });
            
            if (closestAddress && mapRef.current) {
              // Center on address, keeping current zoom
              const currentZoom = mapRef.current.getZoom();
              mapRef.current.setView([closestAddress.latitude, closestAddress.longitude], currentZoom);
              
              // Open popup
              const marker = markersMapRef.current[closestAddress.id];
              if (marker) {
                marker.openPopup();
                toast.success("Adresse la plus proche trouvée");
              }
            }
          }}
          size="icon"
          variant="default"
          className="h-16 w-16 rounded-full shadow-2xl bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 touch-manipulation"
          title="Adresse la plus proche"
        >
          <Target className="h-7 w-7" />
        </Button>
      </div>
      
      {/* Control Buttons - Mobile optimized */}
      <div className="absolute bottom-20 right-3 z-[12000] pointer-events-auto flex flex-col gap-2 sm:gap-3 items-end">
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
          showZones={showZones}
          onShowZonesChange={setShowZones}
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
        {isAdmin && (
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
        )}
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
          onClick={() => setShowRouteOptimizer(true)}
          size="icon"
          variant="outline"
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
          title="Planifier un itinéraire"
        >
          <Route className="h-5 w-5" />
        </Button>
        {isAdmin && (
          <Button
            onClick={toggleZoneMode}
            size="icon"
            variant={zoneMode ? "default" : "outline"}
            className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
            title="Définir une zone"
          >
            {zoneMode ? (
              <X className="h-5 w-5" />
            ) : (
              <Hexagon className="h-5 w-5" />
            )}
          </Button>
        )}
        <Button
          onClick={handleGeolocate}
          disabled={isLocating}
          size="icon"
          variant={gpsTracking ? "default" : "outline"}
          className={`h-12 w-12 rounded-full shadow-lg touch-manipulation ${
            gpsTracking ? "ring-2 ring-blue-400 ring-offset-2" : ""
          }`}
          title={gpsTracking ? "Suivi GPS actif - Cliquer pour désactiver" : "Activer le suivi GPS"}
        >
          <Target className={`h-5 w-5 ${gpsTracking ? "animate-pulse text-white" : isLocating ? "animate-pulse" : ""}`} />
        </Button>
        <Button
          onClick={() => {
            if (!mapRef.current || addresses.length === 0) return;
            
            // Si suivi GPS actif, désactiver d'abord
            if (gpsTracking) {
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              setGpsTracking(false);
              toast.info("Suivi GPS désactivé");
            }
            
            const bounds = L.latLngBounds(addresses.map(addr => [addr.latitude, addr.longitude]));
            mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            toast.success("Vue d'ensemble du secteur");
          }}
          size="icon"
          variant="outline"
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation"
          title="Vue d'ensemble du secteur"
        >
          <Maximize className="h-5 w-5" />
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

      {/* Edit Manual Address Dialog */}
      <EditManualAddressDialog
        open={showEditManual}
        onOpenChange={setShowEditManual}
        address={editingManual}
        onSuccess={(u) => {
          if (!editingManual) return;
          setAddresses((prev) => prev.map(a => a.id === editingManual.id ? { ...a, street_name: u.street_name, street_number: u.street_number, city: u.city, observations: u.observations } : a));
          setEditingManual(null);
        }}
      />

      {/* Route Optimizer Dialog */}
      <RouteOptimizer
        open={showRouteOptimizer}
        onClose={() => setShowRouteOptimizer(false)}
        onRouteGenerated={(route) => {
          setOptimizedRoute(route);
          
          // Draw route on map
          if (routeLineRef.current) {
            mapRef.current?.removeLayer(routeLineRef.current);
          }

          const points: [number, number][] = route.map(addr => [addr.latitude, addr.longitude]);
          routeLineRef.current = L.polyline(points, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10'
          }).addTo(mapRef.current!);

          // Fit bounds to route
          mapRef.current?.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50] });
        }}
        userLocation={userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined}
      />

      {/* Create Zone Dialog */}
      <CreateZoneDialog
        open={showCreateZone}
        onOpenChange={(open) => {
          setShowCreateZone(open);
          if (!open) {
            drawnItemsRef.current?.clearLayers();
            setDrawnZonePolygon(null);
            if (zoneMode) {
              toggleZoneMode();
            }
          }
        }}
        polygon={drawnZonePolygon}
        addresses={addresses}
        onSuccess={() => {
          drawnItemsRef.current?.clearLayers();
          setDrawnZonePolygon(null);
          if (zoneMode) {
            toggleZoneMode();
          }
        }}
      />

      {/* Edit Zone Dialog */}
      <EditZoneDialog
        open={showEditZone}
        onOpenChange={setShowEditZone}
        zone={editingZone}
        onSuccess={() => {
          setEditingZone(null);
        }}
        onEditShape={() => {
          if (editingZone) {
            startEditingZoneShape(editingZone);
          }
        }}
      />

      {/* Zone Shape Editing Overlay */}
      {editingZoneShape && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[12000] flex gap-2">
          <Button onClick={saveEditedZoneShape} size="lg">
            Enregistrer la forme
          </Button>
          <Button onClick={cancelEditingZoneShape} variant="outline" size="lg">
            Annuler
          </Button>
        </div>
      )}

      {/* Building Management Dialogs */}
      <BuildingApartmentsDialog
        addressId={selectedBuildingId}
        open={buildingDialogOpen}
        onOpenChange={setBuildingDialogOpen}
        onUpdate={fetchAddresses}
      />
      
      <ConvertToBuildingDialog
        addressId={convertAddressId}
        open={convertToBuildingOpen}
        onOpenChange={setConvertToBuildingOpen}
        onSuccess={fetchAddresses}
      />
      
      <ConvertToAddressDialog
        addressId={convertAddressId}
        open={convertToAddressOpen}
        onOpenChange={setConvertToAddressOpen}
        onSuccess={fetchAddresses}
      />
    </div>
  );
}
