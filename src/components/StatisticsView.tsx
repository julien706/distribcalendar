import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, MapPin, Group } from "lucide-react";
import { toast } from "sonner";

interface UserStats {
  user_id: string;
  user_email: string;
  total_addresses: number;
  done: number;
  pending: number;
  refused: number;
  retry_first: number;
  retry_second: number;
  uninhabited: number;
}

interface ZoneStats {
  zone_id: string;
  zone_name: string;
  zone_color: string;
  total_addresses: number;
  done: number;
  pending: number;
  refused: number;
}

interface TeamStats {
  team_id: string;
  team_name: string;
  team_color: string;
  total_members: number;
  total_zones: number;
  total_addresses: number;
  done: number;
  pending: number;
}

export default function StatisticsView() {
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [zoneStats, setZoneStats] = useState<ZoneStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);

      // Fetch user statistics
      const { data: addressData } = await supabase
        .from("addresses")
        .select("status, last_visit_date, zone_id");

      const { data: profiles } = await supabase.from("profiles").select("id, email");

      // Fetch zones with team info
      const { data: zones } = await supabase
        .from("zones")
        .select("id, name, color, team_id, addresses(id, status)");

      // Fetch teams
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, color, team_members(user_id), zones(id)");

      // Calculate zone stats
      if (zones) {
        const zStats = zones.map((zone: any) => {
          const addresses = zone.addresses || [];
          return {
            zone_id: zone.id,
            zone_name: zone.name,
            zone_color: zone.color,
            total_addresses: addresses.length,
            done: addresses.filter((a: any) => a.status === "done").length,
            pending: addresses.filter((a: any) => a.status === "pending").length,
            refused: addresses.filter((a: any) => a.status === "refused").length,
          };
        });
        setZoneStats(zStats);
      }

      // Calculate team stats
      if (teams) {
        const tStats = teams.map((team: any) => {
          const zones = team.zones || [];
          const members = team.team_members || [];
          
          return {
            team_id: team.id,
            team_name: team.name,
            team_color: team.color,
            total_members: members.length,
            total_zones: zones.length,
            total_addresses: 0, // To be calculated from zones
            done: 0,
            pending: 0,
          };
        });
        setTeamStats(tStats);
      }

      // Calculate user stats (simplified)
      if (profiles && addressData) {
        const uStats = profiles.map((profile: any) => {
          return {
            user_id: profile.id,
            user_email: profile.email,
            total_addresses: 0,
            done: 0,
            pending: 0,
            refused: 0,
            retry_first: 0,
            retry_second: 0,
            uninhabited: 0,
          };
        });
        setUserStats(uStats);
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  const getCompletionRate = (done: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Chargement des statistiques...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Statistiques
        </CardTitle>
        <CardDescription>
          Vue d'ensemble des performances par utilisateur, zone et équipe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="zones" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="zones">
              <MapPin className="h-4 w-4 mr-2" />
              Zones
            </TabsTrigger>
            <TabsTrigger value="teams">
              <Group className="h-4 w-4 mr-2" />
              Équipes
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Utilisateurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="space-y-4 mt-4">
            {zoneStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune zone trouvée
              </p>
            ) : (
              zoneStats.map((zone) => (
                <div key={zone.zone_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: zone.zone_color }}
                      />
                      <h3 className="font-semibold">{zone.zone_name}</h3>
                    </div>
                    <Badge variant="secondary">
                      {getCompletionRate(zone.done, zone.total_addresses)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{zone.total_addresses}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Faites</p>
                      <p className="font-semibold text-green-600">{zone.done}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">En attente</p>
                      <p className="font-semibold text-blue-600">{zone.pending}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Refusées</p>
                      <p className="font-semibold text-red-600">{zone.refused}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="teams" className="space-y-4 mt-4">
            {teamStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune équipe trouvée
              </p>
            ) : (
              teamStats.map((team) => (
                <div key={team.team_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: team.team_color }}
                      />
                      <h3 className="font-semibold">{team.team_name}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Membres</p>
                      <p className="font-semibold">{team.total_members}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Zones</p>
                      <p className="font-semibold">{team.total_zones}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Adresses</p>
                      <p className="font-semibold">{team.total_addresses}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            {userStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun utilisateur trouvé
              </p>
            ) : (
              userStats.map((user) => (
                <div key={user.user_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{user.user_email}</h3>
                    <Badge variant="secondary">
                      {getCompletionRate(user.done, user.total_addresses)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{user.total_addresses}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Faites</p>
                      <p className="font-semibold text-green-600">{user.done}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">En attente</p>
                      <p className="font-semibold text-blue-600">{user.pending}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Refusées</p>
                      <p className="font-semibold text-red-600">{user.refused}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
