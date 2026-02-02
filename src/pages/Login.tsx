import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEmpresa } from '@/hooks/useEmpresa';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [accessKey, setAccessKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setEmpresa } = useEmpresa();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessKey.trim()) {
      setError('Por favor, informe a chave de acesso.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: dbError } = await supabase
        .from('empresas')
        .select('id, nome, access_key, google_sheets_url, is_active')
        .eq('access_key', accessKey.trim())
        .eq('is_active', true)
        .single();

      if (dbError || !data) {
        setError('Chave de acesso inválida. Verifique e tente novamente.');
        return;
      }

      // Store empresa in context (without admin_secret for security)
      setEmpresa({
        id: data.id,
        nome: data.nome,
        access_key: data.access_key,
        google_sheets_url: data.google_sheets_url,
        is_active: data.is_active,
      });

      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError('Ocorreu um erro ao validar a chave. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-[#1a2744]">Localiz</span>
              <span className="text-[#00b4b4]">AI</span>
            </h1>
          </div>
          <CardTitle className="text-xl">Acesso à Plataforma</CardTitle>
          <CardDescription>
            Informe a chave de acesso da sua empresa para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Digite sua chave de acesso"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
