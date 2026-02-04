import { useState, useCallback } from 'react';
import { useEmpresa } from '@/hooks/useEmpresa';
import { devLog } from '@/lib/logger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Loader2, Eraser, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { brazilianStates } from '@/lib/states';
import { geocodeAddress } from '@/lib/geocoding';
import { calculateRoutes, type RouteResult } from '@/lib/routing';
import { CityAutocomplete } from '@/components/CityAutocomplete';
import type { LocationData } from '@/lib/spreadsheet';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const addressSchema = z.object({
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(1, 'Campo obrigatório'),
  state: z.string().min(1, 'Campo obrigatório'),
});

type AddressFormData = z.infer<typeof addressSchema>;

export interface SearchResult {
  name: string;
  distance: number;
  formattedDistance: string;
  durationMinutes?: number;
  formattedDuration?: string;
  searchInfo?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  services?: string;
  // Origin address for Google Maps directions
  originAddress?: string;
}

interface AddressFormProps {
  locations: LocationData[];
  onResults: (results: SearchResult[]) => void;
  onError: (error: string) => void;
  onSearchStart: () => void;
}

export function AddressForm({ locations, onResults, onError, onSearchStart }: AddressFormProps) {
  const { empresa } = useEmpresa();
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      cep: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
    },
  });

  const fetchAddressByCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return;
    }

    setIsFetchingCep(true);
    setCepError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      // Auto-fill the form fields
      form.setValue('street', data.logradouro || '');
      form.setValue('neighborhood', data.bairro || '');
      
      // Find the state value that matches the UF
      const stateMatch = brazilianStates.find(s => s.value === data.uf);
      if (stateMatch) {
        form.setValue('state', stateMatch.value);
      }
      
      // Set city after state (for autocomplete to work)
      form.setValue('city', data.localidade || '');

      setCepError(null);
    } catch (error) {
      devLog.error('Error fetching CEP:', error);
      setCepError('Erro ao buscar CEP. Preencha o endereço manualmente.');
    } finally {
      setIsFetchingCep(false);
    }
  }, [form]);

  const handleCepChange = useCallback((value: string) => {
    // Format CEP as user types (00000-000)
    const cleanValue = value.replace(/\D/g, '');
    let formattedValue = cleanValue;
    
    if (cleanValue.length > 5) {
      formattedValue = `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`;
    }
    
    form.setValue('cep', formattedValue);
    
    // Trigger API call when CEP is complete
    if (cleanValue.length === 8) {
      fetchAddressByCep(cleanValue);
    } else {
      setCepError(null);
    }
  }, [form, fetchAddressByCep]);

  const buildOriginAddress = (data: AddressFormData): string => {
    const stateName = brazilianStates.find(s => s.value === data.state)?.label || data.state;
    const parts = [
      data.street,
      data.number,
      data.neighborhood,
      data.city,
      stateName,
      'Brasil'
    ].filter(Boolean);
    return parts.join(', ');
  };

  const onSubmit = async (data: AddressFormData) => {
    if (locations.length === 0) {
      onError('Por favor, aguarde o carregamento dos prestadores.');
      return;
    }

    // Validate that at least city is filled (minimum required)
    if (!data.city?.trim() || !data.state?.trim()) {
      onError('Preencha pelo menos a cidade e o estado para realizar a busca.');
      return;
    }

    setIsSearching(true);
    onSearchStart();

    try {
      const stateName = brazilianStates.find(s => s.value === data.state)?.label || data.state;
      
      const coords = await geocodeAddress(
        data.street || '',
        data.number || '',
        data.neighborhood || '',
        data.city,
        stateName
      );

      if (!coords) {
        onError('Endereço não localizado. Tente informar mais detalhes como bairro ou CEP.');
        setIsSearching(false);
        return;
      }

      // Calculate real route distances using OSRM
      if (!empresa?.id) {
        onError('Sessão da empresa não encontrada. Por favor, faça login novamente.');
        setIsSearching(false);
        return;
      }

      const routeResults = await calculateRoutes(
        coords.lat,
        coords.lon,
        locations,
        empresa.id
      );

      const originAddress = buildOriginAddress(data);

      // Map to SearchResult format and filter locations > 40km
      const MAX_DISTANCE_KM = 40;
      const sortedLocations = routeResults
        .map((route: RouteResult) => ({
          name: route.name,
          distance: route.distanceKm,
          formattedDistance: route.formattedDistance,
          durationMinutes: route.durationMinutes,
          formattedDuration: route.formattedDuration,
          searchInfo: coords.searchUsed !== 'endereço completo' ? coords.searchUsed : undefined,
          address: route.address,
          number: route.number,
          neighborhood: route.neighborhood,
          city: route.city,
          state: route.state,
          services: route.services,
          originAddress,
        }))
        .filter((location) => location.distance <= MAX_DISTANCE_KM);

      onResults(sortedLocations);
    } catch (error) {
      devLog.error('Search error:', error);
      let errorMessage = 'Ocorreu um erro ao buscar os locais. Por favor, tente novamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        } else {
          errorMessage = error.message;
        }
      }
      
      onError(errorMessage);
    } finally {
    setIsSearching(false);
    }
  };

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LocalizAI/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar endereço');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      devLog.error('Reverse geocoding error:', error);
      throw error;
    }
  }, []);

  const handleUseMyLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      onError('Seu navegador não suporta geolocalização.');
      return;
    }

    if (locations.length === 0) {
      onError('Por favor, aguarde o carregamento dos prestadores.');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get address
          const geoData = await reverseGeocode(latitude, longitude);
          
          if (!geoData || !geoData.address) {
            onError('Não foi possível identificar seu endereço. Preencha manualmente.');
            setIsGettingLocation(false);
            return;
          }

          const address = geoData.address;
          
          // Map state abbreviation from Nominatim
          const stateCode = address['ISO3166-2-lvl4']?.replace('BR-', '') || '';
          const stateMatch = brazilianStates.find(s => s.value === stateCode);
          
          // Fill form fields
          if (stateMatch) {
            form.setValue('state', stateMatch.value);
          }
          
          form.setValue('city', address.city || address.town || address.municipality || address.village || '');
          form.setValue('neighborhood', address.suburb || address.neighbourhood || address.quarter || '');
          form.setValue('street', address.road || '');
          form.setValue('number', address.house_number || '');
          
          // Try to get CEP from postcode
          if (address.postcode) {
            const cleanCep = address.postcode.replace(/\D/g, '');
            if (cleanCep.length === 8) {
              const formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}`;
              form.setValue('cep', formattedCep);
            }
          }

          setIsGettingLocation(false);
          
          // Automatically trigger search
          form.handleSubmit(onSubmit)();
          
        } catch (error) {
          devLog.error('Location error:', error);
          onError('Erro ao obter seu endereço. Tente novamente ou preencha manualmente.');
          setIsGettingLocation(false);
        }
      },
      (error) => {
        setIsGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            onError('Permissão de localização negada. Habilite nas configurações do navegador.');
            break;
          case error.POSITION_UNAVAILABLE:
            onError('Localização indisponível. Tente novamente.');
            break;
          case error.TIMEOUT:
            onError('Tempo esgotado ao obter localização. Tente novamente.');
            break;
          default:
            onError('Erro ao obter localização. Tente novamente.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [form, locations.length, onError, onSubmit, reverseGeocode]);

  const isDisabled = locations.length === 0;
  const selectedState = form.watch('state');

  return (
    <Card>
      <CardHeader className="flex flex-col space-y-3 pb-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Preencha o endereço</CardTitle>
          <Button 
            type="button" 
            variant="ghost"
            size="sm"
            onClick={() => {
              form.reset({
                cep: '',
                street: '',
                number: '',
                neighborhood: '',
                city: '',
                state: '',
              });
              setCepError(null);
            }}
            disabled={isDisabled || isSearching || isGettingLocation}
            className="text-muted-foreground hover:text-foreground"
          >
            <Eraser className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          disabled={isDisabled || isSearching || isGettingLocation}
          className="w-full"
        >
          {isGettingLocation ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Obtendo localização...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Usar minha localização
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CEP Field - First field */}
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center overflow-hidden">
                        <Input 
                          placeholder="00000-000" 
                          {...field}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          disabled={isDisabled}
                          inputMode="numeric"
                          pattern="[0-9]{5}-?[0-9]{3}"
                          autoComplete="off"
                          className={cepError ? 'border-destructive pr-10' : 'pr-10'}
                        />
                        {isFetchingCep && (
                          <div className="absolute right-3 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    {cepError && (
                      <p className="text-sm text-destructive">{cepError}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Number Field - Second field, same row as CEP */}
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: 123" 
                        {...field} 
                        disabled={isDisabled}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Street Field - Full width */}
              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Endereço (Rua/Avenida)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Rua das Flores" 
                        {...field} 
                        disabled={isDisabled}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Neighborhood Field */}
              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Centro" 
                        {...field} 
                        disabled={isDisabled}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City Field with Autocomplete */}
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <CityAutocomplete
                        value={field.value}
                        onChange={field.onChange}
                        stateCode={selectedState}
                        disabled={isDisabled}
                        placeholder="Ex: São Paulo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* State Field */}
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Clear city when state changes
                        form.setValue('city', '');
                      }} 
                      value={field.value}
                      disabled={isDisabled}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brazilianStates.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-navy hover:bg-navy/90" 
              disabled={isDisabled || isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Buscar Clínicas
                </>
              )}
            </Button>

            {isDisabled && (
              <p className="text-sm text-muted-foreground text-center">
                Importe uma planilha para habilitar a busca
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
