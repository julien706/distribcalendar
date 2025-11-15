import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_CONFIG } from "@/lib/statusConfig";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  status: string;
  observations: string | null;
  city?: string | null;
  is_building?: boolean;
  building_name?: string | null;
  apartment_count?: number | null;
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  color: config.color,
  icon: config.icon,
}));

// Popup for normal addresses
export async function createAddressPopupContent(
  address: Address & { csv_data?: { commune_nom?: string } },
  onStatusChange: (id: string, newStatus: string) => void,
  latitude: number,
  longitude: number,
  onUpdate: () => void
) {
  const container = document.createElement("div");
  container.className = "map-popup-container";
  container.style.padding = "10px";
  container.style.minWidth = "240px";
  container.style.maxWidth = "260px";
  container.style.maxHeight = "400px";
  container.style.overflowY = "auto";

  // Title
  const title = document.createElement("strong");
  title.style.fontSize = "14px";
  title.style.display = "block";
  title.style.marginBottom = "2px";
  title.style.fontWeight = "600";
  title.textContent = `${address.street_number || ""} ${address.street_name}`;
  container.appendChild(title);

  // City
  const cityName = address.city || address.csv_data?.commune_nom;
  if (cityName) {
    const cityDiv = document.createElement("div");
    cityDiv.style.fontSize = "12px";
    cityDiv.style.color = "#6b7280";
    cityDiv.style.marginBottom = "8px";
    cityDiv.textContent = cityName;
    container.appendChild(cityDiv);
  }

  // Separator
  const separator = document.createElement("hr");
  separator.style.border = "none";
  separator.style.borderTop = "1px solid #e5e7eb";
  separator.style.margin = "8px 0";
  container.appendChild(separator);

  // Status section
  const statusLabel = document.createElement("label");
  statusLabel.style.fontSize = "12px";
  statusLabel.style.fontWeight = "600";
  statusLabel.style.display = "block";
  statusLabel.style.marginBottom = "4px";
  statusLabel.textContent = "Statut";
  container.appendChild(statusLabel);

  const statusSelect = document.createElement("select");
  statusSelect.style.width = "100%";
  statusSelect.style.padding = "6px";
  statusSelect.style.fontSize = "12px";
  statusSelect.style.border = "1px solid #d1d5db";
  statusSelect.style.borderRadius = "6px";
  statusSelect.style.marginBottom = "8px";
  statusSelect.value = address.status;

  STATUS_OPTIONS.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    statusSelect.appendChild(optionElement);
  });

  statusSelect.addEventListener("change", (e) => {
    onStatusChange(address.id, (e.target as HTMLSelectElement).value);
  });

  container.appendChild(statusSelect);

  // Observations section
  const obsLabel = document.createElement("label");
  obsLabel.style.fontSize = "12px";
  obsLabel.style.fontWeight = "600";
  obsLabel.style.display = "block";
  obsLabel.style.marginBottom = "4px";
  obsLabel.textContent = "Observations";
  container.appendChild(obsLabel);

  const obsTextarea = document.createElement("textarea");
  obsTextarea.style.width = "100%";
  obsTextarea.style.padding = "6px";
  obsTextarea.style.fontSize = "12px";
  obsTextarea.style.border = "1px solid #d1d5db";
  obsTextarea.style.borderRadius = "6px";
  obsTextarea.style.marginBottom = "8px";
  obsTextarea.style.minHeight = "60px";
  obsTextarea.style.resize = "vertical";
  obsTextarea.value = address.observations || "";
  obsTextarea.placeholder = "Ajouter une observation...";

  let obsTimeout: NodeJS.Timeout;
  obsTextarea.addEventListener("input", (e) => {
    clearTimeout(obsTimeout);
    obsTimeout = setTimeout(async () => {
      const newObs = (e.target as HTMLTextAreaElement).value;
      try {
        const { error } = await supabase
          .from("addresses")
          .update({ observations: newObs })
          .eq("id", address.id);
        
        if (error) throw error;
        toast.success("Observation mise à jour");
      } catch (error) {
        console.error("Error updating observations:", error);
        toast.error("Erreur lors de la mise à jour");
      }
    }, 500);
  });

  container.appendChild(obsTextarea);

  // Separator
  const separator2 = document.createElement("hr");
  separator2.style.border = "none";
  separator2.style.borderTop = "1px solid #e5e7eb";
  separator2.style.margin = "8px 0";
  container.appendChild(separator2);

  // Transform to building button
  const convertBtn = document.createElement("button");
  convertBtn.textContent = "🏢 Transformer en immeuble";
  convertBtn.style.width = "100%";
  convertBtn.style.padding = "8px";
  convertBtn.style.marginBottom = "8px";
  convertBtn.style.backgroundColor = "#3B82F6";
  convertBtn.style.color = "white";
  convertBtn.style.border = "none";
  convertBtn.style.borderRadius = "6px";
  convertBtn.style.cursor = "pointer";
  convertBtn.style.fontWeight = "600";
  convertBtn.style.fontSize = "12px";
  
  convertBtn.addEventListener("click", async () => {
    try {
      const { error } = await supabase
        .from("addresses")
        .update({ 
          is_building: true,
          building_name: null,
          apartment_count: 0 
        })
        .eq("id", address.id);

      if (error) throw error;
      
      toast.success("Transformé en immeuble !");
      onUpdate();
      
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de la transformation");
    }
  });
  
  container.appendChild(convertBtn);

  // Separator
  const separator3 = document.createElement("hr");
  separator3.style.border = "none";
  separator3.style.borderTop = "1px solid #e5e7eb";
  separator3.style.margin = "8px 0";
  container.appendChild(separator3);

  // Quick status buttons
  const quickStatusDiv = document.createElement("div");
  quickStatusDiv.style.display = "grid";
  quickStatusDiv.style.gridTemplateColumns = "repeat(3, 1fr)";
  quickStatusDiv.style.gap = "4px";
  quickStatusDiv.style.marginBottom = "8px";

  const priorityStatuses = ["done", "pending", "retry_first", "refused", "no_answer", "uninhabited"];
  priorityStatuses.forEach((statusKey) => {
    const config = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];
    const btn = document.createElement("button");
    btn.style.padding = "6px 4px";
    btn.style.fontSize = "10px";
    btn.style.border = "1px solid #d1d5db";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.style.backgroundColor = address.status === statusKey ? config.color : "white";
    btn.style.color = address.status === statusKey ? "white" : config.color;
    btn.style.fontWeight = "600";
    btn.style.textAlign = "center";
    btn.textContent = config.label;
    
    btn.addEventListener("click", () => {
      onStatusChange(address.id, statusKey);
    });
    
    quickStatusDiv.appendChild(btn);
  });
  
  container.appendChild(quickStatusDiv);

  // Navigate button
  const navBtn = document.createElement("a");
  navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  navBtn.target = "_blank";
  navBtn.style.display = "block";
  navBtn.style.textAlign = "center";
  navBtn.style.padding = "8px";
  navBtn.style.backgroundColor = "#10b981";
  navBtn.style.color = "white";
  navBtn.style.textDecoration = "none";
  navBtn.style.borderRadius = "6px";
  navBtn.style.fontWeight = "600";
  navBtn.style.fontSize = "12px";
  navBtn.textContent = "📍 Naviguer";
  container.appendChild(navBtn);

  return container;
}

