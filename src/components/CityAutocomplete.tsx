import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface City {
  nome: string;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  stateCode?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({
  value,
  onChange,
  stateCode,
  disabled,
  placeholder = "Ex: São Paulo",
  className,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allCities, setAllCities] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch cities when state changes
  useEffect(() => {
    if (!stateCode) {
      setAllCities([]);
      setSuggestions([]);
      return;
    }

    const fetchCities = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`
        );
        const data: City[] = await response.json();
        const cityNames = data.map((city) => city.nome);
        setAllCities(cityNames);
      } catch (error) {
        console.error('Error fetching cities:', error);
        setAllCities([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCities();
  }, [stateCode]);

  // Filter cities based on input
  const filterCities = useCallback(
    (searchValue: string) => {
      if (!searchValue || searchValue.length < 2) {
        setSuggestions([]);
        return;
      }

      const normalizedSearch = searchValue.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filtered = allCities
        .filter((city) => {
          const normalizedCity = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return normalizedCity.includes(normalizedSearch);
        })
        .slice(0, 8);

      setSuggestions(filtered);
    },
    [allCities]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    filterCities(newValue);
    setIsOpen(true);
  };

  const handleSelectCity = (city: string) => {
    onChange(city);
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showSuggestions = isOpen && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={stateCode ? placeholder : "Selecione o estado primeiro"}
        disabled={disabled || !stateCode}
        className={className}
      />
      {isLoading && stateCode && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
      {showSuggestions && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
          {suggestions.map((city, index) => (
            <li
              key={city}
              onClick={() => handleSelectCity(city)}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                index === 0 && "rounded-t-md",
                index === suggestions.length - 1 && "rounded-b-md"
              )}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
