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
}

async function getRouteDistance(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  try {
    // OSRM uses lon,lat order (not lat,lon)
    const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "LocalizAI/1.0",
      },
    });

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
    console.error("Error fetching route:", error);
    return null;
  }
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

    // Calculate routes to all locations in parallel
    const routePromises = locations.map(async (location) => {
      const route = await getRouteDistance(
        originLat,
        originLon,
        location.latitude,
        location.longitude
      );

      if (route) {
        return {
          name: location.name,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
        };
      }

      // Fallback: if route fails, return null (will be filtered out)
      return null;
    });

    const results = await Promise.all(routePromises);

    // Filter out failed routes and sort by distance
    const validResults = results
      .filter((r): r is RouteResult => r !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3); // Top 3 closest

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
