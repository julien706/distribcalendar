import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Map, List, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
              <Button onClick={() => navigate("/admin")} size="sm" variant="outline" className="h-9 px-3">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Paramètres</span>
              </Button>
            </div>
          </div>
          <h2 className="text-xs sm:text-sm text-muted-foreground">Gestion distribution des calendriers</h2>
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
