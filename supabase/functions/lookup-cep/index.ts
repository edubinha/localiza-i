import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment check - suppress verbose logs in production
const isDev = Deno.env.get("DENO_ENV") === "development" || Deno.env.get("FUNCTIONS_ENV") === "development";

// Development-only logging
const devLog = {
  error: (message: string, ...args: unknown[]) => {
    if (isDev) console.error(message, ...args);
  },
  log: (message: string, ...args: unknown[]) => {
    if (isDev) console.log(message, ...args);
  },
};

// CORS configuration - allowlist for production and preview domains
const ALLOWED_ORIGINS = [
  'https://localiza-i.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

// Pattern for Lovable preview domains
const LOVABLE_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/;
const LOVABLE_PREVIEW_ID_PATTERN = /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (LOVABLE_PREVIEW_PATTERN.test(origin)) return true;
  if (LOVABLE_PREVIEW_ID_PATTERN.test(origin)) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : '';
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin || '',
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// CEP validation regex - exactly 8 digits
const CEP_REGEX = /^[0-9]{8}$/;

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface CepRequest {
  cep: string;
  empresaId: string;
}

function validateRequest(body: unknown): { valid: true; data: CepRequest } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Corpo da requisição inválido" };
  }

  const request = body as Record<string, unknown>;
  const { cep, empresaId } = request;

  // Validate empresaId (required for authentication)
  if (typeof empresaId !== "string" || empresaId.trim().length === 0) {
    return { valid: false, error: "empresaId é obrigatório" };
  }

  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(empresaId)) {
    return { valid: false, error: "empresaId inválido" };
  }

  // Validate CEP format
  if (typeof cep !== "string") {
    return { valid: false, error: "CEP deve ser uma string" };
  }

  const cleanCep = cep.replace(/\D/g, '');
  
  if (!CEP_REGEX.test(cleanCep)) {
    return { valid: false, error: "CEP inválido. Deve conter 8 dígitos numéricos." };
  }

  return {
    valid: true,
    data: {
      cep: cleanCep,
      empresaId: empresaId.trim(),
    },
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST method
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate empresa exists and is active
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      devLog.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Erro de configuração do servidor" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('id, is_active')
      .eq('id', validation.data.empresaId)
      .eq('is_active', true)
      .single();

    if (empresaError || !empresa) {
      devLog.log(`Invalid empresa_id attempt: ${validation.data.empresaId}`);
      return new Response(
        JSON.stringify({ error: "Empresa não autorizada" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch from ViaCEP with validated CEP
    const viacepUrl = `https://viacep.com.br/ws/${validation.data.cep}/json/`;
    
    devLog.log(`Fetching CEP: ${validation.data.cep}`);
    
    const response = await fetch(viacepUrl);
    
    if (!response.ok) {
      devLog.error(`ViaCEP error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar CEP. Tente novamente." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data: ViaCepResponse = await response.json();

    if (data.erro) {
      // Return 200 with notFound flag - the request succeeded, CEP just doesn't exist
      return new Response(
        JSON.stringify({ 
          notFound: true,
          error: "CEP não encontrado"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return sanitized data
    return new Response(
      JSON.stringify({
        cep: data.cep,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        localidade: data.localidade || '',
        uf: data.uf || '',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    devLog.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar requisição" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