// Popup for buildings
export async function createBuildingPopupContent(
  address: Address & { csv_data?: { commune_nom?: string } },
  latitude: number,
  longitude: number,
  onManageApartments: () => void,
  onUpdate: () => void
) {
  const container = document.createElement("div");
  container.className = "map-popup-container";
  container.style.padding = "10px";
  container.style.minWidth = "240px";
  container.style.maxWidth = "260px";
  container.style.maxHeight = "400px";
  container.style.overflowY = "auto";

  // Title
  const title = document.createElement("strong");
  title.style.fontSize = "14px";
  title.style.display = "block";
  title.style.marginBottom = "2px";
  title.style.fontWeight = "600";
  title.textContent = `${address.street_number || ""} ${address.street_name}`;
  container.appendChild(title);

  // City
  const cityName = address.city || address.csv_data?.commune_nom;
  if (cityName) {
    const cityDiv = document.createElement("div");
    cityDiv.style.fontSize = "12px";
    cityDiv.style.color = "#6b7280";
    cityDiv.style.marginBottom = "8px";
    cityDiv.textContent = cityName;
    container.appendChild(cityDiv);
  }

  // Separator
  const separator = document.createElement("hr");
  separator.style.border = "none";
  separator.style.borderTop = "1px solid #e5e7eb";
  separator.style.margin = "8px 0";
  container.appendChild(separator);

  // Building badge
  const buildingDiv = document.createElement("div");
  buildingDiv.style.fontSize = "12px";
  buildingDiv.style.color = "#059669";
  buildingDiv.style.fontWeight = "600";
  buildingDiv.style.marginBottom = "8px";
  buildingDiv.style.padding = "6px 8px";
  buildingDiv.style.backgroundColor = "#f0fdf4";
  buildingDiv.style.borderRadius = "6px";
  buildingDiv.style.border = "1px solid #d1fae5";
  buildingDiv.innerHTML = `🏢 Immeuble${address.building_name ? ` • ${address.building_name}` : ""}${address.apartment_count ? `<br/><span style="font-size: 11px; font-weight: 500;">${address.apartment_count} appartement${address.apartment_count > 1 ? "s" : ""}</span>` : ""}`;
  container.appendChild(buildingDiv);

  // Fetch and display apartments
  const { data: apartments } = await supabase
    .from("apartments")
    .select("*")
    .eq("address_id", address.id)
    .order("name");

  if (apartments && apartments.length > 0) {
    // Apartments section container
    const aptSectionDiv = document.createElement("div");
    aptSectionDiv.style.marginBottom = "8px";
    aptSectionDiv.style.border = "1px solid #e5e7eb";
    aptSectionDiv.style.borderRadius = "6px";
    aptSectionDiv.style.overflow = "hidden";

    // Header (collapsible)
    const aptHeaderDiv = document.createElement("div");
    aptHeaderDiv.style.fontSize = "12px";
    aptHeaderDiv.style.fontWeight = "600";
    aptHeaderDiv.style.padding = "8px";
    aptHeaderDiv.style.backgroundColor = "#f9fafb";
    aptHeaderDiv.style.cursor = "pointer";
    aptHeaderDiv.style.display = "flex";
    aptHeaderDiv.style.justifyContent = "space-between";
    aptHeaderDiv.style.alignItems = "center";
    aptHeaderDiv.style.userSelect = "none";

    const aptHeaderText = document.createElement("span");
    aptHeaderText.textContent = `🏢 Appartements (${apartments.length})`;
    aptHeaderDiv.appendChild(aptHeaderText);

    const aptHeaderIcon = document.createElement("span");
    aptHeaderIcon.textContent = "▼";
    aptHeaderIcon.style.fontSize = "10px";
    aptHeaderDiv.appendChild(aptHeaderIcon);

    // Content (list)
    const aptListDiv = document.createElement("div");
    aptListDiv.style.maxHeight = "150px";
    aptListDiv.style.overflowY = "auto";
    aptListDiv.style.padding = "6px";

    let isOpen = true;

    apartments.forEach((apt) => {
      const aptDiv = document.createElement("div");
      aptDiv.style.padding = "6px";
      aptDiv.style.marginBottom = "4px";
      aptDiv.style.backgroundColor = "#f9fafb";
      aptDiv.style.borderRadius = "4px";
      aptDiv.style.fontSize = "11px";

      const statusConfig = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG];
      
      const aptInfoDiv = document.createElement("div");
      aptInfoDiv.style.display = "flex";
      aptInfoDiv.style.justifyContent = "space-between";
      aptInfoDiv.style.alignItems = "center";
      
      const nameSpan = document.createElement("span");
      nameSpan.textContent = `🚪 ${apt.name}`;
      aptInfoDiv.appendChild(nameSpan);
      
      const statusSpan = document.createElement("span");
      statusSpan.style.color = statusConfig.color;
      statusSpan.style.fontWeight = "600";
      statusSpan.textContent = statusConfig.label;
      aptInfoDiv.appendChild(statusSpan);
      
      aptDiv.appendChild(aptInfoDiv);

      if (apt.observations) {
        const obsDiv = document.createElement("div");
        obsDiv.style.marginTop = "3px";
        obsDiv.style.color = "#6b7280";
        obsDiv.style.fontSize = "10px";
        obsDiv.textContent = `"${apt.observations}"`;
        aptDiv.appendChild(obsDiv);
      }

      aptListDiv.appendChild(aptDiv);
    });

    // Toggle collapsible
    aptHeaderDiv.addEventListener("click", () => {
      isOpen = !isOpen;
      aptListDiv.style.display = isOpen ? "block" : "none";
      aptHeaderIcon.textContent = isOpen ? "▼" : "▶";
    });

    aptSectionDiv.appendChild(aptHeaderDiv);
    aptSectionDiv.appendChild(aptListDiv);
    container.appendChild(aptSectionDiv);
  }

  // Manage apartments button
  const manageBtn = document.createElement("button");
  manageBtn.textContent = "🏢 Gérer les appartements";
  manageBtn.style.width = "100%";
  manageBtn.style.padding = "8px";
  manageBtn.style.marginBottom = "8px";
  manageBtn.style.backgroundColor = "#059669";
  manageBtn.style.color = "white";
  manageBtn.style.border = "none";
  manageBtn.style.borderRadius = "6px";
  manageBtn.style.cursor = "pointer";
  manageBtn.style.fontWeight = "600";
  manageBtn.style.fontSize = "12px";
  
  manageBtn.addEventListener("click", () => {
    onManageApartments();
  });
  
  container.appendChild(manageBtn);

  // Remove building status button (only if no apartments)
  if (!apartments || apartments.length === 0) {
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "❌ Retirer le statut immeuble";
    removeBtn.style.width = "100%";
    removeBtn.style.padding = "8px";
    removeBtn.style.marginBottom = "8px";
    removeBtn.style.backgroundColor = "#EF4444";
    removeBtn.style.color = "white";
    removeBtn.style.border = "none";
    removeBtn.style.borderRadius = "6px";
    removeBtn.style.cursor = "pointer";
    removeBtn.style.fontWeight = "600";
    removeBtn.style.fontSize = "12px";
    
    removeBtn.addEventListener("click", async () => {
      if (!confirm("Retirer le statut immeuble ?")) return;
      
      try {
        const { error } = await supabase
          .from("addresses")
          .update({ 
            is_building: false,
            building_name: null,
            apartment_count: null 
          })
          .eq("id", address.id);

        if (error) throw error;
        
        toast.success("Statut immeuble retiré !");
        onUpdate();
        
      } catch (error) {
        console.error("Error:", error);
        toast.error("Erreur lors de la suppression");
      }
    });
    
    container.appendChild(removeBtn);
  }

  // Navigate button
  const navBtn = document.createElement("a");
  navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  navBtn.target = "_blank";
  navBtn.style.display = "block";
  navBtn.style.textAlign = "center";
  navBtn.style.padding = "8px";
  navBtn.style.backgroundColor = "#10b981";
  navBtn.style.color = "white";
  navBtn.style.textDecoration = "none";
  navBtn.style.borderRadius = "6px";
  navBtn.style.fontWeight = "600";
  navBtn.style.fontSize = "12px";
  navBtn.textContent = "📍 Naviguer";
  container.appendChild(navBtn);

  return container;
}
