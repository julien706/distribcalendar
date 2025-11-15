-- Add building columns to addresses table
ALTER TABLE public.addresses
ADD COLUMN is_building boolean DEFAULT false,
ADD COLUMN building_name text,
ADD COLUMN apartment_count integer;

-- Create apartments table
CREATE TABLE public.apartments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  name text NOT NULL,
  status distribution_status NOT NULL DEFAULT 'pending',
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for better performance
CREATE INDEX idx_apartments_address_id ON public.apartments(address_id);

-- Enable RLS on apartments
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;

-- Function to calculate building status based on apartments
CREATE OR REPLACE FUNCTION public.calculate_building_status(_address_id uuid)
RETURNS distribution_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count integer;
  done_count integer;
  pending_count integer;
  refused_count integer;
  retry_count integer;
BEGIN
  -- Count apartments by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'done'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'refused'),
    COUNT(*) FILTER (WHERE status IN ('retry_first', 'retry_second'))
  INTO total_count, done_count, pending_count, refused_count, retry_count
  FROM public.apartments
  WHERE address_id = _address_id;

  -- If no apartments, keep current status
  IF total_count = 0 THEN
    RETURN (SELECT status FROM public.addresses WHERE id = _address_id);
  END IF;

  -- All done -> done
  IF done_count = total_count THEN
    RETURN 'done';
  END IF;

  -- Any pending -> pending
  IF pending_count > 0 THEN
    RETURN 'pending';
  END IF;

  -- Any retry -> retry_first (use the most common retry status)
  IF retry_count > 0 THEN
    RETURN 'retry_first';
  END IF;

  -- Any refused -> refused
  IF refused_count > 0 THEN
    RETURN 'refused';
  END IF;

  -- Default to pending
  RETURN 'pending';
END;
$$;

-- Function to update building status when apartments change
CREATE OR REPLACE FUNCTION public.update_building_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _address_id uuid;
  new_status distribution_status;
BEGIN
  -- Get the address_id from the trigger
  IF TG_OP = 'DELETE' THEN
    _address_id := OLD.address_id;
  ELSE
    _address_id := NEW.address_id;
  END IF;

  -- Only update if it's a building
  IF EXISTS (SELECT 1 FROM public.addresses WHERE id = _address_id AND is_building = true) THEN
    -- Calculate new status
    new_status := calculate_building_status(_address_id);
    
    -- Update the address status
    UPDATE public.addresses
    SET status = new_status,
        updated_at = now()
    WHERE id = _address_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger to update building status
CREATE TRIGGER trg_update_building_status
AFTER INSERT OR UPDATE OR DELETE ON public.apartments
FOR EACH ROW
EXECUTE FUNCTION update_building_status();

-- Trigger for updated_at on apartments
CREATE TRIGGER update_apartments_updated_at
BEFORE UPDATE ON public.apartments
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- RLS Policies for apartments

-- Admins can do everything
CREATE POLICY "Admins can manage all apartments" ON public.apartments
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Active users can view apartments in their zones
CREATE POLICY "Users can view zone apartments" ON public.apartments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = apartments.address_id
      AND a.zone_id IN (SELECT get_user_zone_ids(auth.uid()))
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);

-- Active users can insert apartments in their zones
CREATE POLICY "Users can insert zone apartments" ON public.apartments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = apartments.address_id
      AND a.zone_id IN (SELECT get_user_zone_ids(auth.uid()))
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);

-- Active users can update apartments in their zones
CREATE POLICY "Users can update zone apartments" ON public.apartments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = apartments.address_id
      AND a.zone_id IN (SELECT get_user_zone_ids(auth.uid()))
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);

-- Active users can delete apartments in their zones
CREATE POLICY "Users can delete zone apartments" ON public.apartments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = apartments.address_id
      AND a.zone_id IN (SELECT get_user_zone_ids(auth.uid()))
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_active = true
  )
);