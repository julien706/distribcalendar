-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, team_id)
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create zones table
CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  boundary_coordinates JSONB NOT NULL,
  color TEXT NOT NULL DEFAULT '#10B981',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on zones
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- Add zone_id to addresses table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'addresses' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE public.addresses ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;
    CREATE INDEX idx_addresses_zone_id ON public.addresses(zone_id);
  END IF;
END $$;

-- Trigger for updated_at on teams
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on zones
DROP TRIGGER IF EXISTS update_zones_updated_at ON public.zones;
CREATE TRIGGER update_zones_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies for teams (drop if exists first)
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;
CREATE POLICY "Authenticated users can view teams"
  ON public.teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert teams" ON public.teams;
CREATE POLICY "Admins can insert teams"
  ON public.teams FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update teams" ON public.teams;
CREATE POLICY "Admins can update teams"
  ON public.teams FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;
CREATE POLICY "Admins can delete teams"
  ON public.teams FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for team_members
DROP POLICY IF EXISTS "Authenticated users can view team members" ON public.team_members;
CREATE POLICY "Authenticated users can view team members"
  ON public.team_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert team members" ON public.team_members;
CREATE POLICY "Admins can insert team members"
  ON public.team_members FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update team members" ON public.team_members;
CREATE POLICY "Admins can update team members"
  ON public.team_members FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete team members" ON public.team_members;
CREATE POLICY "Admins can delete team members"
  ON public.team_members FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for zones
DROP POLICY IF EXISTS "Authenticated users can view zones" ON public.zones;
CREATE POLICY "Authenticated users can view zones"
  ON public.zones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert zones" ON public.zones;
CREATE POLICY "Admins can insert zones"
  ON public.zones FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update zones" ON public.zones;
CREATE POLICY "Admins can update zones"
  ON public.zones FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete zones" ON public.zones;
CREATE POLICY "Admins can delete zones"
  ON public.zones FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Utility function to assign addresses to a zone
CREATE OR REPLACE FUNCTION public.assign_addresses_to_zone(
  _zone_id uuid,
  _address_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.addresses
  SET zone_id = _zone_id
  WHERE id = ANY(_address_ids);
END;
$$;

-- Utility function to get zone statistics
CREATE OR REPLACE FUNCTION public.get_zone_stats(_zone_id uuid)
RETURNS TABLE (
  total_addresses bigint,
  pending_count bigint,
  done_count bigint,
  refused_count bigint,
  no_answer_count bigint,
  retry_first_count bigint,
  retry_second_count bigint,
  uninhabited_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) as total_addresses,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'done') as done_count,
    COUNT(*) FILTER (WHERE status = 'refused') as refused_count,
    COUNT(*) FILTER (WHERE status = 'no_answer') as no_answer_count,
    COUNT(*) FILTER (WHERE status = 'retry_first') as retry_first_count,
    COUNT(*) FILTER (WHERE status = 'retry_second') as retry_second_count,
    COUNT(*) FILTER (WHERE status = 'uninhabited') as uninhabited_count
  FROM public.addresses
  WHERE zone_id = _zone_id;
$$;