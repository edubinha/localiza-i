import { useQuery } from '@tanstack/react-query';
import { parseSpreadsheetText } from '@/lib/spreadsheet';
import { extractGoogleSheetsCsvUrl } from '@/lib/googleSheets';
import { isAllowedUrl } from '@/lib/urlValidation';
import { devLog } from '@/lib/logger';
import type { LocationData } from '@/lib/spreadsheet';

interface SheetData {
  locations: LocationData[];
  sheetName: string | null;
}

async function fetchSheetData(googleSheetsUrl: string): Promise<SheetData> {
  const csvUrl = extractGoogleSheetsCsvUrl(googleSheetsUrl);
  if (!csvUrl) {
    throw new Error('URL da planilha inválida.');
  }

  if (!isAllowedUrl(csvUrl)) {
    throw new Error('URL da planilha não é permitida.');
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

  return {
    locations: result.data,
    sheetName: result.sheetName || null,
  };
}

export function useSheetData(googleSheetsUrl: string | null | undefined) {
  return useQuery<SheetData>({
    queryKey: ['locations', googleSheetsUrl],
    queryFn: () => fetchSheetData(googleSheetsUrl!),
    enabled: !!googleSheetsUrl,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes in cache
    retry: 1,
    meta: {
      errorMessage: 'Erro ao carregar planilha.',
    },
  });
}
