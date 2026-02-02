

# Plano: Implementar Google Geocoding API

## Visao Geral

Substituir o Nominatim pelo Google Geocoding API para maior precisao na conversao de enderecos em coordenadas, mantendo o Nominatim como fallback gratuito.

---

## Arquitetura Proposta

```text
Endereco do Usuario
        |
        v
+-------------------+
| Google Geocoding  |  <-- Primeira tentativa (mais preciso)
+-------------------+
        |
    +---+---+
    |       |
 Sucesso  Falha/Erro
    |       |
    v       v
 Retorna  +-------------------+
 coords   | Nominatim         |  <-- Fallback gratuito
          | (codigo atual)    |
          +-------------------+
                  |
                  v
              Retorna coords
              ou null
```

---

## Configuracao da API Key

### Passo 1: Adicionar Secret

A API key sera armazenada de forma segura no Lovable Cloud como um secret chamado `GOOGLE_GEOCODING_API_KEY`.

Voce precisara:
1. Acessar o Google Cloud Console
2. Habilitar a Geocoding API
3. Criar uma API key (recomendo restringir por dominio)
4. Informar a key quando solicitado

### Passo 2: Edge Function para Geocoding

Para proteger a API key (nao expor no frontend), criaremos uma Edge Function:

| Aspecto | Detalhe |
|---------|---------|
| Nome | geocode-address |
| Metodo | POST |
| Input | { street, number, neighborhood, city, state } |
| Output | { lat, lon, searchUsed } ou erro |

---

## Mudancas no Codigo

### Nova Edge Function: supabase/functions/geocode-address/index.ts

```text
POST /geocode-address
Body: { street, number, neighborhood, city, state }

1. Monta endereco completo
2. Chama Google Geocoding API
3. Valida resultado (cidade/estado corretos)
4. Retorna coordenadas
```

### Atualizacao: src/lib/geocoding.ts

```text
geocodeAddress()
    |
    v
Tenta Edge Function (Google)
    |
    +---+---+
    |       |
 Sucesso  Falha
    |       |
    v       v
 Retorna  Usa Nominatim
 coords   (codigo atual)
```

---

## Comparacao: Google vs Nominatim

| Aspecto | Google Geocoding | Nominatim |
|---------|------------------|-----------|
| Precisao | Alta (nivel numero) | Media (nivel rua) |
| Custo | $5 por 1000 requisicoes | Gratuito |
| Rate Limit | 50 req/segundo | 1 req/segundo |
| Cobertura BR | Excelente | Boa |
| Disponibilidade | 99.9% SLA | Sem SLA |

---

## Estrategia de Fallback

Para otimizar custos e garantir disponibilidade:

1. **Primeira tentativa**: Google Geocoding API
   - Mais preciso
   - Resposta rapida

2. **Fallback**: Nominatim (codigo atual)
   - Se Google falhar (erro de rede, quota excedida)
   - Gratuito, sem custo adicional

3. **Cache em memoria**: Mantido
   - Evita requisicoes duplicadas
   - Funciona para ambos os servicos

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| supabase/functions/geocode-address/index.ts | CRIAR | Edge Function com Google API |
| src/lib/geocoding.ts | MODIFICAR | Adicionar chamada a Edge Function |

---

## Seguranca

| Aspecto | Implementacao |
|---------|---------------|
| API Key | Armazenada como secret no Lovable Cloud |
| Exposicao | Key nunca exposta no frontend |
| Validacao | Edge Function valida origem da requisicao |
| Rate Limit | Controlado pelo Google (50/s) |

---

## Exemplo de Resposta Google Geocoding

```json
{
  "results": [{
    "geometry": {
      "location": {
        "lat": -23.5505199,
        "lng": -46.6333094
      },
      "location_type": "ROOFTOP"
    },
    "address_components": [
      { "types": ["street_number"], "long_name": "123" },
      { "types": ["route"], "long_name": "Avenida Paulista" },
      { "types": ["sublocality"], "long_name": "Bela Vista" },
      { "types": ["administrative_area_level_2"], "long_name": "Sao Paulo" },
      { "types": ["administrative_area_level_1"], "long_name": "SP" }
    ]
  }],
  "status": "OK"
}
```

O campo `location_type: "ROOFTOP"` indica precisao maxima (nivel do edificio).

---

## Resumo de Implementacao

### Fase 1: Configuracao
1. Solicitar API key ao usuario
2. Armazenar como secret `GOOGLE_GEOCODING_API_KEY`

### Fase 2: Edge Function
1. Criar `geocode-address` Edge Function
2. Implementar chamada a Google Geocoding API
3. Validar resposta (cidade/estado)

### Fase 3: Integracao
1. Atualizar `src/lib/geocoding.ts`
2. Chamar Edge Function primeiro
3. Manter Nominatim como fallback

### Fase 4: Testes
1. Testar enderecos conhecidos
2. Comparar precisao com Nominatim
3. Validar fallback funciona

---

## Custos Estimados

| Volume Mensal | Custo Google | Com Fallback |
|---------------|--------------|--------------|
| 1.000 buscas | ~$5 | ~$5 |
| 5.000 buscas | ~$25 | ~$20* |
| 10.000 buscas | ~$50 | ~$40* |

*Cache reduz requisicoes duplicadas em ~20%

