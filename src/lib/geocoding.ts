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

async function tryGeocode(address: string, city?: string, state?: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    
    // Use only q parameter (Nominatim doesn't allow mixing q with structured params)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=br&limit=5`;
    
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

    // If we have city/state context, try to find the best match by validating results
    if (city && data.length > 0) {
      const cityLower = city.toLowerCase();
      const stateLower = state?.toLowerCase();
      
      for (const result of data) {
        const displayLower = result.display_name.toLowerCase();
        // Check if both city and state are in the display name for accuracy
        if (displayLower.includes(cityLower) && (!stateLower || displayLower.includes(stateLower))) {
          return {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
          };
        }
      }
    }

    // Fall back to first result only if no city filter or if validation passed
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

export async function geocodeAddress(
  street: string,
  number: string,
  neighborhood: string,
  city: string,
  state: string
): Promise<GeocodingResult | null> {
  // Build full address string
  const fullAddress = `${street}, ${number}, ${neighborhood}, ${city}, ${state}, Brasil`;
  
  // Check cache first
  const cacheKey = fullAddress.toLowerCase().trim();
  if (geocodingCache.has(cacheKey)) {
    return geocodingCache.get(cacheKey)!;
  }

  // Strategy 1: Full address with number (pass city and state for disambiguation)
  let result = await tryGeocode(fullAddress, city, state);
  if (result) {
    const geocodingResult: GeocodingResult = {
      ...result,
      searchUsed: 'endereço completo',
    };
    geocodingCache.set(cacheKey, geocodingResult);
    return geocodingResult;
  }

  // Strategy 2: Street + neighborhood + city + state (without number)
  const addressWithoutNumber = `${street}, ${neighborhood}, ${city}, ${state}, Brasil`;
  result = await tryGeocode(addressWithoutNumber, city, state);
  if (result) {
    const geocodingResult: GeocodingResult = {
      ...result,
      searchUsed: 'endereço sem número',
    };
    geocodingCache.set(cacheKey, geocodingResult);
    return geocodingResult;
  }

  // Strategy 3: Neighborhood + city + state (pass city and state for disambiguation)
  const neighborhoodAddress = `${neighborhood}, ${city}, ${state}, Brasil`;
  result = await tryGeocode(neighborhoodAddress, city, state);
  if (result) {
    const geocodingResult: GeocodingResult = {
      ...result,
      searchUsed: 'bairro, cidade e estado',
    };
    geocodingCache.set(cacheKey, geocodingResult);
    return geocodingResult;
  }

  // Strategy 4: City + state only
  const cityAddress = `${city}, ${state}, Brasil`;
  result = await tryGeocode(cityAddress, city, state);
  if (result) {
    const geocodingResult: GeocodingResult = {
      ...result,
      searchUsed: 'cidade e estado',
    };
    geocodingCache.set(cacheKey, geocodingResult);
    return geocodingResult;
  }

  return null;
}
