# Plano: Migração Completa - Google Maps → OpenStreetMap + OpenRouteService

## ✅ Status: CONCLUÍDO

---

## Resumo

Migração completa de todas as APIs do Google Maps para alternativas open-source:
- **Geocodificação**: Nominatim (OpenStreetMap) - exclusivo
- **Cálculo de rotas**: OpenRouteService (ORS) - primário, OSRM - fallback

---

## Alterações Realizadas

### 1. ✅ Segredo da API Adicionado
- `OPENROUTESERVICE_API_KEY` configurado no backend

### 2. ✅ src/lib/geocoding.ts
- Removida função `tryGoogleGeocode`
- Removido import do Supabase client
- Nominatim como único provedor de geocodificação
- Estratégias progressivas mantidas:
  1. Endereço completo (rua + número)
  2. Endereço sem número
  3. Busca por bairro
  4. Cidade + estado
  5. Busca textual (fallback)

### 3. ✅ supabase/functions/calculate-routes/index.ts
- Removida função `getGoogleDistanceMatrix`
- Adicionada função `getOpenRouteServiceMatrix` (primário)
- OSRM mantido como fallback gratuito
- Interface `DistanceMatrixResult.source` atualizada: `"ors" | "osrm"`

### 4. ✅ supabase/functions/geocode-address/
- Edge Function deletada (usava exclusivamente Google)

---

## Arquitetura Final

```text
FRONTEND
  geocoding.ts
    +-- tryStructuredGeocode (Nominatim)
    +-- tryFreeTextGeocode (Nominatim)
    +-- Cache em memória

EDGE FUNCTION (calculate-routes)
    +-- Pre-filtro Haversine (60km)
    +-- OpenRouteService Matrix API  ← PRIMÁRIO
    +-- OSRM Table API               ← FALLBACK 1
    +-- OSRM Route individual        ← FALLBACK 2
```

---

## Benefícios

| Aspecto | Antes (Google) | Depois (ORS + Nominatim) |
|---------|----------------|--------------------------|
| Custo | $5/1000 elementos | Gratuito (até 2000 req/dia) |
| Dependência | Proprietário | Open-source |
| Fallback | OSRM | OSRM (mantido) |
