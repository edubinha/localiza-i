import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// CORS configuration - uses dynamic origin matching for Lovable domains
// In production, this matches *.lovable.app and *.lovableproject.com domains
const LOVABLE_DOMAIN_PATTERNS = ['.lovable.app', '.lovableproject.com'];
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:8080'];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check development origins
  if (DEV_ORIGINS.includes(origin)) {
    return true;
  }
  
  // Check Lovable production domains
  return LOVABLE_DOMAIN_PATTERNS.some(pattern => origin.endsWith(pattern));
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
}

interface RouteRequest {
  originLat: number;
  originLon: number;
  locations: Location[];
}

interface RouteResult {
  name: string;
  distanceKm: number;
  durationMinutes: number;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
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
  const optionalStrings = ['address', 'number', 'neighborhood', 'city', 'state'];
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
  const { originLat, originLon, locations } = request;

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
  source: "google" | "osrm";
}

/**
 * Use Google Distance Matrix API for accurate driving distances and durations.
 * Requires GOOGLE_GEOCODING_API_KEY secret (also works for Distance Matrix API).
 */
async function getGoogleDistanceMatrix(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lon: number }[]
): Promise<DistanceMatrixResult | null> {
  const apiKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");
  
  if (!apiKey) {
    devLog.error("GOOGLE_GEOCODING_API_KEY not configured");
    return null;
  }

  try {
    // Build destinations string: lat,lon|lat,lon|...
    const destinationsStr = destinations
      .map((d) => `${d.lat},${d.lon}`)
      .join("|");

    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${originLat},${originLon}`);
    url.searchParams.set("destinations", destinationsStr);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      devLog.error(`Google Distance Matrix API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== "OK") {
      devLog.error("Google Distance Matrix API returned error:", data.status, data.error_message);
      return null;
    }

    // Extract distances and durations from the response
    const elements = data.rows?.[0]?.elements || [];
    const distances: (number | null)[] = [];
    const durations: (number | null)[] = [];

    for (const element of elements) {
      if (element.status === "OK") {
        distances.push(element.distance?.value ?? null); // meters
        durations.push(element.duration?.value ?? null); // seconds
      } else {
        distances.push(null);
        durations.push(null);
      }
    }

    devLog.log(`Google Distance Matrix: ${distances.filter(d => d !== null).length}/${destinations.length} routes calculated`);

    return { distances, durations, source: "google" };
  } catch (error) {
    devLog.error("Google Distance Matrix API error:", error);
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
 * Tries Google first, then OSRM Table, then individual OSRM requests
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

  // Try Google Distance Matrix first (more accurate)
  let matrixResult = await getGoogleDistanceMatrix(originLat, originLon, destinations);
  
  // Fallback to OSRM if Google fails
  if (!matrixResult) {
    devLog.log("Google Distance Matrix failed, falling back to OSRM");
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
        address: location.address,
        number: location.number,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
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
        address: location.address,
        number: location.number,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
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
