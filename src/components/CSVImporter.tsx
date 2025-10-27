import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "./ui/alert";

export default function CSVImporter({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCount, setCurrentCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setCurrentCount(0);
    setTotalCount(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const total = rows.length;
        setTotalCount(total);
        
        let imported = 0;
        let failed = 0;
        const batchSize = 50; // Réduit pour éviter les limites de payload

        toast.info(`Import démarré: ${total} adresses à traiter`);

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          const addresses = batch
            .filter((row) => row.lat && row.long) // Valider les données
            .map((row) => {
              const lat = parseFloat(String(row.lat).replace(',', '.'));
              const lng = parseFloat(String(row.long).replace(',', '.'));
              const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
              if (!valid) return null;
              return {
                street_name: row.voie_nom || row.lieudit_complement_nom || "Rue inconnue",
                street_number: row.numero || null,
                is_even: row.numero ? parseInt(row.numero) % 2 === 0 : null,
                latitude: lat,
                longitude: lng,
                status: "pending" as const,
                csv_data: {
                  commune_nom: row.commune_nom,
                  voie_nom: row.voie_nom,
                  numero: row.numero,
                  lat: row.lat,
                  long: row.long
                }, // Stocker seulement les données essentielles
              };
            })
            .filter(Boolean) as any[];

          const invalidInBatch = batch.length - addresses.length;

          if (addresses.length > 0) {
            const { error } = await supabase.from("addresses").insert(addresses);

            if (error) {
              console.error("Error importing batch:", error);
              toast.error(`Erreur batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
              // Fallback: insertion ligne par ligne pour isoler les erreurs
              for (const addr of addresses) {
                const { error: rowError } = await supabase.from("addresses").insert(addr);
                if (rowError) {
                  failed += 1;
                } else {
                  imported += 1;
                }
              }
            } else {
              imported += addresses.length;
            }
          } else {
            // tout invalide
            failed += batch.length;
          }
          
          // compter les lignes invalides filtrées
          if (addresses.length > 0) {
            failed += invalidInBatch;
          }
          
          setCurrentCount(imported);
          setProgress(Math.round(((imported + failed) / total) * 100));
        }

        setImporting(false);
        if (imported > 0) {
          toast.success(`${imported} adresses importées${failed > 0 ? ` (${failed} erreurs)` : ""}`);
          onClose();
        } else {
          toast.error("Erreur lors de l'import: aucune adresse valide");
        }
      },
      error: (error) => {
        console.error("Parse error:", error);
        toast.error("Erreur lors de la lecture du fichier");
        setImporting(false);
      },
    });
  };

  const handleImportDefault = async () => {
    setImporting(true);
    setProgress(0);
    setCurrentCount(0);
    setTotalCount(0);

    try {
      const response = await fetch("/src/data/addresses.csv");
      const text = await response.text();

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[];
          const total = rows.length;
          setTotalCount(total);
          
          let imported = 0;
          let failed = 0;
          const batchSize = 50; // Réduit pour éviter les limites de payload

          toast.info(`Import démarré: ${total} adresses à traiter`);

          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            
            const addresses = batch
              .filter((row) => row.lat && row.long)
              .map((row) => {
                const lat = parseFloat(String(row.lat).replace(',', '.'));
                const lng = parseFloat(String(row.long).replace(',', '.'));
                const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
                if (!valid) return null;
                return {
                  street_name: row.voie_nom || row.lieudit_complement_nom || "Rue inconnue",
                  street_number: row.numero || null,
                  is_even: row.numero ? parseInt(row.numero) % 2 === 0 : null,
                  latitude: lat,
                  longitude: lng,
                  status: "pending" as const,
                  csv_data: {
                    commune_nom: row.commune_nom,
                    voie_nom: row.voie_nom,
                    numero: row.numero,
                    lat: row.lat,
                    long: row.long
                  }, // Stocker seulement les données essentielles
                };
              })
              .filter(Boolean) as any[];

            const invalidInBatch = batch.length - addresses.length;

            if (addresses.length > 0) {
              const { error } = await supabase.from("addresses").insert(addresses);

              if (error) {
                console.error("Error importing batch:", error);
                toast.error(`Erreur batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
                // Fallback: insertion ligne par ligne pour isoler les erreurs
                for (const addr of addresses) {
                  const { error: rowError } = await supabase.from("addresses").insert(addr);
                  if (rowError) {
                    failed += 1;
                  } else {
                    imported += 1;
                  }
                }
              } else {
                imported += addresses.length;
              }
            } else {
              failed += batch.length;
            }
            
            // compter les lignes invalides filtrées
            if (addresses.length > 0) {
              failed += invalidInBatch;
            }
            
            setCurrentCount(imported);
            setProgress(Math.round(((imported + failed) / total) * 100));
          }

          setImporting(false);
          if (imported > 0) {
            toast.success(`${imported} adresses importées${failed > 0 ? ` (${failed} erreurs)` : ""}`);
            onClose();
          } else {
            toast.error("Erreur lors de l'import: aucune adresse valide");
          }
        },
      });
    } catch (error) {
      console.error("Error loading default CSV:", error);
      toast.error("Erreur lors du chargement du fichier");
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importer les adresses</DialogTitle>
          <DialogDescription>
            Choisissez un fichier CSV à importer ou utilisez les données par défaut
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>Le fichier CSV doit contenir les colonnes : <strong>voie_nom</strong>, <strong>numero</strong>, <strong>lat</strong>, <strong>long</strong>.</p>
              <p className="text-xs">Supporte l'import de plus de 1000 adresses avec traitement par batch optimisé.</p>
              <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                <div className="font-semibold mb-1">Exemple de format CSV :</div>
                <div>commune_nom,voie_nom,numero,lat,long</div>
                <div>Paris,Rue de la Paix,12,48.8566,2.3522</div>
                <div>Lyon,Avenue des Lumières,45,45.7640,4.8357</div>
              </div>
            </AlertDescription>
          </Alert>

          {importing && (
            <div className="space-y-2">
              <div className="text-sm text-center text-muted-foreground">
                Import en cours... {currentCount} / {totalCount} ({progress}%)
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleImportDefault}
              disabled={importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              Importer les données par défaut
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  ou
                </span>
              </div>
            </div>

            <label>
              <Button
                className="w-full"
                variant="outline"
                disabled={importing}
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Choisir un fichier CSV
                </span>
              </Button>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
