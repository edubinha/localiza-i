

# Plano: Melhorar Validação de Cidade/Estado na Busca Textual

## Problema Identificado

A função `tryFreeTextGeocode` valida resultados usando `includes()`, que é insuficiente para distinguir bairros homônimos:

```typescript
// Validação atual (problemática)
if (displayLower.includes(cityLower) && displayLower.includes(stateLower)) {
  return result;
}
```

### Exemplos de Falhas

| Busca | Resultado Incorreto | Motivo |
|-------|---------------------|--------|
| Centro, Campinas, SP | Centro de outra cidade | "Campinas" aparece em outro contexto |
| Vila Nova, Santos, SP | Vila Nova de cidade diferente | Match parcial no display_name |

---

## Solução Proposta

Implementar uma validação mais rigorosa usando a **API de dados estruturados** do Nominatim, que retorna campos separados para cidade e estado através do parâmetro `addressdetails=1`.

### Mudanças na API

Adicionar `addressdetails=1` na query para receber:

```json
{
  "lat": "-23.589",
  "lon": "-46.636",
  "display_name": "Vila Mariana, São Paulo, SP, Brasil",
  "address": {
    "suburb": "Vila Mariana",
    "city": "São Paulo",
    "state": "São Paulo",
    "country": "Brasil"
  }
}
```

---

## Alterações Técnicas

### Arquivo: `src/lib/geocoding.ts`

1. **Atualizar interface de resposta**
   - Adicionar campos de `address` (suburb, city, state, etc.)

2. **Modificar `tryFreeTextGeocode`**
   - Adicionar `addressdetails=1` na URL
   - Validar usando campos estruturados em vez de `includes()`

3. **Implementar validação robusta**
   - Comparar `address.city` diretamente com a cidade informada
   - Comparar `address.state` diretamente com o estado informado
   - Normalizar strings para comparação (remover acentos, lowercase)

### Código Proposto

```typescript
interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

// Função para normalizar strings (remover acentos)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Na função tryFreeTextGeocode:
const url = `...&addressdetails=1`;

// Validação melhorada
for (const result of data) {
  if (!result.address) continue;
  
  // Nominatim usa diferentes campos para cidade
  const resultCity = result.address.city || 
                     result.address.town || 
                     result.address.municipality;
  const resultState = result.address.state;
  
  if (resultCity && resultState) {
    const cityMatch = normalizeString(resultCity) === normalizeString(city);
    const stateMatch = normalizeString(resultState).includes(normalizeString(state));
    
    if (cityMatch && stateMatch) {
      return { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
    }
  }
}
```

---

## Nova Lógica de Validação

```text
1. Busca textual retorna múltiplos resultados
       |
       v
2. Para cada resultado, verifica address.city === cidade informada
       |
       v
3. Verifica address.state contém estado informado
       |
       v
4. Se ambos correspondem, retorna coordenadas
       |
       v
5. Se nenhum corresponde, retorna null (tenta próxima estratégia)
```

---

## Comportamento Esperado

| Busca | Antes | Depois |
|-------|-------|--------|
| Centro, Campinas, SP | Podia retornar Centro de SP | Retorna Centro de Campinas |
| Vila Mariana, São Paulo, SP | Funcionava | Continua funcionando |
| Centro, Santos, SP | Podia confundir | Retorna Centro de Santos |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/geocoding.ts` | Adicionar `addressdetails=1`, interface de endereço, validação estruturada |

