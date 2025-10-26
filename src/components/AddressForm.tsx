import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
};

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "done", label: "Fait" },
  { value: "retry_first", label: "À repasser 1ère fois" },
  { value: "retry_second", label: "À repasser 2ème fois" },
  { value: "refused", label: "Refus" },
  { value: "uninhabited", label: "Inhabité" },
];

export default function AddressForm({
  address,
  open,
  onClose,
}: {
  address: Address | null;
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited">(
    (address?.status as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited") || "pending"
  );
  const [observations, setObservations] = useState(address?.observations || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!address) return;

    setSaving(true);
    const { error } = await supabase
      .from("addresses")
      .update({
        status,
        observations: observations || null,
        last_visit_date: new Date().toISOString(),
      })
      .eq("id", address.id);

    setSaving(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Adresse mise à jour avec succès");
      onClose();
    }
  };

  if (!address) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {address.street_number || ""} {address.street_name}
          </DialogTitle>
          <DialogDescription>
            Mettre à jour le statut de distribution
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <Select 
              value={status} 
              onValueChange={(value) => setStatus(value as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observations</label>
            <Textarea
              placeholder="Notes, commentaires..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
