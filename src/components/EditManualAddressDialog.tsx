import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ManualAddress = {
  id: string;
  street_name: string;
  street_number: string | null;
  observations: string | null;
};

type EditManualAddressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: ManualAddress | null;
  onSuccess: (updated: { street_name: string; street_number: string | null; observations: string | null }) => void;
};

export default function EditManualAddressDialog({
  open,
  onOpenChange,
  address,
  onSuccess,
}: EditManualAddressDialogProps) {
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && address) {
      setStreetName(address.street_name || "");
      setStreetNumber(address.street_number || "");
      setObservations(address.observations || "");
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
          observations: observations.trim() || null,
        })
        .eq("id", address.id);

      if (error) throw error;

      toast.success("Informations mises à jour");
      onSuccess({
        street_name: streetName.trim(),
        street_number: streetNumber.trim() || null,
        observations: observations.trim() || null,
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
            <Label htmlFor="observations">Observations</Label>
            <Textarea id="observations" rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} />
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
