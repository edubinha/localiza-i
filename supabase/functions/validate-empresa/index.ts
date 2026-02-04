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
 * Securely verify admin secret against stored bcrypt hash.
 * Uses bcrypt.compare which is timing-safe.
 */
async function verifyAdminSecret(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  empresaId: string,
  adminSecret: string
): Promise<boolean> {
  // Fetch the stored hash
  const { data, error } = await supabase
    .from('empresas')
    .select('admin_secret_hash')
    .eq('id', empresaId)
    .single();

  if (error || !data?.admin_secret_hash) {
    return false;
  }

  // Use bcrypt to compare - this is timing-safe
  try {
    return await bcrypt.compare(adminSecret, data.admin_secret_hash as string);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Action: Validate access_key
    if (action === 'validate') {
      const { access_key } = body;
      
      if (!access_key) {
        return new Response(
          JSON.stringify({ error: 'access_key is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Return empresa data without admin_secret or hash
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

    // Action: Validate admin_secret using secure bcrypt comparison
    if (action === 'admin-validate') {
      const { empresa_id, admin_secret } = body;
      
      if (!empresa_id || !admin_secret) {
        return new Response(
          JSON.stringify({ error: 'empresa_id and admin_secret are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify admin_secret against bcrypt hash
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

    // Action: Update settings (requires admin validation)
    if (action === 'update-settings') {
      const { empresa_id, admin_secret, google_sheets_url } = body;
      
      if (!empresa_id || !admin_secret) {
        return new Response(
          JSON.stringify({ error: 'empresa_id and admin_secret are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify admin_secret against bcrypt hash
      const isAuthorized = await verifyAdminSecret(supabase, empresa_id, admin_secret);

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update settings
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
