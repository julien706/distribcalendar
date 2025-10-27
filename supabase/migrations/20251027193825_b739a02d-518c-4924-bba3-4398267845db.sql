-- Créer un trigger pour supprimer l'historique quand une adresse est supprimée
CREATE OR REPLACE FUNCTION public.delete_address_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.address_status_history
  WHERE address_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_delete_address_history ON public.addresses;
CREATE TRIGGER trigger_delete_address_history
  BEFORE DELETE ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_address_history();