import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, MapPin, Group, Building, Home, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAddressesWithApartments } from "@/hooks/useAddressesWithApartments";
import StatisticsCard from "./StatisticsCard";

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
  retry_first: number;
  retry_second: number;
  uninhabited: number;
  no_answer: number;
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
  retry_first: number;
  retry_second: number;
  uninhabited: number;
  no_answer: number;
}

const STATUS_OPTIONS = [
  { key: 'done', label: 'Faites', color: '#22c55e' },
  { key: 'pending', label: 'En attente', color: '#94a3b8' },
  { key: 'retry_first', label: 'Repasse 1', color: '#f59e0b' },
  { key: 'retry_second', label: 'Repasse 2', color: '#f97316' },
  { key: 'refused', label: 'Refusées', color: '#ef4444' },
  { key: 'uninhabited', label: 'Inhabité', color: '#000000' },
  { key: 'no_answer', label: 'Pas rép.', color: '#a855f7' },
];

export default function StatisticsView() {
  const [zoneStats, setZoneStats] = useState<ZoneStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: addressStats } = useAddressesWithApartments();
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    STATUS_OPTIONS.map(s => s.key)
  );

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    if (zoneStats.length > 0 && selectedZones.length === 0) {
      setSelectedZones(zoneStats.map(z => z.zone_id));
    }
  }, [zoneStats]);

  useEffect(() => {
    if (teamStats.length > 0 && selectedTeams.length === 0) {
      setSelectedTeams(teamStats.map(t => t.team_id));
    }
  }, [teamStats]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);

      // Fetch zones with addresses AND apartments
      const { data: zones } = await supabase
        .from("zones")
        .select(`
          id, 
          name, 
          color, 
          team_id, 
          addresses(
            id, 
            status, 
            is_building,
            apartments(status)
          )
        `);

      // Fetch teams
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, color, team_members(user_id), zones(id)");

      // Calculate zone stats with correct counting
      if (zones) {
        const zStats = zones.map((zone: any) => {
          const addresses = zone.addresses || [];
          
          // Separate simple addresses and buildings
          const simpleAddresses = addresses.filter((a: any) => !a.is_building);
          const buildings = addresses.filter((a: any) => a.is_building);
          
          // Collect all statuses (addresses + apartments)
          const allStatuses: string[] = [];
          
          // Add simple address statuses
          simpleAddresses.forEach((a: any) => allStatuses.push(a.status));
          
          // Add apartment statuses from buildings
          buildings.forEach((building: any) => {
            if (building.apartments) {
              building.apartments.forEach((apt: any) => allStatuses.push(apt.status));
            }
          });
          
          return {
            zone_id: zone.id,
            zone_name: zone.name,
            zone_color: zone.color,
            total_addresses: allStatuses.length,
            done: allStatuses.filter(s => s === "done").length,
            pending: allStatuses.filter(s => s === "pending").length,
            refused: allStatuses.filter(s => s === "refused").length,
            retry_first: allStatuses.filter(s => s === "retry_first").length,
            retry_second: allStatuses.filter(s => s === "retry_second").length,
            uninhabited: allStatuses.filter(s => s === "uninhabited").length,
            no_answer: allStatuses.filter(s => s === "no_answer").length,
          };
        });
        setZoneStats(zStats);
      }

      // Calculate team stats with correct counting
      if (teams && zones) {
        const tStats = teams.map((team: any) => {
          const teamZones = zones.filter((z: any) => z.team_id === team.id);
          const members = team.team_members || [];
          
          // Collect all statuses from all zones of the team
          const allStatuses: string[] = [];
          
          teamZones.forEach((zone: any) => {
            const addresses = zone.addresses || [];
            const simpleAddresses = addresses.filter((a: any) => !a.is_building);
            const buildings = addresses.filter((a: any) => a.is_building);
            
            simpleAddresses.forEach((a: any) => allStatuses.push(a.status));
            buildings.forEach((building: any) => {
              if (building.apartments) {
                building.apartments.forEach((apt: any) => allStatuses.push(apt.status));
              }
            });
          });
          
          return {
            team_id: team.id,
            team_name: team.name,
            team_color: team.color,
            total_members: members.length,
            total_zones: teamZones.length,
            total_addresses: allStatuses.length,
            done: allStatuses.filter(s => s === "done").length,
            pending: allStatuses.filter(s => s === "pending").length,
            refused: allStatuses.filter(s => s === "refused").length,
            retry_first: allStatuses.filter(s => s === "retry_first").length,
            retry_second: allStatuses.filter(s => s === "retry_second").length,
            uninhabited: allStatuses.filter(s => s === "uninhabited").length,
            no_answer: allStatuses.filter(s => s === "no_answer").length,
          };
        });
        setTeamStats(tStats);
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
                {/* Zone Selection */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Sélectionner les zones à comparer
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {zoneStats.map((zone) => (
                      <label key={zone.zone_id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedZones.includes(zone.zone_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedZones([...selectedZones, zone.zone_id]);
                            } else {
                              setSelectedZones(selectedZones.filter(id => id !== zone.zone_id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: zone.zone_color }}
                        />
                        <span className="text-sm">{zone.zone_name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status Selection */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Sélectionner les status à afficher
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <label key={status.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStatuses([...selectedStatuses, status.key]);
                            } else {
                              setSelectedStatuses(selectedStatuses.filter(k => k !== status.key));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Chart Container */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="h-[400px] w-full">
                      <ChartContainer
                        config={{
                          done: {
                            label: "Faites",
                            color: "#22c55e",
                          },
                          pending: {
                            label: "En attente",
                            color: "#94a3b8",
                          },
                          refused: {
                            label: "Refusées",
                            color: "#ef4444",
                          },
                          retry_first: {
                            label: "Repasse 1",
                            color: "#f59e0b",
                          },
                          retry_second: {
                            label: "Repasse 2",
                            color: "#f97316",
                          },
                          uninhabited: {
                            label: "Inhabité",
                            color: "#000000",
                          },
                          no_answer: {
                            label: "Pas rép.",
                            color: "#a855f7",
                          },
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={zoneStats.filter(z => selectedZones.includes(z.zone_id))} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="zone_name" 
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              angle={-45}
                              textAnchor="end"
                              height={100}
                            />
                            <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            {selectedStatuses.includes('done') && (
                              <Bar dataKey="done" fill="#22c55e" name="Faites" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('pending') && (
                              <Bar dataKey="pending" fill="#94a3b8" name="En attente" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('retry_first') && (
                              <Bar dataKey="retry_first" fill="#f59e0b" name="Repasse 1" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('retry_second') && (
                              <Bar dataKey="retry_second" fill="#f97316" name="Repasse 2" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('refused') && (
                              <Bar dataKey="refused" fill="#ef4444" name="Refusées" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('uninhabited') && (
                              <Bar dataKey="uninhabited" fill="#000000" name="Inhabité" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('no_answer') && (
                              <Bar dataKey="no_answer" fill="#a855f7" name="Pas rép." radius={[8, 8, 0, 0]} />
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Zone Details */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {zoneStats.filter(z => selectedZones.includes(z.zone_id)).map((zone) => (
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{zone.total_addresses}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Faites</p>
                        <p className="font-semibold" style={{ color: '#22c55e' }}>{zone.done}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">En attente</p>
                        <p className="font-semibold" style={{ color: '#94a3b8' }}>{zone.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Repasse 1</p>
                        <p className="font-semibold" style={{ color: '#f59e0b' }}>{zone.retry_first}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Repasse 2</p>
                        <p className="font-semibold" style={{ color: '#f97316' }}>{zone.retry_second}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Refusées</p>
                        <p className="font-semibold" style={{ color: '#ef4444' }}>{zone.refused}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Inhabité</p>
                        <p className="font-semibold" style={{ color: '#000000' }}>{zone.uninhabited}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pas rép.</p>
                        <p className="font-semibold" style={{ color: '#a855f7' }}>{zone.no_answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
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
                {/* Team Selection */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Group className="h-4 w-4" />
                    Sélectionner les équipes à comparer
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {teamStats.map((team) => (
                      <label key={team.team_id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(team.team_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeams([...selectedTeams, team.team_id]);
                            } else {
                              setSelectedTeams(selectedTeams.filter(id => id !== team.team_id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: team.team_color }}
                        />
                        <span className="text-sm">{team.team_name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status Selection */}
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Sélectionner les status à afficher
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <label key={status.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStatuses([...selectedStatuses, status.key]);
                            } else {
                              setSelectedStatuses(selectedStatuses.filter(k => k !== status.key));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

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
                            {teamStats.filter(t => selectedTeams.includes(t.team_id)).map((team, index) => (
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
                        <BarChart data={teamStats.filter(t => selectedTeams.includes(t.team_id))} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
                          <Bar dataKey="total_zones" fill="hsl(262, 83%, 58%)" name="Zones" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="total_addresses" fill="hsl(217, 91%, 60%)" name="Adresses" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <p className="text-sm text-center text-muted-foreground mt-2 font-medium">Zones et adresses par équipe</p>
                  </div>
                </div>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="h-[400px] w-full">
                      <ChartContainer
                        config={{
                          done: {
                            label: "Faites",
                            color: "#22c55e",
                          },
                          pending: {
                            label: "En attente",
                            color: "#94a3b8",
                          },
                          refused: {
                            label: "Refusées",
                            color: "#ef4444",
                          },
                          retry_first: {
                            label: "Repasse 1",
                            color: "#f59e0b",
                          },
                          retry_second: {
                            label: "Repasse 2",
                            color: "#f97316",
                          },
                          uninhabited: {
                            label: "Inhabité",
                            color: "#000000",
                          },
                          no_answer: {
                            label: "Pas rép.",
                            color: "#a855f7",
                          },
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={teamStats.filter(t => selectedTeams.includes(t.team_id))} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis 
                              dataKey="team_name" 
                              tick={{ fill: 'hsl(var(--foreground))' }}
                              angle={-45}
                              textAnchor="end"
                              height={100}
                            />
                            <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            {selectedStatuses.includes('done') && (
                              <Bar dataKey="done" fill="#22c55e" name="Faites" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('pending') && (
                              <Bar dataKey="pending" fill="#94a3b8" name="En attente" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('retry_first') && (
                              <Bar dataKey="retry_first" fill="#f59e0b" name="Repasse 1" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('retry_second') && (
                              <Bar dataKey="retry_second" fill="#f97316" name="Repasse 2" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('refused') && (
                              <Bar dataKey="refused" fill="#ef4444" name="Refusées" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('uninhabited') && (
                              <Bar dataKey="uninhabited" fill="#000000" name="Inhabité" radius={[8, 8, 0, 0]} />
                            )}
                            {selectedStatuses.includes('no_answer') && (
                              <Bar dataKey="no_answer" fill="#a855f7" name="Pas rép." radius={[8, 8, 0, 0]} />
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                      <p className="text-sm text-center text-muted-foreground mt-2 font-medium">Statut des adresses par équipe</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Team Details */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {teamStats.filter(t => selectedTeams.includes(t.team_id)).map((team) => (
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-sm">
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
                        <p className="font-semibold" style={{ color: '#22c55e' }}>{team.done}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">En attente</p>
                        <p className="font-semibold" style={{ color: '#94a3b8' }}>{team.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Repasse 1</p>
                        <p className="font-semibold" style={{ color: '#f59e0b' }}>{team.retry_first}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Repasse 2</p>
                        <p className="font-semibold" style={{ color: '#f97316' }}>{team.retry_second}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Refusées</p>
                        <p className="font-semibold" style={{ color: '#ef4444' }}>{team.refused}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Inhabité</p>
                        <p className="font-semibold" style={{ color: '#000000' }}>{team.uninhabited}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pas rép.</p>
                        <p className="font-semibold" style={{ color: '#a855f7' }}>{team.no_answer}</p>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
