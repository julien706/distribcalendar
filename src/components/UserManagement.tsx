import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Users as UsersIcon, Plus, X } from "lucide-react";

interface Profile {
  id: string;
  email: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  teams: {
    id: string;
    name: string;
    color: string;
  };
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface UserData {
  profile: Profile;
  role: UserRole | null;
  teamMembers: TeamMember[];
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTeamForUser, setAddingTeamForUser] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email")
        .order("email");

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch all team members with team info
      const { data: teamMembers, error: teamMembersError } = await supabase
        .from("team_members")
        .select("id, user_id, team_id, teams(id, name, color)");

      if (teamMembersError) throw teamMembersError;

      // Fetch all teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, color")
        .order("name");

      if (teamsError) throw teamsError;

      setTeams(teamsData || []);

      // Combine data - support multiple teams per user
      const userData: UserData[] = (profiles || []).map(profile => ({
        profile,
        role: roles?.find(r => r.user_id === profile.id) || null,
        teamMembers: teamMembers?.filter(tm => tm.user_id === profile.id) || [],
      }));

      setUsers(userData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "user") => {
    try {
      const existingRole = users.find(u => u.profile.id === userId)?.role;

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as any })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole as any });

        if (error) throw error;
      }

      toast.success("Rôle mis à jour");
      fetchData();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Erreur lors de la mise à jour du rôle");
    }
  };

  const handleAddTeam = async (userId: string, teamId: string) => {
    try {
      // Check if user is already in this team
      const userData = users.find(u => u.profile.id === userId);
      if (userData?.teamMembers.some(tm => tm.team_id === teamId)) {
        toast.error("L'utilisateur est déjà dans cette équipe");
        return;
      }

      const { error } = await supabase
        .from("team_members")
        .insert([{ user_id: userId, team_id: teamId, role: "member" }] as any);

      if (error) throw error;

      toast.success("Équipe ajoutée");
      setAddingTeamForUser(null);
      fetchData();
    } catch (error: any) {
      console.error("Error adding team:", error);
      toast.error("Erreur lors de l'ajout de l'équipe");
    }
  };

  const handleRemoveTeam = async (teamMemberId: string) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", teamMemberId);

      if (error) throw error;

      toast.success("Équipe retirée");
      fetchData();
    } catch (error: any) {
      console.error("Error removing team:", error);
      toast.error("Erreur lors du retrait de l'équipe");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5" />
          Gestion des utilisateurs
        </CardTitle>
        <CardDescription>
          Gérer les rôles et les affectations d'équipe (plusieurs équipes possibles)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((userData) => (
            <div key={userData.profile.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userData.profile.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {userData.role && (
                      <Badge variant={userData.role.role === "admin" ? "default" : "secondary"}>
                        <Shield className="h-3 w-3 mr-1" />
                        {userData.role.role === "admin" ? "Admin" : "Utilisateur"}
                      </Badge>
                    )}
                  </div>
                </div>
                <Select
                  value={userData.role?.role || "user"}
                  onValueChange={(value) => handleRoleChange(userData.profile.id, value as "admin" | "user")}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Display all teams for this user */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Équipes :</p>
                  {addingTeamForUser === userData.profile.id ? (
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(value) => handleAddTeam(userData.profile.id, value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teams
                            .filter(team => !userData.teamMembers.some(tm => tm.team_id === team.id))
                            .map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: team.color }}
                                  />
                                  {team.name}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAddingTeamForUser(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingTeamForUser(userData.profile.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter une équipe
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {userData.teamMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucune équipe</p>
                  ) : (
                    userData.teamMembers.map((tm) => (
                      <Badge
                        key={tm.id}
                        variant="outline"
                        style={{ borderColor: tm.teams.color }}
                        className="flex items-center gap-1"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tm.teams.color }}
                        />
                        {tm.teams.name}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                          onClick={() => handleRemoveTeam(tm.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
