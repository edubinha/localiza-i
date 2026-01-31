import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - restrict to your domains
const ALLOWED_ORIGINS = [
  "https://id-preview--dd0f1f18-b3a6-40c0-a96b-4abaaca86b05.lovable.app",
  "https://lovable.dev",
  "http://localhost:5173",
  "http://localhost:8080",
];

// Constants for validation
const MAX_LOCATIONS = 100;
const MAX_LATITUDE = 90;
const MIN_LATITUDE = -90;
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith('.lovable.app')
  ) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

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

function isValidLocation(loc: unknown): loc is Location {
  if (typeof loc !== "object" || loc === null) return false;
  const location = loc as Record<string, unknown>;
  return (
    typeof location.name === "string" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number" &&
    isValidCoordinate(location.latitude, location.longitude)
  );
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

interface TableAPIResult {
  distances: (number | null)[];
  durations: (number | null)[];
}

/**
 * Use OSRM Table API to calculate distances from one origin to multiple destinations
 * in a single HTTP call. Much more efficient than individual route calls.
 */
async function getTableDistances(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lon: number }[]
): Promise<TableAPIResult | null> {
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
      console.error(`OSRM Table API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.code !== "Ok") {
      console.error("OSRM Table API returned error:", data.code);
      return null;
    }

    // distances[0] contains distances from source 0 to all destinations
    // durations[0] contains durations from source 0 to all destinations
    const distances = data.distances?.[0]?.slice(1) || []; // Remove first element (origin to origin = 0)
    const durations = data.durations?.[0]?.slice(1) || [];

    return { distances, durations };
  } catch (error) {
    console.error("Table API error:", error);
    return null;
  }
}

/**
 * Process a batch of locations using the Table API
 * Falls back to individual requests if Table API fails
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

  const tableResult = await getTableDistances(originLat, originLon, destinations);

  if (tableResult) {
    // Successfully got results from Table API
    return batch.map((location, index) => {
      const distance = tableResult.distances[index];
      const duration = tableResult.durations[index];

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

  // Fallback: process in parallel with individual route requests
  console.log("Table API failed, falling back to parallel individual requests");
  
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

    console.log(`Processing ${locations.length} locations`);

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

    console.log(
      `Pre-filtered to ${locationsWithHaversine.length} locations within ${MAX_HAVERSINE_DISTANCE_KM}km`
    );

    // Step 2: Take only the closest 20 candidates
    const MAX_CANDIDATES = 20;
    const candidates = locationsWithHaversine.slice(0, MAX_CANDIDATES);

    console.log(`Processing ${candidates.length} closest candidates with Table API`);

    // Step 3: Process in batches using Table API (10 per batch for reliability)
    const BATCH_SIZE = 10;
    const allResults: (RouteResult | null)[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} locations)`);

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

    console.log(`Returning ${validResults.length} valid routes`);

    return new Response(JSON.stringify({ routes: validResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
