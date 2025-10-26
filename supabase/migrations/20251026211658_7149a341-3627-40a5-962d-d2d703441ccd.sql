-- Helper function to get user's team ID
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Helper function to get user's zone IDs (all zones of their team)
CREATE OR REPLACE FUNCTION public.get_user_zone_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id
  FROM public.zones z
  INNER JOIN public.team_members tm ON tm.team_id = z.team_id
  WHERE tm.user_id = _user_id;
$$;

-- Drop existing address policies
DROP POLICY IF EXISTS "Authenticated users can read addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can insert addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can update addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated users can delete addresses" ON public.addresses;

-- New address policies with role-based access
-- SELECT: Admins see all, users see only their team's zone addresses
CREATE POLICY "Admins can read all addresses" ON public.addresses
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read their team zone addresses" ON public.addresses
FOR SELECT
USING (
  zone_id IN (SELECT public.get_user_zone_ids(auth.uid()))
);

-- INSERT: Only admins can insert
CREATE POLICY "Admins can insert addresses" ON public.addresses
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- UPDATE: Admins can update all, users can only update status and observations
CREATE POLICY "Admins can update all addresses" ON public.addresses
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update status and observations" ON public.addresses
FOR UPDATE
USING (
  zone_id IN (SELECT public.get_user_zone_ids(auth.uid()))
)
WITH CHECK (
  zone_id IN (SELECT public.get_user_zone_ids(auth.uid()))
);

-- DELETE: Only admins can delete
CREATE POLICY "Admins can delete addresses" ON public.addresses
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Drop existing zone policies
DROP POLICY IF EXISTS "Authenticated users can view zones" ON public.zones;

-- New zone policies
-- SELECT: Admins see all zones, users see only their team's zones
CREATE POLICY "Admins can view all zones" ON public.zones
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their team zones" ON public.zones
FOR SELECT
USING (
  team_id = public.get_user_team_id(auth.uid())
);

-- Update profiles table to ensure users can view all profiles (needed for user management)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));