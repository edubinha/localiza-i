import { MapPin, Cpu } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <MapPin className="h-8 w-8 text-navy" />
            <Cpu className="h-4 w-4 text-emerald absolute -bottom-1 -right-1" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-muted-foreground">Localiz</span>
            <span className="text-navy">AI</span>
          </h1>
        </div>
      </div>
    </header>
  );
}
