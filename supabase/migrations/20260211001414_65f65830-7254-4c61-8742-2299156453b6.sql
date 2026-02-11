
-- Recreate empresas_public view with SECURITY INVOKER to enforce querying user's RLS
DROP VIEW IF EXISTS public.empresas_public;

CREATE VIEW public.empresas_public
WITH (security_invoker = true)
AS
SELECT id, nome, google_sheets_url, is_active
FROM public.empresas;

-- Grant SELECT to anon and authenticated roles
GRANT SELECT ON public.empresas_public TO anon, authenticated;
