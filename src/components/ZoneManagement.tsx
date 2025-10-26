import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Pencil, Trash2 } from "lucide-react";

interface Zone {
  id: string;
  name: string;
  color: string;
  team_id: string | null;
  boundary_coordinates: any;
  teams?: {
    name: string;
  } | null;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface ZoneManagementProps {
  onSelectZone: (zone: Zone) => void;
  selectedZoneId: string | null;
}

const ZoneManagement = ({ onSelectZone, selectedZoneId }: ZoneManagementProps) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneColor, setZoneColor] = useState("#10B981");
  const [zoneTeamId, setZoneTeamId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchZones();
    fetchTeams();
  }, []);

  const fetchZones = async () => {
    const { data, error } = await supabase
      .from("zones")
      .select("*, teams(name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setZones(data);
    }
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, color")
      .order("name");

    if (!error && data) {
      setTeams(data);
    }
  };

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneColor(zone.color);
    setZoneTeamId(zone.team_id || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveZone = async () => {
    if (!editingZone) return;

    const { error } = await supabase
      .from("zones")
      .update({
        name: zoneName,
        color: zoneColor,
        team_id: zoneTeamId || null,
      })
      .eq("id", editingZone.id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de modifier la zone", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Zone modifiée" });
      setIsEditDialogOpen(false);
      fetchZones();
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette zone ?")) return;

    const { error } = await supabase.from("zones").delete().eq("id", zoneId);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer la zone", variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Zone supprimée" });
      fetchZones();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {zones.map((zone) => (
          <Card
            key={zone.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedZoneId === zone.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => onSelectZone(zone)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: zone.color }}
                />
                <div>
                  <h4 className="font-semibold">{zone.name}</h4>
                  {zone.teams && (
                    <p className="text-xs text-muted-foreground">
                      Équipe: {zone.teams.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditZone(zone);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteZone(zone.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {zones.length === 0 && (
        <div className="text-center py-8">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucune zone créée. Utilisez l'outil de dessin sur la carte.
          </p>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la zone</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="zone-name">Nom de la zone</Label>
              <Input
                id="zone-name"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="zone-color">Couleur</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="zone-color"
                  type="color"
                  value={zoneColor}
                  onChange={(e) => setZoneColor(e.target.value)}
                  className="w-20 h-10"
                />
                <span className="text-sm text-muted-foreground">{zoneColor}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="zone-team">Équipe assignée</Label>
              <Select value={zoneTeamId} onValueChange={setZoneTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une équipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune équipe</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveZone}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZoneManagement;