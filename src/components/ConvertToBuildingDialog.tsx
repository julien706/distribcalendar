import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ConvertToBuildingDialog({
  addressId,
  open,
  onOpenChange,
  onSuccess
}: {
  addressId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [buildingName, setBuildingName] = useState("");
  const [apartmentCount, setApartmentCount] = useState(3);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (!addressId) return;
    if (apartmentCount < 1 || apartmentCount > 100) {
      toast.error("Nombre d'appartements invalide (1-100)");
      return;
    }

    setLoading(true);
    
    // Update address to building
    const { error: updateError } = await supabase
      .from('addresses')
      .update({
        is_building: true,
        building_name: buildingName.trim() || null,
        apartment_count: apartmentCount
      })
      .eq('id', addressId);

    if (updateError) {
      toast.error("Erreur lors de la conversion");
      setLoading(false);
      return;
    }

    // Create default apartments
    const apartments = Array.from({ length: apartmentCount }, (_, i) => ({
      address_id: addressId,
      name: `Appartement ${i + 1}`,
      status: 'pending' as const
    }));

    const { error: insertError } = await supabase
      .from('apartments')
      .insert(apartments);

    if (insertError) {
      toast.error("Erreur lors de la création des appartements");
    } else {
      toast.success(`Immeuble créé avec ${apartmentCount} appartements`);
      onOpenChange(false);
      onSuccess();
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🏢 Convertir en immeuble</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom de l'immeuble (optionnel)</label>
            <Input
              placeholder="Ex: Résidence du Parc..."
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nombre d'appartements</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={apartmentCount}
              onChange={(e) => setApartmentCount(parseInt(e.target.value) || 3)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Des appartements numérotés seront créés automatiquement (vous pourrez les renommer)
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleConvert} disabled={loading} className="flex-1">
              {loading ? "Conversion..." : "Convertir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
