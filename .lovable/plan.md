
# Plano: Otimização de Performance da Busca

## Objetivo

Acelerar o carregamento dos resultados sem comprometer a estabilidade da aplicação, reduzindo o tempo total de ~4-5 segundos para ~1.5-2 segundos.

---

## Gargalos Identificados

| Componente | Problema | Impacto |
|------------|----------|---------|
| Edge Function | Chamadas OSRM sequenciais | ~3.5s de delays |
| Edge Function | Delays entre requests | Conservador demais |
| Geocodificação | 5 estratégias sequenciais | ~500ms-2s por busca |

---

## Otimizações Propostas

### 1. Paralelizar chamadas OSRM dentro dos batches

**Arquivo:** `supabase/functions/calculate-routes/index.ts`

**Antes:** Processar 1 rota por vez dentro do batch
```typescript
for (const location of batch) {
  const route = await getRouteDistanceWithRetry(...);
  await sleep(100); // Delay sequencial
}
```

**Depois:** Processar todas as rotas do batch em paralelo
```typescript
const batchPromises = batch.map(location => 
  getRouteDistanceWithRetry(...)
);
const batchResults = await Promise.all(batchPromises);
```

---

### 2. Reduzir delays entre batches

**Arquivo:** `supabase/functions/calculate-routes/index.ts`

| Parâmetro | Atual | Otimizado |
|-----------|-------|-----------|
| Delay entre batches | 500ms | 200ms |
| Tamanho do batch | 5 | 5 (manter) |

---

### 3. Usar OSRM Table API para múltiplas rotas

**Arquivo:** `supabase/functions/calculate-routes/index.ts`

A OSRM oferece uma API Table que calcula distâncias de um ponto para múltiplos destinos em uma única chamada HTTP.

**Antes:** 20 chamadas HTTP (uma por destino)
**Depois:** 1-4 chamadas HTTP (múltiplos destinos por chamada)

Endpoint: `/table/v1/driving/lon1,lat1;lon2,lat2;...?sources=0&annotations=distance,duration`

---

### 4. Otimizar geocodificação com estratégias paralelas seletivas

**Arquivo:** `src/lib/geocoding.ts`

Para casos com endereço completo, executar estratégias 1 e 2 em paralelo:

```typescript
// Se temos street e number, tentar ambos simultaneamente
const [fullResult, streetOnlyResult] = await Promise.all([
  tryStructuredGeocode({ street: streetWithNumber, city, state }),
  tryStructuredGeocode({ street, city, state })
]);
```

---

## Estimativa de Ganhos

| Métrica | Atual | Otimizado | Melhoria |
|---------|-------|-----------|----------|
| Tempo total | 4-5s | 1.5-2s | ~60% mais rápido |
| Chamadas HTTP OSRM | 20 | 4-5 | 75% menos |
| Delays totais | ~3.5s | ~0.8s | 77% menos |

---

## Alterações Detalhadas

### Arquivo: `supabase/functions/calculate-routes/index.ts`

1. **Nova função para OSRM Table API**
   - Calcula distâncias de 1 origem para N destinos em uma única chamada
   - Fallback para chamadas individuais se a Table API falhar

2. **Remover delays sequenciais dentro dos batches**
   - Processar em paralelo com Promise.all

3. **Reduzir delay entre batches**
   - 500ms → 200ms

### Arquivo: `src/lib/geocoding.ts`

1. **Paralelizar estratégias iniciais**
   - Quando street e number existem, testar estratégias 1 e 2 simultaneamente

---

## Considerações de Estabilidade

- Manter retry com backoff exponencial para rate limiting
- OSRM Table API tem limite de ~100 pontos por chamada (usaremos 10)
- Fallback automático para método sequencial se API Table falhar
- Logs detalhados para monitoramento

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/calculate-routes/index.ts` | Implementar Table API + paralelização |
| `src/lib/geocoding.ts` | Paralelizar estratégias iniciais |
