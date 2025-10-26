-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can read their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Drop existing permissive policies on addresses table
DROP POLICY IF EXISTS "Allow public read access" ON public.addresses;
DROP POLICY IF EXISTS "Allow public insert" ON public.addresses;
DROP POLICY IF EXISTS "Allow public update" ON public.addresses;
DROP POLICY IF EXISTS "Allow public delete" ON public.addresses;

-- Create authenticated-only policies for addresses
CREATE POLICY "Authenticated users can read addresses"
ON public.addresses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert addresses"
ON public.addresses
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update addresses"
ON public.addresses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete addresses"
ON public.addresses
FOR DELETE
TO authenticated
USING (true);

-- Drop existing permissive policies on address_status_history
DROP POLICY IF EXISTS "Allow public read access" ON public.address_status_history;
DROP POLICY IF EXISTS "Allow public insert" ON public.address_status_history;

-- Create authenticated-only policies for address_status_history
CREATE POLICY "Authenticated users can read history"
ON public.address_status_history
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert history"
ON public.address_status_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();