import { supabase } from "@/integrations/supabase/client";
import type { LocationData } from "./spreadsheet";
import { devLog } from "./logger";
import { calculateDistance } from "./haversine";

// Maximum straight-line distance for pre-filtering (km)
const MAX_HAVERSINE_DISTANCE_KM = 60;

export interface RouteResult {
  name: string;
  distanceKm: number;
  durationMinutes: number;
  formattedDistance: string;
  formattedDuration: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  services?: string;
}

export async function calculateRoutes(
  originLat: number,
  originLon: number,
  locations: LocationData[],
  empresaId: string
): Promise<RouteResult[]> {
  // Validate empresaId is provided
  if (!empresaId || empresaId.trim().length === 0) {
    throw new Error("Identificação da empresa é obrigatória para calcular rotas.");
  }

  // Pre-filter locations using Haversine distance to reduce payload
  // Also sort by distance to prioritize closest locations
  const nearbyLocations = locations
    .map(loc => {
      if (loc.latitude === undefined || loc.longitude === undefined) {
        return null;
      }
      const haversineDistance = calculateDistance(
        originLat,
        originLon,
        loc.latitude,
        loc.longitude
      );
      return { ...loc, haversineDistance };
    })
    .filter((loc): loc is LocationData & { haversineDistance: number } => 
      loc !== null && loc.haversineDistance <= MAX_HAVERSINE_DISTANCE_KM
    )
    .sort((a, b) => a.haversineDistance - b.haversineDistance)
    .slice(0, 30);

  if (nearbyLocations.length === 0) {
    return []; // No locations within range
  }

  try {
    const { data, error } = await supabase.functions.invoke("calculate-routes", {
      body: {
        empresaId,
        originLat,
        originLon,
        locations: nearbyLocations,
      },
    });

    if (error) {
      devLog.error("Error calling calculate-routes:", error);
      throw new Error("Erro ao calcular rotas. Por favor, tente novamente.");
    }

    if (!data?.routes || !Array.isArray(data.routes)) {
      throw new Error("Resposta inválida do servidor.");
    }

    return data.routes.map((route: { 
      name: string; 
      distanceKm: number; 
      durationMinutes: number;
      latitude?: number;
      longitude?: number;
      address?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      services?: string;
    }) => ({
      ...route,
      formattedDistance: formatDistance(route.distanceKm),
      formattedDuration: formatDuration(route.durationMinutes),
    }));
  } catch (error) {
    devLog.error("Calculate routes error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro ao calcular rotas. Por favor, tente novamente.");
  }
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}

