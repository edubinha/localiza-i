import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { AddressForm, type SearchResult } from '@/components/AddressForm';
import { ResultsList } from '@/components/ResultsList';
import { useEmpresa } from '@/hooks/useEmpresa';
import { useLocationsCache } from '@/hooks/useLocationsCache';
import { parseSpreadsheetText } from '@/lib/spreadsheet';
import { extractGoogleSheetsCsvUrl } from '@/lib/googleSheets';
import { Loader2, AlertCircle, FileSpreadsheet, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const CACHE_KEY = 'localizai_sheet_cache';

interface SheetCache {
  data: any[];
  sheetName: string | null;
  timestamp: number;
  url: string;
}

function loadFromLocalStorage(url: string): SheetCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: SheetCache = JSON.parse(raw);
    if (cached.url !== url) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: any[], sheetName: string | null, url: string) {
  try {
    const cache: SheetCache = { data, sheetName, timestamp: Date.now(), url };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — ignore */ }
}

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
  const { empresa } = useEmpresa();
  
  // Centralized location cache with in-memory filtering
  const { 
    locations, 
    setLocations, 
    totalCount 
  } = useLocationsCache();
  
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
  const hasLoadedRef = useRef(false);

  // Load sheet data with stale-while-revalidate via localStorage
  const loadSheetData = useCallback(async (forceRefresh = false) => {
    if (!empresa?.google_sheets_url) {
      setSheetError('Nenhuma planilha configurada. Acesse as configurações para vincular uma planilha.');
      return;
    }

    const sheetUrl = empresa.google_sheets_url;

    // On first load, try localStorage cache for instant display
    if (!hasLoadedRef.current && !forceRefresh) {
      const cached = loadFromLocalStorage(sheetUrl);
      if (cached) {
        setLocations(cached.data);
        setSheetName(cached.sheetName);
        setLastSyncTime(new Date(cached.timestamp));
        hasLoadedRef.current = true;
        // Continue to background revalidation below (no return)
      }
    }

    // Skip network fetch if already loaded and not forcing refresh (and no stale-while-revalidate needed)
    if (hasLoadedRef.current && !forceRefresh && locations.length > 0) {
      // If we just restored from cache, do a background revalidation
      // Otherwise skip entirely
      const cached = loadFromLocalStorage(sheetUrl);
      const isStaleRevalidation = cached && !forceRefresh;
      if (!isStaleRevalidation) return;
    }

    // Show loading spinner only if we have no data yet
    if (!hasLoadedRef.current) {
      setIsLoadingSheet(true);
    }
    setSheetError(null);

    try {
      const csvUrl = extractGoogleSheetsCsvUrl(sheetUrl);
      if (!csvUrl) {
        throw new Error('URL da planilha inválida.');
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Não foi possível acessar a planilha. Verifique se ela está publicada na web.');
      }

      const csvText = await response.text();

      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error('A planilha não está publicada como CSV. Peça ao administrador para publicá-la corretamente.');
      }

      const result = parseSpreadsheetText(csvText, true);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar a planilha.');
      }

      // Compare with current data — only update state if data changed
      const newDataJson = JSON.stringify(result.data);
      const currentDataJson = JSON.stringify(locations);

      if (newDataJson !== currentDataJson || !hasLoadedRef.current) {
        setLocations(result.data);
        setResults([]);
        setHasSearched(false);
      }

      setSheetName(result.sheetName || null);
      setLastSyncTime(new Date());
      hasLoadedRef.current = true;

      // Persist to localStorage
      saveToLocalStorage(result.data, result.sheetName || null, sheetUrl);
    } catch (error) {
      console.error('Error loading sheet:', error);
      // Only show error if we have no cached data
      if (!hasLoadedRef.current) {
        setSheetError(error instanceof Error ? error.message : 'Erro ao carregar planilha.');
        setLocations([]);
      }
    } finally {
      setIsLoadingSheet(false);
    }
  }, [empresa?.google_sheets_url, locations, setLocations]);

  // Load sheet data only once on mount
  useEffect(() => {
    if (empresa?.google_sheets_url && !hasLoadedRef.current) {
      loadSheetData();
    }
  }, [empresa?.google_sheets_url, loadSheetData]);
  const handleSearchStart = () => {
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    setHasSearched(false);
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
            <h2 className="text-2xl sm:text-3xl font-extrabold text-heading mb-2">
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
                  <Button variant="outline" size="sm" onClick={() => loadSheetData()}>
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
                        {totalCount} {totalCount === 1 ? 'prestador disponível' : 'prestadores disponíveis'}
                      </p>
                      {lastSyncTime && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Última sincronização: {formatRelativeTime(lastSyncTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => loadSheetData(true)} 
                    title="Atualizar dados da planilha"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>}
            </CardContent>
          </Card>

          {/* Address Form - Only show when sheet is loaded */}
          {!isLoadingSheet && !sheetError && totalCount > 0 && <section>
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