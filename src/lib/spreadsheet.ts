import * as XLSX from 'xlsx';

export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface ParseResult {
  success: boolean;
  data: LocationData[];
  error?: string;
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseCoordinate(value: unknown): number {
  if (typeof value === 'number') return value;

  const raw = String(value ?? '').trim();
  if (!raw) return NaN;

  // Normaliza número pt-BR (ex: "-23,292" ou "1.234,56") e remove aspas
  const noQuotes = raw.replace(/["']/g, '');
  const normalized = /,\d+$/.test(noQuotes)
    ? noQuotes.replace(/\./g, '').replace(',', '.')
    : noQuotes.replace(',', '.');

  return parseFloat(normalized);
}

function findColumn(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const index = headers.findIndex(h => normalizeColumnName(h) === normalizedName);
    if (index !== -1) return index;
  }
  return -1;
}

export function parseSpreadsheet(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: file.name.endsWith('.csv') ? 'string' : 'array', codepage: 65001 });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with raw array output
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          resolve({
            success: false,
            data: [],
            error: 'A planilha deve conter pelo menos uma linha de cabeçalho e uma linha de dados.',
          });
          return;
        }

        // Get headers from first row
        const headersRow = jsonData[0] as unknown[];
        const headers = headersRow.map(h => String(h || ''));
        
        // Find column indexes
        const nameColIndex = findColumn(headers, ['nome do local', 'nome', 'local', 'name']);
        const latColIndex = findColumn(headers, ['latitude', 'lat']);
        const lonColIndex = findColumn(headers, ['longitude', 'lon', 'long', 'lng']);
        const cepColIndex = findColumn(headers, ['cep']);
        const addressColIndex = findColumn(headers, ['endereço (logradouro)', 'endereço', 'endereco', 'address', 'rua', 'logradouro']);
        const numberColIndex = findColumn(headers, ['número', 'numero', 'number', 'num']);
        const neighborhoodColIndex = findColumn(headers, ['bairro', 'neighborhood']);
        const cityColIndex = findColumn(headers, ['cidade', 'city']);
        const stateColIndex = findColumn(headers, ['uf', 'estado', 'state']);

        if (nameColIndex === -1 || latColIndex === -1 || lonColIndex === -1) {
          resolve({
            success: false,
            data: [],
            error: `Colunas obrigatórias não encontradas. A planilha deve conter: Nome do local, Latitude, Longitude.`,
          });
          return;
        }

        // Parse data rows
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

          const latitude = parseCoordinate(latValue);
          const longitude = parseCoordinate(lonValue);

          if (isNaN(latitude) || isNaN(longitude)) {
            errors.push(`Linha ${i + 1}: Coordenadas inválidas para "${name}"`);
            continue;
          }

          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            errors.push(`Linha ${i + 1}: Coordenadas fora do intervalo válido para "${name}"`);
            continue;
          }

          // Extract optional address fields
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
          resolve({
            success: false,
            data: [],
            error: errors.length > 0 
              ? `Nenhum local válido encontrado. Erros: ${errors.slice(0, 3).join('; ')}` 
              : 'Nenhum local válido encontrado na planilha.',
          });
          return;
        }

        resolve({
          success: true,
          data: locations,
          error: errors.length > 0 ? `${locations.length} locais carregados. ${errors.length} linhas com erro.` : undefined,
        });
      } catch (error) {
        console.error('Parse error:', error);
        resolve({
          success: false,
          data: [],
          error: 'Erro ao processar a planilha. Verifique se o arquivo é um CSV ou Excel válido.',
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        error: 'Erro ao ler o arquivo.',
      });
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}
