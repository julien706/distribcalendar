import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CSVImporter from "@/components/CSVImporter";
import ZoneManagement from "@/components/ZoneManagement";
import UserManagement from "@/components/UserManagement";
import { ArrowLeft, Upload, LogOut, Trash2, Key, Download, Shield, RotateCcw, Users, AlertTriangle } from "lucide-react";
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
  const [showChangeInvitation, setShowChangeInvitation] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [newInvitationCode, setNewInvitationCode] = useState("");
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const { signOut, isAdmin, userRole, userTeamIds } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin) {
      fetchInvitationCode();
    }
  }, [isAdmin]);

  const handleDeleteAll = async () => {
    const { error } = await supabase.from("addresses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Toutes les adresses ont été supprimées");
    }
  };

  const fetchInvitationCode = async () => {
    setLoadingInvitation(true);
    const { data, error } = await supabase
      .from("invitation_codes")
      .select("code")
      .eq("is_active", true)
      .single();

    if (!error && data) {
      setInvitationCode(data.code);
    }
    setLoadingInvitation(false);
  };

  const handleChangeInvitationCode = async () => {
    if (!newInvitationCode.trim()) {
      toast.error("Le code d'invitation ne peut pas être vide");
      return;
    }

    if (newInvitationCode.length < 4) {
      toast.error("Le code doit contenir au moins 4 caractères");
      return;
    }

    try {
      const { error } = await supabase
        .from("invitation_codes")
        .update({ code: newInvitationCode.toUpperCase() })
        .eq("is_active", true);

      if (error) throw error;

      toast.success("Code d'invitation modifié avec succès");
      setInvitationCode(newInvitationCode.toUpperCase());
      setShowChangeInvitation(false);
      setNewInvitationCode("");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du changement du code");
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

  const handleResetStatuses = async () => {
    try {
      // Delete all history
      const { error: historyError } = await supabase
        .from("address_status_history")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (historyError) throw historyError;

      // Reset all addresses to pending status with no observations
      const { error: addressError } = await supabase
        .from("addresses")
        .update({
          status: "pending",
          observations: null,
          last_visit_date: null,
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (addressError) throw addressError;

      toast.success("Statuts, historique et commentaires réinitialisés avec succès");
    } catch (error: any) {
      console.error("Error resetting statuses:", error);
      toast.error("Erreur lors de la réinitialisation");
    }
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
            <Badge variant={isAdmin ? "default" : "secondary"}>
              <Shield className="h-3 w-3 mr-1" />
              {userRole || "user"}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto p-4 space-y-4">
        {userTeamIds.length === 0 && !isAdmin && (
          <Card className="border-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="font-semibold">Aucune équipe assignée</p>
                  <p className="text-sm text-muted-foreground">
                    Vous n'êtes pas encore assigné à une équipe. Contactez un administrateur pour être ajouté à une équipe.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && <UserManagement />}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des équipes et zones
              </CardTitle>
              <CardDescription>
                Organisez vos distributeurs en équipes et assignez-leur des zones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => navigate("/teams")} className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Gérer les équipes
              </Button>
              <ZoneManagement />
            </CardContent>
          </Card>
        )}

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

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Code d'invitation
              </CardTitle>
            <CardDescription>
              Gérer le code requis pour les nouvelles inscriptions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingInvitation ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : (
              <div className="space-y-2">
                <Label>Code actuel</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={invitationCode}
                    readOnly
                    className="font-mono text-lg tracking-wider"
                  />
                </div>
              </div>
            )}
            <Dialog open={showChangeInvitation} onOpenChange={setShowChangeInvitation}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="h-4 w-4 mr-2" />
                  Modifier le code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier le code d'invitation</DialogTitle>
                  <DialogDescription>
                    Ce code sera requis pour toutes les nouvelles inscriptions (minimum 4 caractères)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="new-invitation-code">Nouveau code d'invitation</Label>
                    <Input
                      id="new-invitation-code"
                      type="text"
                      value={newInvitationCode}
                      onChange={(e) => setNewInvitationCode(e.target.value.toUpperCase())}
                      placeholder="NOUVEAUCODE"
                      className="font-mono tracking-wider"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowChangeInvitation(false);
                    setNewInvitationCode("");
                  }}>
                    Annuler
                  </Button>
                  <Button onClick={handleChangeInvitationCode}>
                    Modifier
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        )}

        {isAdmin && (
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
        )}

        {isAdmin && (
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
        )}

        {isAdmin && (
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Réinitialisation des données
            </CardTitle>
            <CardDescription>
              Remettre tous les statuts à "En attente" et supprimer l'historique et les commentaires (les adresses sont conservées)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réinitialiser les statuts
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Réinitialiser tous les statuts ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va :
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Remettre tous les statuts à "En attente"</li>
                      <li>Supprimer tout l'historique des changements</li>
                      <li>Effacer tous les commentaires</li>
                      <li>Conserver toutes les adresses</li>
                    </ul>
                    <p className="mt-2 font-semibold">Cette action est irréversible.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetStatuses} className="bg-orange-500 text-white hover:bg-orange-600">
                    Réinitialiser
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
        )}

        {isAdmin && (
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
        )}
      </div>

      <CSVImporter open={showImporter} onClose={() => setShowImporter(false)} />
    </div>
  );
}
