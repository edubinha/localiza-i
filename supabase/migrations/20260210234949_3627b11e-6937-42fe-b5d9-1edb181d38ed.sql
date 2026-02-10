
-- Create a public view exposing ONLY non-sensitive columns from empresas
-- No security_invoker=on so it runs as owner, bypassing the base table's deny-all RLS
-- This is safe because sensitive columns (access_key, admin_secret_hash) are excluded
CREATE VIEW public.empresas_public AS
  SELECT id, nome, google_sheets_url, is_active
  FROM public.empresas;

-- Grant read access to the view for anonymous and authenticated users
GRANT SELECT ON public.empresas_public TO anon, authenticated;
