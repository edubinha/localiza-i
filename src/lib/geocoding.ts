// Geocoding utilities using Nominatim (OpenStreetMap)

export interface GeocodingResult {
  lat: number;
  lon: number;
  searchUsed: string; // Describes what search strategy was used
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

// Simple in-memory cache for geocoding results
const geocodingCache = new Map<string, GeocodingResult>();

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

    const response = await fetch(url, {
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

    // Validate that the result matches the expected city/state
    const displayLower = data[0].display_name.toLowerCase();
    const cityLower = params.city.toLowerCase();
    const stateLower = params.state.toLowerCase();

    // Check if the result contains the expected city and state
    if (!displayLower.includes(cityLower) || !displayLower.includes(stateLower)) {
      console.log(`Structured geocode result doesn't match expected location: ${data[0].display_name}`);
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('Structured geocoding error:', error);
    return null;
  }
}

/**
 * Free-text geocoding as a fallback option.
 * Used only when structured queries fail.
 */
async function tryFreeTextGeocode(query: string, city?: string, state?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=br&limit=5`;

    const response = await fetch(url, {
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

    // If we have city/state context, validate results
    if (city && state) {
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();

      for (const result of data) {
        const displayLower = result.display_name.toLowerCase();
        if (displayLower.includes(cityLower) && displayLower.includes(stateLower)) {
          return {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
          };
        }
      }
      // No result matched the expected city/state
      return null;
    }

    // Fall back to first result if no validation needed
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('Free-text geocoding error:', error);
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
    return geocodingCache.get(cacheKey)!;
  }

  let result: { lat: number; lon: number } | null = null;
  let searchUsed = '';

  // Strategy 1: Structured search with street + number
  if (street && number) {
    const streetWithNumber = `${number} ${street}`;
    result = await tryStructuredGeocode({
      street: streetWithNumber,
      city,
      state,
      country: 'Brasil',
    });
    if (result) {
      searchUsed = 'endereço completo (estruturado)';
    }
  }

  // Strategy 2: Structured search with street only (no number)
  if (!result && street) {
    result = await tryStructuredGeocode({
      street,
      city,
      state,
      country: 'Brasil',
    });
    if (result) {
      searchUsed = 'endereço sem número (estruturado)';
    }
  }

  // Strategy 3: Structured search with neighborhood as street
  if (!result && neighborhood) {
    result = await tryStructuredGeocode({
      street: neighborhood,
      city,
      state,
      country: 'Brasil',
    });
    if (result) {
      searchUsed = 'bairro (estruturado)';
    }
  }

  // Strategy 4: Structured search with city + state only
  if (!result) {
    result = await tryStructuredGeocode({
      city,
      state,
      country: 'Brasil',
    });
    if (result) {
      searchUsed = 'cidade e estado (estruturado)';
    }
  }

  // Strategy 5: Free-text fallback as last resort
  if (!result) {
    const freeTextQuery = `${neighborhood}, ${city}, ${state}, Brasil`;
    result = await tryFreeTextGeocode(freeTextQuery, city, state);
    if (result) {
      searchUsed = 'busca textual (fallback)';
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
