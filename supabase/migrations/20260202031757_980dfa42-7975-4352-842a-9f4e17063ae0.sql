-- Remove the dangerous public SELECT policy that exposes credentials
DROP POLICY IF EXISTS "Allow public read for access validation" ON public.empresas;

-- No public SELECT policies - all access will go through edge functions
-- This ensures access_key and admin_secret are never exposed to clients