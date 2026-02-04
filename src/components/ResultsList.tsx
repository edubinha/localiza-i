import { useState, forwardRef } from 'react';
import { MapPin, Navigation, Info, ChevronDown, ChevronUp, FlaskConical, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SearchResult } from '@/components/AddressForm';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
}

function formatLocation(neighborhood?: string, city?: string, state?: string): string {
  const neighborhoodCity = [neighborhood, city].filter(Boolean).join(', ');
  if (neighborhoodCity && state) {
    return `${neighborhoodCity} - ${state}`;
  }
  return neighborhoodCity || state || '';
}

function formatFullAddress(address?: string, number?: string, neighborhood?: string, city?: string, state?: string): string {
  // Format: "Rua Solidônio Leite, 231 - Vila Ivone, São Paulo - SP"
  const streetWithNumber = address && number ? `${address}, ${number}` : address || '';
  const neighborhoodCity = [neighborhood, city].filter(Boolean).join(', ');
  
  const parts = [streetWithNumber, neighborhoodCity, state].filter(Boolean);
  return parts.join(' - ');
}

function buildGoogleMapsUrl(result: SearchResult): string {
  const destination = formatFullAddress(
    result.address,
    result.number,
    result.neighborhood,
    result.city,
    result.state
  );
  
  const origin = result.originAddress || '';
  
  // URL for Google Maps directions
  const baseUrl = 'https://www.google.com/maps/dir/';
  const encodedOrigin = encodeURIComponent(origin);
  const encodedDestination = encodeURIComponent(destination + ', Brasil');
  
  return `${baseUrl}${encodedOrigin}/${encodedDestination}`;
}

function ResultItem({ result, index }: { result: SearchResult; index: number }) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  
  const locationSummary = formatLocation(result.neighborhood, result.city, result.state);
  const fullAddress = formatFullAddress(result.address, result.number, result.neighborhood, result.city, result.state);
  const hasAddressDetails = result.address || result.neighborhood || result.city;
  const isOnlyExams = result.services?.toLowerCase() === 'somente exames complementares';
  const handleOpenGoogleMaps = () => {
    const url = buildGoogleMapsUrl(result);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="font-bold text-primary text-sm sm:text-base">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-medium text-foreground text-sm sm:text-base leading-tight">{result.name}</h3>
            {isOnlyExams && (
              <FlaskConical className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
            )}
          </div>
          {locationSummary && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{locationSummary}</p>
          )}
          <div className="flex items-center justify-between mt-1.5 sm:mt-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-accent" />
              <span className="font-medium text-accent">{result.formattedDistance}</span>
            </div>
            {/* Mobile: button inline with distance, Desktop: button on the right */}
            {hasAddressDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullAddress(!showFullAddress)}
                className="sm:hidden h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {showFullAddress ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    Endereço
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        {/* Desktop only: button on the right side */}
        {hasAddressDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFullAddress(!showFullAddress)}
            className="hidden sm:flex flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            {showFullAddress ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver endereço
              </>
            )}
          </Button>
        )}
      </div>
      {showFullAddress && fullAddress && (
        <div className="ml-11 sm:ml-14 p-3 rounded-md bg-background border text-xs sm:text-sm space-y-3">
          <div>
            <span className="font-medium">Endereço: </span>
            {fullAddress}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenGoogleMaps}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir no Google Maps
          </Button>
        </div>
      )}
    </div>
  );
}

export const ResultsList = forwardRef<HTMLDivElement, ResultsListProps>(
  function ResultsList({ results, isLoading, error }, ref) {
    if (isLoading) {
      return (
        <Card ref={ref}>
        <CardHeader>
          <CardTitle className="text-lg">Buscando locais...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8">
            <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Calculando rotas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card ref={ref} className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Erro na busca</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0 && !isLoading && !error) {
    return (
      <Card ref={ref}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Navigation className="h-5 w-5 text-muted-foreground" />
            Nenhuma clínica encontrada
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground">
            Não foi localizada nenhuma clínica dentro do raio de 40km.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if any result used fallback search
  const searchInfo = results.find(r => r.searchInfo)?.searchInfo;
  
  // Limit to top 3 closest locations
  const topResults = results.slice(0, 3);
  
  // Check if any of the top results is only for exams
  const hasOnlyExams = topResults.some(r => 
    r.services?.toLowerCase() === 'somente exames complementares'
  );

  return (
    <Card ref={ref}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="h-5 w-5 text-accent" />
          Clínicas mais próximas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {searchInfo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-muted-foreground text-sm">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>Busca realizada utilizando: <strong className="text-foreground">{searchInfo}</strong></span>
          </div>
        )}
        {hasOnlyExams && (
          <Alert className="bg-accent/10 border-accent/30">
            <FlaskConical className="h-4 w-4 text-accent" />
            <AlertDescription className="text-accent-foreground text-sm">
              Este local realiza apenas exames laboratoriais e/ou de imagem.
            </AlertDescription>
          </Alert>
        )}
        {topResults.map((result, index) => (
          <ResultItem key={`${result.name}-${index}`} result={result} index={index} />
        ))}
      </CardContent>
    </Card>
  );
});
