import { supabase } from "@/integrations/supabase/client";
import { STATUS_CONFIG } from "@/lib/statusConfig";

type Apartment = {
  id: string;
  name: string;
  status: string;
  observations: string | null;
};

type Address = {
  id: string;
  building_name?: string | null;
  apartment_count?: number | null;
  street_name: string;
  street_number: string | null;
};

export function createBuildingPopupContent(
  address: Address,
  onUpdate: () => void,
  onConvertToAddress: () => void
) {
  const container = document.createElement("div");
  container.style.padding = "12px";
  container.style.minWidth = "280px";
  container.style.maxWidth = "320px";

  // Title avec icône immeuble
  const title = document.createElement("div");
  title.style.display = "flex";
  title.style.alignItems = "center";
  title.style.gap = "8px";
  title.style.marginBottom = "8px";
  title.innerHTML = `
    <span style="font-size: 20px;">🏢</span>
    <div>
      <strong style="font-size: 14px; font-weight: 600;">
        ${address.building_name || `${address.street_number || ""} ${address.street_name}`}
      </strong>
      <div style="font-size: 11px; color: #6b7280;">
        Immeuble · ${address.apartment_count || 0} appartements
      </div>
    </div>
  `;
  container.appendChild(title);

  // Separator
  const separator = document.createElement("hr");
  separator.style.margin = "8px 0";
  separator.style.border = "none";
  separator.style.borderTop = "1px solid #e5e7eb";
  container.appendChild(separator);

  // Apartments list container (will be populated)
  const apartmentsList = document.createElement("div");
  apartmentsList.id = `apartments-list-${address.id}`;
  apartmentsList.style.maxHeight = "200px";
  apartmentsList.style.overflowY = "auto";
  container.appendChild(apartmentsList);

  // Fetch and display apartments
  fetchAndDisplayApartments(address.id, apartmentsList, onUpdate);

  // Action buttons
  const actionsDiv = document.createElement("div");
  actionsDiv.style.marginTop = "12px";
  actionsDiv.style.display = "flex";
  actionsDiv.style.gap = "8px";

  // Button "Gérer les appartements"
  const manageBtn = document.createElement("button");
  manageBtn.textContent = "📝 Gérer";
  manageBtn.style.flex = "1";
  manageBtn.style.padding = "8px";
  manageBtn.style.borderRadius = "6px";
  manageBtn.style.border = "1px solid #d1d5db";
  manageBtn.style.backgroundColor = "#ffffff";
  manageBtn.style.cursor = "pointer";
  manageBtn.style.fontSize = "12px";
  manageBtn.style.fontWeight = "500";
  manageBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('open-building-dialog', { detail: { addressId: address.id } }));
  };
  actionsDiv.appendChild(manageBtn);

  // Button "Convertir en adresse"
  const convertBtn = document.createElement("button");
  convertBtn.textContent = "🏠 Convertir";
  convertBtn.style.flex = "1";
  convertBtn.style.padding = "8px";
  convertBtn.style.borderRadius = "6px";
  convertBtn.style.border = "1px solid #d1d5db";
  convertBtn.style.backgroundColor = "#ffffff";
  convertBtn.style.cursor = "pointer";
  convertBtn.style.fontSize = "12px";
  convertBtn.style.fontWeight = "500";
  convertBtn.onclick = onConvertToAddress;
  actionsDiv.appendChild(convertBtn);

  container.appendChild(actionsDiv);

  return container;
}

async function fetchAndDisplayApartments(
  addressId: string,
  listContainer: HTMLElement,
  onUpdate: () => void
) {
  const { data: apartments, error } = await supabase
    .from('apartments')
    .select('*')
    .eq('address_id', addressId)
    .order('name');

  if (error) {
    listContainer.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Erreur de chargement</p>';
    return;
  }

  if (!apartments || apartments.length === 0) {
    listContainer.innerHTML = '<p style="color: #6b7280; font-size: 12px; text-align: center;">Aucun appartement</p>';
    return;
  }

  listContainer.innerHTML = '';
  apartments.forEach((apt: Apartment) => {
    const aptDiv = document.createElement("div");
    aptDiv.style.padding = "10px";
    aptDiv.style.marginBottom = "8px";
    aptDiv.style.backgroundColor = "#f9fafb";
    aptDiv.style.borderRadius = "6px";
    aptDiv.style.fontSize = "12px";
    aptDiv.style.display = "flex";
    aptDiv.style.flexDirection = "column";
    aptDiv.style.gap = "8px";

    const statusConfig = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG];
    
    // Info section (name + current status)
    const infoDiv = document.createElement("div");
    infoDiv.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <strong>${apt.name}</strong>
        <span style="
          padding: 2px 6px; 
          border-radius: 4px; 
          background-color: ${statusConfig?.color}15;
          color: ${statusConfig?.color};
          font-size: 10px;
          font-weight: 600;
        ">${statusConfig?.label || apt.status}</span>
      </div>
      ${apt.observations ? `<div style="color: #6b7280; font-size: 11px;">${apt.observations}</div>` : ''}
    `;
    aptDiv.appendChild(infoDiv);

    // Quick action buttons
    const quickActionsDiv = document.createElement("div");
    quickActionsDiv.style.display = "flex";
    quickActionsDiv.style.gap = "4px";
    quickActionsDiv.style.flexWrap = "wrap";

    const statusOptions = [
      { status: 'done', icon: '✓', label: 'Fait', color: '#22c55e' },
      { status: 'pending', icon: '⏳', label: 'En attente', color: '#94a3b8' },
      { status: 'refused', icon: '✕', label: 'Refusé', color: '#ef4444' },
      { status: 'retry_first', icon: '🔄', label: 'Repasse 1', color: '#f59e0b' },
    ];

    statusOptions.forEach(({ status, icon, label, color }) => {
      const btn = document.createElement("button");
      btn.innerHTML = `${icon}`;
      btn.title = label;
      btn.style.padding = "4px 10px";
      btn.style.borderRadius = "4px";
      btn.style.border = apt.status === status ? `2px solid ${color}` : "1px solid #d1d5db";
      btn.style.backgroundColor = apt.status === status ? `${color}20` : "#ffffff";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "14px";
      btn.style.fontWeight = "500";
      btn.style.transition = "all 0.2s";
      
      btn.onmouseover = () => {
        if (apt.status !== status) {
          btn.style.backgroundColor = "#f3f4f6";
        }
      };
      btn.onmouseout = () => {
        if (apt.status !== status) {
          btn.style.backgroundColor = "#ffffff";
        }
      };
      
      btn.onclick = async () => {
        const { error } = await supabase
          .from('apartments')
          .update({ status: status as any })
          .eq('id', apt.id);
        
        if (!error) {
          onUpdate();
          fetchAndDisplayApartments(addressId, listContainer, onUpdate);
        }
      };
      
      quickActionsDiv.appendChild(btn);
    });

    aptDiv.appendChild(quickActionsDiv);
    listContainer.appendChild(aptDiv);
  });
}
