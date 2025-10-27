import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users, MapPin, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import TeamManagement from "@/components/TeamManagement";

interface Team {
  id: string;
  name: string;
  color: string;
  description: string | null;
  member_count?: number;
  zone_count?: number;
}

const Teams = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;

      const teamsWithCounts = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { count: memberCount } = await supabase
            .from("team_members")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);

          const { count: zoneCount } = await supabase
            .from("zones")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);

          return {
            ...team,
            member_count: memberCount || 0,
            zone_count: zoneCount || 0,
          };
        })
      );

      setTeams(teamsWithCounts);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Erreur lors du chargement des équipes");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (team?: Team) => {
    setSelectedTeam(team || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedTeam(null);
    fetchTeams();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-4 mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="self-start"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestion des Équipes</h1>
            <p className="text-muted-foreground mt-1">
              Créez et gérez vos équipes de distribution
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle équipe
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Card
            key={team.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleOpenDialog(team)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <CardTitle>{team.name}</CardTitle>
              </div>
              {team.description && (
                <CardDescription>{team.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{team.member_count} membres</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{team.zone_count} zones</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teams.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Aucune équipe créée</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Créer votre première équipe
            </Button>
          </CardContent>
        </Card>
      )}

      <TeamManagement
        open={dialogOpen}
        onClose={handleCloseDialog}
        team={selectedTeam}
      />
    </div>
  );
};

export default Teams;
