import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LogEntry {
  id: string;
  address_id: string;
  old_status: string | null;
  new_status: string;
  old_observations: string | null;
  new_observations: string | null;
  changed_at: string;
  address?: {
    street_name: string;
    street_number: string | null;
  };
}

export default function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("logs_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "address_status_history",
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("address_status_history")
        .select(`
          *,
          addresses:address_id (
            street_name,
            street_number
          )
        `)
        .order("changed_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs(data as any || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      done: "Fait",
      refused: "Refusé",
      retry_first: "1ère relance",
      retry_second: "2ème relance",
      uninhabited: "Inhabité",
      no_answer: "Pas de réponse",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "default",
      done: "default",
      refused: "destructive",
      retry_first: "secondary",
      retry_second: "secondary",
      uninhabited: "secondary",
      no_answer: "secondary",
    };
    return colors[status] || "default";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Chargement des logs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historique des modifications
        </CardTitle>
        <CardDescription>
          Les 100 dernières modifications de statuts et observations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune modification enregistrée
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {log.address?.street_number && `${log.address.street_number} `}
                        {log.address?.street_name || "Adresse supprimée"}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.changed_at), "Pp", { locale: fr })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    {log.old_status && (
                      <>
                        <Badge variant={getStatusColor(log.old_status) as any}>
                          {getStatusLabel(log.old_status)}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <Badge variant={getStatusColor(log.new_status) as any}>
                      {getStatusLabel(log.new_status)}
                    </Badge>
                  </div>

                  {(log.old_observations || log.new_observations) && (
                    <div className="text-sm space-y-1 pt-2 border-t">
                      {log.old_observations && (
                        <div>
                          <span className="text-muted-foreground">Ancien commentaire: </span>
                          <span className="line-through text-muted-foreground">
                            {log.old_observations}
                          </span>
                        </div>
                      )}
                      {log.new_observations && (
                        <div>
                          <span className="text-muted-foreground">Nouveau commentaire: </span>
                          <span>{log.new_observations}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
