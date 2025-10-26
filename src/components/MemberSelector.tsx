import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";

interface Profile {
  id: string;
  email: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profiles: Profile;
}

interface MemberSelectorProps {
  teamId: string;
}

const MemberSelector = ({ teamId }: MemberSelectorProps) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchProfiles();
  }, [teamId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase.from("team_members").select("*, profiles(id, email)").eq("team_id", teamId);
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id, email").order("email");
      if (error) throw error;
      setAllProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const availableProfiles = allProfiles.filter(
    (profile) =>
      !members.some((member) => member.user_id === profile.id) &&
      profile.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast.error("Veuillez sélectionner un utilisateur");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: selectedUserId, role: selectedRole });
      if (error) throw error;
      toast.success("Membre ajouté");
      setSelectedUserId("");
      setSearchTerm("");
      fetchMembers();
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Erreur lors de l'ajout du membre");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) throw error;
      toast.success("Membre retiré");
      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Erreur lors du retrait du membre");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("team_members").update({ role: newRole }).eq("id", memberId);
      if (error) throw error;
      toast.success("Rôle mis à jour");
      fetchMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Erreur lors de la mise à jour du rôle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-2 border rounded-lg">
            <span className="text-sm">{member.profiles.email}</span>
            <div className="flex items-center gap-2">
              <Select value={member.role} onValueChange={(value) => handleUpdateRole(member.id, value)} disabled={loading}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)} disabled={loading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Rechercher un utilisateur..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Membre</SelectItem>
            <SelectItem value="leader">Leader</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {searchTerm && availableProfiles.length > 0 && (
        <div className="border rounded-lg p-2 max-h-48 overflow-y-auto">
          {availableProfiles.slice(0, 10).map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer"
              onClick={() => { setSelectedUserId(profile.id); setSearchTerm(profile.email); }}
            >
              <span className="text-sm">{profile.email}</span>
            </div>
          ))}
        </div>
      )}
      {selectedUserId && (
        <Button onClick={handleAddMember} disabled={loading} className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          Ajouter le membre
        </Button>
      )}
    </div>
  );
};

export default MemberSelector;
