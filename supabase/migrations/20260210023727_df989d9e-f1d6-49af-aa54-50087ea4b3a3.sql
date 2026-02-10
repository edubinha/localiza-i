
CREATE TABLE public.rate_limits (
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (identifier, endpoint)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all selects on rate_limits"
  ON public.rate_limits FOR SELECT
  USING (false);

CREATE POLICY "Deny all inserts on rate_limits"
  ON public.rate_limits FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Deny all updates on rate_limits"
  ON public.rate_limits FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all deletes on rate_limits"
  ON public.rate_limits FOR DELETE
  USING (false);

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '10 minutes';
END;
$$;
