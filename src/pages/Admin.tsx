import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CSVImporter from "@/components/CSVImporter";
import { ArrowLeft, Upload, LogOut, Trash2, Key, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Admin() {
  const [showImporter, setShowImporter] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleDeleteAll = async () => {
    const { error } = await supabase.from("addresses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Toutes les adresses ont été supprimées");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Mot de passe modifié avec succès");
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du changement de mot de passe");
    }
  };

  const sanitizeCSVField = (field: string): string => {
    // Prevent CSV injection by escaping formulas
    if (field && typeof field === 'string' && /^[=+\-@]/.test(field)) {
      return `"'${field.replace(/"/g, '""')}"`;
    }
    return `"${String(field || '').replace(/"/g, '""')}"`;
  };

  const exportToCSV = async (statusFilter?: ("done" | "pending" | "refused" | "retry_first" | "retry_second" | "uninhabited")[], withObservations?: boolean) => {
    let query = supabase.from("addresses").select("*").order("street_name");
    
    if (statusFilter && statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }
    
    if (withObservations) {
      query = query.not("observations", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Erreur lors de l'export");
      return;
    }

    if (!data || data.length === 0) {
      toast.info("Aucune donnée à exporter");
      return;
    }

    // Convert to CSV with sanitization
    const headers = ["Rue", "Numéro", "Statut", "Observations", "Latitude", "Longitude", "Dernière visite"];
    const csvContent = [
      headers.join(","),
      ...data.map(row => [
        sanitizeCSVField(row.street_name),
        sanitizeCSVField(row.street_number || ""),
        sanitizeCSVField(row.status),
        sanitizeCSVField(row.observations || ""),
        row.latitude,
        row.longitude,
        row.last_visit_date || ""
      ].join(","))
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `export_${statusFilter?.join("_") || "all"}_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${data.length} adresse(s) exportée(s)`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Administration</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Sécurité du compte
            </CardTitle>
            <CardDescription>
              Modifier votre mot de passe de connexion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="h-4 w-4 mr-2" />
                  Changer le mot de passe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier le mot de passe</DialogTitle>
                  <DialogDescription>
                    Entrez votre nouveau mot de passe (minimum 6 caractères)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowChangePassword(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleChangePassword}>
                    Modifier
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exporter les données
            </CardTitle>
            <CardDescription>
              Télécharger les adresses au format CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => exportToCSV(["done"])}>
              <Download className="h-4 w-4 mr-2" />
              Exporter les maisons faites
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => exportToCSV(["refused"])}>
              <Download className="h-4 w-4 mr-2" />
              Exporter les maisons non répondues
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => exportToCSV(undefined, true)}>
              <Download className="h-4 w-4 mr-2" />
              Exporter avec observations
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => exportToCSV()}>
              <Download className="h-4 w-4 mr-2" />
              Exporter toutes les adresses
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importer des données
            </CardTitle>
            <CardDescription>
              Importer des adresses depuis un fichier CSV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowImporter(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Ouvrir l'importateur
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Gestion des données
            </CardTitle>
            <CardDescription>
              Supprimer toutes les adresses de la base de données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer toutes les adresses
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer toutes les adresses ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes les adresses et leur historique seront définitivement supprimés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      <CSVImporter open={showImporter} onClose={() => setShowImporter(false)} />
    </div>
  );
}
