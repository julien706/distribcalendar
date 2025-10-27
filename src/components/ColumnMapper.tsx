import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ColumnMapperProps {
  headers: string[];
  onConfirm: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}

const REQUIRED_FIELDS = [
  { key: "street_name", label: "Nom de rue", required: true },
  { key: "latitude", label: "Latitude", required: true },
  { key: "longitude", label: "Longitude", required: true },
];

const OPTIONAL_FIELDS = [
  { key: "street_number", label: "Numéro", required: false },
  { key: "city", label: "Ville", required: false },
  { key: "observations", label: "Observations", required: false },
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Auto-detection patterns
const PATTERNS: Record<string, string[]> = {
  street_name: ["nom_voie", "voie_nom", "rue", "street", "nom_rue", "voie", "street_name", "adresse", "address"],
  street_number: ["numero", "num", "number", "street_number", "n°", "no"],
  latitude: ["lat", "latitude", "y"],
  longitude: ["lon", "long", "lng", "longitude", "x"],
  city: ["nom_commune", "commune_nom", "ville", "city", "commune", "municipalite", "libelle_acheminement"],
  observations: ["observations", "obs", "note", "notes", "remarques", "commentaire"],
};

export default function ColumnMapper({ headers, onConfirm, onCancel }: ColumnMapperProps) {
  // Auto-detect mappings
  const autoDetect = () => {
    const mapping: Record<string, string> = {};
    
    for (const field of ALL_FIELDS) {
      const pattern = PATTERNS[field.key] || [];
      const match = headers.find(h => 
        pattern.some(p => h.toLowerCase().includes(p.toLowerCase()))
      );
      if (match) {
        mapping[field.key] = match;
      }
    }
    
    return mapping;
  };

  const [mapping, setMapping] = useState<Record<string, string>>(autoDetect());

  const handleMappingChange = (fieldKey: string, columnName: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: columnName === "none" ? "" : columnName,
    }));
  };

  const isValid = REQUIRED_FIELDS.every(field => mapping[field.key]);

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Associez les colonnes de votre fichier CSV aux champs requis. Les champs marqués d'un * sont obligatoires.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {ALL_FIELDS.map(field => (
          <div key={field.key} className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
              {mapping[field.key] && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </label>
            <Select
              value={mapping[field.key] || "none"}
              onValueChange={(value) => handleMappingChange(field.key, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une colonne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Aucune --</SelectItem>
                {headers.map(header => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {!isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Veuillez mapper tous les champs obligatoires (marqués d'un *)
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Annuler
        </Button>
        <Button onClick={() => onConfirm(mapping)} disabled={!isValid} className="flex-1">
          Confirmer et importer
        </Button>
      </div>
    </div>
  );
}
