import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      console.log("Dialog opened with coords:", latitude, longitude);
      setStreetName("");
      setStreetNumber("");
      setObservations("");
      setLoading(false);
    }
  }, [open, latitude, longitude]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streetName.trim()) {
      toast.error("Le nom de rue est requis");
      return;
    }

    setLoading(true);
    console.log("Submitting address:", { streetName, streetNumber, latitude, longitude });
    
    try {
      const { data, error } = await supabase.from("addresses").insert({
        street_name: streetName.trim(),
        street_number: streetNumber.trim() || null,
        latitude,
        longitude,
        status: "pending",
        observations: observations.trim() || null,
      }).select();

      console.log("Insert result:", { data, error });

      if (error) throw error;

      toast.success("Adresse ajoutée avec succès");
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
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notes additionnelles..."
              rows={3}
            />
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
