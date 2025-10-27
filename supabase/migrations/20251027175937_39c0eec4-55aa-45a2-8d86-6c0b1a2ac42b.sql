-- Update helper functions to support multiple teams per user

-- Drop the policy that depends on get_user_team_id
DROP POLICY IF EXISTS "Users can view their team zones" ON public.zones;

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_team_id(uuid);

-- Create function to get all team IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id;
$$;

-- Recreate the policy using the new function
CREATE POLICY "Users can view their team zones"
ON public.zones
FOR SELECT
USING (team_id IN (SELECT get_user_team_ids(auth.uid())));