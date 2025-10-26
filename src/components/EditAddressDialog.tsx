import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addressSchema } from "@/lib/validationSchemas";
import { MapPin } from "lucide-react";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
};

type EditAddressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: Address | null;
  onSuccess: () => void;
  onMoveRequest: () => void;
};

export default function EditAddressDialog({
  open,
  onOpenChange,
  address,
  onSuccess,
  onMoveRequest,
}: EditAddressDialogProps) {
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && address) {
      setStreetName(address.street_name);
      setStreetNumber(address.street_number || "");
      setObservations(address.observations || "");
      setLoading(false);
    }
  }, [open, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    // Validate inputs
    const result = addressSchema.safeParse({
      street_name: streetName,
      street_number: streetNumber || undefined,
      latitude: address.latitude,
      longitude: address.longitude,
      observations: observations || undefined,
      status: address.status as any
    });

    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from("addresses")
        .update({
          street_name: result.data.street_name,
          street_number: result.data.street_number || null,
          observations: result.data.observations || null,
        })
        .eq("id", address.id);

      if (error) throw error;

      toast.success("Adresse modifiée avec succès");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating address:", error);
      toast.error("Erreur lors de la modification de l'adresse");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveClick = () => {
    onOpenChange(false);
    onMoveRequest();
  };

  if (!address) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] z-[12010]">
        <DialogHeader>
          <DialogTitle>Modifier l'adresse</DialogTitle>
          <DialogDescription>
            Modifiez les informations de l'adresse
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
          <div className="text-xs text-muted-foreground">
            Coordonnées: {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleMoveClick}
            className="w-full"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Déplacer sur la carte
          </Button>
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
              {loading ? "Modification..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}