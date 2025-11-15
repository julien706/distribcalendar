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

  // "Changer le statut:" label
  const statusLabel = document.createElement("div");
  statusLabel.style.fontSize = "14px";
  statusLabel.style.fontWeight = "600";
  statusLabel.style.marginBottom = "8px";
  statusLabel.style.color = "#6b7280";
  statusLabel.textContent = "Changer le statut:";
  container.appendChild(statusLabel);

  // Quick status buttons (priority order: pending, done, retry_first, retry_second, refused, uninhabited, no_answer)
  const quickStatusDiv = document.createElement("div");
  quickStatusDiv.style.display = "grid";
  quickStatusDiv.style.gridTemplateColumns = "repeat(3, 1fr)";
  quickStatusDiv.style.gap = "8px";
  quickStatusDiv.style.marginBottom = "12px";

  const priorityStatuses = ["pending", "done", "retry_first", "retry_second", "refused", "uninhabited", "no_answer"];
  priorityStatuses.forEach((statusKey) => {
    const config = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];
    const btn = document.createElement("button");
    btn.style.padding = "12px 8px";
    btn.style.fontSize = "11px";
    btn.style.border = `2px solid ${config.color}`;
    btn.style.borderRadius = "8px";
    btn.style.cursor = "pointer";
    btn.style.backgroundColor = address.status === statusKey ? config.color : "white";
    btn.style.color = address.status === statusKey ? "white" : config.color;
    btn.style.fontWeight = "600";
    btn.style.textAlign = "center";
    btn.style.transition = "all 0.2s";
    btn.innerHTML = `${config.icon} ${config.label}`;
    
    btn.addEventListener("mouseenter", () => {
      if (address.status !== statusKey) {
        btn.style.backgroundColor = config.color + "20";
      }
    });
    
    btn.addEventListener("mouseleave", () => {
      if (address.status !== statusKey) {
        btn.style.backgroundColor = "white";
      }
    });
    
    btn.addEventListener("click", () => {
      onStatusChange(address.id, statusKey);
    });
    
    quickStatusDiv.appendChild(btn);
  });
  
  container.appendChild(quickStatusDiv);

  // Separator
  const separator2 = document.createElement("hr");
  separator2.style.border = "none";
  separator2.style.borderTop = "1px solid #e5e7eb";
  separator2.style.margin = "8px 0";
  container.appendChild(separator2);

  // Observations section (collapsible)
  const obsSection = document.createElement("div");
  obsSection.style.marginBottom = "8px";
  obsSection.style.border = "1px solid #e5e7eb";
  obsSection.style.borderRadius = "6px";
  obsSection.style.overflow = "hidden";

  // Observations header (clickable)
  const obsHeader = document.createElement("div");
  obsHeader.style.padding = "8px";
  obsHeader.style.backgroundColor = "#f9fafb";
  obsHeader.style.cursor = "pointer";
  obsHeader.style.fontWeight = "600";
  obsHeader.style.fontSize = "14px";
  obsHeader.style.display = "flex";
  obsHeader.style.justifyContent = "space-between";
  obsHeader.style.alignItems = "center";
  obsHeader.style.userSelect = "none";
  obsHeader.style.color = "#6b7280";

  const obsTitle = document.createElement("span");
  obsTitle.textContent = "Observations";
  obsHeader.appendChild(obsTitle);

  const obsIcon = document.createElement("span");
  obsIcon.textContent = "▼";
  obsIcon.style.fontSize = "10px";
  obsHeader.appendChild(obsIcon);

  // Observations content
  const obsContent = document.createElement("div");
  obsContent.style.padding = "8px";
  let isObsOpen = true; // Open by default
  obsContent.style.display = "block";

  const obsTextarea = document.createElement("textarea");
  obsTextarea.style.width = "100%";
  obsTextarea.style.padding = "6px";
  obsTextarea.style.fontSize = "12px";
  obsTextarea.style.border = "1px solid #d1d5db";
  obsTextarea.style.borderRadius = "6px";
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

  obsContent.appendChild(obsTextarea);

  // Toggle observations collapsible
  obsHeader.addEventListener("click", () => {
    isObsOpen = !isObsOpen;
    obsContent.style.display = isObsOpen ? "block" : "none";
    obsIcon.textContent = isObsOpen ? "▼" : "▶";
  });

  obsSection.appendChild(obsHeader);
  obsSection.appendChild(obsContent);
  container.appendChild(obsSection);

  // Separator
  const separator3 = document.createElement("hr");
  separator3.style.border = "none";
  separator3.style.borderTop = "1px solid #e5e7eb";
  separator3.style.margin = "8px 0";
  container.appendChild(separator3);

  // Transform to building button (small button with icon)
  const convertBtn = document.createElement("button");
  convertBtn.innerHTML = "🏢 Transformer en immeuble";
  convertBtn.style.width = "100%";
  convertBtn.style.padding = "8px";
  convertBtn.style.marginBottom = "8px";
  convertBtn.style.backgroundColor = "white";
  convertBtn.style.color = "#6b7280";
  convertBtn.style.border = "1px solid #d1d5db";
  convertBtn.style.borderRadius = "6px";
  convertBtn.style.cursor = "pointer";
  convertBtn.style.fontWeight = "500";
  convertBtn.style.fontSize = "12px";
  convertBtn.style.transition = "all 0.2s";
  
  convertBtn.addEventListener("mouseenter", () => {
    convertBtn.style.backgroundColor = "#f9fafb";
    convertBtn.style.borderColor = "#9ca3af";
  });
  
  convertBtn.addEventListener("mouseleave", () => {
    convertBtn.style.backgroundColor = "white";
    convertBtn.style.borderColor = "#d1d5db";
  });
  
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

  // Navigate button (big blue button)
  const navBtn = document.createElement("a");
  navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  navBtn.target = "_blank";
  navBtn.style.display = "block";
  navBtn.style.textAlign = "center";
  navBtn.style.padding = "12px";
  navBtn.style.backgroundColor = "#3B82F6";
  navBtn.style.color = "white";
  navBtn.style.textDecoration = "none";
  navBtn.style.borderRadius = "8px";
  navBtn.style.fontWeight = "600";
  navBtn.style.fontSize = "14px";
  navBtn.style.marginBottom = "8px";
  navBtn.innerHTML = "📍 Naviguer";
  container.appendChild(navBtn);

  // Separator
  const separator4 = document.createElement("hr");
  separator4.style.border = "none";
  separator4.style.borderTop = "1px solid #e5e7eb";
  separator4.style.margin = "8px 0";
  container.appendChild(separator4);

  // Fetch and display history
  const { data: history } = await supabase
    .from("address_status_history")
    .select("*")
    .eq("address_id", address.id)
    .order("changed_at", { ascending: false })
    .limit(10);

  if (history && history.length > 0) {
    // History section (collapsible)
    const historySection = document.createElement("div");
    historySection.style.marginBottom = "8px";
    historySection.style.border = "1px solid #e5e7eb";
    historySection.style.borderRadius = "6px";
    historySection.style.overflow = "hidden";

    // Header (clickable)
    const historyHeader = document.createElement("div");
    historyHeader.style.padding = "8px";
    historyHeader.style.backgroundColor = "#f9fafb";
    historyHeader.style.cursor = "pointer";
    historyHeader.style.fontWeight = "600";
    historyHeader.style.fontSize = "14px";
    historyHeader.style.display = "flex";
    historyHeader.style.justifyContent = "space-between";
    historyHeader.style.alignItems = "center";
    historyHeader.style.userSelect = "none";
    historyHeader.style.color = "#6b7280";

    const historyTitle = document.createElement("span");
    historyTitle.textContent = "Historique";
    historyHeader.appendChild(historyTitle);

    const historyIcon = document.createElement("span");
    historyIcon.textContent = "▼";
    historyIcon.style.fontSize = "10px";
    historyHeader.appendChild(historyIcon);

    // Content (list)
    const historyContent = document.createElement("div");
    historyContent.style.maxHeight = "200px";
    historyContent.style.overflowY = "auto";
    historyContent.style.padding = "6px";
    let isHistoryOpen = true; // Open by default
    historyContent.style.display = "block";

    // Populate history entries
    history.forEach((entry, index) => {
      const entryDiv = document.createElement("div");
      entryDiv.style.padding = "6px";
      entryDiv.style.marginBottom = "4px";
      entryDiv.style.backgroundColor = "#f9fafb";
      entryDiv.style.borderRadius = "4px";
      entryDiv.style.fontSize = "11px";

      const oldConfig = entry.old_status ? STATUS_CONFIG[entry.old_status as keyof typeof STATUS_CONFIG] : null;
      const newConfig = STATUS_CONFIG[entry.new_status as keyof typeof STATUS_CONFIG];

      // Status change line
      const statusLine = document.createElement("div");
      statusLine.style.display = "flex";
      statusLine.style.justifyContent = "space-between";
      statusLine.style.alignItems = "center";
      statusLine.style.marginBottom = "2px";

      const statusChange = document.createElement("span");
      if (oldConfig) {
        statusChange.innerHTML = `<span style="color: ${oldConfig.color}">${oldConfig.label}</span> → <span style="color: ${newConfig.color}; font-weight: 600;">${newConfig.label}</span>`;
      } else {
        statusChange.innerHTML = `<span style="color: ${newConfig.color}; font-weight: 600;">${newConfig.label}</span>`;
      }
      statusLine.appendChild(statusChange);

      // Date
      const date = new Date(entry.changed_at);
      const dateSpan = document.createElement("span");
      dateSpan.style.color = "#6b7280";
      dateSpan.style.fontSize = "10px";
      dateSpan.textContent = date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      statusLine.appendChild(dateSpan);

      entryDiv.appendChild(statusLine);

      // Observations (if changed)
      if (entry.new_observations && entry.new_observations !== entry.old_observations) {
        const obsDiv = document.createElement("div");
        obsDiv.style.marginTop = "3px";
        obsDiv.style.color = "#6b7280";
        obsDiv.style.fontSize = "10px";
        obsDiv.style.fontStyle = "italic";
        obsDiv.textContent = `"${entry.new_observations}"`;
        entryDiv.appendChild(obsDiv);
      }

      historyContent.appendChild(entryDiv);

      // Separator between entries (except last)
      if (index < history.length - 1) {
        const sep = document.createElement("hr");
        sep.style.border = "none";
        sep.style.borderTop = "1px solid #e5e7eb";
        sep.style.margin = "4px 0";
        historyContent.appendChild(sep);
      }
    });

    // Toggle collapsible
    historyHeader.addEventListener("click", () => {
      isHistoryOpen = !isHistoryOpen;
      historyContent.style.display = isHistoryOpen ? "block" : "none";
      historyIcon.textContent = isHistoryOpen ? "▼" : "▶";
    });

    historySection.appendChild(historyHeader);
    historySection.appendChild(historyContent);
    container.appendChild(historySection);
  }

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

  // Fetch and display history
  const { data: history } = await supabase
    .from("address_status_history")
    .select("*")
    .eq("address_id", address.id)
    .order("changed_at", { ascending: false })
    .limit(10);

  if (history && history.length > 0) {
    // Separator
    const historySeparator = document.createElement("hr");
    historySeparator.style.border = "none";
    historySeparator.style.borderTop = "1px solid #e5e7eb";
    historySeparator.style.margin = "8px 0";
    container.appendChild(historySeparator);

    // History section (collapsible)
    const historySection = document.createElement("div");
    historySection.style.marginBottom = "8px";
    historySection.style.border = "1px solid #e5e7eb";
    historySection.style.borderRadius = "6px";
    historySection.style.overflow = "hidden";

    // Header (clickable)
    const historyHeader = document.createElement("div");
    historyHeader.style.padding = "8px";
    historyHeader.style.backgroundColor = "#f9fafb";
    historyHeader.style.cursor = "pointer";
    historyHeader.style.fontWeight = "600";
    historyHeader.style.fontSize = "12px";
    historyHeader.style.display = "flex";
    historyHeader.style.justifyContent = "space-between";
    historyHeader.style.alignItems = "center";
    historyHeader.style.userSelect = "none";

    const historyTitle = document.createElement("span");
    historyTitle.textContent = `📜 Historique (${history.length})`;
    historyHeader.appendChild(historyTitle);

    const historyIcon = document.createElement("span");
    historyIcon.textContent = "▶";
    historyIcon.style.fontSize = "10px";
    historyHeader.appendChild(historyIcon);

    // Content (list)
    const historyContent = document.createElement("div");
    historyContent.style.maxHeight = "200px";
    historyContent.style.overflowY = "auto";
    historyContent.style.padding = "6px";
    let isHistoryOpen = false;
    historyContent.style.display = "none";

    // Populate history entries
    history.forEach((entry, index) => {
      const entryDiv = document.createElement("div");
      entryDiv.style.padding = "6px";
      entryDiv.style.marginBottom = "4px";
      entryDiv.style.backgroundColor = "#f9fafb";
      entryDiv.style.borderRadius = "4px";
      entryDiv.style.fontSize = "11px";

      const oldConfig = entry.old_status ? STATUS_CONFIG[entry.old_status as keyof typeof STATUS_CONFIG] : null;
      const newConfig = STATUS_CONFIG[entry.new_status as keyof typeof STATUS_CONFIG];

      // Status change line
      const statusLine = document.createElement("div");
      statusLine.style.display = "flex";
      statusLine.style.justifyContent = "space-between";
      statusLine.style.alignItems = "center";
      statusLine.style.marginBottom = "2px";

      const statusChange = document.createElement("span");
      if (oldConfig) {
        statusChange.innerHTML = `<span style="color: ${oldConfig.color}">${oldConfig.label}</span> → <span style="color: ${newConfig.color}; font-weight: 600;">${newConfig.label}</span>`;
      } else {
        statusChange.innerHTML = `<span style="color: ${newConfig.color}; font-weight: 600;">${newConfig.label}</span>`;
      }
      statusLine.appendChild(statusChange);

      // Date
      const date = new Date(entry.changed_at);
      const dateSpan = document.createElement("span");
      dateSpan.style.color = "#6b7280";
      dateSpan.style.fontSize = "10px";
      dateSpan.textContent = date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      statusLine.appendChild(dateSpan);

      entryDiv.appendChild(statusLine);

      // Observations (if changed)
      if (entry.new_observations && entry.new_observations !== entry.old_observations) {
        const obsDiv = document.createElement("div");
        obsDiv.style.marginTop = "3px";
        obsDiv.style.color = "#6b7280";
        obsDiv.style.fontSize = "10px";
        obsDiv.style.fontStyle = "italic";
        obsDiv.textContent = `"${entry.new_observations}"`;
        entryDiv.appendChild(obsDiv);
      }

      historyContent.appendChild(entryDiv);

      // Separator between entries (except last)
      if (index < history.length - 1) {
        const sep = document.createElement("hr");
        sep.style.border = "none";
        sep.style.borderTop = "1px solid #e5e7eb";
        sep.style.margin = "4px 0";
        historyContent.appendChild(sep);
      }
    });

    // Toggle collapsible
    historyHeader.addEventListener("click", () => {
      isHistoryOpen = !isHistoryOpen;
      historyContent.style.display = isHistoryOpen ? "block" : "none";
      historyIcon.textContent = isHistoryOpen ? "▼" : "▶";
    });

    historySection.appendChild(historyHeader);
    historySection.appendChild(historyContent);
    container.appendChild(historySection);
  }

  // Separator
  const separator3 = document.createElement("hr");
  separator3.style.border = "none";
  separator3.style.borderTop = "1px solid #e5e7eb";
  separator3.style.margin = "8px 0";
  container.appendChild(separator3);

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
