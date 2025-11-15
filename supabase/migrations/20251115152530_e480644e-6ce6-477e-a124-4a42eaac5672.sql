-- Allow active users to insert addresses
CREATE POLICY "Active users can insert addresses"
ON public.addresses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);