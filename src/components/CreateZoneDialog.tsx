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
      
      console.log('Creating zone with:', {
        name: name.trim(),
        color,
        team_id: teamId || null,
        coordinates: coordinates.length
      });
      
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

      if (zoneError) {
        console.error('Zone creation error:', zoneError);
        throw zoneError;
      }
      
      console.log('Zone created successfully:', zoneData);

      // Find addresses inside the polygon that are NOT already assigned to another zone
      console.log('Total addresses:', addresses.length);
      console.log('Polygon points:', polygon.length);
      
      const addressesInZone = addresses.filter(addr => {
        const inside = !addr.zone_id && isPointInPolygon(
          { lat: addr.latitude, lng: addr.longitude }, 
          polygon
        );
        if (inside || (!addr.zone_id && Math.abs(addr.latitude - polygon[0].lat) < 0.01)) {
          console.log(`Address ${addr.id}: lat=${addr.latitude}, lng=${addr.longitude}, inside=${inside}`);
        }
        return inside;
      });

      console.log('Addresses to assign:', addressesInZone.length, addressesInZone.map(a => a.id));

      if (addressesInZone.length > 0) {
        console.log('Updating addresses with zone_id:', zoneData.id);
        
        // Chunking pour éviter les problèmes de "Bad Request" avec trop d'IDs
        const CHUNK_SIZE = 300;
        const addressIds = addressesInZone.map(a => a.id);
        let totalUpdated = 0;

        for (let i = 0; i < addressIds.length; i += CHUNK_SIZE) {
          const chunk = addressIds.slice(i, i + CHUNK_SIZE);
          console.log(`Updating chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(addressIds.length / CHUNK_SIZE)}: ${chunk.length} addresses`);
          
          const { data: updateData, error: updateError } = await supabase
            .from("addresses")
            .update({ zone_id: zoneData.id })
            .in("id", chunk)
            .select();

          if (updateError) {
            console.error('Address update error:', updateError);
            
            // Message spécifique pour les erreurs RLS
            if (updateError.message?.includes('row level security') || updateError.message?.includes('permission')) {
              toast.error("Vous devez être administrateur pour assigner des adresses aux zones");
            } else {
              toast.error(`Erreur lors de l'assignation des adresses: ${updateError.message}`);
            }
            throw updateError;
          }

          totalUpdated += updateData?.length || 0;
          console.log(`Chunk updated: ${updateData?.length || 0} addresses`);
        }

        console.log(`Total addresses updated: ${totalUpdated}`);
        toast.success(`Zone créée avec ${totalUpdated} adresse(s) assignée(s)`);
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
