// Geocoding utilities using Nominatim (OpenStreetMap)

interface GeocodingResult {
  lat: number;
  lon: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

// Simple in-memory cache for geocoding results
const geocodingCache = new Map<string, GeocodingResult>();

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

  try {
    const encodedAddress = encodeURIComponent(fullAddress);
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

    const result: GeocodingResult = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };

    // Cache the result
    geocodingCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}
