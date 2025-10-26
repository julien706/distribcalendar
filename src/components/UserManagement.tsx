import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Users as UsersIcon } from "lucide-react";

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
  teamMember: TeamMember | null;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Combine data
      const userData: UserData[] = (profiles || []).map(profile => ({
        profile,
        role: roles?.find(r => r.user_id === profile.id) || null,
        teamMember: teamMembers?.find(tm => tm.user_id === profile.id) || null,
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
      // Check if user already has a role
      const existingRole = users.find(u => u.profile.id === userId)?.role;

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as any })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new role
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

  const handleTeamChange = async (userId: string, teamId: string) => {
    try {
      const existingTeamMember = users.find(u => u.profile.id === userId)?.teamMember;

      if (teamId === "none") {
        // Remove from team
        if (existingTeamMember) {
          const { error } = await supabase
            .from("team_members")
            .delete()
            .eq("id", existingTeamMember.id);

          if (error) throw error;
        }
      } else {
        if (existingTeamMember) {
          // Update team
          const { error } = await supabase
            .from("team_members")
            .update({ team_id: teamId })
            .eq("id", existingTeamMember.id);

          if (error) throw error;
        } else {
          // Add to team
          const { error } = await supabase
            .from("team_members")
            .insert([{ user_id: userId, team_id: teamId, role: "member" }] as any);

          if (error) throw error;
        }
      }

      toast.success("Équipe mise à jour");
      fetchData();
    } catch (error: any) {
      console.error("Error updating team:", error);
      toast.error("Erreur lors de la mise à jour de l'équipe");
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
          Gérer les rôles et les affectations d'équipe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((userData) => (
            <div key={userData.profile.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userData.profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {userData.role && (
                    <Badge variant={userData.role.role === "admin" ? "default" : "secondary"}>
                      <Shield className="h-3 w-3 mr-1" />
                      {userData.role.role === "admin" ? "Admin" : "Utilisateur"}
                    </Badge>
                  )}
                  {userData.teamMember && (
                    <Badge variant="outline" style={{ borderColor: userData.teamMember.teams.color }}>
                      {userData.teamMember.teams.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                <Select
                  value={userData.teamMember?.team_id || "none"}
                  onValueChange={(value) => handleTeamChange(userData.profile.id, value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Aucune équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune équipe</SelectItem>
                    {teams.map((team) => (
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
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
