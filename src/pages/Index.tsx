import { useState } from 'react';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { AddressForm, type SearchResult } from '@/components/AddressForm';
import { ResultsList } from '@/components/ResultsList';
import type { LocationData } from '@/lib/spreadsheet';

const Index = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleDataLoaded = (data: LocationData[]) => {
    setLocations(data);
    // Clear previous results when new data is loaded
    setResults([]);
    setSearchError(null);
  };

  const handleSearchStart = () => {
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
  };

  const handleResults = (newResults: SearchResult[]) => {
    setResults(newResults);
    setIsSearching(false);
    setSearchError(null);
  };

  const handleError = (error: string) => {
    setSearchError(error);
    setIsSearching(false);
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Introduction */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Encontre o local mais próximo para exames de seu colaborador
            </h2>
            <p className="text-muted-foreground">
              Importe sua planilha de prestadores e busque os mais próximos do endereço informado.
            </p>
          </div>

          {/* Step 1: File Upload */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-navy text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              Importe sua planilha
            </h3>
            <FileUpload 
              onDataLoaded={handleDataLoaded} 
              locationsCount={locations.length}
            />
          </section>

          {/* Step 2: Address Form */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-navy text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              Informe o endereço
            </h3>
            <AddressForm
              locations={locations}
              onResults={handleResults}
              onError={handleError}
              onSearchStart={handleSearchStart}
            />
          </section>

          {/* Results */}
          {(results.length > 0 || isSearching || searchError) && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-emerald text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                Resultados
              </h3>
              <ResultsList 
                results={results} 
                isLoading={isSearching} 
                error={searchError}
              />
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>LocalizAI © {new Date().getFullYear()} — Encontre locais de exame ocupacional próximos a você</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
