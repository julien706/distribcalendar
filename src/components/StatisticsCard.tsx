import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { BarChart3 } from "lucide-react";

type StatisticsCardProps = {
  totalAddresses: number;
  statusCounts: Record<string, number>;
};

export default function StatisticsCard({ totalAddresses, statusCounts }: StatisticsCardProps) {
  const calculatePercentage = (count: number) => {
    if (totalAddresses === 0) return "0%";
    return `${Math.round((count / totalAddresses) * 100)}%`;
  };

  const completionRate = totalAddresses > 0 
    ? Math.round(((statusCounts["done"] || 0) / totalAddresses) * 100)
    : 0;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Statistiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="text-2xl font-bold">{totalAddresses}</div>
            <div className="text-xs text-muted-foreground">Total adresses</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-primary">{completionRate}%</div>
            <div className="text-xs text-muted-foreground">Taux de complétion</div>
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = statusCounts[key] || 0;
            const percentage = calculatePercentage(count);
            const Icon = config.icon;
            
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{config.label}</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <span>{count}</span>
                  <span className="text-xs text-muted-foreground">({percentage})</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
