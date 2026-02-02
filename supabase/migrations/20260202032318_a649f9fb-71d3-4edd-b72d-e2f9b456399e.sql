-- Add explicit DENY policies for write operations on empresas table
-- This makes the security posture explicit rather than relying on default behavior

-- Deny all INSERT operations from client
CREATE POLICY "Deny all inserts on empresas"
  ON public.empresas
  FOR INSERT
  WITH CHECK (false);

-- Deny all UPDATE operations from client
CREATE POLICY "Deny all updates on empresas"
  ON public.empresas
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Deny all DELETE operations from client
CREATE POLICY "Deny all deletes on empresas"
  ON public.empresas
  FOR DELETE
  USING (false);

-- Note: All write operations must go through edge functions using service role
-- The validate-empresa edge function handles all authenticated writes