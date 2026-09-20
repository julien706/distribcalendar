import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCampaigns, useInvalidateCampaignData } from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarPlus, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function CampaignManagement() {
  const { data: campaigns, refetch } = useCampaigns();
  const invalidate = useInvalidateCampaignData();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear + 1));
  const [name, setName] = useState(`Campagne ${currentYear + 1}`);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const createCampaign = async () => {
    setSaving(true);
    const { error } = await supabase.from("campaigns").insert({
      name: name.trim() || `Campagne ${year}`,
      year: Number(year),
      is_active: false,
    });
    setSaving(false);
    if (error) {
      toast.error("Création impossible");
      return;
    }
    toast.success("Année créée");
    refetch();
    invalidate();
  };

  const activate = async (id: string) => {
    await supabase.from("campaigns").update({ is_active: false }).eq("is_active", true);
    const { error } = await supabase.from("campaigns").update({ is_active: true }).eq("id", id);
    if (error) {
      toast.error("Activation impossible");
      return;
    }
    toast.success("Année active mise à jour");
    refetch();
    invalidate();
  };

  const close = async (id: string) => {
    const { error } = await supabase
      .from("campaigns")
      .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) {
      toast.error("Clôture impossible");
      return;
    }
    toast.success("Année clôturée");
    refetch();
    invalidate();
  };

  const resetStatuses = async () => {
    const { error } = await supabase
      .from("addresses")
      .update({ status: "pending", last_visit_date: null })
      .neq("status", "pending");
    if (error) {
      toast.error("Réinitialisation impossible");
      return;
    }
    await supabase.from("apartments").update({ status: "pending" }).neq("status", "pending");
    toast.success("Toutes les adresses sont repassées en attente");
    setResetOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4" /> Nouvelle année de distribution
          </CardTitle>
          <CardDescription>Les adresses, zones et équipes restent communes à toutes les années.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="year">Année</Label>
              <Input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cname">Nom</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <Button onClick={createCampaign} disabled={saving || !year}>Créer l'année</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Années enregistrées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(campaigns || []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {c.name}
                  {c.is_active && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Active</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.year} · début {new Date(c.start_date).toLocaleDateString("fr-FR")}
                  {c.end_date && ` · clôturée le ${new Date(c.end_date).toLocaleDateString("fr-FR")}`}
                </div>
              </div>
              <div className="flex gap-2">
                {!c.is_active && <Button size="sm" variant="outline" onClick={() => activate(c.id)}>Activer</Button>}
                {c.is_active && <Button size="sm" variant="outline" onClick={() => close(c.id)}>Clôturer</Button>}
              </div>
            </div>
          ))}
          {(campaigns || []).length === 0 && <p className="text-sm text-muted-foreground">Aucune année enregistrée.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remise à zéro des statuts</CardTitle>
          <CardDescription>À utiliser au démarrage d'une nouvelle année. Les montants et l'historique sont conservés.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4 mr-2" /> Tout repasser en attente
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repasser toutes les adresses en attente ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les adresses et tous les appartements repasseront en « en attente ». Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={resetStatuses}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
