
# Plano: Corrigir Geocodificacao de Bairros

## Problema Identificado

Quando o usuario digita apenas o bairro (ex: "Vila Mariana") sem rua, a logica atual tenta usar o bairro no campo `street` da API Nominatim. Isso falha porque:

1. Nominatim nao reconhece bairros no parametro `street`
2. O fallback vai para "cidade + estado", retornando o centro de Sao Paulo
3. Os resultados mostram prestadores proximos ao centro da cidade, nao do bairro

Quando o CEP e usado, funciona porque o ViaCEP preenche a rua automaticamente.

---

## Solucao Proposta

Adicionar uma nova estrategia de busca textual especifica para bairros, ANTES de cair no fallback de cidade/estado. A busca textual livre do Nominatim consegue encontrar bairros quando formatados corretamente.

### Nova Ordem de Fallback

```text
Estrategia 1: Estruturada (Rua + Numero + Cidade + Estado)
     |
     v (se falhar)
Estrategia 2: Estruturada (Rua + Cidade + Estado)
     |
     v (se falhar)
Estrategia 3: Busca textual para BAIRRO (Nova!)
              Query: "Vila Mariana, Sao Paulo, Sao Paulo, Brasil"
              Validacao: confirma cidade/estado no resultado
     |
     v (se falhar)
Estrategia 4: Estruturada (Cidade + Estado)
     |
     v (se falhar)
Estrategia 5: Busca textual livre (fallback final)
```

---

## Alteracoes Tecnicas

### Arquivo: `src/lib/geocoding.ts`

1. **Remover a Estrategia 3 atual** (bairro como `street`)
   - Esta abordagem nao funciona com o Nominatim

2. **Adicionar nova Estrategia 3** - Busca textual para bairro
   - Usar `tryFreeTextGeocode` com query: `"bairro, cidade, estado, Brasil"`
   - Validar que o resultado contem a cidade e estado corretos
   - Isso permite encontrar bairros como entidades geograficas

3. **Ajustar mensagem de `searchUsed`**
   - Informar ao usuario quando a busca foi feita pelo bairro

### Codigo Proposto

```typescript
// Estrategia 3: Busca textual para bairro (nao estruturada)
// Nominatim encontra bairros melhor em busca livre
if (!result && neighborhood) {
  const neighborhoodQuery = `${neighborhood}, ${city}, ${state}, Brasil`;
  result = await tryFreeTextGeocode(neighborhoodQuery, city, state);
  if (result) {
    searchUsed = 'bairro (busca textual)';
  }
}
```

---

## Por Que Isso Funciona

A API Nominatim tem dois modos:
- **Estruturada**: campos separados (street, city, state) - bom para enderecos
- **Textual livre**: query unica (q=) - melhor para localidades como bairros

Bairros brasileiros sao mapeados no OpenStreetMap como `place=suburb` ou `place=neighbourhood`, e a busca textual consegue encontra-los quando combinados com cidade/estado.

---

## Exemplo de Funcionamento

| Campo preenchido | Antes | Depois |
|------------------|-------|--------|
| Bairro: Vila Mariana, Cidade: Sao Paulo | Retornava centro de SP | Retorna coordenadas da Vila Mariana |
| Bairro: Centro, Cidade: Campinas | Retornava centro de SP | Retorna centro de Campinas |
| Apenas Cidade: Sao Paulo | Retorna centro de SP | Comportamento mantido |

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/geocoding.ts` | Substituir Estrategia 3 por busca textual de bairro |

---

## Validacao

Apos a alteracao, a busca textual para bairro:
1. Monta query: `"Vila Mariana, Sao Paulo, Sao Paulo, Brasil"`
2. Busca no Nominatim com `q=` (busca livre)
3. Valida se o resultado contem "sao paulo" na cidade E no estado
4. Retorna coordenadas do bairro Vila Mariana (~-23.589, -46.636)
