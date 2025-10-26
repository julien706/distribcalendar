import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Address = {
  id: string;
  street_name: string;
  street_number: string | null;
  status: string;
  observations: string | null;
};

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente", color: "#94a3b8" },
  { value: "done", label: "Fait", color: "#22c55e" },
  { value: "retry_first", label: "À repasser 1ère", color: "#f59e0b" },
  { value: "retry_second", label: "À repasser 2ème", color: "#f59e0b" },
  { value: "refused", label: "Refus", color: "#ef4444" },
  { value: "uninhabited", label: "Inhabité", color: "#64748b" },
];

export function createPopupContent(
  address: Address,
  onStatusChange: (id: string, newStatus: string) => void
) {
  const container = document.createElement("div");
  container.className = "map-popup-container";
  container.style.padding = "12px";
  container.style.minWidth = "250px";

  const title = document.createElement("strong");
  title.style.fontSize = "14px";
  title.style.display = "block";
  title.style.marginBottom = "8px";
  title.textContent = `${address.street_number || ""} ${address.street_name}`;
  container.appendChild(title);

  const statusLabel = document.createElement("div");
  statusLabel.style.fontSize = "12px";
  statusLabel.style.marginBottom = "8px";
  statusLabel.style.color = "#666";
  statusLabel.textContent = "Statut:";
  container.appendChild(statusLabel);

  const select = document.createElement("select");
  select.style.width = "100%";
  select.style.padding = "6px 8px";
  select.style.borderRadius = "6px";
  select.style.border = "1px solid #d1d5db";
  select.style.fontSize = "13px";
  select.style.marginBottom = "8px";
  select.style.cursor = "pointer";
  select.value = address.status;

  STATUS_OPTIONS.forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    select.appendChild(optionEl);
  });

  select.addEventListener("change", async (e) => {
    const newStatus = (e.target as HTMLSelectElement).value as "pending" | "done" | "retry_first" | "retry_second" | "refused" | "uninhabited";
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
      toast.success("Statut mis à jour");
      onStatusChange(address.id, newStatus);
    }
  });

  container.appendChild(select);

  if (address.observations) {
    const obs = document.createElement("div");
    obs.style.fontSize = "12px";
    obs.style.color = "#666";
    obs.style.marginTop = "8px";
    obs.style.paddingTop = "8px";
    obs.style.borderTop = "1px solid #e5e7eb";
    obs.textContent = address.observations;
    container.appendChild(obs);
  }

  return container;
}
