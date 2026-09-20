import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveCampaign, useOpenRound, useRoundTotals, useInvalidateCampaignData } from "@/hooks/useCampaigns";
import { formatEuro } from "@/lib/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Euro, Clock } from "lucide-react";
import { toast } from "sonner";

type Team = { id: string; name: string; color: string };

export default function RoundControl() {
  const { user, isAdmin, userTeamIds } = useAuth();
  const { data: campaign } = useActiveCampaign();
  const { data: round, refetch: refetchRound } = useOpenRound(campaign?.id);
  const { data: totals, refetch: refetchTotals } = useRoundTotals(round?.id);
  const invalidate = useInvalidateCampaignData();

  const [teams, setTeams] = useState<Team[]>([]);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [correctedAmount, setCorrectedAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("teams").select("id, name, color").order("name");
      const all = (data || []) as Team[];
      setTeams(isAdmin ? all : all.filter((t) => userTeamIds.includes(t.id)));
    };
    load();
  }, [isAdmin, userTeamIds]);

  const startRound = async () => {
    if (!campaign || !selectedTeam || !user) return;
    setSaving(true);
    const { error } = await supabase.from("rounds").insert({
      campaign_id: campaign.id,
      team_id: selectedTeam,
      started_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("one_open_round") ? "Une tournée est déjà en cours pour cette équipe" : "Impossible de démarrer la tournée");
      return;
    }
    toast.success("Tournée démarrée");
    setStartOpen(false);
    refetchRound();
    invalidate();
  };

  const endRound = async () => {
    if (!round) return;
    setSaving(true);
    const { error } = await supabase
      .from("rounds")
      .update({
        ended_at: new Date().toISOString(),
        corrected_amount: correctedAmount ? Number(correctedAmount.replace(",", ".")) : null,
        note: note.trim() || null,
      })
      .eq("id", round.id);
    setSaving(false);
    if (error) {
      toast.error("Impossible d'arrêter la tournée");
      return;
    }
    toast.success("Tournée terminée");
    setEndOpen(false);
    setCorrectedAmount("");
    setNote("");
    refetchRound();
    invalidate();
  };

  const openEnd = () => {
    refetchTotals();
    setCorrectedAmount(totals ? String(totals.total) : "");
    setEndOpen(true);
  };

  if (!campaign) return null;

  const teamName = teams.find((t) => t.id === round?.team_id)?.name;
  const durationDays = round ? Math.max(1, Math.ceil((Date.now() - new Date(round.started_at).getTime()) / 86400000)) : 0;

  return (
    <>
      {round ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {teamName || "Tournée"} · j{durationDays}
          </Badge>
          <Badge className="gap-1">
            <Euro className="h-3 w-3" />
            {formatEuro(totals?.total ?? 0)} · {totals?.count ?? 0}
          </Badge>
          <Button size="sm" variant="destructive" className="h-8" onClick={openEnd}>
            <Square className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Arrêter</span>
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-8" onClick={() => setStartOpen(true)} disabled={teams.length === 0}>
          <Play className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Démarrer une tournée</span>
        </Button>
      )}

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Démarrer une tournée</DialogTitle>
            <DialogDescription>
              La tournée reste ouverte jusqu'à son arrêt, même sur plusieurs jours. Année : {campaign.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Équipe</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger><SelectValue placeholder="Choisir une équipe" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Annuler</Button>
            <Button onClick={startRound} disabled={!selectedTeam || saving}>Démarrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arrêter la tournée</DialogTitle>
            <DialogDescription>Récapitulatif et montant réellement compté.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Équipe</span><span className="font-medium">{teamName}</span></div>
              <div className="flex justify-between"><span>Adresses avec montant</span><span className="font-medium">{totals?.count ?? 0}</span></div>
              <div className="flex justify-between"><span>Total calculé</span><span className="font-medium">{formatEuro(totals?.total ?? 0)}</span></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="corrected">Montant réellement compté (€)</Label>
              <Input id="corrected" inputMode="decimal" value={correctedAmount} onChange={(e) => setCorrectedAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note sur l'écart</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)}>Annuler</Button>
            <Button onClick={endRound} disabled={saving}>Terminer la tournée</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
