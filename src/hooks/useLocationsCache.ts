import { useState, useCallback, useMemo } from 'react';
import type { LocationData } from '@/lib/spreadsheet';
import { 
  filterLocationsInMemory, 
  getUniqueCities, 
  getUniqueStates,
  groupLocationsByCity 
} from '@/lib/searchUtils';

interface UseLocationsCacheReturn {
  /** All loaded locations */
  locations: LocationData[];
  /** Filtered locations based on current search */
  filteredLocations: LocationData[];
  /** Current search query */
  searchQuery: string;
  /** Set locations data */
  setLocations: (data: LocationData[]) => void;
  /** Filter locations by search query (instant, no network) */
  filterByQuery: (query: string) => void;
  /** Clear search filter */
  clearFilter: () => void;
  /** Unique cities for autocomplete */
  uniqueCities: string[];
  /** Unique states */
  uniqueStates: string[];
  /** Locations grouped by city */
  locationsByCity: Map<string, LocationData[]>;
  /** Total count of locations */
  totalCount: number;
  /** Filtered count */
  filteredCount: number;
}

/**
 * Hook for managing cached location data with in-memory filtering
 * Provides instant search without network latency
 */
export function useLocationsCache(): UseLocationsCacheReturn {
  const [locations, setLocationsState] = useState<LocationData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized filtered results - instant filtering
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) {
      return locations;
    }
    return filterLocationsInMemory(locations, searchQuery);
  }, [locations, searchQuery]);

  // Memoized derived data
  const uniqueCities = useMemo(() => getUniqueCities(locations), [locations]);
  const uniqueStates = useMemo(() => getUniqueStates(locations), [locations]);
  const locationsByCity = useMemo(() => groupLocationsByCity(locations), [locations]);

  const setLocations = useCallback((data: LocationData[]) => {
    setLocationsState(data);
    setSearchQuery(''); // Reset search when new data is loaded
  }, []);

  const filterByQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearFilter = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    locations,
    filteredLocations,
    searchQuery,
    setLocations,
    filterByQuery,
    clearFilter,
    uniqueCities,
    uniqueStates,
    locationsByCity,
    totalCount: locations.length,
    filteredCount: filteredLocations.length,
  };
}
