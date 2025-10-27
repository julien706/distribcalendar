-- Fix: Address History Readable by All Authenticated Users
-- Restrict history access to only addresses within user's assigned zones

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read history" ON address_status_history;

-- Create zone-scoped policy for regular users
CREATE POLICY "Users can read their zone address history"
ON address_status_history FOR SELECT
USING (
  -- Allow if address belongs to user's team zones
  address_id IN (
    SELECT a.id FROM addresses a
    WHERE a.zone_id IN (
      SELECT get_user_zone_ids(auth.uid())
    )
  )
  -- AND user is active
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_active = true
  )
);

-- Admins can read all history
CREATE POLICY "Admins can read all history"
ON address_status_history FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Fix: Invitation Codes Modifiable by Any Authenticated User
-- Restrict invitation code management to admins only

-- Drop overly permissive UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update invitation codes" ON invitation_codes;

-- Only admins can update invitation codes
CREATE POLICY "Only admins can update invitation codes"
ON invitation_codes FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read invitation codes" ON invitation_codes;

-- Only admins can read invitation codes
CREATE POLICY "Only admins can read invitation codes"
ON invitation_codes FOR SELECT
USING (has_role(auth.uid(), 'admin'));