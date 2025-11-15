-- Restrict unassigned addresses visibility to admins only
DROP POLICY IF EXISTS "Active users can read unassigned addresses" ON public.addresses;

CREATE POLICY "Admins can read unassigned addresses"
ON public.addresses
FOR SELECT
TO authenticated
USING (
  zone_id IS NULL
  AND has_role(auth.uid(), 'admin'::app_role)
);
