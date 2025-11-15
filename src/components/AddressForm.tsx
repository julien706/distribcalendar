import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { History, ArrowRight, Building2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import ApartmentManager from "./ApartmentManager";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
  is_building?: boolean;
  building_name?: string | null;
  apartment_count?: number | null;
  city?: string | null;
};

type StatusHistory = {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  old_observations: string | null;
  new_observations: string | null;
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  icon: config.icon,
}));

export default function AddressForm({
  address,
  open,
  onClose,
}: {
  address: Address | null;
  open: boolean;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<"pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | "no_answer">(
    (address?.status as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | "no_answer") || "pending"
  );
  const [observations, setObservations] = useState(address?.observations || "");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showApartmentManager, setShowApartmentManager] = useState(false);
  const [isBuilding, setIsBuilding] = useState(address?.is_building || false);
  const [buildingName, setBuildingName] = useState(address?.building_name || "");
  const [apartmentCount, setApartmentCount] = useState(address?.apartment_count?.toString() || "");
  const [showUncheckAlert, setShowUncheckAlert] = useState(false);
  const [existingApartmentsCount, setExistingApartmentsCount] = useState(0);

  useEffect(() => {
    if (address && open) {
      setStatus((address.status as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | "no_answer") || "pending");
      setObservations(address.observations || "");
      setIsBuilding(address.is_building || false);
      setBuildingName(address.building_name || "");
      setApartmentCount(address.apartment_count?.toString() || "");
      fetchHistory();
    }
  }, [address, open]);

  const fetchHistory = async () => {
    if (!address) return;
    
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("address_status_history")
      .select("*")
      .eq("address_id", address.id)
      .order("changed_at", { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoadingHistory(false);
  };

  const checkExistingApartments = async (addressId: string) => {
    const { count } = await supabase
      .from("apartments")
      .select("*", { count: "exact", head: true })
      .eq("address_id", addressId);
    return count || 0;
  };

  const handleBuildingCheckChange = async (checked: boolean) => {
    if (!checked && address?.is_building) {
      // User is trying to uncheck, check if apartments exist
      const count = await checkExistingApartments(address.id);
      if (count > 0) {
        setExistingApartmentsCount(count);
        setShowUncheckAlert(true);
        return;
      }
    }
    setIsBuilding(checked);
    if (!checked) {
      setBuildingName("");
      setApartmentCount("");
    }
  };

  const confirmUncheck = () => {
    setIsBuilding(false);
    setBuildingName("");
    setApartmentCount("");
    setShowUncheckAlert(false);
  };

  const handleSave = async () => {
    if (!address) return;

    // Validate observations length
    if (observations && observations.length > 1000) {
      toast.error("Les observations sont trop longues (max 1000 caractères)");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("addresses")
      .update({
        status,
        observations: observations?.trim() || null,
        last_visit_date: new Date().toISOString(),
        is_building: isBuilding,
        building_name: isBuilding ? buildingName?.trim() || null : null,
        apartment_count: isBuilding && apartmentCount ? parseInt(apartmentCount) : null,
      })
      .eq("id", address.id);

    setSaving(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Adresse mise à jour avec succès");
      onClose();
    }
  };

  if (!address) return null;

  const formContent = (
    <>
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <Select 
              value={status} 
              onValueChange={(value) => setStatus(value as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited" | "no_answer")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Building type section */}
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is_building" 
                checked={isBuilding}
                onCheckedChange={handleBuildingCheckChange}
              />
              <Label htmlFor="is_building" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <Building2 className="h-4 w-4" />
                C'est un immeuble
              </Label>
            </div>
            
            {isBuilding && (
              <div className="space-y-3 ml-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="building_name" className="text-sm">
                    Nom de l'immeuble (optionnel)
                  </Label>
                  <Input 
                    id="building_name"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    placeholder="Ex: Résidence Les Chênes"
                    maxLength={200}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apartment_count" className="text-sm">
                    Nombre d'appartements estimé (optionnel)
                  </Label>
                  <Input 
                    id="apartment_count"
                    type="number"
                    min="1"
                    value={apartmentCount}
                    onChange={(e) => setApartmentCount(e.target.value)}
                    placeholder="Ex: 12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vous pourrez ajouter les appartements précis ci-dessous après sauvegarde
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observations (max 1000 caractères)</label>
            <Textarea
              placeholder="Notes, commentaires..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {(observations || "").length}/1000 caractères
            </p>
          </div>

          {/* Building management button */}
          {isBuilding && (
            <>
              <Separator className="my-4" />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowApartmentManager(true)}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Gérer les appartements
                {address.apartment_count && address.apartment_count > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    ({address.apartment_count} appt{address.apartment_count > 1 ? "s" : ""})
                  </span>
                )}
              </Button>
            </>
          )}

          {history.length > 0 && (
            <>
              <Separator className="my-4" />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Historique des modifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((entry, index) => {
                        const oldConfig = entry.old_status ? STATUS_CONFIG[entry.old_status as keyof typeof STATUS_CONFIG] : null;
                        const newConfig = STATUS_CONFIG[entry.new_status as keyof typeof STATUS_CONFIG];
                        const OldIcon = oldConfig?.icon;
                        const NewIcon = newConfig?.icon;

                        return (
                          <div key={entry.id} className="text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {oldConfig && OldIcon && (
                                  <>
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <OldIcon className="h-3 w-3" />
                                      {oldConfig.label}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  </>
                                )}
                                <span className="flex items-center gap-1 font-medium">
                                  <NewIcon className="h-3 w-3" />
                                  {newConfig.label}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.changed_at), "dd MMM yyyy HH:mm", { locale: fr })}
                              </span>
                            </div>
                            {(entry.new_observations && entry.new_observations !== entry.old_observations) && (
                              <p className="text-xs text-muted-foreground pl-5 mt-1 italic">
                                "{entry.new_observations}"
                              </p>
                            )}
                            {index < history.length - 1 && <Separator className="mt-3" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {!showApartmentManager && isMobile && (
        <Drawer open={open} onOpenChange={onClose}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>
                {address.street_number || ""} {address.street_name}
              </DrawerTitle>
              <DrawerDescription>
                Mettre à jour le statut de distribution
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4 flex flex-col min-h-0 flex-1">
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {!showApartmentManager && !isMobile && (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {address.street_number || ""} {address.street_name}
              </DialogTitle>
              <DialogDescription>
                Mettre à jour le statut de distribution
              </DialogDescription>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      )}

      {showApartmentManager && address && (
        <Dialog open={showApartmentManager} onOpenChange={setShowApartmentManager}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Gestion des appartements</DialogTitle>
            </DialogHeader>
            <ApartmentManager
              address={{
                id: address.id,
                street_name: address.street_name,
                street_number: address.street_number,
                city: address.city || null,
                building_name: address.building_name || null,
              }}
              onClose={() => setShowApartmentManager(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={showUncheckAlert} onOpenChange={setShowUncheckAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Attention</AlertDialogTitle>
            <AlertDialogDescription>
              Cet immeuble a déjà {existingApartmentsCount} appartement{existingApartmentsCount > 1 ? 's' : ''} créé{existingApartmentsCount > 1 ? 's' : ''}.
              <br /><br />
              Si vous décochez "C'est un immeuble", l'adresse redeviendra une adresse normale, mais les appartements existants resteront dans la base de données.
              <br /><br />
              Voulez-vous vraiment continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUncheck}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
