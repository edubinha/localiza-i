import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, X, Cloud } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { parseSpreadsheet, parseSpreadsheetText, extractSheetName, type LocationData } from '@/lib/spreadsheet';

interface FileUploadProps {
  onDataLoaded: (data: LocationData[]) => void;
  locationsCount: number;
}

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT669HNj9Xp01XeXIonmyAayOWIPlN_VsBl5sQpcXOL1NotshQp5s4kYN1x0gtypa_XqShZS8vgesAU/pub?gid=0&single=true&output=csv';

const DEFAULT_SHEET_NAME = 'Planilha CONNAPA';

export function FileUpload({ onDataLoaded, locationsCount }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingName, setIsFetchingName] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string>(DEFAULT_SHEET_NAME);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sheet name on mount
  useEffect(() => {
    const fetchSheetName = async () => {
      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        if (response.ok) {
          const csvText = await response.text();
          const name = extractSheetName(csvText);
          if (name) {
            setSheetName(name);
          }
        }
      } catch (err) {
        console.error('Error fetching sheet name:', err);
      } finally {
        setIsFetchingName(false);
      }
    };
    
    fetchSheetName();
  }, []);

  const handleLoadFromGoogleSheets = async () => {
    setIsLoading(true);
    setError(null);
    setFileName(null);

    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL);
      if (!response.ok) {
        throw new Error('Falha ao carregar planilha');
      }
      const csvText = await response.text();

      const result = parseSpreadsheetText(csvText, true); // true = has name row
      if (result.success) {
        // Use the extracted name from the sheet, or fallback to the state
        const displayName = result.sheetName || sheetName;
        setFileName(displayName);
        if (result.sheetName) {
          setSheetName(result.sheetName); // Update state with latest name
        }
        onDataLoaded(result.data);
        if (result.error) setError(result.error);
      } else {
        setError(result.error || 'Erro ao processar a planilha.');
        setFileName(null);
        onDataLoaded([]);
      }
    } catch (err) {
      console.error('Error loading Google Sheet:', err);
      setError('Erro ao carregar planilha do Google Sheets. Verifique sua conexão.');
      onDataLoaded([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      setError('Formato inválido. Envie um arquivo CSV ou Excel (.xlsx, .xls).');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    const result = await parseSpreadsheet(file);

    setIsLoading(false);

    if (result.success) {
      onDataLoaded(result.data);
      if (result.error) {
        // Partial success warning
        setError(result.error);
      }
    } else {
      setError(result.error || 'Erro ao processar arquivo');
      setFileName(null);
      onDataLoaded([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClear = () => {
    setFileName(null);
    setError(null);
    onDataLoaded([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isLoaded = locationsCount > 0;

  return (
    <Card className={`transition-colors ${isDragging ? 'border-emerald border-2' : ''} ${isLoaded ? 'border-emerald/50 bg-emerald/5' : ''}`}>
      <CardContent className="p-6">
        <div
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {!isLoaded && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />
          )}
          
          <div className="flex flex-col items-center justify-center py-8 text-center">
            {isLoading ? (
              <>
                <div className="h-12 w-12 rounded-full border-4 border-muted border-t-emerald animate-spin mb-4" />
                <p className="text-muted-foreground">Processando planilha...</p>
              </>
            ) : isLoaded ? (
              <>
                <div className="h-12 w-12 rounded-full bg-emerald/20 flex items-center justify-center mb-4">
                  <Check className="h-6 w-6 text-emerald" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald" />
                  <span className="font-medium">{fileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.preventDefault();
                      handleClear();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-emerald font-medium">
                  {locationsCount} {locationsCount === 1 ? 'local carregado' : 'locais carregados'}
                </p>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="font-medium mb-1">Arraste sua planilha aqui</p>
                <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: CSV, Excel (.xlsx, .xls)
                </p>
              </>
            )}
          </div>
        </div>

        {/* Google Sheets card - outside the drop zone */}
        {!isLoaded && !isLoading && (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted-foreground mb-3 text-center">Ou use a planilha recomendada:</p>
            <button
              type="button"
              onClick={handleLoadFromGoogleSheets}
              disabled={isFetchingName}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors mx-auto disabled:opacity-50"
            >
              <Cloud className="h-4 w-4 text-emerald" />
              <span className="text-sm font-medium">
                {isFetchingName ? 'Carregando...' : sheetName}
              </span>
            </button>
          </div>
        )}

        {error && (
          <div className={`mt-4 p-3 rounded-md flex items-start gap-2 ${isLoaded ? 'bg-amber-50 text-amber-800' : 'bg-destructive/10 text-destructive'}`}>
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
