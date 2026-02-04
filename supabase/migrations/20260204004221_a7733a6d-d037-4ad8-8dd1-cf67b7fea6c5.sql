-- Add hashed admin secret column
ALTER TABLE public.empresas 
ADD COLUMN admin_secret_hash text;

-- Create function to hash admin secrets using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update existing records with hashed versions of admin_secret
UPDATE public.empresas 
SET admin_secret_hash = crypt(admin_secret, gen_salt('bf', 10))
WHERE admin_secret IS NOT NULL AND admin_secret_hash IS NULL;

-- Add comment explaining the security model
COMMENT ON TABLE public.empresas IS 'Multi-tenant company table. access_key is a public identifier for company lookup. admin_secret_hash stores bcrypt-hashed admin password. Direct access is denied by RLS; all operations go through Edge Functions with service_role.';

COMMENT ON COLUMN public.empresas.admin_secret_hash IS 'Bcrypt-hashed admin password. Verified using crypt() function in Edge Functions.';