/**
 * Utilities for Google Sheets integration
 */
import { isAllowedUrl } from '@/lib/urlValidation';

/**
 * Extracts the CSV export URL from a Google Sheets URL
 * Supports multiple formats:
 * - Published CSV URL: already ends with output=csv
 * - Published HTML URL: /pubhtml or /pub
 * - Edit URL: /edit or /view
 * - Direct spreadsheet URL with ID
 */
export function extractGoogleSheetsCsvUrl(url: string): string | null {
  if (!url) return null;
  
  // If it's already a CSV export URL, return as-is
  if (url.includes('output=csv')) {
    return url;
  }
  
  // Try to extract the spreadsheet ID
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/,
    /key=([a-zA-Z0-9-_]+)/,
  ];
  
  let spreadsheetId: string | null = null;
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      spreadsheetId = match[1];
      break;
    }
  }
  
  if (!spreadsheetId) {
    return null;
  }
  
  // Check if it's a published spreadsheet (2PACX format)
  if (spreadsheetId.startsWith('2PACX')) {
    return `https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pub?gid=0&single=true&output=csv`;
  }
  
  // Standard spreadsheet ID
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`;
}

/**
 * Validates if a URL is a valid Google Sheets URL
 */
export function isValidGoogleSheetsUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') return false;
    return urlObj.hostname === 'docs.google.com' && url.includes('spreadsheets');
  } catch {
    return false;
  }
}

/**
 * Fetches and validates a Google Sheets CSV
 * Returns the CSV content if valid, or throws an error with details
 */
export async function fetchGoogleSheetsCsv(url: string): Promise<string> {
  const csvUrl = extractGoogleSheetsCsvUrl(url);
  
  if (!csvUrl) {
    throw new Error('URL inválida do Google Sheets. Verifique se o link está correto.');
  }
  
  try {
    if (!isAllowedUrl(csvUrl)) {
      throw new Error('URL da planilha não é permitida.');
    }
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Planilha não encontrada. Verifique se ela está publicada na web.');
      }
      throw new Error(`Erro ao acessar planilha: ${response.status}`);
    }
    
    const text = await response.text();
    
    // Basic validation - check if it looks like CSV content
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      throw new Error('A planilha não está publicada como CSV. Publique-a em Arquivo > Publicar na web > CSV.');
    }
    
    return text;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Não foi possível acessar a planilha. Verifique sua conexão e tente novamente.');
  }
}

/**
 * Validates if the CSV has the required columns for the application
 */
export function validateRequiredColumns(headers: string[]): { valid: boolean; missing: string[] } {
  const normalizedHeaders = headers.map(h => 
    h.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );
  
  const requiredMappings = {
    nome: ['nome do local', 'nome', 'local', 'name', 'nome_clinica', 'clinica'],
    latitude: ['latitude', 'lat'],
    longitude: ['longitude', 'lon', 'long', 'lng'],
  };
  
  const missing: string[] = [];
  
  for (const [field, aliases] of Object.entries(requiredMappings)) {
    const found = aliases.some(alias => 
      normalizedHeaders.some(h => h.includes(alias) || alias.includes(h))
    );
    if (!found) {
      missing.push(field);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}
