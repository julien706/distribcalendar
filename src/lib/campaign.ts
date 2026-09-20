import { supabase } from "@/integrations/supabase/client";

export type Campaign = {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};

export type Round = {
  id: string;
  campaign_id: string;
  team_id: string;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  corrected_amount: number | null;
  note: string | null;
};

export async function getActiveCampaign(): Promise<Campaign | null> {
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return (data as Campaign) || null;
}

/** Tournée ouverte pour l'une des équipes de l'utilisateur connecté */
export async function getOpenRound(): Promise<Round | null> {
  const { data } = await supabase
    .from("rounds")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  return (data?.[0] as Round) || null;
}

export async function getDonation(params: { addressId?: string; apartmentId?: string }) {
  const campaign = await getActiveCampaign();
  if (!campaign) return null;

  let query = supabase
    .from("donations")
    .select("*")
    .eq("campaign_id", campaign.id)
    .limit(1);

  query = params.apartmentId
    ? query.eq("apartment_id", params.apartmentId)
    : query.eq("address_id", params.addressId!).is("apartment_id", null);

  const { data } = await query;
  return data?.[0] || null;
}

/** Enregistre (ou met à jour) le montant reçu pour une adresse ou un appartement */
export async function saveDonation(params: {
  addressId?: string;
  apartmentId?: string;
  amount: number;
}): Promise<{ error: string | null }> {
  const campaign = await getActiveCampaign();
  if (!campaign) return { error: "Aucune année de distribution active" };

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Non connecté" };

  const round = await getOpenRound();
  const existing = await getDonation(params);

  if (existing) {
    const { error } = await supabase
      .from("donations")
      .update({ amount: params.amount, round_id: round?.id ?? null })
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("donations").insert({
    campaign_id: campaign.id,
    round_id: round?.id ?? null,
    address_id: params.addressId ?? null,
    apartment_id: params.apartmentId ?? null,
    team_id: round?.team_id ?? null,
    amount: params.amount,
    collected_by: userId,
  });
  return { error: error?.message ?? null };
}

export function formatEuro(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}
