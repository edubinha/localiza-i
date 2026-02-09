import { useNavigate } from 'react-router-dom';
import { useEmpresa } from '@/hooks/useEmpresa';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, LogOut } from 'lucide-react';

export function Header() {
  const {
    empresa,
    isLoading,
    logout
  } = useEmpresa();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-8 rounded-full" />
                <span className="text-muted-foreground">|</span>
                <Skeleton className="h-6 w-32 rounded-md" />
              </>
            ) : (
            <>
                <img alt="LocalizAI" className="h-8" src="/lovable-uploads/4969dc17-88a2-41b0-a0fe-9489ce9ba09f.png" />
                {empresa && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-lg font-sans font-medium tracking-tight text-foreground">{empresa.nome}</span>
                  </>
                )}
              </>
            )}
          </div>
          
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ) : empresa && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} title="Configurações" className="text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Configurações</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Sair" className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Sair</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}