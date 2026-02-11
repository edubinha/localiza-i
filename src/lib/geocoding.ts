// Geocoding utilities - Nominatim (OpenStreetMap) exclusive
import { devLog } from './logger';

export interface GeocodingResult {
  lat: number;
  lon: number;
  searchUsed: string; // Describes what search strategy was used
}

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

// Normalize strings for comparison (remove accents, lowercase)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Simple in-memory cache for geocoding results
const geocodingCache = new Map<string, GeocodingResult>();

/**
 * Fetch with exponential backoff retry for 429/503 responses.
 * Retries up to 3 times with delays of 1s, 2s, 4s.
 */
async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429 || response.status === 503) {
      const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      devLog.log(`Geocoding: status ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      lastError = new Error(`Serviço de geocodificação ocupado (HTTP ${response.status})`);
      continue;
    }

    return response;
  }

  throw lastError || new Error('Serviço de geocodificação ocupado. Tente novamente em alguns segundos.');
}

/**
 * Structured geocoding using Nominatim's structured query parameters.
 * This ensures results are restricted to the correct city/state.
 */
async function tryStructuredGeocode(params: {
  street?: string;
  city: string;
  state: string;
  country?: string;
}): Promise<{ lat: number; lon: number } | null> {
  try {
    const searchParams = new URLSearchParams({
      format: 'json',
      limit: '1',
      countrycodes: 'br',
    });

    if (params.street) {
      searchParams.set('street', params.street);
    }
    searchParams.set('city', params.city);
    searchParams.set('state', params.state);
    if (params.country) {
      searchParams.set('country', params.country);
    }

    const url = `https://nominatim.openstreetmap.org/search?${searchParams}`;

    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'LocalizAI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao conectar com o serviço de geocodificação');
    }

    const data: NominatimResponse[] = await response.json();

    if (data.length === 0) {
      return null;
    }

    // Structured query already constrains results to the correct city/state,
    // so we trust the result without additional display_name validation
    // (which caused false negatives due to accent/abbreviation mismatches).
    devLog.log(`Structured geocode result: ${data[0].display_name}`);

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('ocupado')) {
      throw error;
    }
    devLog.error('Structured geocoding error:', error);
    return null;
  }
}

/**
 * Free-text geocoding as a fallback option.
 * Used only when structured queries fail.
 * Uses addressdetails=1 for structured validation of city/state.
 */
async function tryFreeTextGeocode(query: string, city?: string, state?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=br&limit=5&addressdetails=1`;

    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'LocalizAI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao conectar com o serviço de geocodificação');
    }

    const data: NominatimResponse[] = await response.json();

    if (data.length === 0) {
      return null;
    }

    // If we have city/state context, try to find a result matching city/state
    // Use relaxed matching (contains) to handle accent/abbreviation differences
    if (city && state) {
      const normalizedCity = normalizeString(city);
      const normalizedState = normalizeString(state);

      for (const result of data) {
        if (!result.address) continue;

        const resultCity = result.address.city || 
                           result.address.town || 
                           result.address.municipality;
        const resultState = result.address.state;

        if (resultCity && resultState) {
          const normResultCity = normalizeString(resultCity);
          const normResultState = normalizeString(resultState);
          // Use contains-based matching to handle partial names and abbreviations
          const cityMatch = normResultCity.includes(normalizedCity) || normalizedCity.includes(normResultCity);
          const stateMatch = normResultState.includes(normalizedState) || normalizedState.includes(normResultState);

          if (cityMatch && stateMatch) {
            return {
              lat: parseFloat(result.lat),
              lon: parseFloat(result.lon),
            };
          }
        }
      }
      // If no structured match, still use first result since the query already included city/state
      devLog.log('Free-text: no structured address match, using first result');
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }

    // Fall back to first result if no validation needed
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('ocupado')) {
      throw error;
    }
    devLog.error('Free-text geocoding error:', error);
    return null;
  }
}

export async function geocodeAddress(
  street: string,
  number: string,
  neighborhood: string,
  city: string,
  state: string
): Promise<GeocodingResult | null> {
  // Build full address string for cache key
  const fullAddress = `${street}, ${number}, ${neighborhood}, ${city}, ${state}, Brasil`;

  // Check cache first
  const cacheKey = fullAddress.toLowerCase().trim();
  if (geocodingCache.has(cacheKey)) {
    devLog.log('Cache hit for:', cacheKey);
    return geocodingCache.get(cacheKey)!;
  }

  let result: { lat: number; lon: number } | null = null;
  let searchUsed = '';

  // Strategy 1: Structured geocode with street (sequential to respect Nominatim rate-limit)
  if (street) {
    const streetQuery = number ? `${number} ${street}` : street;
    result = await tryStructuredGeocode({
      street: streetQuery,
      city,
      state,
      country: 'Brasil',
    });
    if (result) {
      searchUsed = number ? 'endereço completo' : 'endereço sem número';
    }
  }

  // Strategy 2 (fallback): Free-text with full address
  if (!result) {
    const parts = [street, number, neighborhood, city, state, 'Brasil'].filter(Boolean);
    const freeTextQuery = parts.join(', ');
    result = await tryFreeTextGeocode(freeTextQuery, city, state);
    if (result) {
      searchUsed = 'busca textual';
    }
  }

  if (result) {
    const geocodingResult: GeocodingResult = {
      ...result,
      searchUsed,
    };
    geocodingCache.set(cacheKey, geocodingResult);
    return geocodingResult;
  }

  return null;
}
