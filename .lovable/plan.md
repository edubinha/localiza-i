

# Plano: Substituir OSRM pela Google Distance Matrix API

## Visao Geral

Substituir o servico de calculo de rotas OSRM (OpenStreetMap) pela Google Distance Matrix API para obter distancias e tempos de viagem mais precisos e atualizados.

---

## Problema Atual

| Aspecto | OSRM (Atual) | Impacto |
|---------|--------------|---------|
| Dados de mapa | OpenStreetMap (pode estar desatualizado) | Rotas imprecisas |
| Trafego | Nao considera | Tempos irreais |
| Atualizacao | Depende de contribuicoes voluntarias | Mapas incompletos |
| Cobertura BR | Boa, mas inconsistente | Areas com dados antigos |

---

## Solucao Proposta

Usar a Google Distance Matrix API que oferece:

| Aspecto | Google Distance Matrix |
|---------|------------------------|
| Dados de mapa | Google Maps (atualizados constantemente) |
| Trafego | Opcional (tempo real ou historico) |
| Precisao | Alta, especialmente em areas urbanas |
| Cobertura BR | Excelente |

---

## Arquitetura Proposta

```text
Frontend (routing.ts)
        |
        v
+----------------------------+
| Edge Function              |
| calculate-routes           |
+----------------------------+
        |
        v
+----------------------------+
| Google Distance Matrix API |  <-- Novo servico
| (usando GOOGLE_GEOCODING_  |
|  API_KEY existente)        |
+----------------------------+
        |
    +---+---+
    |       |
 Sucesso  Falha
    |       |
    v       v
 Retorna  +-------------------+
 rotas    | OSRM              |  <-- Fallback gratuito
          | (codigo atual)    |
          +-------------------+
```

---

## Limites da API

A Google Distance Matrix API tem limites importantes:

| Limite | Valor |
|--------|-------|
| Maximo de destinos por requisicao | 25 |
| Maximo de elementos (origens x destinos) | 100 |
| Taxa | $5 por 1000 elementos |

**Estrategia de Otimizacao:**
1. Pre-filtrar com Haversine (distancia em linha reta) - ja implementado
2. Enviar apenas os 20-25 mais proximos para Google
3. Usar OSRM como fallback se Google falhar

---

## Comparacao de Custos

| Cenario | OSRM | Google Distance Matrix |
|---------|------|------------------------|
| 100 buscas/dia | Gratuito | ~$3/mes |
| 500 buscas/dia | Gratuito | ~$15/mes |
| 1000 buscas/dia | Gratuito | ~$30/mes |

*Considerando 20 destinos por busca = 20 elementos*

---

## Mudancas no Codigo

### Arquivo: supabase/functions/calculate-routes/index.ts

**Modificacoes:**

1. Adicionar funcao `getGoogleDistanceMatrix()` para chamar a API do Google
2. Modificar `processBatchWithTableAPI()` para tentar Google primeiro
3. Manter OSRM como fallback automatico
4. Usar a mesma `GOOGLE_GEOCODING_API_KEY` (funciona para Distance Matrix)

### Nenhuma alteracao necessaria no frontend

O arquivo `src/lib/routing.ts` permanece inalterado - a Edge Function ja retorna o mesmo formato de dados.

---

## Detalhes Tecnicos

### Requisicao Google Distance Matrix

```text
GET https://maps.googleapis.com/maps/api/distancematrix/json
  ?origins=-23.550520,-46.633308
  &destinations=-23.563987,-46.654106|-23.557842,-46.660429
  &mode=driving
  &language=pt-BR
  &key=API_KEY
```

### Resposta Esperada

```json
{
  "rows": [{
    "elements": [
      {
        "status": "OK",
        "distance": { "value": 3542, "text": "3.5 km" },
        "duration": { "value": 720, "text": "12 min" }
      },
      {
        "status": "OK",
        "distance": { "value": 5123, "text": "5.1 km" },
        "duration": { "value": 1080, "text": "18 min" }
      }
    ]
  }],
  "status": "OK"
}
```

---

## Fluxo de Processamento

```text
1. Receber requisicao com origem + ate 100 locais
          |
          v
2. Pre-filtrar: Haversine <= 60km, ordenar por distancia
          |
          v
3. Selecionar os 25 mais proximos
          |
          v
4. Chamar Google Distance Matrix API
          |
      +---+---+
      |       |
   Sucesso  Falha/Erro
      |       |
      v       v
5. Retornar   Fallback para OSRM
   resultados (codigo atual mantido)
```

---

## Vantagens do Fallback

| Situacao | Comportamento |
|----------|---------------|
| Google funciona | Usa Google (mais preciso) |
| Quota Google excedida | Usa OSRM automaticamente |
| Erro de rede Google | Usa OSRM automaticamente |
| API Key invalida | Usa OSRM automaticamente |

---

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| supabase/functions/calculate-routes/index.ts | MODIFICAR | Adicionar integracao com Google Distance Matrix, manter OSRM como fallback |

---

## Seguranca

| Aspecto | Status |
|---------|--------|
| API Key | Ja configurada (GOOGLE_GEOCODING_API_KEY) |
| Exposicao | Key protegida na Edge Function |
| CORS | Ja configurado corretamente |

---

## Resumo de Implementacao

### Fase 1: Modificar Edge Function
1. Adicionar funcao `getGoogleDistanceMatrix()`
2. Integrar com o fluxo existente
3. Manter OSRM como fallback

### Fase 2: Testes
1. Comparar resultados Google vs OSRM
2. Verificar precisao em enderecos conhecidos
3. Testar comportamento de fallback

### Fase 3: Monitoramento
1. Verificar logs para confirmar uso do Google
2. Monitorar custos no Google Cloud Console

---

## Nota Importante

A mesma API key usada para Geocoding (`GOOGLE_GEOCODING_API_KEY`) funciona para a Distance Matrix API, desde que ela esteja habilitada no Google Cloud Console.

**Voce precisara verificar:**
1. Acesse o Google Cloud Console
2. Navegue ate APIs e Servicos > Biblioteca
3. Procure por "Distance Matrix API"
4. Certifique-se de que esta **Habilitada**

Se nao estiver habilitada, basta clicar em "Habilitar" - a mesma API key funcionara.

