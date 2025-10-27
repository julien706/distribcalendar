-- Mettre à jour la fonction handle_new_user pour créer les profils inactifs par défaut
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_active)
  VALUES (NEW.id, NEW.email, false);
  RETURN NEW;
END;
$$;

-- Modifier les RLS policies pour les adresses pour vérifier is_active
DROP POLICY IF EXISTS "Users can read their team zone addresses" ON public.addresses;
CREATE POLICY "Users can read their team zone addresses"
ON public.addresses
FOR SELECT
USING (
  (zone_id IN (SELECT get_user_zone_ids(auth.uid())))
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
);

DROP POLICY IF EXISTS "Users can update status and observations" ON public.addresses;
CREATE POLICY "Users can update status and observations"
ON public.addresses
FOR UPDATE
USING (
  (zone_id IN (SELECT get_user_zone_ids(auth.uid())))
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
)
WITH CHECK (
  (zone_id IN (SELECT get_user_zone_ids(auth.uid())))
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
);

-- Ajouter une politique pour permettre aux admins de mettre à jour les profils
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));