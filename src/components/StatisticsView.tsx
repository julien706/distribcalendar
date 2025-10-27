import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, MapPin, Group } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

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
  refused: number;
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
      if (teams && zones) {
        const tStats = teams.map((team: any) => {
          const teamZones = zones.filter((z: any) => z.team_id === team.id);
          const members = team.team_members || [];
          
          // Calculate totals from all team zones
          let total_addresses = 0;
          let done = 0;
          let pending = 0;
          let refused = 0;
          
          teamZones.forEach((zone: any) => {
            const addresses = zone.addresses || [];
            total_addresses += addresses.length;
            done += addresses.filter((a: any) => a.status === "done").length;
            pending += addresses.filter((a: any) => a.status === "pending").length;
            refused += addresses.filter((a: any) => a.status === "refused").length;
          });
          
          return {
            team_id: team.id,
            team_name: team.name,
            team_color: team.color,
            total_members: members.length,
            total_zones: teamZones.length,
            total_addresses,
            done,
            pending,
            refused,
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="zones">
              <MapPin className="h-4 w-4 mr-2" />
              Zones
            </TabsTrigger>
            <TabsTrigger value="teams">
              <Group className="h-4 w-4 mr-2" />
              Équipes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="space-y-4 mt-4">
            {zoneStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune zone trouvée
              </p>
            ) : (
              <>
                <div className="h-[350px] w-full">
                  <ChartContainer
                    config={{
                      done: {
                        label: "Faites",
                        color: "hsl(142, 76%, 36%)",
                      },
                      pending: {
                        label: "En attente",
                        color: "hsl(217, 91%, 60%)",
                      },
                      refused: {
                        label: "Refusées",
                        color: "hsl(0, 84%, 60%)",
                      },
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={zoneStats} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="zone_name" 
                          tick={{ fill: 'hsl(var(--foreground))' }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="done" fill="hsl(142, 76%, 36%)" name="Faites" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="pending" fill="hsl(217, 91%, 60%)" name="En attente" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="refused" fill="hsl(0, 84%, 60%)" name="Refusées" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                {zoneStats.map((zone) => (
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
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="teams" className="space-y-4 mt-4">
            {teamStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune équipe trouvée
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-[350px]">
                    <ChartContainer
                      config={{
                        members: {
                          label: "Membres",
                          color: "hsl(var(--primary))",
                        },
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={teamStats.map(t => ({ name: t.team_name, value: t.total_members }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {teamStats.map((team, index) => (
                              <Cell key={`cell-${index}`} fill={team.team_color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <p className="text-sm text-center text-muted-foreground mt-2 font-medium">Membres par équipe</p>
                  </div>
                  <div className="h-[350px]">
                    <ChartContainer
                      config={{
                        zones: {
                          label: "Zones",
                          color: "hsl(262, 83%, 58%)",
                        },
                        addresses: {
                          label: "Adresses",
                          color: "hsl(217, 91%, 60%)",
                        },
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="team_name" 
                            tick={{ fill: 'hsl(var(--foreground))' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend wrapperStyle={{ paddingTop: '10px' }} />
                          <Bar dataKey="total_zones" fill="hsl(262, 83%, 58%)" name="Zones" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="total_addresses" fill="hsl(217, 91%, 60%)" name="Adresses" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <p className="text-sm text-center text-muted-foreground mt-2 font-medium">Zones et adresses par équipe</p>
                  </div>
                </div>
                {teamStats.map((team) => (
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
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
                      <div>
                        <p className="text-muted-foreground">Faites</p>
                        <p className="font-semibold text-green-600">{team.done}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">En attente</p>
                        <p className="font-semibold text-blue-600">{team.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Refusées</p>
                        <p className="font-semibold text-red-600">{team.refused}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
