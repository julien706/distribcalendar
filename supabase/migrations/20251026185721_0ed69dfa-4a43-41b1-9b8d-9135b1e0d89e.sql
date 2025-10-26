-- Create a table to store the invitation code
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read the code
CREATE POLICY "Authenticated users can read invitation codes"
ON public.invitation_codes
FOR SELECT
TO authenticated
USING (true);

-- Only authenticated users can update the code
CREATE POLICY "Authenticated users can update invitation codes"
ON public.invitation_codes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert a default invitation code
INSERT INTO public.invitation_codes (code, is_active)
VALUES ('INVITE2025', true)
ON CONFLICT (code) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_invitation_codes_updated_at
BEFORE UPDATE ON public.invitation_codes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();