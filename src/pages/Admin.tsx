import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEmpresa } from '@/hooks/useEmpresa';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, AlertCircle, CheckCircle2, Settings, Link2, Eye, EyeOff } from 'lucide-react';
import { isValidGoogleSheetsUrl, fetchGoogleSheetsCsv, validateRequiredColumns } from '@/lib/googleSheets';
import { parseCSV } from '@/lib/csv';
import { devLog } from '@/lib/logger';

export default function Admin() {
  const { empresa, isAdminValidated, setAdminValidated, setEmpresa } = useEmpresa();
  const [adminSecret, setAdminSecret] = useState('');
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Store admin secret in memory only (not sessionStorage) for security
  const [validatedAdminSecret, setValidatedAdminSecret] = useState<string | null>(null);
  
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSheet, setIsTestingSheet] = useState(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (empresa?.google_sheets_url) {
      setGoogleSheetsUrl(empresa.google_sheets_url);
    }
  }, [empresa]);

  // Redirect if no empresa
  useEffect(() => {
    if (!empresa) {
      navigate('/login');
    }
  }, [empresa, navigate]);

  const handleValidateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminSecret.trim()) {
      setValidationError('Por favor, informe o código administrativo.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Validate admin_secret via edge function - no direct DB access
      const { data: responseData, error: fnError } = await supabase.functions.invoke('validate-empresa', {
        body: {
          action: 'admin-validate',
          empresa_id: empresa?.id,
          admin_secret: adminSecret.trim(),
        },
      });

      if (fnError) {
        if (fnError.message?.includes('429') || responseData?.error?.includes('Muitas tentativas')) {
          setValidationError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setValidationError('Código administrativo inválido.');
        }
        return;
      }
      if (!responseData?.success) {
        setValidationError('Código administrativo inválido.');
        return;
      }

      setAdminValidated(true);
      setValidatedAdminSecret(adminSecret.trim()); // Store in memory only
      setAdminSecret(''); // Clear the input field
    } catch (err) {
      devLog.error('Admin validation error:', err);
      setValidationError('Erro ao validar código. Tente novamente.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestSheet = async () => {
    if (!googleSheetsUrl.trim()) {
      setSheetTestResult({ success: false, message: 'Informe a URL da planilha.' });
      return;
    }

    if (!isValidGoogleSheetsUrl(googleSheetsUrl)) {
      setSheetTestResult({ success: false, message: 'URL inválida. Use um link do Google Sheets.' });
      return;
    }

    setIsTestingSheet(true);
    setSheetTestResult(null);

    try {
      const csvContent = await fetchGoogleSheetsCsv(googleSheetsUrl);
      const lines = csvContent.trim().split('\n');
      
      // Get headers (might be line 1 or line 2 depending on format)
      let headerLine = lines[0];
      if (lines.length > 1 && !headerLine.toLowerCase().includes('nome') && !headerLine.toLowerCase().includes('latitude')) {
        headerLine = lines[1];
      }
      
      const headers = parseCSV(headerLine)[0] || [];
      const validation = validateRequiredColumns(headers);

      if (!validation.valid) {
        setSheetTestResult({
          success: false,
          message: `Colunas obrigatórias não encontradas: ${validation.missing.join(', ')}`,
        });
        return;
      }

      const dataRows = lines.length - (lines[0].toLowerCase().includes('nome') ? 1 : 2);
      setSheetTestResult({
        success: true,
        message: `Planilha válida! ${dataRows} locais encontrados.`,
      });
    } catch (error) {
      setSheetTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao acessar planilha.',
      });
    } finally {
      setIsTestingSheet(false);
    }
  };

  const handleSave = async () => {
    if (!googleSheetsUrl.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe a URL da planilha.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidGoogleSheetsUrl(googleSheetsUrl)) {
      toast({
        title: 'Erro',
        description: 'URL inválida. Use um link do Google Sheets.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Use admin secret from memory (not sessionStorage) for security
      if (!validatedAdminSecret) {
        toast({
          title: 'Sessão expirada',
          description: 'Por favor, faça login novamente na área administrativa.',
          variant: 'destructive',
        });
        setAdminValidated(false);
        return;
      }
      
      // Use edge function for secure update - no direct DB access
      const { data: responseData, error: fnError } = await supabase.functions.invoke('validate-empresa', {
        body: {
          action: 'update-settings',
          empresa_id: empresa?.id,
          admin_secret: validatedAdminSecret,
          google_sheets_url: googleSheetsUrl.trim(),
        },
      });

      if (fnError || !responseData?.success) {
        throw new Error('Failed to update settings');
      }

      // Update local context
      if (empresa) {
        setEmpresa({
          ...empresa,
          google_sheets_url: googleSheetsUrl.trim(),
        });
      }

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso!',
      });
    } catch (error) {
      devLog.error('Save error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!empresa) {
    return null;
  }

  // Admin validation screen
  if (!isAdminValidated) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Settings className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-xl">Área Administrativa</CardTitle>
            <CardDescription>
              Informe o código administrativo para acessar as configurações de {empresa.nome}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidateAdmin} className="space-y-4">
              <div className="relative overflow-hidden">
                <Input
                  type={showAdminSecret ? 'text' : 'password'}
                  placeholder="Código administrativo"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  disabled={isValidating}
                  autoComplete="off"
                  className="pr-10 text-base md:text-sm select-text touch-manipulation [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-textfield-decoration-container]:hidden [&::-webkit-clear-button]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminSecret(!showAdminSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showAdminSecret ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showAdminSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {validationError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button type="submit" className="flex-1 bg-navy hover:bg-navy/90 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    'Acessar'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin settings screen
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-xl font-semibold text-heading">Configurações</h1>
            </div>
            <span className="text-sm text-muted-foreground">{empresa.nome}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Google Sheets Configuration */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Planilha de Prestadores
              </CardTitle>
              <CardDescription>
                Configure o link da planilha Google Sheets com os prestadores da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL da Planilha (Google Sheets)</label>
                <Input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={googleSheetsUrl}
                  onChange={(e) => {
                    setGoogleSheetsUrl(e.target.value);
                    setSheetTestResult(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  A planilha deve estar publicada na web (Arquivo → Publicar na web → CSV)
                </p>
              </div>

              {sheetTestResult && (
                <div
                  className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                    sheetTestResult.success
                      ? 'text-emerald bg-emerald/10'
                      : 'text-destructive bg-destructive/10'
                  }`}
                >
                  {sheetTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>{sheetTestResult.message}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSheet}
                  disabled={isTestingSheet || !googleSheetsUrl.trim()}
                  className="flex-1"
                >
                  {isTestingSheet ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    'Testar Planilha'
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !googleSheetsUrl.trim()}
                  className="flex-1 bg-navy hover:bg-navy/90 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Informações da Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{empresa.nome}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Chave de Acesso</span>
                <span className="font-mono text-sm">{empresa.access_key}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Status</span>
                <span className={empresa.is_active ? 'text-emerald font-medium' : 'text-destructive'}>
                  {empresa.is_active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
