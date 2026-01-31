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

// Fetch route with retry and exponential backoff
async function getRouteDistanceWithRetry(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  maxRetries: number = 3
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // OSRM uses lon,lat order (not lat,lon)
      const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "LocalizAI/1.0",
        },
      });

      if (response.status === 429) {
        // Rate limited - wait with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        console.error(`OSRM error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
        console.error("No route found:", data);
        return null;
      }

      const route = data.routes[0];
      return {
        distanceKm: route.distance / 1000, // meters to km
        durationMinutes: route.duration / 60, // seconds to minutes
      };
    } catch (error) {
      console.error(`Error fetching route (attempt ${attempt + 1}):`, error);
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 500);
      }
    }
  }
  return null;
}

// Process locations in batches to avoid rate limiting
async function processBatch(
  batch: Location[],
  originLat: number,
  originLon: number
): Promise<(RouteResult | null)[]> {
  const results: (RouteResult | null)[] = [];
  
  for (const location of batch) {
    const route = await getRouteDistanceWithRetry(
      originLat,
      originLon,
      location.latitude,
      location.longitude
    );

    if (route) {
      results.push({
        name: location.name,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        address: location.address,
        number: location.number,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
      });
    } else {
      results.push(null);
    }
    
    // Small delay between requests in a batch
    await sleep(100);
  }
  
  return results;
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
    // Only keep locations within 60km straight-line distance
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

    console.log(`Pre-filtered to ${locationsWithHaversine.length} locations within ${MAX_HAVERSINE_DISTANCE_KM}km straight-line`);

    // Step 2: Take only the closest 20 candidates for route calculation
    const MAX_CANDIDATES = 20;
    const candidates = locationsWithHaversine.slice(0, MAX_CANDIDATES);

    console.log(`Processing ${candidates.length} closest candidates`);

    // Step 3: Process in small batches with delays
    const BATCH_SIZE = 5;
    const allResults: (RouteResult | null)[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)}`);
      
      const batchResults = await processBatch(batch, originLat, originLon);
      allResults.push(...batchResults);
      
      // Delay between batches to respect rate limits
      if (i + BATCH_SIZE < candidates.length) {
        await sleep(500);
      }
    }

    // Filter out failed routes and sort by distance
    const validResults: RouteResult[] = allResults
      .filter((r): r is RouteResult => r !== null);
    
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
