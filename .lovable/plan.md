
# Plano: Migrar de Google Maps para OpenStreetMap + OpenRouteService

## Resumo

Remoção completa de todas as APIs do Google Maps e implementação de alternativas open-source:
- **Geocodificação**: Nominatim (OpenStreetMap) - exclusivo
- **Cálculo de rotas**: OpenRouteService (ORS) - primário, OSRM - fallback

---

## Pré-requisito: Adicionar Segredo da API

O segredo `OPENROUTESERVICE_API_KEY` será adicionado com a chave fornecida:
```
eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdmMDU2ZmZhMjJjYTQzZjhiMGM5MTBlZDEzN2UwZmVhIiwiaCI6Im11cm11cjY0In0=
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/lib/geocoding.ts` | MODIFICAR | Remover `tryGoogleGeocode`, usar apenas Nominatim |
| `supabase/functions/calculate-routes/index.ts` | MODIFICAR | Substituir Google Distance Matrix por OpenRouteService |
| `supabase/functions/geocode-address/index.ts` | DELETAR | Remover Edge Function do Google Geocoding |

---

## Detalhes das Alterações

### 1. src/lib/geocoding.ts

**Remover:**
- Função `tryGoogleGeocode` (linhas 14-45)
- Import do `supabase` (não será mais necessário)
- Chamada ao Google como primeira estratégia

**Manter:**
- Funções Nominatim existentes (`tryStructuredGeocode`, `tryFreeTextGeocode`)
- Cache em memória
- Estratégias progressivas de fallback

**Nova lógica:**
```text
1. Verificar cache
2. Nominatim: endereço completo (rua + número)
3. Nominatim: endereço sem número
4. Nominatim: busca por bairro
5. Nominatim: cidade + estado
6. Nominatim: busca textual (fallback final)
```

### 2. supabase/functions/calculate-routes/index.ts

**Remover:**
- Função `getGoogleDistanceMatrix` (linhas 217-278)
- Referências ao Google no `processBatchWithTableAPI`

**Adicionar:**
- Função `getOpenRouteServiceMatrix` para chamar a API ORS

**Nova lógica de cálculo:**
```text
1. Tentar OpenRouteService Matrix API (primário)
2. Fallback para OSRM Table API (gratuito)
3. Fallback para OSRM Route individual (último recurso)
```

**Formato da requisição ORS:**
```json
{
  "locations": [[lon, lat], [lon, lat], ...],
  "sources": [0],
  "destinations": [1, 2, 3, ...],
  "metrics": ["distance", "duration"]
}
```

### 3. Deletar supabase/functions/geocode-address/

Esta Edge Function usava exclusivamente a Google Geocoding API e não é mais necessária, pois o frontend agora usa Nominatim diretamente.

---

## Arquitetura Final

```text
FRONTEND
  geocoding.ts
    |
    +-- tryStructuredGeocode (Nominatim)
    +-- tryFreeTextGeocode (Nominatim)
    +-- Cache em memória
    |
    v
EDGE FUNCTION (calculate-routes)
    |
    +-- Pre-filtro Haversine (60km)
    +-- OpenRouteService Matrix API  <-- PRIMÁRIO
    +-- OSRM Table API               <-- FALLBACK 1
    +-- OSRM Route individual        <-- FALLBACK 2
```

---

## Benefícios

| Aspecto | Antes (Google) | Depois (ORS + Nominatim) |
|---------|----------------|--------------------------|
| Custo | $5/1000 elementos | Gratuito (até 2000 req/dia) |
| Dependência | Proprietário | Open-source |
| Fallback | OSRM | OSRM (mantido) |
| Precisão | Alta | Alta |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Limite de 2000 req/dia no ORS | OSRM como fallback automático |
| Nominatim rate limiting | Cache em memória implementado |
| Dados menos atualizados | ORS usa dados OSM frequentemente atualizados |

---

## Segurança

- A chave do ORS será armazenada como segredo no backend
- Nenhuma API key exposta no frontend
- CORS restritivo mantido
