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

// Custom icons for navigation apps - Official SVGs
function GoogleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 92.3 132.3">
      <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z"/>
      <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z"/>
      <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"/>
      <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3"/>
      <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2"/>
    </svg>
  );
}

function WazeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <path fill="#33CCFF" d="M819.1,1000H180.9C81,1000,0,919,0,819.1V180.9C0,81,81,0,180.9,0h638.2C919,0,1000,81,1000,180.9v638.2C1000,919,919,1000,819.1,1000z"/>
      <path fill="#FFFFFF" d="M539.4,184.3c-87.2,0-168.5,39.2-223.3,108.7c-38.2,49-58.8,109.7-58.8,171.4v51.9c0,22.5-8.8,44.1-23.5,59.7c-11.7,11.8-26.4,20.6-42.1,24.5c5.9,14.7,19.6,37.2,44.1,61.7c20.6,21.5,45.1,39.2,71.5,51.9v-1c16.6-25.5,44.1-40.2,74.4-40.2c5.9,0,10.8,1,16.7,2c35.3,6.9,62.7,34.3,69.5,68.6h72.5c75.4,0,146.9-31.3,198.8-82.3C819.5,580.9,844,460.5,800,356.6C755.9,251.8,654,184.3,539.4,184.3z"/>
      <path fill="#000001" d="M539.4,149c-97,0-188,43.1-249.8,120.5c-44.1,55.8-67.6,124.4-67.6,195.9v50.9c0,26.4-18.6,50.9-54.8,52.9c-8.8,0-15.7,6.9-16.6,15.7c-1,23.5,24.5,67.6,59.7,102.8c24.5,24.5,52.9,44.1,83.2,59.7c-9.8,53.9,32.3,102.8,87.2,102.8h1c42.1,0,77.4-29.4,86.2-69.5h73.5c7.8,40.2,43.1,69.5,86.2,69.5c9.8,0,20.6-2,30.4-4.9c24.5-7.8,43.1-26.4,51.9-50.9c7.8-22.5,6.9-45,0-63.7c19.6-12.7,37.2-26.4,53.9-43.1c59.7-58.8,93-139.1,93-222.3c0-84.2-33.3-162.6-93-222.3C704,181.3,623.7,149,539.4,149z M539.4,184.3c113.6,0,216.5,68.6,260.5,173.4c44.1,104.8,19.6,225.3-60.7,304.6c-51.9,51.9-123.4,82.3-198.8,82.3h-72.5c-6.9-35.3-34.3-61.7-69.5-68.6c-5.9-1-10.8-2-16.7-2c-29.4,0-57.8,14.7-74.4,40.2v1c-26.4-13.7-50-31.4-71.5-51.9c-24.5-24.5-38.2-48-44.1-61.7c16.7-3.9,30.4-12.7,42.1-24.5c14.7-16.7,23.5-37.2,23.5-59.7v-51.9c0-61.7,20.6-122.4,58.8-171.4C371,222.5,452.3,184.3,539.4,184.3z"/>
      <path fill="#000001" d="M680.5,358.6c-19.6,0-35.3,15.7-35.3,35.3c0,19.6,15.7,35.3,35.3,35.3c19.6,0,35.3-15.7,35.3-35.3C715.7,374.3,700.1,358.6,680.5,358.6z"/>
      <path fill="#000001" d="M468.9,358.6c-19.6,0-35.3,15.7-35.3,35.3c0,19.6,15.7,35.3,35.3,35.3s35.3-15.7,35.3-35.3C504.2,374.3,488.5,358.6,468.9,358.6z"/>
      <path fill="#000001" d="M463,498.6c-12.7,0-21.5,12.7-15.7,24.5c23.5,49,72.5,80.3,127.3,80.3c54.8,0,103.8-31.3,127.3-80.3c4.9-11.7-2.9-24.5-15.7-24.5c-6.9,0-12.7,3.9-15.7,9.8c-17.6,36.2-54.8,59.7-95,59.7c-41.1,0-78.3-23.5-95-59.7C476.8,502.6,470.9,498.6,463,498.6z"/>
    </svg>
  );
}

function AppleMapsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10000 3050">
      <path fill="#000" fillRule="evenodd" clipRule="evenodd" d="M1393.93,402.59c76.49-92.42,132.26-221.49,132.26-350.56c0-17.53-1.59-35.06-4.78-49.4c-125.88,4.78-277.26,84.45-368.09,191.22c-71.71,81.27-137.04,208.74-137.04,339.41c0,19.12,3.19,38.24,4.78,44.62c11.03,2.09,22.23,3.15,33.46,3.19C1167.66,581.05,1309.48,504.57,1393.93,402.59z M1483.17,608.14c-189.62,0-344.19,114.73-441.39,114.73c-105.17,0-243.8-108.36-407.93-108.36c-312.32,0-629.42,258.14-629.42,745.74c0,302.76,117.92,623.05,262.92,830.2c124.29,175.28,232.65,318.7,388.81,318.7c154.57,0,223.09-103.58,415.89-103.58c196,0,239.02,100.39,411.12,100.39c168.91,0,282.04-156.16,388.81-309.14c119.51-175.28,168.9-347.37,172.09-355.34c-11.15-3.19-334.63-135.44-334.63-506.72c0-321.88,254.96-466.89,269.3-478.04C1809.83,614.52,1553.28,608.14,1483.17,608.14L1483.17,608.14z M4831.69,2491.8V192.43h-474.86l-704.31,1754.41h-12.75L2935.46,192.43h-476.45V2491.8h371.28V860.09h11.15l664.48,1631.71h280.45l664.48-1631.71H4462V2491.8H4831.69z M5606.56,2518.89c216.71,0,428.64-113.13,525.85-296.38h7.96v269.29h382.44V1328.57c0-339.41-272.49-560.9-691.57-560.9c-430.24,0-699.53,226.27-717.06,541.78h368.09c25.5-140.23,145.01-231.05,333.04-231.05c195.99,0,315.5,101.98,315.5,278.85v121.11l-446.17,25.49c-411.11,25.5-642.17,205.56-642.17,505.13C5042.47,2313.34,5279.9,2518.89,5606.56,2518.89L5606.56,2518.89z M5726.07,2219.32c-172.09,0-286.82-87.64-286.82-226.27c0-133.85,109.95-219.9,301.16-232.65l390.4-23.9v129.07C6130.81,2069.53,5950.75,2219.32,5726.07,2219.32z M7719.95,774.04c-245.39,0-436.61,124.29-532.22,320.29h-7.97v-291.6h-387.21v2245.2h396.77v-836.58h7.97c92.42,189.63,283.64,307.54,529.03,307.54c423.87,0,694.76-333.03,694.76-871.63C8421.08,1107.08,8148.59,774.04,7719.95,774.04z M7598.85,2193.82c-246.99,0-411.12-215.11-412.71-546.56c1.59-328.25,165.72-546.56,412.71-546.56c256.54,0,415.89,213.53,415.89,546.56C8014.74,1981.89,7855.39,2193.82,7598.85,2193.82z M8596.8,1287.14c0,250.17,162.54,409.52,486.01,481.23l280.45,62.14c176.88,39.84,237.43,97.21,237.43,199.19c0,125.88-119.51,205.56-312.32,205.56c-200.78,0-313.91-82.87-344.19-246.99h-390.4c31.87,326.66,293.2,537,734.59,537c414.3,0,707.5-215.12,707.5-533.82c0-245.39-135.44-380.84-486.01-458.92l-280.45-62.14c-176.87-39.84-246.99-106.76-246.99-203.97c0-124.29,116.33-207.15,291.61-207.15c183.25,0,296.39,97.21,312.32,250.18h369.69c-9.57-320.29-270.89-541.78-682.01-541.78C8866.1,767.67,8596.8,978.01,8596.8,1287.14L8596.8,1287.14z"/>
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
      className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-accent rounded-lg transition-all group"
    >
      <span className="transition-transform group-hover:scale-105">
        {option.icon}
      </span>
      <span className="font-medium text-sm">{option.name}</span>
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
      <PopoverContent className="w-40 p-1" align="start">
        <div className="space-y-1">
          {options.filter(o => o.name !== 'Apple Maps').map((option) => (
            <OptionButton key={option.name} option={option} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
