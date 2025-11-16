import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/statusConfig";

type Apartment = {
  id: string;
  name: string;
  status: string;
  observations: string | null;
};

export function BuildingApartmentsDialog({
  addressId,
  open,
  onOpenChange,
  onUpdate
}: {
  addressId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newApartmentName, setNewApartmentName] = useState("");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  useEffect(() => {
    if (open && addressId) {
      fetchApartments();
    }
  }, [open, addressId]);

  const fetchApartments = async () => {
    if (!addressId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('apartments')
      .select('*')
      .eq('address_id', addressId)
      .order('name');
    
    if (error) {
      toast.error("Erreur lors du chargement des appartements");
    } else {
      setApartments(data || []);
    }
    setLoading(false);
  };

  const handleAddApartment = async () => {
    if (!addressId || !newApartmentName.trim()) {
      toast.error("Le nom de l'appartement est requis");
      return;
    }

    const { error } = await supabase
      .from('apartments')
      .insert({
        address_id: addressId,
        name: newApartmentName.trim(),
        status: 'pending'
      });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      toast.success("Appartement ajouté");
      setNewApartmentName("");
      fetchApartments();
      onUpdate();
    }
  };

  const handleUpdateApartment = async (
    aptId: string, 
    field: 'status' | 'observations', 
    value: string
  ) => {
    const { error } = await supabase
      .from('apartments')
      .update({ [field]: value })
      .eq('id', aptId);

    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      setApartments(prev => prev.map(apt => 
        apt.id === aptId ? { ...apt, [field]: value } : apt
      ));
      onUpdate();
    }
  };

  const handleUpdateName = async (aptId: string, newName: string) => {
    if (!newName.trim()) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }

    const { error } = await supabase
      .from('apartments')
      .update({ name: newName.trim() })
      .eq('id', aptId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du nom");
    } else {
      setApartments(prev => prev.map(apt => 
        apt.id === aptId ? { ...apt, name: newName.trim() } : apt
      ));
      setEditingNameId(null);
      setEditingNameValue("");
      onUpdate();
      toast.success("Nom modifié");
    }
  };

  const handleDeleteApartment = async (aptId: string) => {
    if (!confirm("Supprimer cet appartement ?")) return;

    const { error } = await supabase
      .from('apartments')
      .delete()
      .eq('id', aptId);

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Appartement supprimé");
      fetchApartments();
      onUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🏢 Gestion des appartements</DialogTitle>
        </DialogHeader>

        {/* Add apartment form */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Nom de l'appartement (ex: Appt. 1, Rez-de-chaussée...)"
            value={newApartmentName}
            onChange={(e) => setNewApartmentName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddApartment()}
          />
          <Button onClick={handleAddApartment}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>

        {/* Apartments list */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-muted-foreground">Chargement...</p>
          ) : apartments.length === 0 ? (
            <p className="text-center text-muted-foreground">Aucun appartement</p>
          ) : (
            apartments.map((apt) => (
              <div key={apt.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {editingNameId === apt.id ? (
                    <div className="flex gap-2 items-center flex-1">
                      <Input
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateName(apt.id, editingNameValue);
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                        autoFocus
                        className="text-sm"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateName(apt.id, editingNameValue)}
                        className="h-8 w-8 p-0"
                      >
                        ✓
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setEditingNameId(null)}
                        className="h-8 w-8 p-0"
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <strong className="text-sm">{apt.name}</strong>
                      <button 
                        onClick={() => {
                          setEditingNameId(apt.id);
                          setEditingNameValue(apt.name);
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs"
                        title="Modifier le nom"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteApartment(apt.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <Select
                  value={apt.status}
                  onValueChange={(value) => handleUpdateApartment(apt.id, 'status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Observations..."
                  value={apt.observations || ""}
                  onChange={(e) => handleUpdateApartment(apt.id, 'observations', e.target.value)}
                  rows={2}
                />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
