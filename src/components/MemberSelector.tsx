import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";

interface Profile {
  id: string;
  email: string;
}

interface MemberSelectorProps {
  teamId: string;
  existingMemberIds: string[];
  onAddMembers: (userIds: string[]) => void;
}

const MemberSelector = ({ teamId, existingMemberIds, onAddMembers }: MemberSelectorProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchProfiles();
  }, [teamId]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email")
      .order("email");

    if (!error && data) {
      setProfiles(data);
    }
  };

  const availableProfiles = profiles.filter(
    (p) =>
      !existingMemberIds.includes(p.id) &&
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAdd = () => {
    if (selectedIds.length > 0) {
      onAddMembers(selectedIds);
      setSelectedIds([]);
      setSearchQuery("");
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <Label>Ajouter des membres</Label>
      <Input
        placeholder="Rechercher par email..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2">
        {availableProfiles.map((profile) => (
          <div key={profile.id} className="flex items-center gap-2">
            <Checkbox
              id={`profile-${profile.id}`}
              checked={selectedIds.includes(profile.id)}
              onCheckedChange={() => handleToggle(profile.id)}
            />
            <label
              htmlFor={`profile-${profile.id}`}
              className="text-sm cursor-pointer flex-1"
            >
              {profile.email}
            </label>
          </div>
        ))}
        {availableProfiles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Aucun utilisateur disponible
          </p>
        )}
      </div>

      <Button
        onClick={handleAdd}
        disabled={selectedIds.length === 0}
        className="w-full"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Ajouter {selectedIds.length > 0 && `(${selectedIds.length})`}
      </Button>
    </div>
  );
};

export default MemberSelector;