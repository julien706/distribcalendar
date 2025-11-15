import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Plus, Pencil, Trash2, Building2, X } from "lucide-react";
import { toast } from "sonner";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";
import ApartmentQuickEdit from "./ApartmentQuickEdit";
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

type Apartment = {
  id: string;
  address_id: string;
  name: string;
  status: StatusType;
  observations: string | null;
  created_at: string;
  updated_at: string;
};

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  city: string | null;
  building_name: string | null;
};

type ApartmentManagerProps = {
  address: Address;
  onClose: () => void;
};

export default function ApartmentManager({ address, onClose }: ApartmentManagerProps) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApartment, setNewApartment] = useState({
    name: "",
    status: "pending" as StatusType,
    observations: "",
  });
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [deletingApartmentId, setDeletingApartmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchApartments();
  }, [address.id]);

  const fetchApartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("apartments")
      .select("*")
      .eq("address_id", address.id)
      .order("name");

    if (error) {
      toast.error("Erreur lors du chargement des appartements");
      console.error(error);
    } else {
      setApartments(data || []);
    }
    setLoading(false);
  };

  const handleAddApartment = async () => {
    if (!newApartment.name.trim()) {
      toast.error("Le nom/numéro de l'appartement est requis");
      return;
    }

    const { error } = await supabase.from("apartments").insert({
      address_id: address.id,
      name: newApartment.name.trim(),
      status: newApartment.status,
      observations: newApartment.observations.trim() || null,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout de l'appartement");
      console.error(error);
    } else {
      toast.success("Appartement ajouté");
      setNewApartment({ name: "", status: "pending", observations: "" });
      setShowAddForm(false);
      fetchApartments();
    }
  };

  const handleDeleteApartment = async (id: string) => {
    const { error } = await supabase
      .from("apartments")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    } else {
      toast.success("Appartement supprimé");
      fetchApartments();
    }
    setDeletingApartmentId(null);
  };

  const getStatusBadgeColor = (status: StatusType) => {
    const colors: Record<StatusType, string> = {
      pending: "bg-slate-500",
      done: "bg-green-500",
      retry_first: "bg-amber-500",
      retry_second: "bg-orange-500",
      refused: "bg-red-500",
      uninhabited: "bg-slate-600",
      no_answer: "bg-purple-500",
    };
    return colors[status] || "bg-slate-500";
  };

  const statusCounts = apartments.reduce((acc, apt) => {
    acc[apt.status] = (acc[apt.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const addressTitle = address.building_name || 
    `${address.street_number ? address.street_number + " " : ""}${address.street_name}`;

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 bg-background z-10 pb-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">{addressTitle}</h2>
              {address.city && (
                <p className="text-sm text-muted-foreground">{address.city}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="text-sm">
            {apartments.length} appartement{apartments.length > 1 ? "s" : ""}
          </Badge>
          {Object.entries(statusCounts).map(([status, count]) => {
            const StatusIcon = STATUS_CONFIG[status as StatusType].icon;
            return (
              <Badge
                key={status}
                variant="outline"
                className="text-sm"
                style={{ borderColor: STATUS_CONFIG[status as StatusType].color }}
              >
                <StatusIcon className="h-3 w-3 mr-1" style={{ color: STATUS_CONFIG[status as StatusType].color }} />
                {count} {STATUS_CONFIG[status as StatusType].label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Add button */}
      {!showAddForm && (
        <Button
          onClick={() => setShowAddForm(true)}
          className="w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un appartement
        </Button>
      )}

      {/* Add form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvel appartement</CardTitle>
            <CardDescription>Ajoutez un nouvel appartement à cet immeuble</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Nom/Numéro/Étage/Sonnette
              </label>
              <Input
                placeholder="Ex: 3A, 2ème étage gauche, Sonnette 5"
                value={newApartment.name}
                onChange={(e) => setNewApartment({ ...newApartment, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Statut</label>
              <Select
                value={newApartment.status}
                onValueChange={(value: StatusType) =>
                  setNewApartment({ ...newApartment, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: config.color }} />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Observations (optionnel)
              </label>
              <Textarea
                placeholder="Remarques..."
                value={newApartment.observations}
                onChange={(e) =>
                  setNewApartment({ ...newApartment, observations: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddApartment} className="flex-1">
                Ajouter
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewApartment({ name: "", status: "pending", observations: "" });
                }}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apartments list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement des appartements...
        </div>
      ) : apartments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun appartement. Ajoutez-en un pour commencer.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {apartments.map((apartment) => (
            <Card key={apartment.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{apartment.name}</h3>
                      <Badge
                        variant="secondary"
                        className={`${getStatusBadgeColor(apartment.status)} text-white shrink-0`}
                      >
                        {STATUS_CONFIG[apartment.status].label}
                      </Badge>
                    </div>
                    {apartment.observations && (
                      <p className="text-sm text-muted-foreground truncate">
                        {apartment.observations}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingApartment(apartment)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingApartmentId(apartment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick edit dialog */}
      {editingApartment && (
        <ApartmentQuickEdit
          apartment={editingApartment}
          onClose={() => setEditingApartment(null)}
          onSaved={fetchApartments}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingApartmentId}
        onOpenChange={(open) => !open && setDeletingApartmentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'appartement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'appartement sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingApartmentId && handleDeleteApartment(deletingApartmentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
