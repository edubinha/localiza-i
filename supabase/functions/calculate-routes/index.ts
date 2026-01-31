import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originLat, originLon, locations }: RouteRequest = await req.json();

    if (!originLat || !originLon || !locations || !Array.isArray(locations)) {
      return new Response(
        JSON.stringify({ error: "Parâmetros inválidos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
