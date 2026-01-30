import { supabase } from "@/integrations/supabase/client";
import type { LocationData } from "./spreadsheet";

export interface RouteResult {
  name: string;
  distanceKm: number;
  durationMinutes: number;
  formattedDistance: string;
  formattedDuration: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export async function calculateRoutes(
  originLat: number,
  originLon: number,
  locations: LocationData[]
): Promise<RouteResult[]> {
  const { data, error } = await supabase.functions.invoke("calculate-routes", {
    body: {
      originLat,
      originLon,
      locations,
    },
  });

  if (error) {
    console.error("Error calling calculate-routes:", error);
    throw new Error("Erro ao calcular rotas. Por favor, tente novamente.");
  }

  if (!data.routes || !Array.isArray(data.routes)) {
    throw new Error("Resposta inválida do servidor.");
  }

  return data.routes.map((route: { 
    name: string; 
    distanceKm: number; 
    durationMinutes: number;
    address?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }) => ({
    ...route,
    formattedDistance: formatDistance(route.distanceKm),
    formattedDuration: formatDuration(route.durationMinutes),
  }));
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
