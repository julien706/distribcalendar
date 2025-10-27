import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";
import { Filter, X, Hash, Hexagon } from "lucide-react";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

type StatusFilterProps = {
  selectedStatuses: StatusType[];
  onStatusChange: (statuses: StatusType[]) => void;
  showNumbers: boolean;
  onShowNumbersChange: (show: boolean) => void;
  showZones: boolean;
  onShowZonesChange: (show: boolean) => void;
};

const SHORT_LABELS: Record<StatusType, string> = {
  pending: "Att",
  done: "Fait",
  retry_first: "R1",
  retry_second: "R2",
  refused: "Ref",
  uninhabited: "Inh",
  no_answer: "NR",
};

export default function StatusFilter({ selectedStatuses, onStatusChange, showNumbers, onShowNumbersChange, showZones, onShowZonesChange }: StatusFilterProps) {
  const [open, setOpen] = useState(false);
  const allStatuses = Object.keys(STATUS_CONFIG) as StatusType[];
  const allSelected = selectedStatuses.length === allStatuses.length;

  const selectAll = () => {
    onStatusChange(allStatuses);
  };

  const selectNone = () => {
    onStatusChange([]);
  };

  const getFilterCount = () => {
    if (allSelected) return "Tous";
    if (selectedStatuses.length === 0) return "Aucun";
    return selectedStatuses.length.toString();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg touch-manipulation relative"
          title="Filtrer par statut"
        >
          <Filter className="h-5 w-5" />
          {!allSelected && selectedStatuses.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
              {selectedStatuses.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2 max-h-[min(60vh,280px)] overflow-y-auto z-[12010]" align="end">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pb-1.5 border-b">
            <h4 className="font-medium text-sm">Filtres</h4>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-6 px-2 text-[11px]"
              >
                Tout
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectNone}
                className="h-6 px-2 text-[11px]"
              >
                Aucun
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <ToggleGroup
              type="multiple"
              value={selectedStatuses as string[]}
              onValueChange={(vals) => onStatusChange(vals as StatusType[])}
              className="grid grid-cols-3 gap-1.5"
            >
              {allStatuses.map((status) => {
                const config = STATUS_CONFIG[status];
                const Icon = config.icon;
                const isOn = selectedStatuses.includes(status);

                return (
                  <ToggleGroupItem
                    key={status}
                    value={status}
                    className="min-h-10 px-2 text-[11px] data-[state=on]:bg-primary/10 data-[state=on]:ring-1 data-[state=on]:ring-primary/40 font-medium flex items-center gap-1 touch-manipulation"
                    aria-pressed={isOn}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                    <span>{SHORT_LABELS[status]}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          <div className="pt-1.5 border-t space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="show-numbers" className="text-xs cursor-pointer">
                  N°
                </Label>
              </div>
              <Switch
                id="show-numbers"
                checked={showNumbers}
                onCheckedChange={onShowNumbersChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Hexagon className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="show-zones" className="text-xs cursor-pointer">
                  Zones
                </Label>
              </div>
              <Switch
                id="show-zones"
                checked={showZones}
                onCheckedChange={onShowZonesChange}
              />
            </div>
          </div>

          <div className="pt-1 border-t text-[11px] text-muted-foreground">
            {getFilterCount()} statut(s)
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
