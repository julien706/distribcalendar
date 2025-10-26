import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import MemberSelector from "./MemberSelector";
import { Trash2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface TeamManagementProps {
  open: boolean;
  onClose: () => void;
  team?: Team | null;
}

const TeamManagement = ({ open, onClose, team }: TeamManagementProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setColor(team.color);
      setDescription(team.description || "");
    } else {
      setName("");
      setColor("#3B82F6");
      setDescription("");
    }
  }, [team]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom de l'équipe est requis");
      return;
    }

    setLoading(true);
    try {
      if (team) {
        const { error } = await supabase
          .from("teams")
          .update({ name: name.trim(), color, description: description.trim() || null })
          .eq("id", team.id);
        if (error) throw error;
        toast.success("Équipe mise à jour");
      } else {
        const { error } = await supabase
          .from("teams")
          .insert({ name: name.trim(), color, description: description.trim() || null });
        if (error) throw error;
        toast.success("Équipe créée");
      }
      onClose();
    } catch (error) {
      console.error("Error saving team:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!team || !confirm("Êtes-vous sûr de vouloir supprimer cette équipe ?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("teams").delete().eq("id", team.id);
      if (error) throw error;
      toast.success("Équipe supprimée");
      onClose();
    } catch (error) {
      console.error("Error deleting team:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team ? "Modifier l'équipe" : "Nouvelle équipe"}</DialogTitle>
          <DialogDescription>
            {team ? "Modifiez les informations de l'équipe" : "Créez une nouvelle équipe de distribution"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nom de l'équipe *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Équipe Nord" />
          </div>
          <div>
            <Label htmlFor="color">Couleur</Label>
            <div className="flex gap-2">
              <Input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-20 h-10" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Zone nord de la ville..." rows={3} />
          </div>
          {team && (
            <div>
              <Label>Membres de l'équipe</Label>
              <MemberSelector teamId={team.id} />
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between">
          <div>
            {team && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamManagement;
