/**
 * URL validation and sanitization utilities.
 * Prevents SSRF by enforcing an allowlist of trusted external hosts.
 */

const ALLOWED_HOSTS = [
  'docs.google.com',
  'viacep.com.br',
  'brasilapi.com.br',
  'nominatim.openstreetmap.org',
  'servicodados.ibge.gov.br',
] as const;

/**
 * Validates that a URL belongs to an allowed host and uses HTTPS.
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/**
 * Sanitizes a CEP string to contain only digits, max 8 chars.
 */
export function sanitizeCep(cep: string): string {
  return cep.replace(/[^0-9]/g, '').slice(0, 8);
}

/**
 * Builds a validated ViaCEP URL.
 */
export function buildViaCepUrl(cep: string): string {
  const clean = sanitizeCep(cep);
  return `https://viacep.com.br/ws/${encodeURIComponent(clean)}/json/`;
}

/**
 * Builds a validated BrasilAPI CEP URL.
 */
export function buildBrasilApiCepUrl(cep: string): string {
  const clean = sanitizeCep(cep);
  return `https://brasilapi.com.br/api/cep/v1/${encodeURIComponent(clean)}`;
}

/**
 * Builds a validated Nominatim reverse geocoding URL.
 */
export function buildNominatimReverseUrl(lat: number, lon: number): string {
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Invalid coordinates');
  }
  return `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1`;
}

/**
 * Builds a validated IBGE municipalities URL.
 */
export function buildIbgeMunicipiosUrl(stateCode: string): string {
  const clean = stateCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
  return `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(clean)}/municipios?orderBy=nome`;
}
