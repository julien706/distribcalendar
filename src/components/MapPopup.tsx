import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_CONFIG } from "@/lib/statusConfig";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  status: string;
  observations: string | null;
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  color: config.color,
  icon: config.icon,
}));

export function createPopupContent(
  address: Address,
  onStatusChange: (id: string, newStatus: string) => void
) {
  const container = document.createElement("div");
  container.className = "map-popup-container";
  container.style.padding = "16px";
  container.style.minWidth = "280px";
  container.style.maxWidth = "320px";

  // Title
  const title = document.createElement("strong");
  title.style.fontSize = "16px";
  title.style.display = "block";
  title.style.marginBottom = "12px";
  title.style.fontWeight = "600";
  title.textContent = `${address.street_number || ""} ${address.street_name}`;
  container.appendChild(title);

  // Status label
  const statusLabel = document.createElement("div");
  statusLabel.style.fontSize = "12px";
  statusLabel.style.marginBottom = "8px";
  statusLabel.style.color = "#6b7280";
  statusLabel.style.fontWeight = "500";
  statusLabel.textContent = "Changer le statut:";
  container.appendChild(statusLabel);

  // Status buttons grid
  const buttonsGrid = document.createElement("div");
  buttonsGrid.style.display = "grid";
  buttonsGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
  buttonsGrid.style.gap = "8px";
  buttonsGrid.style.marginBottom = "12px";

  STATUS_OPTIONS.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.gap = "6px";
    button.style.padding = "8px 12px";
    button.style.borderRadius = "8px";
    button.style.border = address.status === option.value ? `2px solid ${option.color}` : "2px solid transparent";
    button.style.backgroundColor = address.status === option.value ? `${option.color}15` : "#f9fafb";
    button.style.color = option.color;
    button.style.fontSize = "12px";
    button.style.fontWeight = "500";
    button.style.cursor = "pointer";
    button.style.transition = "all 0.2s";
    
    // Create icon using Unicode or emoji representation
    const iconSpan = document.createElement("span");
    iconSpan.style.fontSize = "14px";
    
    // Map icon names to Unicode/emoji
    const iconMap: Record<string, string> = {
      pending: "⏱️",
      done: "✅",
      retry_first: "🔄",
      retry_second: "🔄",
      refused: "❌",
      uninhabited: "🏠",
    };
    
    iconSpan.textContent = iconMap[option.value] || "•";
    button.appendChild(iconSpan);
    
    const label = document.createElement("span");
    label.textContent = option.label;
    button.appendChild(label);

    button.addEventListener("mouseenter", () => {
      if (address.status !== option.value) {
        button.style.backgroundColor = `${option.color}08`;
        button.style.transform = "scale(1.02)";
      }
    });

    button.addEventListener("mouseleave", () => {
      if (address.status !== option.value) {
        button.style.backgroundColor = "#f9fafb";
        button.style.transform = "scale(1)";
      }
    });

    button.addEventListener("click", async () => {
      const newStatus = option.value as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited";
      
      // Update button states
      buttonsGrid.querySelectorAll("button").forEach((btn) => {
        btn.style.border = "2px solid transparent";
        btn.style.backgroundColor = "#f9fafb";
      });
      button.style.border = `2px solid ${option.color}`;
      button.style.backgroundColor = `${option.color}15`;

      const { error } = await supabase
        .from("addresses")
        .update({
          status: newStatus,
          last_visit_date: new Date().toISOString(),
        })
        .eq("id", address.id);

      if (error) {
        toast.error("Erreur lors de la mise à jour");
      } else {
        toast.success(`Statut mis à jour: ${option.label}`);
        onStatusChange(address.id, newStatus);
      }
    });

    buttonsGrid.appendChild(button);
  });

  container.appendChild(buttonsGrid);

  // Observations section
  const obsContainer = document.createElement("div");
  obsContainer.style.marginTop = "12px";
  obsContainer.style.paddingTop = "12px";
  obsContainer.style.borderTop = "1px solid #e5e7eb";

  const obsLabel = document.createElement("div");
  obsLabel.style.fontSize = "12px";
  obsLabel.style.color = "#6b7280";
  obsLabel.style.fontWeight = "500";
  obsLabel.style.marginBottom = "6px";
  obsLabel.textContent = "Observations:";
  obsContainer.appendChild(obsLabel);

  const obsTextarea = document.createElement("textarea");
  obsTextarea.style.width = "100%";
  obsTextarea.style.padding = "8px";
  obsTextarea.style.borderRadius = "6px";
  obsTextarea.style.border = "1px solid #d1d5db";
  obsTextarea.style.fontSize = "12px";
  obsTextarea.style.fontFamily = "inherit";
  obsTextarea.style.resize = "vertical";
  obsTextarea.style.minHeight = "60px";
  obsTextarea.placeholder = "Ajouter des observations...";
  obsTextarea.value = address.observations || "";

  let saveTimeout: NodeJS.Timeout;
  obsTextarea.addEventListener("input", () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const { error } = await supabase
        .from("addresses")
        .update({
          observations: obsTextarea.value.trim() || null,
        })
        .eq("id", address.id);

      if (error) {
        toast.error("Erreur lors de la sauvegarde");
      } else {
        toast.success("Observations sauvegardées");
      }
    }, 1000);
  });

  obsContainer.appendChild(obsTextarea);
  container.appendChild(obsContainer);

  return container;
}
