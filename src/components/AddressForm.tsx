import { useState, useCallback } from 'react';
import { useEmpresa } from '@/hooks/useEmpresa';
import { devLog } from '@/lib/logger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Loader2, Eraser } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
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
import { useToast } from '@/hooks/use-toast';


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
  latitude?: number;
  longitude?: number;
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
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10);
  const [cepError, setCepError] = useState<string | null>(null);

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
      let cepData: { logradouro: string; bairro: string; uf: string; localidade: string } | null = null;

      // Try ViaCEP with 3s timeout
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          if (!data.erro) {
            cepData = { logradouro: data.logradouro || '', bairro: data.bairro || '', uf: data.uf || '', localidade: data.localidade || '' };
          }
        }
      } catch (e) {
        devLog.log('ViaCEP failed, trying BrasilAPI fallback');
      }

      // Fallback: BrasilAPI
      if (!cepData) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, { signal: controller.signal });
          clearTimeout(timeout);

          if (response.ok) {
            const data = await response.json();
            cepData = { logradouro: data.street || '', bairro: data.neighborhood || '', uf: data.state || '', localidade: data.city || '' };
          }
        } catch (e) {
          devLog.log('BrasilAPI fallback also failed');
        }
      }

      if (!cepData) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      form.setValue('street', cepData.logradouro);
      form.setValue('neighborhood', cepData.bairro);
      
      const stateMatch = brazilianStates.find(s => s.value === cepData!.uf);
      if (stateMatch) {
        form.setValue('state', stateMatch.value);
      }
      
      form.setValue('city', cepData.localidade);
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

  // Reverse geocoding using Nominatim
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LocalizAI/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao obter endereço');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      devLog.error('Reverse geocoding error:', error);
      throw error;
    }
  }, []);

  // Geolocation handler
  const handleGeolocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocalização não suportada',
        description: 'Seu navegador não suporta geolocalização.',
        variant: 'destructive',
      });
      return;
    }

    setIsFetchingLocation(true);
    setCepError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      devLog.log('Geolocation obtained:', { latitude, longitude });

      // Reverse geocode the coordinates
      const addressData = await reverseGeocode(latitude, longitude);
      
      if (!addressData || !addressData.address) {
        throw new Error('Não foi possível obter o endereço');
      }

      const address = addressData.address;
      devLog.log('Reverse geocode result:', address);

      // Fill form fields
      const street = address.road || address.pedestrian || address.street || '';
      const neighborhood = address.suburb || address.neighbourhood || address.district || '';
      const city = address.city || address.town || address.municipality || address.village || '';
      const stateAbbr = address.state;

      form.setValue('street', street);
      form.setValue('neighborhood', neighborhood);
      form.setValue('city', city);

      // Find state by name and set it
      if (stateAbbr) {
        const stateMatch = brazilianStates.find(
          s => s.label.toLowerCase() === stateAbbr.toLowerCase() || 
               s.value.toLowerCase() === stateAbbr.toLowerCase()
        );
        if (stateMatch) {
          form.setValue('state', stateMatch.value);
        }
      }

      // Try to get CEP from postcode field
      const postcode = address.postcode;
      if (postcode) {
        const cleanPostcode = postcode.replace(/\D/g, '');
        if (cleanPostcode.length === 8) {
          const formattedCep = `${cleanPostcode.slice(0, 5)}-${cleanPostcode.slice(5)}`;
          form.setValue('cep', formattedCep);
        } else {
          // Focus CEP field if postcode is incomplete
          setTimeout(() => {
            const cepInput = document.querySelector('input[name="cep"]') as HTMLInputElement;
            cepInput?.focus();
          }, 100);
        }
      } else {
        // Focus CEP field if no postcode
        setTimeout(() => {
          const cepInput = document.querySelector('input[name="cep"]') as HTMLInputElement;
          cepInput?.focus();
        }, 100);
      }

      toast({
        title: 'Localização obtida',
        description: 'Endereço preenchido automaticamente.',
      });
    } catch (error) {
      devLog.error('Geolocation error:', error);
      
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast({
              title: 'Permissão negada',
              description: 'Ative a localização nas configurações do navegador para usar este recurso.',
              variant: 'destructive',
            });
            break;
          case error.POSITION_UNAVAILABLE:
            toast({
              title: 'Localização indisponível',
              description: 'Não foi possível obter sua localização. Tente novamente.',
              variant: 'destructive',
            });
            break;
          case error.TIMEOUT:
            toast({
              title: 'Tempo esgotado',
              description: 'A obtenção da localização demorou muito. Tente novamente.',
              variant: 'destructive',
            });
            break;
        }
      } else {
        toast({
          title: 'Erro ao obter localização',
          description: 'Não foi possível obter seu endereço. Preencha manualmente.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsFetchingLocation(false);
    }
  }, [form, reverseGeocode, toast]);

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

      // Map to SearchResult format and filter by search radius
      // Always apply the search radius filter (max is 50km)
      const sortedLocations = routeResults
        .map((route: RouteResult) => ({
          name: route.name,
          distance: route.distanceKm,
          formattedDistance: route.formattedDistance,
          durationMinutes: route.durationMinutes,
          formattedDuration: route.formattedDuration,
          searchInfo: coords.searchUsed !== 'endereço completo' ? coords.searchUsed : undefined,
          latitude: route.latitude,
          longitude: route.longitude,
          address: route.address,
          number: route.number,
          neighborhood: route.neighborhood,
          city: route.city,
          state: route.state,
          services: route.services,
          originAddress,
        }))
        .filter((location) => location.distance <= searchRadius);

      if (sortedLocations.length === 0) {
        toast({
          title: 'Nenhuma clínica encontrada',
          description: `Nenhum prestador foi encontrado no raio de ${searchRadius} km. Tente aumentar o raio de busca.`,
        });
      }

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

  const isDisabled = locations.length === 0;
  const selectedState = form.watch('state');

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
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
          disabled={isDisabled || isSearching}
          className="text-muted-foreground hover:text-foreground"
        >
          <Eraser className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CEP Field with Geolocation - First field */}
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <Input 
                          placeholder="00000-000" 
                          {...field}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          disabled={isDisabled || isFetchingLocation}
                          inputMode="numeric"
                          pattern="[0-9]{5}-?[0-9]{3}"
                          autoComplete="off"
                          className={`shadow-sm rounded-lg focus:ring-2 focus:ring-primary/20 ${cepError ? 'border-destructive' : ''}`}
                        />
                        {isFetchingCep && (
                          <div className="absolute right-2 flex items-center justify-center p-1">
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
                      {isFetchingCep ? (
                        <Skeleton className="h-10 w-full rounded-md" />
                      ) : (
                        <Input 
                          placeholder="Ex: Rua das Flores" 
                          {...field} 
                          disabled={isDisabled}
                          autoComplete="off"
                        />
                      )}
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
                      {isFetchingCep ? (
                        <Skeleton className="h-10 w-full rounded-md" />
                      ) : (
                        <Input 
                          placeholder="Ex: Centro" 
                          {...field} 
                          disabled={isDisabled}
                          autoComplete="off"
                        />
                      )}
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
                      {isFetchingCep ? (
                        <Skeleton className="h-10 w-full rounded-md" />
                      ) : (
                        <CityAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          stateCode={selectedState}
                          disabled={isDisabled}
                          placeholder="Ex: São Paulo"
                        />
                      )}
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
                        <SelectTrigger className="cursor-pointer text-sm">
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

            {/* Search Radius Slider */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-heading">
                  Raio de busca:{' '}
                  <span className="text-navy font-semibold">
                    {searchRadius} km
                  </span>
                </span>
              </div>
              <Slider
                value={[searchRadius]}
                onValueChange={(values) => setSearchRadius(values[0])}
                min={5}
                max={50}
                step={1}
                disabled={isDisabled}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 km</span>
                <span>50 km</span>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-navy hover:bg-navy/90 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" 
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
