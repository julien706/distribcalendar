import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Zone {
  id: string;
  name: string;
  color: string;
  team_id: string | null;
  teams?: { name: string; color: string; } | null;
  address_count?: number;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

const ZoneManagement = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, teamsRes] = await Promise.all([
        supabase.from("zones").select("*, teams(name, color)").order("name"),
        supabase.from("teams").select("*").order("name"),
      ]);
      if (zonesRes.error) throw zonesRes.error;
      if (teamsRes.error) throw teamsRes.error;
      
      // Get address counts for each zone
      const zonesWithCounts = await Promise.all(
        (zonesRes.data || []).map(async (zone) => {
          const { count } = await supabase
            .from("addresses")
            .select("*", { count: "exact", head: true })
            .eq("zone_id", zone.id);
          return { ...zone, address_count: count || 0 };
        })
      );
      
      setZones(zonesWithCounts);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      // First, unassign all addresses from this zone
      const { error: updateError } = await supabase
        .from("addresses")
        .update({ zone_id: null })
        .eq("zone_id", zoneId);
      
      if (updateError) throw updateError;

      // Then delete the zone
      const { error: deleteError } = await supabase
        .from("zones")
        .delete()
        .eq("id", zoneId);
      
      if (deleteError) throw deleteError;

      toast.success("Zone supprimée");
      fetchData();
    } catch (error) {
      console.error("Error deleting zone:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleAssignTeam = async (zoneId: string, teamId: string | null) => {
    try {
      const { error } = await supabase.from("zones").update({ team_id: teamId }).eq("id", zoneId);
      if (error) throw error;
      toast.success("Zone assignée");
      fetchData();
    } catch (error) {
      console.error("Error assigning team:", error);
      toast.error("Erreur lors de l'assignation");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Zones</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zones.map((zone) => (
          <Card key={zone.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: zone.color }} />
                  <CardTitle className="text-lg">{zone.name}</CardTitle>
                </div>
                {zone.teams && (
                  <Badge style={{ backgroundColor: zone.teams.color, color: "#fff" }}>
                    {zone.teams.name}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{zone.address_count} adresse(s)</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette zone ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action supprimera la zone "{zone.name}". Les adresses assignées à cette zone seront désassignées mais ne seront pas supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteZone(zone.id)}>
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Assigner à une équipe</label>
                <Select value={zone.team_id || "none"} onValueChange={(value) => handleAssignTeam(zone.id, value === "none" ? null : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune équipe</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {zones.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">Aucune zone définie</p>
            <p className="text-sm text-muted-foreground">Utilisez la carte pour dessiner vos zones de distribution</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ZoneManagement;
