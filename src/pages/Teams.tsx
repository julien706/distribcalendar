import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Users, MapPin } from "lucide-react";
import TeamManagement from "@/components/TeamManagement";

interface Team {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

interface TeamStats {
  memberCount: number;
  zoneCount: number;
  addressCount: number;
}

const Teams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, TeamStats>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const { data: teamsData, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les équipes", variant: "destructive" });
      return;
    }

    setTeams(teamsData || []);

    // Fetch stats for each team
    const stats: Record<string, TeamStats> = {};
    for (const team of teamsData || []) {
      const [members, zones] = await Promise.all([
        supabase.from("team_members").select("id", { count: "exact" }).eq("team_id", team.id),
        supabase.from("zones").select("id", { count: "exact" }).eq("team_id", team.id),
      ]);

      const { data: zoneIds } = await supabase.from("zones").select("id").eq("team_id", team.id);
      const zoneIdList = zoneIds?.map(z => z.id) || [];
      
      let addressCount = 0;
      if (zoneIdList.length > 0) {
        const { count } = await supabase
          .from("addresses")
          .select("id", { count: "exact" })
          .in("zone_id", zoneIdList);
        addressCount = count || 0;
      }

      stats[team.id] = {
        memberCount: members.count || 0,
        zoneCount: zones.count || 0,
        addressCount,
      };
    }
    setTeamStats(stats);
  };

  const handleCreateTeam = () => {
    setSelectedTeam(null);
    setIsDialogOpen(true);
  };

  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedTeam(null);
    fetchTeams();
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Équipes</h1>
          <p className="text-muted-foreground mt-1">Organisez vos distributeurs en équipes</p>
        </div>
        <Button onClick={handleCreateTeam}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Équipe
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => {
          const stats = teamStats[team.id] || { memberCount: 0, zoneCount: 0, addressCount: 0 };
          return (
            <Card
              key={team.id}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleEditTeam(team)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <h3 className="text-xl font-semibold">{team.name}</h3>
                </div>
              </div>
              
              {team.description && (
                <p className="text-sm text-muted-foreground mb-4">{team.description}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{stats.memberCount} membre{stats.memberCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{stats.zoneCount} zone{stats.zoneCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{stats.addressCount} adresse{stats.addressCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {teams.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune équipe</h3>
          <p className="text-muted-foreground mb-4">Créez votre première équipe pour commencer</p>
          <Button onClick={handleCreateTeam}>
            <Plus className="mr-2 h-4 w-4" />
            Créer une équipe
          </Button>
        </div>
      )}

      <TeamManagement
        open={isDialogOpen}
        onClose={handleDialogClose}
        team={selectedTeam}
      />
    </div>
  );
};

export default Teams;