-- Criar tabela empresas para multi-tenant
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  access_key TEXT NOT NULL UNIQUE,
  admin_secret TEXT NOT NULL,
  google_sheets_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Politica: Leitura publica para validacao de access_key (apenas campos nao sensiveis)
-- Nota: admin_secret NAO deve ser exposto no SELECT
CREATE POLICY "Allow public read for access validation"
  ON public.empresas
  FOR SELECT
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir empresa de teste para desenvolvimento
INSERT INTO public.empresas (nome, access_key, admin_secret, google_sheets_url, is_active)
VALUES (
  'Empresa Teste',
  'teste123',
  'admin456',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT669HNj9Xp01XeXIonmyAayOWIPlN_VsBl5sQpcXOL1NotshQp5s4kYN1x0gtypa_XqShZS8vgesAU/pub?gid=0&single=true&output=csv',
  true
);