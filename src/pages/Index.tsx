import { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/Header';
import { AddressForm, type SearchResult } from '@/components/AddressForm';
import { ResultsList } from '@/components/ResultsList';
import { useEmpresa } from '@/hooks/useEmpresa';
import { useSheetData } from '@/hooks/useSheetData';
import { Loader2, AlertCircle, FileSpreadsheet, RefreshCw, Clock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  
  const { data: sheetData, isLoading: isLoadingSheet, error: sheetQueryError, dataUpdatedAt } = useSheetData(empresa?.google_sheets_url);

  const locations = sheetData?.locations ?? [];
  const sheetName = sheetData?.sheetName ?? null;
  const totalCount = locations.length;
  const sheetError = !empresa?.google_sheets_url
    ? 'Nenhuma planilha configurada. Acesse as configurações para vincular uma planilha.'
    : sheetQueryError instanceof Error
      ? sheetQueryError.message
      : sheetQueryError
        ? 'Erro ao carregar planilha.'
        : null;
  const lastSyncTime = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset search when locations change
  const prevLocationsRef = useRef(locations);
  useEffect(() => {
    if (prevLocationsRef.current !== locations && prevLocationsRef.current.length > 0 && locations.length > 0) {
      setResults([]);
      setHasSearched(false);
    }
    prevLocationsRef.current = locations;
  }, [locations]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['locations', empresa?.google_sheets_url] });
  };

  const handleDownloadCSV = () => {
    if (!locations.length) return;

    const headers = ['Clínica', 'CEP', 'Endereço (logradouro)', 'Número', 'Bairro', 'Cidade', 'Estado (UF)'];
    const rows = locations.map(loc => [
      loc.name,
      loc.cep ?? '',
      loc.address ?? '',
      loc.number ?? '',
      loc.neighborhood ?? '',
      loc.city ?? '',
      loc.state ?? '',
    ]);

    const escapeField = (field: string) => {
      if (field.includes(';') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.map(escapeField).join(';'),
      ...rows.map(row => row.map(escapeField).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prestadores_ativos.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Download iniciado! Apenas prestadores ativos foram incluídos.');
  };

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
              </div> : sheetError ? <div className="space-y-3" role="alert">
                  <div className="w-full flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{sheetError}</span>
                  </div>
                  {empresa?.google_sheets_url && (
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Tentar novamente
                      </Button>
                    </div>
                  )}
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
                      {lastSyncTime && dataUpdatedAt > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Última sincronização: {formatRelativeTime(lastSyncTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDownloadCSV}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Baixar lista de credenciados (CSV)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleRefresh}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Atualizar dados da planilha</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
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
          {(hasSearched || isSearching || searchError) && <section aria-live="polite" role="region" aria-label="Resultados da busca">
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
