import { useState, useRef, type ChangeEvent } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, X, Cloud } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { parseSpreadsheet, type LocationData } from '@/lib/spreadsheet';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onDataLoaded: (data: LocationData[]) => void;
  locationsCount: number;
}

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCV3tFeR8Tp2gFFiUKw3UxuwpHnD7SYz8KiD0Iukuov_yvOTXT2iLNwYfW0waSdAPsijkYh3l3Xx4a/pub?gid=1434258017&single=true&output=csv';

export function FileUpload({ onDataLoaded, locationsCount }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSVData = (csvText: string, sourceName: string): void => {
    try {
      const workbook = XLSX.read(csvText, { type: 'string', codepage: 65001 });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        setError('A planilha deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
        setFileName(null);
        onDataLoaded([]);
        return;
      }

      const headersRow = jsonData[0] as unknown[];
      const headers = headersRow.map(h => String(h || ''));

      const normalizeColumnName = (name: string): string => {
        return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      };

      const findColumn = (possibleNames: string[]): number => {
        for (const name of possibleNames) {
          const normalizedName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const index = headers.findIndex(h => normalizeColumnName(h) === normalizedName);
          if (index !== -1) return index;
        }
        return -1;
      };

      const nameColIndex = findColumn(['nome do local', 'nome', 'local', 'name']);
      const latColIndex = findColumn(['latitude', 'lat']);
      const lonColIndex = findColumn(['longitude', 'lon', 'long', 'lng']);
      const cepColIndex = findColumn(['cep']);
      const addressColIndex = findColumn(['endereço (logradouro)', 'endereço', 'endereco', 'address', 'rua', 'logradouro']);
      const numberColIndex = findColumn(['número', 'numero', 'number', 'num']);
      const neighborhoodColIndex = findColumn(['bairro', 'neighborhood']);
      const cityColIndex = findColumn(['cidade', 'city']);
      const stateColIndex = findColumn(['uf', 'estado', 'state']);

      if (nameColIndex === -1 || latColIndex === -1 || lonColIndex === -1) {
        setError('Colunas obrigatórias não encontradas. A planilha deve conter: Nome do local, Latitude, Longitude.');
        setFileName(null);
        onDataLoaded([]);
        return;
      }

      const locations: LocationData[] = [];
      const errors: string[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        if (!row || row.length === 0) continue;

        const name = String(row[nameColIndex] || '').trim();
        const latValue = row[latColIndex];
        const lonValue = row[lonColIndex];

        if (!name) {
          errors.push(`Linha ${i + 1}: Nome do local vazio`);
          continue;
        }

        const latitude = typeof latValue === 'number' ? latValue : parseFloat(String(latValue));
        const longitude = typeof lonValue === 'number' ? lonValue : parseFloat(String(lonValue));

        if (isNaN(latitude) || isNaN(longitude)) {
          errors.push(`Linha ${i + 1}: Coordenadas inválidas para "${name}"`);
          continue;
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          errors.push(`Linha ${i + 1}: Coordenadas fora do intervalo válido para "${name}"`);
          continue;
        }

        const cep = cepColIndex !== -1 ? String(row[cepColIndex] || '').trim() : undefined;
        const address = addressColIndex !== -1 ? String(row[addressColIndex] || '').trim() : undefined;
        const number = numberColIndex !== -1 ? String(row[numberColIndex] || '').trim() : undefined;
        const neighborhood = neighborhoodColIndex !== -1 ? String(row[neighborhoodColIndex] || '').trim() : undefined;
        const city = cityColIndex !== -1 ? String(row[cityColIndex] || '').trim() : undefined;
        const state = stateColIndex !== -1 ? String(row[stateColIndex] || '').trim() : undefined;

        locations.push({
          name,
          latitude,
          longitude,
          cep: cep || undefined,
          address: address || undefined,
          number: number || undefined,
          neighborhood: neighborhood || undefined,
          city: city || undefined,
          state: state || undefined,
        });
      }

      if (locations.length === 0) {
        setError(errors.length > 0
          ? `Nenhum local válido encontrado. Erros: ${errors.slice(0, 3).join('; ')}`
          : 'Nenhum local válido encontrado na planilha.');
        setFileName(null);
        onDataLoaded([]);
        return;
      }

      setFileName(sourceName);
      onDataLoaded(locations);
      if (errors.length > 0) {
        setError(`${locations.length} locais carregados. ${errors.length} linhas com erro.`);
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError('Erro ao processar a planilha.');
      setFileName(null);
      onDataLoaded([]);
    }
  };

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
      parseCSVData(csvText, 'Prestadores CONNAPA - Atualizado');
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
                <p className="text-xs text-muted-foreground mb-6">
                  Formatos aceitos: CSV, Excel (.xlsx, .xls)
                </p>
                
                {/* Google Sheets card */}
                <div className="border-t border-border pt-4 w-full">
                  <p className="text-xs text-muted-foreground mb-3">Ou use a planilha recomendada:</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadFromGoogleSheets();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors mx-auto"
                  >
                    <Cloud className="h-4 w-4 text-emerald" />
                    <span className="text-sm font-medium">Prestadores CONNAPA - Atualizado</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

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
