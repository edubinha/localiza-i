import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { AddressForm, type SearchResult } from '@/components/AddressForm';
import { ResultsList } from '@/components/ResultsList';
import { useEmpresa } from '@/hooks/useEmpresa';
import { parseSpreadsheetText, type LocationData } from '@/lib/spreadsheet';
import { extractGoogleSheetsCsvUrl } from '@/lib/googleSheets';
import { Loader2, AlertCircle, FileSpreadsheet, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'agora mesmo';
  if (diffMins === 1) return 'há 1 minuto';
  if (diffMins < 60) return `há ${diffMins} minutos`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'há 1 hora';
  if (diffHours < 24) return `há ${diffHours} horas`;
  
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const Index = () => {
  const {
    empresa
  } = useEmpresa();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Sheet loading state
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const loadSheetData = useCallback(async () => {
    if (!empresa?.google_sheets_url) {
      setSheetError('Nenhuma planilha configurada. Acesse as configurações para vincular uma planilha.');
      return;
    }
    setIsLoadingSheet(true);
    setSheetError(null);
    try {
      const csvUrl = extractGoogleSheetsCsvUrl(empresa.google_sheets_url);
      if (!csvUrl) {
        throw new Error('URL da planilha inválida.');
      }
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Não foi possível acessar a planilha. Verifique se ela está publicada na web.');
      }
      const csvText = await response.text();

      // Check if it's HTML (not published as CSV)
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error('A planilha não está publicada como CSV. Peça ao administrador para publicá-la corretamente.');
      }

      // Parse with name row (first row contains sheet name)
      const result = parseSpreadsheetText(csvText, true);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar a planilha.');
      }
      setLocations(result.data);
      setSheetName(result.sheetName || null);
      setLastSyncTime(new Date());
      setResults([]);
      setHasSearched(false);
    } catch (error) {
      console.error('Error loading sheet:', error);
      setSheetError(error instanceof Error ? error.message : 'Erro ao carregar planilha.');
      setLocations([]);
    } finally {
      setIsLoadingSheet(false);
    }
  }, [empresa?.google_sheets_url]);

  // Load sheet data on mount and when google_sheets_url changes
  useEffect(() => {
    loadSheetData();
  }, [loadSheetData]);
  const handleSearchStart = () => {
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
  };
  const handleResults = (newResults: SearchResult[]) => {
    setResults(newResults);
    setIsSearching(false);
    setSearchError(null);
    setHasSearched(true);

    // Scroll to results after a brief delay to allow render
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };
  const handleError = (error: string) => {
    setSearchError(error);
    setIsSearching(false);
    setResults([]);
  };
  return <div className="min-h-screen bg-slate-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Introduction */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
              Onde encontrar ficou fácil.
            </h2>
            <p className="text-muted-foreground">
              Localize clínicas de saúde ocupacional próximas de você, de forma rápida e precisa.
            </p>
          </div>

          {/* Sheet Status */}
          <Card className="rounded-xl">
            <CardContent className="py-4">
              {isLoadingSheet ? <div className="flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Carregando prestadores...</span>
                </div> : sheetError ? <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span>{sheetError}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadSheetData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div> : <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-emerald" />
                    <div>
                      <p className="font-medium">
                        {sheetName || 'Planilha de Prestadores'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {locations.length} {locations.length === 1 ? 'prestador disponível' : 'prestadores disponíveis'}
                      </p>
                      {lastSyncTime && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Última sincronização: {formatRelativeTime(lastSyncTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadSheetData} title="Atualizar dados">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>}
            </CardContent>
          </Card>

          {/* Address Form - Only show when sheet is loaded */}
          {!isLoadingSheet && !sheetError && locations.length > 0 && <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-navy text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                Informe o endereço
              </h3>
              <AddressForm locations={locations} onResults={handleResults} onError={handleError} onSearchStart={handleSearchStart} />
            </section>}

          {/* Results */}
          {(hasSearched || isSearching || searchError) && <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-emerald text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                Resultados
              </h3>
              <ResultsList ref={resultsRef} results={results} isLoading={isSearching} error={searchError} />
            </section>}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>Localizaí © 2026</p>
        </div>
      </footer>
    </div>;
};
export default Index;