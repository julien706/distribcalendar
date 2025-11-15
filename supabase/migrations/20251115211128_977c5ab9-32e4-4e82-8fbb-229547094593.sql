-- Fonction pour mettre à jour le compteur d'appartements automatiquement
CREATE OR REPLACE FUNCTION public.update_apartment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Mettre à jour le compteur pour l'adresse concernée
  IF TG_OP = 'DELETE' THEN
    UPDATE public.addresses
    SET apartment_count = (
      SELECT COUNT(*) FROM public.apartments WHERE address_id = OLD.address_id
    )
    WHERE id = OLD.address_id;
    RETURN OLD;
  ELSE
    UPDATE public.addresses
    SET apartment_count = (
      SELECT COUNT(*) FROM public.apartments WHERE address_id = NEW.address_id
    )
    WHERE id = NEW.address_id;
    RETURN NEW;
  END IF;
END;
$$;

-- Créer les triggers pour INSERT et DELETE sur apartments
DROP TRIGGER IF EXISTS trg_update_apartment_count_insert ON public.apartments;
CREATE TRIGGER trg_update_apartment_count_insert
AFTER INSERT ON public.apartments
FOR EACH ROW
EXECUTE FUNCTION public.update_apartment_count();

DROP TRIGGER IF EXISTS trg_update_apartment_count_delete ON public.apartments;
CREATE TRIGGER trg_update_apartment_count_delete
AFTER DELETE ON public.apartments
FOR EACH ROW
EXECUTE FUNCTION public.update_apartment_count();

-- Migration de données : recalculer tous les apartment_count existants
UPDATE public.addresses a
SET apartment_count = (
  SELECT COUNT(*) 
  FROM public.apartments apt 
  WHERE apt.address_id = a.id
)
WHERE a.is_building = true;

-- Ajouter une contrainte CHECK pour valider la cohérence des données
ALTER TABLE public.addresses
DROP CONSTRAINT IF EXISTS check_apartment_count_consistency;

ALTER TABLE public.addresses
ADD CONSTRAINT check_apartment_count_consistency
CHECK (
  (is_building = false AND apartment_count IS NULL)
  OR 
  (is_building = true AND apartment_count >= 0)
);