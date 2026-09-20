-- Campagnes (années de distribution)
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete campaigns" ON public.campaigns FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX one_active_campaign ON public.campaigns ((is_active)) WHERE is_active;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Tournées
CREATE TABLE public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  corrected_amount numeric(10,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rounds TO authenticated;
GRANT ALL ON public.rounds TO service_role;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view team rounds" ON public.rounds FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR team_id IN (SELECT get_user_team_ids(auth.uid())));
CREATE POLICY "Members create team rounds" ON public.rounds FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR team_id IN (SELECT get_user_team_ids(auth.uid())));
CREATE POLICY "Members update team rounds" ON public.rounds FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR team_id IN (SELECT get_user_team_ids(auth.uid())));
CREATE POLICY "Admins delete rounds" ON public.rounds FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX one_open_round_per_team ON public.rounds (team_id, campaign_id) WHERE ended_at IS NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rounds FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Dons (montants encaissés)
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.rounds(id) ON DELETE SET NULL,
  address_id uuid REFERENCES public.addresses(id) ON DELETE CASCADE,
  apartment_id uuid REFERENCES public.apartments(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  collected_by uuid NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or team donations" ON public.donations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR collected_by = auth.uid() OR team_id IN (SELECT get_user_team_ids(auth.uid())));
CREATE POLICY "Insert own donations" ON public.donations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR collected_by = auth.uid());
CREATE POLICY "Update own donations" ON public.donations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR collected_by = auth.uid());
CREATE POLICY "Delete own donations" ON public.donations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR collected_by = auth.uid());
CREATE INDEX donations_campaign_idx ON public.donations (campaign_id);
CREATE INDEX donations_round_idx ON public.donations (round_id);
CREATE INDEX donations_address_idx ON public.donations (address_id);
CREATE INDEX donations_apartment_idx ON public.donations (apartment_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Mouvements de calendriers
CREATE TABLE public.calendar_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('given','returned')),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_stocks TO authenticated;
GRANT ALL ON public.calendar_stocks TO service_role;
ALTER TABLE public.calendar_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or team stocks" ON public.calendar_stocks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR user_id = auth.uid() OR team_id IN (SELECT get_user_team_ids(auth.uid())));
CREATE POLICY "Admins insert stocks" ON public.calendar_stocks FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update stocks" ON public.calendar_stocks FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete stocks" ON public.calendar_stocks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Versements d'argent
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  method text,
  note text,
  recorded_by uuid NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or team payments" ON public.payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR user_id = auth.uid() OR team_id IN (SELECT get_user_team_ids(auth.uid())));
CREATE POLICY "Admins insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payments" ON public.payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Agrégats
CREATE OR REPLACE FUNCTION public.get_round_totals(_round_id uuid)
RETURNS TABLE(total_amount numeric, donation_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount),0), COUNT(*) FROM public.donations WHERE round_id = _round_id;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_balance(_campaign_id uuid)
RETURNS TABLE(user_id uuid, email text, given integer, returned integer, collected numeric, paid numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email,
    COALESCE((SELECT SUM(quantity)::int FROM public.calendar_stocks s WHERE s.user_id = p.id AND s.campaign_id = _campaign_id AND s.movement_type = 'given'), 0),
    COALESCE((SELECT SUM(quantity)::int FROM public.calendar_stocks s WHERE s.user_id = p.id AND s.campaign_id = _campaign_id AND s.movement_type = 'returned'), 0),
    COALESCE((SELECT SUM(amount) FROM public.donations d WHERE d.collected_by = p.id AND d.campaign_id = _campaign_id), 0),
    COALESCE((SELECT SUM(amount) FROM public.payments pay WHERE pay.user_id = p.id AND pay.campaign_id = _campaign_id), 0)
  FROM public.profiles p
  ORDER BY p.email;
$$;

-- Campagne initiale
INSERT INTO public.campaigns (name, year, is_active) VALUES ('Campagne ' || EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(YEAR FROM CURRENT_DATE)::int, true);