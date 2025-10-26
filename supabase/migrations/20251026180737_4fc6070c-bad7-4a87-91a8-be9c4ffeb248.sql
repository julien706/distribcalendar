-- Create status history table
CREATE TABLE public.address_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address_id uuid NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  old_status distribution_status,
  new_status distribution_status NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  old_observations text,
  new_observations text
);

-- Enable RLS
ALTER TABLE public.address_status_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access" 
ON public.address_status_history 
FOR SELECT 
USING (true);

-- Create policy for insert (will be used by trigger)
CREATE POLICY "Allow public insert" 
ON public.address_status_history 
FOR INSERT 
WITH CHECK (true);

-- Create function to log status changes
CREATE OR REPLACE FUNCTION public.log_address_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status or observations changed
  IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.observations IS DISTINCT FROM NEW.observations) THEN
    INSERT INTO public.address_status_history (
      address_id,
      old_status,
      new_status,
      old_observations,
      new_observations
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      OLD.observations,
      NEW.observations
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on addresses table
CREATE TRIGGER log_address_status_changes
AFTER UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.log_address_status_change();

-- Create index for faster queries
CREATE INDEX idx_address_status_history_address_id ON public.address_status_history(address_id);
CREATE INDEX idx_address_status_history_changed_at ON public.address_status_history(changed_at DESC);