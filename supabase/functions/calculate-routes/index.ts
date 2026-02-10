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

/**
 * Database-based rate limiter.
 */
// deno-lint-ignore no-explicit-any
async function checkRateLimit(supabase: any, identifier: string, endpoint: string, maxAttempts: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  const { data: existing } = await supabase.from('rate_limits').select('attempt_count, window_start').eq('identifier', identifier).eq('endpoint', endpoint).single();
  if (!existing) {
    await supabase.from('rate_limits').upsert({ identifier, endpoint, attempt_count: 1, window_start: now.toISOString() });
    return { allowed: true };
  }
  const entryWindowStart = new Date(existing.window_start);
  if (entryWindowStart < windowStart) {
    await supabase.from('rate_limits').upsert({ identifier, endpoint, attempt_count: 1, window_start: now.toISOString() });
    return { allowed: true };
  }
  if (existing.attempt_count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((entryWindowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  await supabase.from('rate_limits').update({ attempt_count: existing.attempt_count + 1 }).eq('identifier', identifier).eq('endpoint', endpoint);
  return { allowed: true };
}

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
  // Only allow known origins, deny unknown ones
  const allowedOrigin = isAllowedOrigin(origin) ? origin : null;
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin || '',
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Constants for validation
const MAX_LOCATIONS = 100;
const MAX_LATITUDE = 90;
const MIN_LATITUDE = -90;
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;
const MAX_STRING_LENGTH = 200; // Maximum length for string fields

interface Location {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  services?: string;
}

interface RouteRequest {
  empresaId: string;
  originLat: number;
  originLon: number;
  locations: Location[];
}

interface RouteResult {
  name: string;
  distanceKm: number;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  services?: string;
}

// Validation helper functions
function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= MIN_LATITUDE &&
    lat <= MAX_LATITUDE &&
    lon >= MIN_LONGITUDE &&
    lon <= MAX_LONGITUDE
  );
}

// Sanitize and validate string fields
function sanitizeString(value: unknown, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isValidLocation(loc: unknown): loc is Location {
  if (typeof loc !== "object" || loc === null) return false;
  const location = loc as Record<string, unknown>;
  
  // Validate required fields
  if (typeof location.name !== "string" || location.name.length === 0 || location.name.length > MAX_STRING_LENGTH) {
    return false;
  }
  
  if (typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return false;
  }
  
  if (!isValidCoordinate(location.latitude, location.longitude)) {
    return false;
  }
  
  // Validate optional string fields length
  const optionalStrings = ['address', 'number', 'neighborhood', 'city', 'state', 'services'];
  for (const field of optionalStrings) {
    if (location[field] !== undefined && location[field] !== null) {
      if (typeof location[field] !== 'string' || (location[field] as string).length > MAX_STRING_LENGTH) {
        return false;
      }
    }
  }
  
  return true;
}

function validateRequest(body: unknown): { valid: true; data: RouteRequest } | { valid: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Corpo da requisição inválido" };
  }

  const request = body as Record<string, unknown>;
  const { empresaId, originLat, originLon, locations } = request;

  // Validate empresaId (required for authentication)
  if (typeof empresaId !== "string" || empresaId.trim().length === 0) {
    return { valid: false, error: "empresaId é obrigatório" };
  }

  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(empresaId)) {
    return { valid: false, error: "empresaId inválido" };
  }

  // Validate origin coordinates
  if (typeof originLat !== "number" || typeof originLon !== "number") {
    return { valid: false, error: "Coordenadas de origem devem ser números" };
  }

  if (!isValidCoordinate(originLat, originLon)) {
    return { valid: false, error: "Coordenadas de origem fora do intervalo válido" };
  }

  // Validate locations array
  if (!Array.isArray(locations)) {
    return { valid: false, error: "Localizações deve ser um array" };
  }

  if (locations.length === 0) {
    return { valid: false, error: "Array de localizações está vazio" };
  }

  if (locations.length > MAX_LOCATIONS) {
    return { valid: false, error: `Máximo de ${MAX_LOCATIONS} localizações permitidas` };
  }

  // Validate each location
  for (let i = 0; i < locations.length; i++) {
    if (!isValidLocation(locations[i])) {
      return { valid: false, error: `Localização ${i + 1} inválida` };
    }
  }

  return {
    valid: true,
    data: {
      empresaId: empresaId.trim(),
      originLat: originLat as number,
      originLon: originLon as number,
      locations: locations as Location[],
    },
  };
}

// Haversine formula for straight-line distance
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// Sleep function for delays
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DistanceMatrixResult {
  distances: (number | null)[];
  durations: (number | null)[];
  source: "ors" | "osrm";
}

/**
 * Use OpenRouteService Matrix API for accurate driving distances and durations.
 * Requires OPENROUTESERVICE_API_KEY secret.
 */
