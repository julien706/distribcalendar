import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EditZoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: { id: string; name: string; color: string; boundary_coordinates: any } | null;
  onSuccess: () => void;
};

export default function EditZoneDialog({ open, onOpenChange, zone, onSuccess }: EditZoneDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10B981");

  useEffect(() => {
    if (zone) {
      setName(zone.name);
      setColor(zone.color);
    }
  }, [zone]);

  const handleSave = async () => {
    if (!zone || !name.trim()) {
      toast.error("Le nom de la zone est requis");
      return;
    }

    try {
      const { error } = await supabase
        .from("zones")
        .update({ name: name.trim(), color })
        .eq("id", zone.id);

      if (error) throw error;

      toast.success("Zone mise à jour");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating zone:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (!zone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la zone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="zone-name">Nom de la zone</Label>
            <Input
              id="zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Zone Centre-Ville"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-color">Couleur</Label>
            <div className="flex gap-2">
              <Input
                id="zone-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#10B981"
                className="flex-1"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
