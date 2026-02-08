import type { LocationData } from './spreadsheet';

/**
 * Normalizes text for accent-insensitive, case-insensitive search
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();
}

/**
 * Checks if a normalized search term matches any part of the text
 */
export function matchesSearch(text: string | undefined, searchTerm: string): boolean {
  if (!text) return false;
  return normalizeSearchText(text).includes(searchTerm);
}

/**
 * Filters locations in memory based on search query
 * Searches across name, city, neighborhood, address, and services
 */
export function filterLocationsInMemory(
  locations: LocationData[],
  query: string
): LocationData[] {
  if (!query.trim()) {
    return locations;
  }

  const normalizedQuery = normalizeSearchText(query);

  return locations.filter((location) => {
    return (
      matchesSearch(location.name, normalizedQuery) ||
      matchesSearch(location.city, normalizedQuery) ||
      matchesSearch(location.neighborhood, normalizedQuery) ||
      matchesSearch(location.address, normalizedQuery) ||
      matchesSearch(location.state, normalizedQuery) ||
      matchesSearch(location.services, normalizedQuery)
    );
  });
}

/**
 * Groups locations by city for quick access
 */
export function groupLocationsByCity(
  locations: LocationData[]
): Map<string, LocationData[]> {
  const grouped = new Map<string, LocationData[]>();

  for (const location of locations) {
    const city = location.city || 'Sem cidade';
    const normalizedCity = normalizeSearchText(city);
    
    if (!grouped.has(normalizedCity)) {
      grouped.set(normalizedCity, []);
    }
    grouped.get(normalizedCity)!.push(location);
  }

  return grouped;
}

/**
 * Gets unique cities from locations for autocomplete
 */
export function getUniqueCities(locations: LocationData[]): string[] {
  const cities = new Set<string>();
  
  for (const location of locations) {
    if (location.city) {
      cities.add(location.city);
    }
  }

  return Array.from(cities).sort((a, b) => 
    normalizeSearchText(a).localeCompare(normalizeSearchText(b))
  );
}

/**
 * Gets unique states from locations
 */
export function getUniqueStates(locations: LocationData[]): string[] {
  const states = new Set<string>();
  
  for (const location of locations) {
    if (location.state) {
      states.add(location.state);
    }
  }

  return Array.from(states).sort();
}
