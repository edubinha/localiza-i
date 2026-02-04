import { useNavigate } from 'react-router-dom';
import { useEmpresa } from '@/hooks/useEmpresa';
import { Button } from '@/components/ui/button';
import { Settings, LogOut } from 'lucide-react';
import logo from '@/assets/logo.png';
export function Header() {
  const {
    empresa,
    logout
  } = useEmpresa();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img alt="LocalizAI" className="h-8" src="/lovable-uploads/8947c6aa-727e-41b8-b29d-748669f1c582.png" />
            {empresa && <>
                <span className="text-muted-foreground">|</span>
                <span className="text-lg font-medium text-foreground">{empresa.nome}</span>
              </>}
          </div>
          
          {empresa && <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} title="Configurações">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Configurações</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Sair</span>
              </Button>
            </div>}
        </div>
      </div>
    </header>;
}