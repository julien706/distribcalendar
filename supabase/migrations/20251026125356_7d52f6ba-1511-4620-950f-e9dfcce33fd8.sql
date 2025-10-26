-- Create enum for distribution status
CREATE TYPE public.distribution_status AS ENUM (
  'pending',
  'done',
  'retry_first',
  'retry_second',
  'refused',
  'uninhabited'
);

-- Create addresses table
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  street_name TEXT NOT NULL,
  street_number TEXT,
  is_even BOOLEAN DEFAULT true,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status distribution_status DEFAULT 'pending' NOT NULL,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_visit_date TIMESTAMPTZ,
  csv_data JSONB
);

-- Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is for field workers)
CREATE POLICY "Allow public read access" 
ON public.addresses 
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Allow public insert" 
ON public.addresses 
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update" 
ON public.addresses 
FOR UPDATE 
TO public
USING (true);

CREATE POLICY "Allow public delete" 
ON public.addresses 
FOR DELETE 
TO public
USING (true);

-- Create index for spatial queries
CREATE INDEX idx_addresses_location ON public.addresses (latitude, longitude);
CREATE INDEX idx_addresses_status ON public.addresses (status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.addresses;