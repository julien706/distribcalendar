import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export function ConvertToAddressDialog({
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
  const [apartmentCount, setApartmentCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && addressId) {
      fetchApartmentCount();
    }
  }, [open, addressId]);

  const fetchApartmentCount = async () => {
    if (!addressId) return;
    const { count } = await supabase
      .from('apartments')
      .select('*', { count: 'exact', head: true })
      .eq('address_id', addressId);
    setApartmentCount(count || 0);
  };

  const handleConvert = async () => {
    if (!addressId) return;

    setLoading(true);

    // Delete all apartments
    const { error: deleteError } = await supabase
      .from('apartments')
      .delete()
      .eq('address_id', addressId);

    if (deleteError) {
      toast.error("Erreur lors de la suppression des appartements");
      setLoading(false);
      return;
    }

    // Convert to simple address
    const { error: updateError } = await supabase
      .from('addresses')
      .update({
        is_building: false,
        building_name: null,
        apartment_count: null
      })
      .eq('id', addressId);

    if (updateError) {
      toast.error("Erreur lors de la conversion");
    } else {
      toast.success("Converti en adresse simple");
      onOpenChange(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🏠 Convertir en adresse simple</DialogTitle>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Cette action est irréversible et supprimera <strong>{apartmentCount} appartement{apartmentCount > 1 ? 's' : ''}</strong> ainsi que toutes leurs données (statuts, observations).
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleConvert} disabled={loading} className="flex-1">
            {loading ? "Conversion..." : "Confirmer la suppression"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
