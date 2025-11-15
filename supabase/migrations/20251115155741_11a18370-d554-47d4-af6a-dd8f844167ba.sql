-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Active users can read all addresses" ON public.addresses;

-- Allow active users to read only addresses without a zone (newly added)
CREATE POLICY "Active users can read unassigned addresses"
ON public.addresses
FOR SELECT
TO authenticated
USING (
  zone_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);