import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import MemberSelector from "./MemberSelector";

interface Team {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    email: string;
  };
}

interface TeamManagementProps {
  open: boolean;
  onClose: () => void;
  team: Team | null;
}

const TeamManagement = ({ open, onClose, team }: TeamManagementProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (team) {
      setName(team.name);
      setColor(team.color);
      setDescription(team.description || "");
      fetchMembers(team.id);
    } else {
      setName("");
      setColor("#3B82F6");
      setDescription("");
      setMembers([]);
    }
  }, [team]);

  const fetchMembers = async (teamId: string) => {
    const { data, error } = await supabase
      .from("team_members")
      .select("id, user_id, role, profiles(email)")
      .eq("team_id", teamId);

    if (!error && data) {
      setMembers(data as TeamMember[]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Erreur", description: "Le nom est requis", variant: "destructive" });
      return;
    }

    setLoading(true);

    if (team) {
      // Update existing team
      const { error } = await supabase
        .from("teams")
        .update({ name, color, description })
        .eq("id", team.id);

      if (error) {
        toast({ title: "Erreur", description: "Impossible de modifier l'équipe", variant: "destructive" });
      } else {
        toast({ title: "Succès", description: "Équipe modifiée" });
        onClose();
      }
    } else {
      // Create new team
      const { error } = await supabase
        .from("teams")
        .insert({ name, color, description });

      if (error) {
        toast({ title: "Erreur", description: "Impossible de créer l'équipe", variant: "destructive" });
      } else {
        toast({ title: "Succès", description: "Équipe créée" });
        onClose();
      }
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!team) return;

    if (!confirm("Voulez-vous vraiment supprimer cette équipe ?")) return;

    setLoading(true);
    const { error } = await supabase.from("teams").delete().eq("id", team.id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer l'équipe", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Équipe supprimée" });
      onClose();
    }
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de retirer le membre", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Membre retiré" });
      if (team) fetchMembers(team.id);
    }
  };

  const handleAddMembers = async (userIds: string[]) => {
    if (!team) return;

    const { error } = await supabase.from("team_members").insert(
      userIds.map((userId) => ({
        team_id: team.id,
        user_id: userId,
        role: "member",
      }))
    );

    if (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter les membres", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Membres ajoutés" });
      fetchMembers(team.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team ? "Modifier l'équipe" : "Nouvelle équipe"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nom de l'équipe</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Équipe Nord"
            />
          </div>

          <div>
            <Label htmlFor="color">Couleur</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'équipe"
              rows={3}
            />
          </div>

          {team && (
            <div>
              <Label>Membres de l'équipe</Label>
              <div className="mt-2 space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <span className="text-sm">{member.profiles.email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <MemberSelector
                teamId={team.id}
                existingMemberIds={members.map((m) => m.user_id)}
                onAddMembers={handleAddMembers}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          {team && (
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Supprimer
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamManagement;