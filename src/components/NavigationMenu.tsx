import { useState } from 'react';
import { Navigation, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavigationMenuProps {
  destination: string;
  origin?: string;
}

function buildGoogleMapsUrl(destination: string, origin?: string): string {
  const baseUrl = 'https://www.google.com/maps/dir/';
  const encodedDestination = encodeURIComponent(destination + ', Brasil');
  const encodedOrigin = origin ? encodeURIComponent(origin) : '';
  
  return `${baseUrl}?api=1&origin=${encodedOrigin}&destination=${encodedDestination}`;
}

function buildWazeUrl(destination: string): string {
  const encodedDestination = encodeURIComponent(destination + ', Brasil');
  return `https://waze.com/ul?q=${encodedDestination}&navigate=yes`;
}

function buildAppleMapsUrl(destination: string): string {
  const encodedDestination = encodeURIComponent(destination + ', Brasil');
  return `maps://?daddr=${encodedDestination}`;
}

// Check if running on iOS
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Custom icons for navigation apps
function GoogleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4285F4"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  );
}

function WazeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.02 10.02 0 0022 12c0-5.52-4.48-10-10-10z" fill="#33CCFF"/>
    </svg>
  );
}

function AppleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FF3B30"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  );
}

interface NavigationOption {
  name: string;
  icon: React.ReactNode;
  url: string;
  showOnIOS?: boolean;
}

export function NavigationMenu({ destination, origin }: NavigationMenuProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const showAppleMaps = isIOS();

  const options: NavigationOption[] = [
    {
      name: 'Google Maps',
      icon: <GoogleMapsIcon className="h-5 w-5" />,
      url: buildGoogleMapsUrl(destination, origin),
    },
    {
      name: 'Waze',
      icon: <WazeIcon className="h-5 w-5" />,
      url: buildWazeUrl(destination),
    },
    ...(showAppleMaps ? [{
      name: 'Apple Maps',
      icon: <AppleMapsIcon className="h-5 w-5" />,
      url: buildAppleMapsUrl(destination),
    }] : []),
  ];

  const handleOptionClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const OptionButton = ({ option }: { option: NavigationOption }) => (
    <button
      onClick={() => handleOptionClick(option.url)}
      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent rounded-lg transition-colors"
    >
      {option.icon}
      <span className="font-medium">{option.name}</span>
    </button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Navigation className="h-4 w-4 mr-2" />
            Como chegar
          </Button>
        </DrawerTrigger>
        <DrawerContent className="backdrop-blur-xl bg-background/95">
          <DrawerHeader className="text-center">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <MapPin className="h-5 w-5 text-emerald" />
              Abrir com...
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2 space-y-1">
            {options.map((option) => (
              <OptionButton key={option.name} option={option} />
            ))}
          </div>
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <Navigation className="h-4 w-4 mr-2" />
          Como chegar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-1">
          {options.filter(o => o.name !== 'Apple Maps').map((option) => (
            <OptionButton key={option.name} option={option} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
