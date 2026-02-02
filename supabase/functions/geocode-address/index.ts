import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface GoogleGeocodeResult {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    location_type: string;
  };
  address_components: Array<{
    types: string[];
    long_name: string;
    short_name: string;
  }>;
}

interface GoogleGeocodeResponse {
  results: GoogleGeocodeResult[];
  status: string;
  error_message?: string;
}

// Normalize strings for comparison (remove accents, lowercase)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Validate that the result matches the expected city/state
function validateResult(result: GoogleGeocodeResult, city: string, state: string): boolean {
  const normalizedCity = normalizeString(city);
  const normalizedState = normalizeString(state);

  let foundCity = false;
  let foundState = false;

  for (const component of result.address_components) {
    const normalizedName = normalizeString(component.long_name);
    const normalizedShortName = normalizeString(component.short_name);

    // Check for city match
    if (component.types.includes('administrative_area_level_2') || 
        component.types.includes('locality')) {
      if (normalizedName === normalizedCity || normalizedShortName === normalizedCity) {
        foundCity = true;
      }
    }

    // Check for state match
    if (component.types.includes('administrative_area_level_1')) {
      if (normalizedName.includes(normalizedState) || 
          normalizedShortName === normalizedState) {
        foundState = true;
      }
    }
  }

  return foundCity && foundState;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');
    
    if (!apiKey) {
      console.error('GOOGLE_GEOCODING_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Geocoding service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: GeocodeRequest = await req.json();
    const { street, number, neighborhood, city, state } = body;

    if (!city || !state) {
      return new Response(
        JSON.stringify({ error: 'City and state are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build address string for Google Geocoding
    const addressParts: string[] = [];
    
    if (street && number) {
      addressParts.push(`${street}, ${number}`);
    } else if (street) {
      addressParts.push(street);
    }
    
    if (neighborhood) {
      addressParts.push(neighborhood);
    }
    
    addressParts.push(city, state, 'Brasil');
    
    const fullAddress = addressParts.join(', ');
    
    console.log(`Geocoding address: ${fullAddress}`);

    // Call Google Geocoding API
    const googleUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    googleUrl.searchParams.set('address', fullAddress);
    googleUrl.searchParams.set('key', apiKey);
    googleUrl.searchParams.set('language', 'pt-BR');
    googleUrl.searchParams.set('region', 'br');
    googleUrl.searchParams.set('components', 'country:BR');

    const response = await fetch(googleUrl.toString());
    
    if (!response.ok) {
      console.error(`Google API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Geocoding service error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: GoogleGeocodeResponse = await response.json();

    console.log(`Google API status: ${data.status}, results: ${data.results?.length || 0}`);

    if (data.status === 'ZERO_RESULTS' || !data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Address not found', status: 'ZERO_RESULTS' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.status !== 'OK') {
      console.error(`Google API error: ${data.status} - ${data.error_message}`);
      return new Response(
        JSON.stringify({ error: data.error_message || 'Geocoding failed', status: data.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the first result that matches the expected city/state
    for (const result of data.results) {
      if (validateResult(result, city, state)) {
        const locationType = result.geometry.location_type;
        let searchUsed = 'Google Geocoding';
        
        // Add precision indicator
        if (locationType === 'ROOFTOP') {
          searchUsed += ' (precisão máxima)';
        } else if (locationType === 'RANGE_INTERPOLATED') {
          searchUsed += ' (interpolado)';
        } else if (locationType === 'GEOMETRIC_CENTER') {
          searchUsed += ' (centro geométrico)';
        } else if (locationType === 'APPROXIMATE') {
          searchUsed += ' (aproximado)';
        }

        console.log(`Found valid result: ${result.geometry.location.lat}, ${result.geometry.location.lng} (${locationType})`);

        return new Response(
          JSON.stringify({
            lat: result.geometry.location.lat,
            lon: result.geometry.location.lng,
            searchUsed,
            locationType,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No result matched the expected city/state
    console.log('No results matched the expected city/state');
    return new Response(
      JSON.stringify({ error: 'No matching address found in specified city/state', status: 'NO_MATCH' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
