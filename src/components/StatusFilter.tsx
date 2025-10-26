import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";
import { Filter, X } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

type StatusFilterProps = {
  selectedStatuses: StatusType[];
  onStatusChange: (statuses: StatusType[]) => void;
};

export default function StatusFilter({ selectedStatuses, onStatusChange }: StatusFilterProps) {
  const [open, setOpen] = useState(false);
  const allStatuses = Object.keys(STATUS_CONFIG) as StatusType[];
  const allSelected = selectedStatuses.length === allStatuses.length;

  const toggleStatus = (status: StatusType) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      onStatusChange([]);
    } else {
      onStatusChange(allStatuses);
    }
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
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <h4 className="font-medium text-sm">Filtrer par statut</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="all-statuses"
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <Label
                htmlFor="all-statuses"
                className="text-sm font-medium cursor-pointer flex-1"
              >
                Tous les statuts
              </Label>
            </div>

            <div className="border-t my-2" />

            {allStatuses.map((status) => {
              const config = STATUS_CONFIG[status];
              const Icon = config.icon;
              const isChecked = selectedStatuses.includes(status);

              return (
                <div key={status} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={status}
                    checked={isChecked}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <Label
                    htmlFor={status}
                    className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <Icon className="h-4 w-4" style={{ color: config.color }} />
                    {config.label}
                  </Label>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            {getFilterCount()} statut(s) sélectionné(s)
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
