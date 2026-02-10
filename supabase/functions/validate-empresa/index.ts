import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ValidateRequest {
  action: 'validate' | 'admin-validate' | 'update-settings';
  access_key?: string;
  empresa_id?: string;
  admin_secret?: string;
  google_sheets_url?: string;
}

/**
 * Database-based rate limiter using the rate_limits table.
 * Uses service_role to bypass RLS.
 */
async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  identifier: string,
  endpoint: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  // Try to get existing rate limit entry
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('attempt_count, window_start')
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .single();

  if (!existing) {
    // No entry — create one
    await supabase.from('rate_limits').upsert({
      identifier,
      endpoint,
      attempt_count: 1,
      window_start: now.toISOString(),
    });
    return { allowed: true };
  }

  const entryWindowStart = new Date(existing.window_start);

  // Window expired — reset
  if (entryWindowStart < windowStart) {
    await supabase.from('rate_limits').upsert({
      identifier,
      endpoint,
      attempt_count: 1,
      window_start: now.toISOString(),
    });
    return { allowed: true };
  }

  // Within window — check count
  if (existing.attempt_count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil(
      (entryWindowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000
    );
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  // Increment
  await supabase
    .from('rate_limits')
    .update({ attempt_count: existing.attempt_count + 1 })
    .eq('identifier', identifier)
    .eq('endpoint', endpoint);

  return { allowed: true };
}

/**
 * Securely verify admin secret against stored bcrypt hash.
 */
async function verifyAdminSecret(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  empresaId: string,
  adminSecret: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('empresas')
    .select('admin_secret_hash')
    .eq('id', empresaId)
    .single();

  if (error || !data?.admin_secret_hash) {
    return false;
  }

  try {
    return bcrypt.compareSync(adminSecret, data.admin_secret_hash as string);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ValidateRequest = await req.json();
    const { action } = body;

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Action: Validate access_key
    if (action === 'validate') {
      const { access_key } = body;

      if (!access_key) {
        return new Response(
          JSON.stringify({ error: 'access_key is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Rate limit: 5 attempts per IP per 60 seconds
      const rl = await checkRateLimit(supabase, clientIp, 'validate', 5, 60);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({ error: 'Muitas tentativas. Aguarde e tente novamente.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSeconds) },
          }
        );
      }

      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, access_key, google_sheets_url, is_active')
        .eq('access_key', access_key)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Invalid access key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          empresa: {
            id: data.id,
            nome: data.nome,
            access_key: data.access_key,
            google_sheets_url: data.google_sheets_url,
            is_active: data.is_active,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Validate admin_secret
    if (action === 'admin-validate') {
      const { empresa_id, admin_secret } = body;

      if (!empresa_id || !admin_secret) {
        return new Response(
          JSON.stringify({ error: 'empresa_id and admin_secret are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Rate limit: 3 attempts per empresa_id per 300 seconds (5 min)
      const rl = await checkRateLimit(supabase, empresa_id, 'admin-validate', 3, 300);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSeconds) },
          }
        );
      }

      const isValid = await verifyAdminSecret(supabase, empresa_id, admin_secret);

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid admin secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Update settings
    if (action === 'update-settings') {
      const { empresa_id, admin_secret, google_sheets_url } = body;

      if (!empresa_id || !admin_secret) {
        return new Response(
          JSON.stringify({ error: 'empresa_id and admin_secret are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Rate limit: 10 attempts per empresa_id per 60 seconds
      const rl = await checkRateLimit(supabase, empresa_id, 'update-settings', 10, 60);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({ error: 'Muitas tentativas. Aguarde e tente novamente.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSeconds) },
          }
        );
      }

      const isAuthorized = await verifyAdminSecret(supabase, empresa_id, admin_secret);

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('empresas')
        .update({ google_sheets_url })
        .eq('id', empresa_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
