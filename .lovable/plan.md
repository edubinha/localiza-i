
# Plano: Corrigir Funcionalidade "Usar Minha Localização"

## Objetivo
Resolver o problema de endereços incorretos retornados pelo botão "Usar minha localização", melhorando a precisão e o feedback ao usuário.

---

## Mudanças Propostas

### 1. Verificar e Exibir Precisão da Geolocalização
Adicionar verificação da propriedade `accuracy` retornada pelo navegador e alertar o usuário quando a precisão for baixa.

**Comportamento:**
- Se `accuracy > 500 metros`: Mostrar aviso de que a localização pode ser imprecisa
- Permitir que o usuário confirme/corrija o endereço antes da busca

### 2. Melhorar Mapeamento dos Campos do Nominatim
Expandir o mapeamento para incluir todos os campos possíveis que o Nominatim pode retornar para endereços brasileiros:

| Campo do Form | Campos Nominatim (ordem de prioridade) |
|---------------|----------------------------------------|
| city | city → town → city_district → municipality → village |
| state | state (texto) → ISO3166-2-lvl4 |
| neighborhood | suburb → neighbourhood → quarter → hamlet |
| street | road → pedestrian → footway |

### 3. Validar CEP via ViaCEP
Após obter o endereço do Nominatim, usar a API ViaCEP para validar/completar o endereço quando o CEP estiver disponível. Isso garante dados mais precisos.

### 4. Feedback Visual do Endereço Obtido
Não realizar a busca automaticamente. Em vez disso:
- Preencher os campos do formulário
- Mostrar um toast informando que o endereço foi preenchido
- Permitir que o usuário revise e corrija antes de buscar manualmente

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/AddressForm.tsx` | Atualizar `handleUseMyLocation` com validação de precisão, melhorar mapeamento do Nominatim, e remover auto-submit |

---

## Detalhes Técnicos

### Verificação de Precisão
```typescript
navigator.geolocation.getCurrentPosition(
  async (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Alertar se precisão for baixa (> 500m)
    if (accuracy > 500) {
      toast.warning('Localização aproximada detectada. Revise o endereço antes de buscar.');
    }
    // ... resto do código
  }
);
```

### Mapeamento Expandido
```typescript
const address = geoData.address;

// Cidade - mais opções
const city = address.city || address.town || address.city_district || 
             address.municipality || address.village || '';

// Estado - preferir texto quando disponível
const stateText = address.state;
const stateCode = address['ISO3166-2-lvl4']?.replace('BR-', '') || '';
const stateMatch = brazilianStates.find(s => 
  s.value === stateCode || 
  s.label.toLowerCase() === stateText?.toLowerCase()
);

// Bairro - mais opções
const neighborhood = address.suburb || address.neighbourhood || 
                     address.quarter || address.hamlet || '';

// Rua - mais opções
const street = address.road || address.pedestrian || address.footway || '';
```

### Remover Auto-Submit
Em vez de executar `form.handleSubmit(onSubmit)()` automaticamente, mostrar um toast:
```typescript
toast.success('Endereço preenchido! Revise os campos e clique em Buscar Clínicas.');
```

---

## Resultado Esperado
- O usuário receberá feedback sobre a precisão da localização
- Os campos do endereço serão preenchidos com maior precisão
- O usuário terá a oportunidade de revisar/corrigir antes de buscar
- Redução significativa de endereços incorretos
