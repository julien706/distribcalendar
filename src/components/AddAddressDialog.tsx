import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addressSchema } from "@/lib/validationSchemas";
import { Building2 } from "lucide-react";

type AddAddressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude: number;
  longitude: number;
  onSuccess: () => void;
};

export default function AddAddressDialog({
  open,
  onOpenChange,
  latitude,
  longitude,
  onSuccess,
}: AddAddressDialogProps) {
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [observations, setObservations] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [apartmentCount, setApartmentCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);

  // Reset form and fetch city when dialog opens
  useEffect(() => {
    if (open) {
      console.log("Dialog opened with coords:", latitude, longitude);
      setStreetName("");
      setStreetNumber("");
      setCity("");
      setObservations("");
      setIsBuilding(false);
      setBuildingName("");
      setApartmentCount("");
      setLoading(false);
      
      // Fetch city from coordinates using reverse geocoding
      const fetchCity = async () => {
        setLoadingCity(true);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'AddressDistributionApp/1.0'
              }
            }
          );
          const data = await response.json();
          const cityName = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "";
          setCity(cityName);
        } catch (error) {
          console.error("Error fetching city:", error);
        } finally {
          setLoadingCity(false);
        }
      };
      
      fetchCity();
    }
  }, [open, latitude, longitude]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const result = addressSchema.safeParse({
      street_name: streetName,
      street_number: streetNumber || undefined,
      city: city || undefined,
      latitude,
      longitude,
      observations: observations || undefined,
      status: "pending" as const,
      is_building: isBuilding,
      building_name: isBuilding && buildingName ? buildingName : undefined,
      apartment_count: isBuilding && apartmentCount ? parseInt(apartmentCount) : undefined
    });

    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          street_name: result.data.street_name,
          street_number: result.data.street_number || null,
          city: result.data.city || null,
          latitude: result.data.latitude,
          longitude: result.data.longitude,
          status: result.data.status,
          observations: result.data.observations || null,
          is_building: result.data.is_building || false,
          building_name: result.data.building_name || null,
          apartment_count: result.data.apartment_count || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data?.zone_id) {
        toast.success("Adresse ajoutée et assignée à une zone");
      } else {
        toast.message("Adresse ajoutée (hors zone, visible uniquement pour les admins)");
      }
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error adding address:", error);
      toast.error("Erreur lors de l'ajout de l'adresse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] z-[12010]">
        <DialogHeader>
          <DialogTitle>Ajouter une adresse</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle adresse à la liste en cliquant sur la carte.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street_name">Nom de rue *</Label>
            <Input
              id="street_name"
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
              placeholder="Rue de la Paix"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="street_number">Numéro</Label>
            <Input
              id="street_number"
              value={streetNumber}
              onChange={(e) => setStreetNumber(e.target.value)}
              placeholder="42"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={loadingCity ? "Chargement..." : "Ville"}
              disabled={loadingCity}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observations">Observations (max 1000 caractères)</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notes additionnelles..."
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {observations.length}/1000 caractères
            </p>
          </div>
          
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is_building" 
                checked={isBuilding}
                onCheckedChange={(checked) => setIsBuilding(checked === true)}
              />
              <Label htmlFor="is_building" className="flex items-center gap-2 cursor-pointer">
                <Building2 className="h-4 w-4" />
                C'est un immeuble
              </Label>
            </div>
            
            {isBuilding && (
              <div className="space-y-3 ml-6 animate-in fade-in-50 duration-200">
                <div className="space-y-2">
                  <Label htmlFor="building_name">Nom de l'immeuble (optionnel)</Label>
                  <Input 
                    id="building_name"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    placeholder="Ex: Résidence Les Chênes"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apartment_count">Nombre d'appartements estimé (optionnel)</Label>
                  <Input 
                    id="apartment_count"
                    type="number"
                    min="1"
                    value={apartmentCount}
                    onChange={(e) => setApartmentCount(e.target.value)}
                    placeholder="Ex: 12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vous pourrez ajouter les appartements précis après création
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            Coordonnées: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Ajout..." : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
