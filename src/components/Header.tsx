import logoImage from '@/assets/logo.png';

export function Header() {
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center">
          <img 
            src={logoImage} 
            alt="LocalizAI" 
            className="h-8 w-auto"
          />
        </div>
      </div>
    </header>
  );
}
