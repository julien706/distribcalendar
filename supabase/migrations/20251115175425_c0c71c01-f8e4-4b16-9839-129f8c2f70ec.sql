-- Function to check if a point is inside a polygon using ray casting algorithm
CREATE OR REPLACE FUNCTION public.point_in_polygon(lon double precision, lat double precision, coords jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  inside boolean := false;
  i int := 1;
  j int;
  n int := jsonb_array_length(coords);
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
BEGIN
  IF coords IS NULL OR n < 3 THEN
    RETURN false;
  END IF;

  j := n;
  WHILE i <= n LOOP
    xi := (coords->(i-1)->>0)::double precision;
    yi := (coords->(i-1)->>1)::double precision;
    xj := (coords->(j-1)->>0)::double precision;
    yj := (coords->(j-1)->>1)::double precision;

    IF ((yi > lat) <> (yj > lat)) AND
       (lon < (xj - xi) * (lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;

    j := i;
    i := i + 1;
  END LOOP;

  RETURN inside;
END;
$$;

-- Trigger function to automatically assign zone on address insert
CREATE OR REPLACE FUNCTION public.assign_zone_on_address_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  z RECORD;
BEGIN
  IF NEW.zone_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR z IN
    SELECT id, boundary_coordinates
    FROM public.zones
  LOOP
    IF z.boundary_coordinates IS NOT NULL
       AND point_in_polygon(NEW.longitude, NEW.latitude, z.boundary_coordinates) THEN
      NEW.zone_id := z.id;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for insert
DROP TRIGGER IF EXISTS trg_assign_zone_on_address_insert ON public.addresses;
CREATE TRIGGER trg_assign_zone_on_address_insert
BEFORE INSERT ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.assign_zone_on_address_insert();

-- Trigger function to reassign zone when coordinates change
CREATE OR REPLACE FUNCTION public.reassign_zone_on_address_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  z RECORD;
BEGIN
  IF (NEW.latitude IS DISTINCT FROM OLD.latitude) OR (NEW.longitude IS DISTINCT FROM OLD.longitude) THEN
    NEW.zone_id := NULL;

    FOR z IN SELECT id, boundary_coordinates FROM public.zones LOOP
      IF z.boundary_coordinates IS NOT NULL
         AND point_in_polygon(NEW.longitude, NEW.latitude, z.boundary_coordinates) THEN
        NEW.zone_id := z.id;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for update
DROP TRIGGER IF EXISTS trg_reassign_zone_on_address_update ON public.addresses;
CREATE TRIGGER trg_reassign_zone_on_address_update
BEFORE UPDATE OF latitude, longitude ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.reassign_zone_on_address_update();

-- Admin function to backfill zone assignments for existing addresses
CREATE OR REPLACE FUNCTION public.backfill_zone_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.addresses a
  SET zone_id = z.id
  FROM public.zones z
  WHERE a.zone_id IS NULL
    AND z.boundary_coordinates IS NOT NULL
    AND point_in_polygon(a.longitude, a.latitude, z.boundary_coordinates);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;