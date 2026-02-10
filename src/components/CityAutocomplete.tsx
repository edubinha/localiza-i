import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

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
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the input value for filtering
  const debouncedInputValue = useDebounce(inputValue, 300);

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

  // Filter cities when debounced value changes
  useEffect(() => {
    filterCities(debouncedInputValue);
  }, [debouncedInputValue, filterCities]);

  // Sync inputValue with external value changes (e.g., from CEP lookup)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectCity = (city: string) => {
    setInputValue(city);
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
  const showLoadingSkeletons = isOpen && isLoading && inputValue.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0 || isLoading) setIsOpen(true);
        }}
        placeholder={stateCode ? placeholder : "Selecione o estado primeiro"}
        disabled={disabled || !stateCode}
        className={cn("cursor-text text-sm h-10", className)}
        autoComplete="off"
      />
      {isLoading && stateCode && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
      {showLoadingSkeletons && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-1">
          {[1, 2, 3].map((i) => (
            <li key={i} className="px-3 py-1.5">
              <Skeleton className="h-4 w-full rounded-md" />
            </li>
          ))}
        </ul>
      )}
      {showSuggestions && !isLoading && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto scrollbar-hidden p-1">
          {suggestions.map((city) => (
            <li
              key={city}
              onClick={() => handleSelectCity(city)}
              className="px-3 py-1.5 cursor-default text-sm rounded-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
