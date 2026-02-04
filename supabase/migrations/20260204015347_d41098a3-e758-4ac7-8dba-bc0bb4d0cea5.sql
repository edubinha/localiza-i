-- Remove plaintext admin_secret column since we now use admin_secret_hash with bcrypt
-- The edge function (validate-empresa) already uses bcrypt.compare() with admin_secret_hash

-- First, drop the NOT NULL constraint if it exists and then drop the column
ALTER TABLE public.empresas DROP COLUMN IF EXISTS admin_secret;