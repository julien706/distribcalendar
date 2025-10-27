-- Add city column to addresses table
ALTER TABLE public.addresses 
ADD COLUMN city TEXT;

-- Create index for better performance on city filtering
CREATE INDEX idx_addresses_city ON public.addresses(city);

-- Update existing records to extract city from csv_data if available
UPDATE public.addresses 
SET city = (csv_data->>'commune_nom')
WHERE csv_data IS NOT NULL AND csv_data->>'commune_nom' IS NOT NULL;