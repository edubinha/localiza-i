import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Loader2, Eraser } from 'lucide-react';
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
}

interface AddressFormProps {
  locations: LocationData[];
  onResults: (results: SearchResult[]) => void;
  onError: (error: string) => void;
  onSearchStart: () => void;
}

export function AddressForm({ locations, onResults, onError, onSearchStart }: AddressFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
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
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResponse = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      // Auto-fill the form fields
      form.setValue('street', data.logradouro || '');
      form.setValue('neighborhood', data.bairro || '');
      form.setValue('city', data.localidade || '');
      
      // Find the state value that matches the UF
      const stateMatch = brazilianStates.find(s => s.value === data.uf);
      if (stateMatch) {
        form.setValue('state', stateMatch.value);
      }

      setCepError(null);
    } catch (error) {
      console.error('Error fetching CEP:', error);
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

  const onSubmit = async (data: AddressFormData) => {
    if (locations.length === 0) {
      onError('Por favor, importe uma planilha com os locais antes de buscar.');
      return;
    }

    setIsSearching(true);
    onSearchStart();

    try {
      const stateName = brazilianStates.find(s => s.value === data.state)?.label || data.state;
      
      const coords = await geocodeAddress(
        data.street,
        data.number,
        data.neighborhood,
        data.city,
        stateName
      );

      if (!coords) {
        onError('Não foi possível encontrar as coordenadas do endereço informado. Por favor, verifique os dados e tente novamente.');
        setIsSearching(false);
        return;
      }

      // Calculate real route distances using OSRM
      const routeResults = await calculateRoutes(
        coords.lat,
        coords.lon,
        locations
      );

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
        }))
        .filter((location) => location.distance <= MAX_DISTANCE_KM);

      onResults(sortedLocations);
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro ao buscar os locais. Por favor, tente novamente.';
      onError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const isDisabled = locations.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Informe o endereço</CardTitle>
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
              {/* CEP Field - First field */}
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="00000-000" 
                          {...field}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          disabled={isDisabled}
                          className={cepError ? 'border-destructive' : ''}
                        />
                        {isFetchingCep && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: São Paulo" 
                        {...field} 
                        disabled={isDisabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
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
                  Buscar Prestadores
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
