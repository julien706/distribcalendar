import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { toast } from "sonner";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";

type Apartment = {
  id: string;
  name: string;
  status: StatusType;
  observations: string | null;
};

type ApartmentQuickEditProps = {
  apartment: Apartment;
  onClose: () => void;
  onSaved: () => void;
};

export default function ApartmentQuickEdit({
  apartment,
  onClose,
  onSaved,
}: ApartmentQuickEditProps) {
  const [name, setName] = useState(apartment.name);
  const [status, setStatus] = useState<StatusType>(apartment.status);
  const [observations, setObservations] = useState(apartment.observations || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom de l'appartement est requis");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("apartments")
      .update({
        name: name.trim(),
        status,
        observations: observations.trim() || null,
      })
      .eq("id", apartment.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    } else {
      toast.success("Appartement mis à jour");
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l'appartement</DialogTitle>
          <DialogDescription>
            Modifiez les informations de l'appartement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Nom/Numéro/Étage/Sonnette
            </label>
            <Input
              placeholder="Ex: 3A, 2ème étage gauche"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Statut</label>
            <Select value={status} onValueChange={(value: StatusType) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: config.color }} />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Observations</label>
            <Textarea
              placeholder="Remarques..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
