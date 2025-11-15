-- Allow active users to read all addresses
CREATE POLICY "Active users can read all addresses"
ON public.addresses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);