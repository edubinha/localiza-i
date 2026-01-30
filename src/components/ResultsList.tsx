import { useState } from 'react';
import { MapPin, Navigation, Clock, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SearchResult } from '@/components/AddressForm';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
}

function formatLocation(neighborhood?: string, city?: string, state?: string): string {
  const parts = [neighborhood, city, state].filter(Boolean);
  return parts.join(', ');
}

function formatFullAddress(address?: string, number?: string, neighborhood?: string, city?: string, state?: string): string {
  const street = address && number ? `${address}, ${number}` : address || '';
  const parts = [street, neighborhood, city, state].filter(Boolean);
  return parts.join(' - ');
}

function ResultItem({ result, index }: { result: SearchResult; index: number }) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  
  const locationSummary = formatLocation(result.neighborhood, result.city, result.state);
  const fullAddress = formatFullAddress(result.address, result.number, result.neighborhood, result.city, result.state);
  const hasAddressDetails = result.address || result.neighborhood || result.city;

  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-navy/10 flex items-center justify-center">
          <span className="font-bold text-navy">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{result.name}</h3>
          {locationSummary && (
            <p className="text-sm text-muted-foreground truncate">{locationSummary}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-emerald" />
              <span className="font-medium text-emerald">{result.formattedDistance}</span>
            </div>
            {result.formattedDuration && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-navy" />
                <span className="font-medium text-navy">{result.formattedDuration}</span>
              </div>
            )}
          </div>
        </div>
        {hasAddressDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFullAddress(!showFullAddress)}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
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
        <div className="ml-14 p-3 rounded-md bg-background border text-sm">
          <span className="font-medium">Endereço: </span>
          {fullAddress}
        </div>
      )}
    </div>
  );
}

export function ResultsList({ results, isLoading, error }: ResultsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscando locais...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8">
            <div className="h-12 w-12 rounded-full border-4 border-muted border-t-navy animate-spin mb-4" />
            <p className="text-muted-foreground">Calculando rotas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Navigation className="h-5 w-5 text-muted-foreground" />
            Nenhum prestador encontrado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-muted-foreground mb-2">
            Não foi localizado nenhum prestador dentro do raio de 40km.
          </p>
          <p className="text-sm text-emerald font-medium">
            Mas não se preocupe! É possível solicitar um credenciamento à CONNAPA.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if any result used fallback search
  const searchInfo = results.find(r => r.searchInfo)?.searchInfo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="h-5 w-5 text-emerald" />
          Locais mais próximos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {searchInfo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>Busca realizada utilizando: <strong>{searchInfo}</strong></span>
          </div>
        )}
        {results.map((result, index) => (
          <ResultItem key={`${result.name}-${index}`} result={result} index={index} />
        ))}
        <p className="text-xs text-muted-foreground text-center pt-2">
          Distância e tempo estimados por rota de carro
        </p>
      </CardContent>
    </Card>
  );
}