async function getOpenRouteServiceMatrix(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lon: number }[]
): Promise<DistanceMatrixResult | null> {
  const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");
  
  if (!apiKey) {
    devLog.error("OPENROUTESERVICE_API_KEY not configured");
    return null;
  }

  try {
    // ORS uses [lon, lat] format
    const locations = [
      [originLon, originLat],
      ...destinations.map((d) => [d.lon, d.lat]),
    ];

    // Sources: index 0 (origin)
    // Destinations: all other indices
    const destinationIndices = destinations.map((_, i) => i + 1);

    const response = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST",
      headers: {
        "Authorization": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations,
        sources: [0],
        destinations: destinationIndices,
        metrics: ["distance", "duration"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      devLog.error(`OpenRouteService Matrix API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();

    // ORS returns distances in meters and durations in seconds
    // distances[0] = distances from source 0 to all destinations
    // durations[0] = durations from source 0 to all destinations
    const distances = data.distances?.[0] || [];
    const durations = data.durations?.[0] || [];

    devLog.log(`OpenRouteService Matrix: ${distances.filter((d: number | null) => d !== null).length}/${destinations.length} routes calculated`);

    return { distances, durations, source: "ors" };
  } catch (error) {
    devLog.error("OpenRouteService Matrix API error:", error);
    return null;
  }
}

/**
 * Use OSRM Table API as fallback for calculating distances.
 * Free but may have less accurate/updated data.
 */
async function getOSRMTableDistances(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lon: number }[]
): Promise<DistanceMatrixResult | null> {
  try {
    // Build coordinates string: origin first, then all destinations
    // OSRM uses lon,lat order
    const coords = [
      `${originLon},${originLat}`,
      ...destinations.map((d) => `${d.lon},${d.lat}`),
    ].join(";");

    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance,duration`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "LocalizAI/1.0",
      },
    });

    if (!response.ok) {
      devLog.error(`OSRM Table API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.code !== "Ok") {
      devLog.error("OSRM Table API returned error:", data.code);
      return null;
    }

    // distances[0] contains distances from source 0 to all destinations
    // durations[0] contains durations from source 0 to all destinations
    const distances = data.distances?.[0]?.slice(1) || []; // Remove first element (origin to origin = 0)
    const durations = data.durations?.[0]?.slice(1) || [];

    devLog.log(`OSRM Table: ${distances.filter((d: number | null) => d !== null).length}/${destinations.length} routes calculated`);

    return { distances, durations, source: "osrm" };
  } catch (error) {
    devLog.error("OSRM Table API error:", error);
    return null;
  }
}

/**
 * Process a batch of locations using Distance Matrix APIs
 * Tries OpenRouteService first, then OSRM Table, then individual OSRM requests
 */
async function processBatchWithTableAPI(
  batch: Location[],
  originLat: number,
  originLon: number
): Promise<(RouteResult | null)[]> {
  const destinations = batch.map((loc) => ({
    lat: loc.latitude,
    lon: loc.longitude,
  }));

  // Try OpenRouteService Matrix first (accurate, requires API key)
  let matrixResult = await getOpenRouteServiceMatrix(originLat, originLon, destinations);
  
  // Fallback to OSRM if ORS fails
  if (!matrixResult) {
    devLog.log("OpenRouteService failed, falling back to OSRM");
    matrixResult = await getOSRMTableDistances(originLat, originLon, destinations);
  }

  if (matrixResult) {
    // Successfully got results from Distance Matrix API
    devLog.log(`Using ${matrixResult.source} results`);
    return batch.map((location, index) => {
      const distance = matrixResult!.distances[index];
      const duration = matrixResult!.durations[index];

      if (distance === null || duration === null) {
        return null;
      }

      return {
        name: location.name,
        distanceKm: distance / 1000, // meters to km
        durationMinutes: duration / 60, // seconds to minutes
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        number: location.number,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
        services: location.services,
      };
    });
  }

  // Fallback: process in parallel with individual route requests (OSRM)
  devLog.log("All matrix APIs failed, falling back to parallel individual OSRM requests");
  
  const promises = batch.map(async (location) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${location.longitude},${location.latitude}?overview=false`;

      const response = await fetch(url, {
        headers: { "User-Agent": "LocalizAI/1.0" },
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.code !== "Ok" || !data.routes?.[0]) return null;

      const route = data.routes[0];
      return {
        name: location.name,
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        number: location.number,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
        services: location.services,
      };
    } catch {
      return null;
    }
  });

  return Promise.all(promises);
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

    // Rate limit: 20 requests per empresa_id per 60 seconds
    const rl = await checkRateLimit(supabase, validation.data.empresaId, 'calculate-routes', 20, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Aguarde e tente novamente." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSeconds) },
        }
      );
    }

    const { originLat, originLon, locations } = validation.data;

    devLog.log(`Processing ${locations.length} locations`);

    // Step 1: Pre-filter using Haversine distance (straight-line)
    const MAX_HAVERSINE_DISTANCE_KM = 60;
    const locationsWithHaversine = locations
      .map((location) => ({
        ...location,
        haversineDistance: calculateHaversineDistance(
          originLat,
          originLon,
          location.latitude,
          location.longitude
        ),
      }))
      .filter((loc) => loc.haversineDistance <= MAX_HAVERSINE_DISTANCE_KM)
      .sort((a, b) => a.haversineDistance - b.haversineDistance);

    devLog.log(
      `Pre-filtered to ${locationsWithHaversine.length} locations within ${MAX_HAVERSINE_DISTANCE_KM}km`
    );

    // Step 2: Take only the closest 20 candidates
    const MAX_CANDIDATES = 20;
    const candidates = locationsWithHaversine.slice(0, MAX_CANDIDATES);

    devLog.log(`Processing ${candidates.length} closest candidates with Table API`);

    // Step 3: Process in batches using Table API (10 per batch for reliability)
    const BATCH_SIZE = 10;
    const allResults: (RouteResult | null)[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
      
      devLog.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} locations)`);

      const batchResults = await processBatchWithTableAPI(batch, originLat, originLon);
      allResults.push(...batchResults);

      // Reduced delay between batches (200ms instead of 500ms)
      if (i + BATCH_SIZE < candidates.length) {
        await sleep(200);
      }
    }

    // Filter out failed routes and sort by distance
    const validResults: RouteResult[] = allResults.filter(
      (r): r is RouteResult => r !== null
    );

    validResults.sort((a, b) => a.distanceKm - b.distanceKm);

    devLog.log(`Returning ${validResults.length} valid routes`);

    return new Response(JSON.stringify({ routes: validResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    devLog.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
