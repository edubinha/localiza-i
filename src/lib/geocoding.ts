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

async function tryGeocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=br&limit=1`,
      {
        headers: {
          'User-Agent': 'LocalizAI/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao conectar com o serviço de geocodificação');
    }

    const data: NominatimResponse[] = await response.json();

    if (data.length === 0) {
      return null;
    }

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

  // Strategy 1: Full address with number
  let result = await tryGeocode(fullAddress);
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
  result = await tryGeocode(addressWithoutNumber);
  if (result) {
    const geocodingResult: GeocodingResult = {
      ...result,
      searchUsed: 'endereço sem número',
    };
    geocodingCache.set(cacheKey, geocodingResult);
    return geocodingResult;
  }

  // Strategy 3: Neighborhood + city + state
  const neighborhoodAddress = `${neighborhood}, ${city}, ${state}, Brasil`;
  result = await tryGeocode(neighborhoodAddress);
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
  result = await tryGeocode(cityAddress);
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
