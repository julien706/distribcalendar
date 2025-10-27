import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import L from "leaflet";

interface CreateZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  polygon: L.LatLng[] | null;
  addresses: Array<{ id: string; latitude: number; longitude: number; zone_id?: string | null }>;
  onSuccess: () => void;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  "#10B981", // green
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

export default function CreateZoneDialog({ open, onOpenChange, polygon, addresses, onSuccess }: CreateZoneDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [teamId, setTeamId] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open]);

  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*").order("name");
    if (!error && data) {
      setTeams(data);
    }
  };

  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: L.LatLng[]) => {
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom de la zone est requis");
      return;
    }

    if (!polygon || polygon.length < 3) {
      toast.error("Polygone invalide");
      return;
    }

    setLoading(true);

    try {
      // Convert polygon to GeoJSON format
      const coordinates = polygon.map(p => [p.lng, p.lat]);
      
      // Create zone
      const { data: zoneData, error: zoneError } = await supabase
        .from("zones")
        .insert({
          name: name.trim(),
          color: color,
          team_id: teamId || null,
          boundary_coordinates: coordinates,
        })
        .select()
        .single();

      if (zoneError) throw zoneError;

      // Find addresses inside the polygon that are NOT already assigned to another zone
      const addressesInZone = addresses.filter(addr => 
        !addr.zone_id && isPointInPolygon({ lat: addr.latitude, lng: addr.longitude }, polygon)
      );

      if (addressesInZone.length > 0) {
        const { error: updateError } = await supabase
          .from("addresses")
          .update({ zone_id: zoneData.id })
          .in("id", addressesInZone.map(a => a.id));

        if (updateError) throw updateError;

        toast.success(`Zone créée avec ${addressesInZone.length} adresse(s) assignée(s)`);
      } else {
        toast.success("Zone créée sans adresse assignée");
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Error creating zone:", error);
      toast.error(error.message || "Erreur lors de la création de la zone");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setColor(PRESET_COLORS[0]);
    setTeamId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une nouvelle zone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nom de la zone *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Zone Nord"
            />
          </div>
          <div>
            <Label htmlFor="color">Couleur</Label>
            <div className="flex gap-2 mt-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    color === c ? "border-primary scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="team">Équipe (optionnel)</Label>
            <Select value={teamId || "none"} onValueChange={(value) => setTeamId(value === "none" ? "" : value)}>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : "Créer la zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
