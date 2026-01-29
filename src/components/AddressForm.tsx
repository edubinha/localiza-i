import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Loader2 } from 'lucide-react';
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

const addressSchema = z.object({
  street: z.string().min(3, 'Endereço deve ter pelo menos 3 caracteres'),
  number: z.string().min(1, 'Número é obrigatório'),
  neighborhood: z.string().min(2, 'Bairro deve ter pelo menos 2 caracteres'),
  city: z.string().min(2, 'Cidade deve ter pelo menos 2 caracteres'),
  state: z.string().min(2, 'Selecione um estado'),
});

type AddressFormData = z.infer<typeof addressSchema>;

export interface SearchResult {
  name: string;
  distance: number;
  formattedDistance: string;
  durationMinutes?: number;
  formattedDuration?: string;
}

interface AddressFormProps {
  locations: LocationData[];
  onResults: (results: SearchResult[]) => void;
  onError: (error: string) => void;
  onSearchStart: () => void;
}

export function AddressForm({ locations, onResults, onError, onSearchStart }: AddressFormProps) {
  const [isSearching, setIsSearching] = useState(false);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
    },
  });

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
      <CardHeader>
        <CardTitle className="text-lg">Informe o endereço</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      defaultValue={field.value}
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
