
# Plano: Corrigir Geocodificacao para Bairros Homonimos

## Problema Identificado

A funcao `tryGeocode` em `src/lib/geocoding.ts` usa apenas o parametro `q=` (busca textual livre) do Nominatim. Isso causa ambiguidade quando bairros com o mesmo nome existem em cidades diferentes (ex: "Centro" em Sao Paulo vs "Centro" em Campinas).

Atualmente, a validacao e feita apenas verificando se o nome da cidade aparece no `display_name` retornado, o que nao e 100% confiavel.

## Solucao Proposta

Usar a **API de busca estruturada** do Nominatim, que permite especificar parametros separados para rua, cidade, estado e pais. Isso garante que a busca seja restrita a localidade correta.

---

## Alteracoes Tecnicas

### Arquivo: `src/lib/geocoding.ts`

1. **Criar nova funcao `tryStructuredGeocode`**
   - Usa parametros estruturados: `street`, `city`, `state`, `country`
   - Nao mistura com `q=` (o Nominatim nao permite combinacao)

2. **Atualizar estrategia de fallback**
   - Priorizar busca estruturada
   - Manter busca textual como fallback de ultimo recurso

### Nova Estrutura de Fallback

```text
Estrategia 1: Busca estruturada com rua + numero + cidade + estado
     |
     v (se falhar)
Estrategia 2: Busca estruturada com rua + cidade + estado (sem numero)
     |
     v (se falhar)
Estrategia 3: Busca estruturada com bairro + cidade + estado
     |
     v (se falhar)
Estrategia 4: Busca estruturada apenas cidade + estado
     |
     v (se falhar)
Estrategia 5: Busca textual livre (fallback final)
```

---

## Exemplo de URL Estruturada

Formato atual (problematico):
```text
/search?q=Centro, Campinas, Sao Paulo, Brasil
```

Novo formato (estruturado):
```text
/search?street=Centro&city=Campinas&state=Sao Paulo&country=Brasil
```

---

## Codigo Proposto

```typescript
async function tryStructuredGeocode(params: {
  street?: string;
  city: string;
  state: string;
  country?: string;
}): Promise<{ lat: number; lon: number } | null> {
  const searchParams = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  });
  
  if (params.street) searchParams.set('street', params.street);
  searchParams.set('city', params.city);
  searchParams.set('state', params.state);
  if (params.country) searchParams.set('country', params.country);
  
  const url = `https://nominatim.openstreetmap.org/search?${searchParams}`;
  // ... fetch and return result
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/geocoding.ts` | Adicionar funcao de busca estruturada e atualizar fluxo de fallback |

---

## Comportamento Esperado

| Situacao | Antes | Depois |
|----------|-------|--------|
| Bairro "Centro" em Campinas-SP | Podia retornar Centro de outra cidade | Retorna exatamente Centro de Campinas-SP |
| Bairro "Jardim America" em duas cidades | Ambiguidade | Usa cidade/estado para desambiguar |
| Endereco nao encontrado | Erro | Tenta fallback estruturado antes de falhar |

---

## Validacao Adicional

Apos receber o resultado, validar que:
1. A cidade retornada corresponde a cidade solicitada
2. O estado retornado corresponde ao estado solicitado

Se a validacao falhar, tentar a proxima estrategia de fallback.
