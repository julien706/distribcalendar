import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { addressSchema } from "@/lib/validationSchemas";
import ColumnMapper from "./ColumnMapper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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
  const [showMapper, setShowMapper] = useState(false);
  const [showFormatChoice, setShowFormatChoice] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showDefaultConfirm, setShowDefaultConfirm] = useState(false);

  const processImport = async (data: any[], columnMapping: Record<string, string>) => {
    setImporting(true);
    setProgress(0);
    setCurrentCount(0);
    setShowMapper(false);
    setShowFormatChoice(false);
    
    const errors: string[] = [];
    const validatedData: any[] = [];
    
    // Validate and transform data
    data.forEach((row, index) => {
      try {
        const transformedRow: any = {
          street_name: row[columnMapping.street_name] || "Rue inconnue",
          latitude: parseFloat(String(row[columnMapping.latitude] || "0").replace(',', '.')),
          longitude: parseFloat(String(row[columnMapping.longitude] || "0").replace(',', '.')),
          status: "pending" as const,
          csv_data: {},
        };
        
        if (columnMapping.street_number && row[columnMapping.street_number]) {
          transformedRow.street_number = row[columnMapping.street_number];
        }
        
        if (columnMapping.city && row[columnMapping.city]) {
          transformedRow.csv_data.commune_nom = row[columnMapping.city];
        }
        
        if (columnMapping.observations && row[columnMapping.observations]) {
          transformedRow.observations = row[columnMapping.observations];
        }
        
        // Validate with Zod
        const validated = addressSchema.parse(transformedRow);
        validatedData.push(validated);
      } catch (error: any) {
        errors.push(`Ligne ${index + 2}: ${error.message}`);
      }
    });
    
    setValidationErrors(errors);
    
    if (validatedData.length === 0) {
      toast.error("Aucune donnée valide à importer");
      setImporting(false);
      return;
    }
    
    if (errors.length > 0) {
      toast.warning(`${errors.length} ligne(s) avec erreurs (seront ignorées)`);
    }
    
    const total = validatedData.length;
    setTotalCount(total);
    let imported = 0;
    let failed = 0;
    const batchSize = 50;
    
    toast.info(`Import démarré: ${total} adresses valides à traiter`);
    
    for (let i = 0; i < validatedData.length; i += batchSize) {
      const batch = validatedData.slice(i, i + batchSize);
      const { error } = await supabase.from("addresses").insert(batch);
      
      if (error) {
        console.error("Error importing batch:", error);
        // Fallback ligne par ligne
        for (const addr of batch) {
          const { error: rowError } = await supabase.from("addresses").insert(addr);
          if (rowError) {
            failed += 1;
          } else {
            imported += 1;
          }
        }
      } else {
        imported += batch.length;
      }
      
      setCurrentCount(imported);
      setProgress(Math.round((imported / total) * 100));
    }
    
    setImporting(false);
    if (imported > 0) {
      toast.success(`${imported} adresses importées${failed > 0 ? ` (${failed} erreurs)` : ""}`);
      onClose();
    } else {
      toast.error("Erreur lors de l'import");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const headers = results.meta.fields || [];
        
        if (headers.length === 0) {
          toast.error("Fichier CSV vide ou invalide");
          return;
        }
        
        // Show format choice
        setCsvHeaders(headers);
        setCsvData(rows);
        setShowFormatChoice(true);
      },
      error: (error) => {
        console.error("Parse error:", error);
        toast.error("Erreur lors de la lecture du fichier");
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
          {showFormatChoice ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Votre fichier CSV a été chargé avec succès. Choisissez le format :
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowFormatChoice(false);
                    // Utiliser le mapping BAN par défaut
                    const banMapping = {
                      street_name: 'voie_nom',
                      street_number: 'numero',
                      latitude: 'lat',
                      longitude: 'long',
                      city: 'commune_nom',
                    };
                    processImport(csvData, banMapping);
                  }}
                >
                  Format BAN (Base Adresse Nationale)
                </Button>
                
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setShowFormatChoice(false);
                    setShowMapper(true);
                  }}
                >
                  Mapping manuel des colonnes
                </Button>
                
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setShowFormatChoice(false);
                    setCsvData([]);
                    setCsvHeaders([]);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : showMapper ? (
            <ColumnMapper
              headers={csvHeaders}
              onConfirm={(mapping) => processImport(csvData, mapping)}
              onCancel={() => {
                setShowMapper(false);
                setCsvData([]);
                setCsvHeaders([]);
              }}
            />
          ) : (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p>Importez un fichier CSV avec les colonnes nécessaires. Le système détectera automatiquement les colonnes.</p>
                  <p className="text-xs">Colonnes requises : <strong>nom de rue</strong>, <strong>latitude</strong>, <strong>longitude</strong></p>
                  <p className="text-xs">Colonnes optionnelles : numéro, observations</p>
                  <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                    <div className="font-semibold mb-1">Exemple de format CSV :</div>
                    <div>commune_nom,voie_nom,numero,lat,long</div>
                    <div>Paris,Rue de la Paix,12,48.8566,2.3522</div>
                    <div>Lyon,Avenue des Lumières,45,45.7640,4.8357</div>
                  </div>
                </AlertDescription>
              </Alert>
              
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Erreurs de validation :</div>
                    <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                      {validationErrors.slice(0, 10).map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                      {validationErrors.length > 10 && (
                        <div className="font-semibold">... et {validationErrors.length - 10} autres erreurs</div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

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
                  onClick={() => setShowDefaultConfirm(true)}
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
                    disabled={importing || showMapper}
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
                    disabled={importing || showMapper}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={showDefaultConfirm} onOpenChange={setShowDefaultConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'import des données par défaut</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va importer toutes les adresses du fichier par défaut. Voulez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowDefaultConfirm(false);
              handleImportDefault();
            }}>
              Confirmer l'import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
