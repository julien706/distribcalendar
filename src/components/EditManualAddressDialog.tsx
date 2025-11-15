import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export type ManualAddress = {
  id: string;
  street_name: string;
  street_number: string | null;
  city: string | null;
  observations: string | null;
  is_building?: boolean | null;
  building_name?: string | null;
  apartment_count?: number | null;
};

type EditManualAddressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: ManualAddress | null;
  onSuccess: (updated: { street_name: string; street_number: string | null; city: string | null; observations: string | null; is_building?: boolean | null; building_name?: string | null; apartment_count?: number | null }) => void;
};

export default function EditManualAddressDialog({
  open,
  onOpenChange,
  address,
  onSuccess,
}: EditManualAddressDialogProps) {
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [city, setCity] = useState("");
  const [observations, setObservations] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [apartmentCount, setApartmentCount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && address) {
      setStreetName(address.street_name || "");
      setStreetNumber(address.street_number || "");
      setCity(address.city || "");
      setObservations(address.observations || "");
      setIsBuilding(address.is_building || false);
      setBuildingName(address.building_name || "");
      setApartmentCount(address.apartment_count ? String(address.apartment_count) : "");
      setLoading(false);
    }
  }, [open, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    if (!streetName.trim()) {
      toast.error("Le nom de rue est requis");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("addresses")
        .update({
          street_name: streetName.trim(),
          street_number: streetNumber.trim() || null,
          city: city.trim() || null,
          observations: observations.trim() || null,
          is_building: isBuilding,
          building_name: isBuilding && buildingName.trim() ? buildingName.trim() : null,
          apartment_count: isBuilding && apartmentCount ? parseInt(apartmentCount) : null,
        })
        .eq("id", address.id);

      if (error) throw error;

      toast.success("Informations mises à jour");
      onSuccess({
        street_name: streetName.trim(),
        street_number: streetNumber.trim() || null,
        city: city.trim() || null,
        observations: observations.trim() || null,
        is_building: isBuilding,
        building_name: isBuilding && buildingName.trim() ? buildingName.trim() : null,
        apartment_count: isBuilding && apartmentCount ? parseInt(apartmentCount) : null,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  if (!address) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] z-[12010]">
        <DialogHeader>
          <DialogTitle>Modifier les informations</DialogTitle>
          <DialogDescription>
            Éditez le nom et le numéro de rue de cet emplacement
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street_name">Nom de rue *</Label>
            <Input id="street_name" value={streetName} onChange={(e) => setStreetName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="street_number">Numéro</Label>
            <Input id="street_number" value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observations">Observations</Label>
            <Textarea id="observations" rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} />
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
                    Vous pourrez ajouter les appartements précis en cliquant sur l'adresse
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
