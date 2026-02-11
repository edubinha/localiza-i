import { useState, forwardRef } from 'react';
import { MapPin, Navigation, Info, ChevronDown, ChevronUp, FlaskConical, MapPinned } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SearchResult } from '@/components/AddressForm';
import { cn } from '@/lib/utils';
import { ResultsListSkeleton } from '@/components/ResultCardSkeleton';
import { NavigationMenu } from '@/components/NavigationMenu';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  searchStep?: 'idle' | 'geocoding' | 'routing' | 'finished';
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

function getFullDestination(result: SearchResult): string {
  return formatFullAddress(
    result.address,
    result.number,
    result.neighborhood,
    result.city,
    result.state
  );
}

const INITIAL_VISIBLE_COUNT = 3;
const INCREMENT_COUNT = 5;

function ResultItem({ result, index }: { result: SearchResult; index: number }) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  
  const locationSummary = formatLocation(result.neighborhood, result.city, result.state);
  const fullAddress = formatFullAddress(result.address, result.number, result.neighborhood, result.city, result.state);
  const hasAddressDetails = result.address || result.neighborhood || result.city;
  const isOnlyExams = result.services?.toLowerCase() === 'somente exames complementares';
  const destination = getFullDestination(result);
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-xl bg-white shadow-sm border-l-4 border-l-emerald",
        "hover:shadow-md transition-all duration-200 animate-fade-in-up"
      )}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-navy/10 flex items-center justify-center">
          <span className="font-bold text-navy text-sm sm:text-base">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-navy text-sm sm:text-base leading-tight">{result.name}</h3>
            {isOnlyExams && (
              <FlaskConical className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            )}
          </div>
          {locationSummary && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{locationSummary}</p>
          )}
          <div className="flex items-center justify-between mt-1.5 sm:mt-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-emerald" />
              <span className="font-medium text-emerald">{result.formattedDistance}</span>
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
          <NavigationMenu destination={destination} origin={result.originAddress} latitude={result.latitude} longitude={result.longitude} />
        </div>
      )}
    </div>
  );
}

export const ResultsList = forwardRef<HTMLDivElement, ResultsListProps>(
  function ResultsList({ results, isLoading, error, searchStep }, ref) {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

    const loadingMessage = searchStep === 'routing'
      ? 'Calculando melhores rotas...'
      : 'Validando localização...';
    
    if (isLoading) {
      return (
        <Card ref={ref} className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Navigation className="h-5 w-5 text-emerald" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={loadingMessage}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  {loadingMessage}
                </motion.span>
              </AnimatePresence>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResultsListSkeleton count={3} />
          </CardContent>
        </Card>
      );
    }

  if (error) {
    return (
      <Card ref={ref} className="rounded-xl border-destructive/50" role="alert">
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
      <Card ref={ref} className="rounded-xl">
        <span className="sr-only">Nenhum resultado encontrado</span>
        <CardContent className="text-center py-10">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
              <MapPinned className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-heading mb-1">
                Nenhuma clínica encontrada
              </h3>
              <p className="text-muted-foreground text-sm">
                Experimente aumentar o raio de busca para ver opções próximas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if any result used fallback search
  const searchInfo = results.find(r => r.searchInfo)?.searchInfo;
  
  // Show results up to visible count
  const visibleResults = results.slice(0, visibleCount);
  const hasMoreResults = visibleCount < results.length;
  const remainingCount = results.length - visibleCount;
  
  const handleShowMore = () => {
    setVisibleCount(prev => Math.min(prev + INCREMENT_COUNT, results.length));
  };
  
  const handleShowLess = () => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };
  
  // Check if any of the visible results is only for exams
  const hasOnlyExams = visibleResults.some(r => 
    r.services?.toLowerCase() === 'somente exames complementares'
  );

  return (
    <Card ref={ref} className="rounded-xl">
      <span className="sr-only">
        Busca concluída. {results.length} {results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}.
      </span>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="h-5 w-5 text-emerald" />
          Clínicas mais próximas
          <span className="text-sm font-normal text-muted-foreground">
            ({results.length} {results.length === 1 ? 'resultado' : 'resultados'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {searchInfo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>Busca realizada utilizando: <strong>{searchInfo}</strong></span>
          </div>
        )}
        {hasOnlyExams && (
          <Alert className="bg-blue-50 border-blue-200">
            <FlaskConical className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              Este local realiza apenas exames laboratoriais e/ou de imagem.
            </AlertDescription>
          </Alert>
        )}
        {visibleResults.map((result, index) => (
          <ResultItem key={`${result.name}-${index}`} result={result} index={index} />
        ))}
        {hasMoreResults && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={handleShowMore}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            Ver mais ({remainingCount} {remainingCount === 1 ? 'clínica' : 'clínicas'})
          </Button>
        )}
      </CardContent>
    </Card>
  );
});
