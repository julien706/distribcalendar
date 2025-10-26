import { useState } from "react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/MapView";
import AddressList from "@/components/AddressList";
import AddressForm from "@/components/AddressForm";
import CSVImporter from "@/components/CSVImporter";
import { List, Upload, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  const [showList, setShowList] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header mobile-optimized */}
      <header className="border-b sticky top-0 z-[11000] bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
          <h1 className="text-base sm:text-xl font-bold truncate">Distribution Calendriers</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowImporter(true)} size="sm" className="h-9 px-3">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Importer</span>
            </Button>
            <Button onClick={() => setShowList(true)} variant="outline" size="sm" className="h-9 px-3">
              <List className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Liste</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Full screen map */}
      <div className="flex-1 relative">
        <MapView />
      </div>

      {/* Address list sheet */}
      <Sheet open={showList} onOpenChange={setShowList}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="px-4 py-3 border-b sticky top-0 bg-background z-10">
            <div className="flex items-center justify-between">
              <SheetTitle>Liste des adresses</SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowList(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-4rem)]">
            <AddressList onSelectAddress={(address) => {
              setSelectedAddress(address);
              setShowList(false);
            }} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Address form dialog */}
      <AddressForm
        address={selectedAddress}
        open={!!selectedAddress}
        onClose={() => setSelectedAddress(null)}
      />

      {/* CSV importer */}
      <CSVImporter open={showImporter} onClose={() => setShowImporter(false)} />
    </div>
  );
}
