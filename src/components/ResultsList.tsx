import { MapPin, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SearchResult } from '@/components/AddressForm';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
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
            <p className="text-muted-foreground">Calculando distâncias...</p>
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

  if (results.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="h-5 w-5 text-emerald" />
          Locais mais próximos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((result, index) => (
          <div
            key={`${result.name}-${index}`}
            className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-navy/10 flex items-center justify-center">
              <span className="font-bold text-navy">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{result.name}</h3>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-emerald" />
                <span className="font-medium text-emerald">{result.formattedDistance}</span>
                <span>de distância</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
