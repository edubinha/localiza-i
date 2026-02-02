-- Add explicit DENY policy for SELECT operations on empresas table
-- This blocks all direct client reads - all access must go through edge functions using service role

CREATE POLICY "Deny all selects on empresas"
  ON public.empresas
  FOR SELECT
  USING (false);

-- Note: All read operations must go through the validate-empresa edge function
-- which uses the service role to bypass RLS policies