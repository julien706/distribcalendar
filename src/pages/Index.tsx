import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MapView from "@/components/MapView";
import AddressList from "@/components/AddressList";
import AddressForm from "@/components/AddressForm";
import { Map, List, Settings, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import QuickDistributionMode from "@/components/QuickDistributionMode";

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
  const [showQuickMode, setShowQuickMode] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (showQuickMode) {
    return <QuickDistributionMode onClose={() => setShowQuickMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header mobile-optimized */}
      <header className="border-b sticky top-0 z-[11000] bg-background/95 backdrop-blur">
        <div className="px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base sm:text-xl font-bold truncate">Distribution Calendriers</h1>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowQuickMode(true)} 
                size="sm" 
                className="h-9 px-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Zap className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Distribution rapide</span>
              </Button>
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b h-auto p-0 bg-transparent">
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
          <div className="absolute inset-0">
            <MapView />
          </div>
        </TabsContent>

        <TabsContent 
          value="list" 
          className="flex-1 relative min-h-0 m-0 animate-fade-in overflow-hidden"
        >
          <div className="absolute inset-0 overflow-y-auto">
            <AddressList onSelectAddress={(address) => {
              setSelectedAddress(address);
            }} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Address form dialog */}
      <AddressForm
        address={selectedAddress}
        open={!!selectedAddress}
        onClose={() => setSelectedAddress(null)}
      />
    </div>
  );
}
