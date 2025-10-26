import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MapView from "@/components/MapView";
import AddressList from "@/components/AddressList";
import AddressForm from "@/components/AddressForm";
import CSVImporter from "@/components/CSVImporter";
import { Map, List, Upload } from "lucide-react";

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
  const [showImporter, setShowImporter] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">Distribution Calendriers</h1>
          <Button onClick={() => setShowImporter(true)} size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </Button>
        </div>
      </header>

      <Tabs defaultValue="map" className="w-full">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="map" className="flex-1">
            <Map className="mr-2 h-4 w-4" />
            Carte
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1">
            <List className="mr-2 h-4 w-4" />
            Liste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="m-0">
          <MapView />
        </TabsContent>

        <TabsContent value="list" className="m-0">
          <AddressList onSelectAddress={setSelectedAddress} />
        </TabsContent>
      </Tabs>

      <AddressForm
        address={selectedAddress}
        open={!!selectedAddress}
        onClose={() => setSelectedAddress(null)}
      />

      <CSVImporter open={showImporter} onClose={() => setShowImporter(false)} />
    </div>
  );
}
