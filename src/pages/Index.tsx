import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Map, List, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useAddresses } from "@/hooks/useAddresses";
import { STATUS_CONFIG, StatusType } from "@/lib/statusConfig";
import { Card, CardContent } from "@/components/ui/card";

// Lazy load heavy components
const MapView = lazy(() => import("@/components/MapView"));
const AddressList = lazy(() => import("@/components/AddressList"));
const AddressForm = lazy(() => import("@/components/AddressForm"));

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  latitude: number;
  longitude: number;
  status: string;
  observations: string | null;
};

export default function Index() {
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [activeTab, setActiveTab] = useState("map");
  const [showStats, setShowStats] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: addresses = [] } = useAddresses();

  const totalAddresses = addresses.length;
  const completedAddresses = addresses.filter(a => a.status === 'done').length;
  const completionRate = totalAddresses > 0 ? Math.round((completedAddresses / totalAddresses) * 100) : 0;
  
  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, status) => {
    acc[status as StatusType] = addresses.filter(a => a.status === status).length;
    return acc;
  }, {} as Record<StatusType, number>);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header mobile-optimized */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base sm:text-xl font-bold truncate">Distribution Calendriers</h1>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowStats(!showStats)} 
                size="sm" 
                variant="outline" 
                className="h-9 px-3"
              >
                <Map className="h-4 w-4" />
              </Button>
              <Button onClick={() => navigate("/admin")} size="sm" variant="outline" className="h-9 px-3">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Paramètres</span>
              </Button>
            </div>
          </div>
          
          {showStats && (
            <Card className="mt-3 mb-2">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Statistiques
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-3xl font-bold">{totalAddresses}</div>
                    <div className="text-xs text-muted-foreground">Total adresses</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3">
                    <div className="text-3xl font-bold text-primary">{completionRate}%</div>
                    <div className="text-xs text-muted-foreground">Taux de complétion</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                    const count = statusCounts[status as StatusType];
                    const percentage = totalAddresses > 0 
                      ? Math.round((count / totalAddresses) * 100) 
                      : 0;
                    const Icon = config.icon;
                    
                    return (
                      <div key={status} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: config.color }} />
                          <span>{config.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{count}</span>
                          <span className="text-muted-foreground text-xs">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b h-auto p-0 bg-background sticky top-0 z-40">
          <TabsTrigger 
            value="map" 
            className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-12 sm:h-14 gap-2"
          >
            <Map className="h-4 w-4" />
            <span>Carte</span>
          </TabsTrigger>
          <TabsTrigger 
            value="list" 
            className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-12 sm:h-14 gap-2"
          >
            <List className="h-4 w-4" />
            <span>Liste</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent 
          value="map" 
          className="flex-1 relative min-h-0 m-0 animate-fade-in"
        >
          <div className="h-full w-full">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-muted-foreground">Chargement de la carte...</div>
              </div>
            }>
              <MapView />
            </Suspense>
          </div>
        </TabsContent>

        <TabsContent 
          value="list" 
          className="flex-1 relative min-h-0 m-0 animate-fade-in overflow-hidden"
        >
          <div className="absolute inset-0 overflow-y-auto">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full p-8">
                <div className="animate-pulse text-muted-foreground">Chargement de la liste...</div>
              </div>
            }>
              <AddressList onSelectAddress={(address) => {
                setSelectedAddress(address);
              }} />
            </Suspense>
          </div>
        </TabsContent>
      </Tabs>

      {/* Address form dialog */}
      <Suspense fallback={null}>
        <AddressForm
          address={selectedAddress}
          open={!!selectedAddress}
          onClose={() => setSelectedAddress(null)}
        />
      </Suspense>
    </div>
  );
}
