
# Plano: Correção da Exibição do Estado (UF) nos Resultados

## Resumo

Corrigir a identificação da coluna "Estado (UF)" da planilha do Google Sheets para que o estado seja exibido corretamente nos resultados da busca.

---

## Diagnóstico

O código está correto nas funções de formatação (`formatLocation` e `formatFullAddress`), mas a coluna **"Estado (UF)"** não está sendo reconhecida no parser da planilha.

**Causa raiz**: A função `findColumn` busca por variações como `'uf'`, `'estado'` e `'state'`, mas o nome da coluna na planilha é **"Estado (UF)"** que, quando normalizado, fica `"estado (uf)"` — não correspondendo exatamente a nenhuma dessas opções.

---

## Solução

Adicionar a variação `"estado (uf)"` à lista de nomes possíveis para a coluna de estado no parser de planilha.

### Arquivo: `src/lib/spreadsheet.ts`

**Linha 75 - Alterar de:**
```typescript
const stateColIndex = findColumn(headers, ['uf', 'estado', 'state']);
```

**Para:**
```typescript
const stateColIndex = findColumn(headers, ['uf', 'estado', 'state', 'estado (uf)']);
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/spreadsheet.ts` | Adicionar `'estado (uf)'` à lista de nomes de coluna para estado |

---

## Impacto

- **Funcionalidade**: O estado passará a ser reconhecido e exibido corretamente em:
  - Linha de localização abaixo do nome (ex: "Bela Vista, São Paulo - SP")
  - Endereço completo (ex: "Avenida Paulista, 1000 - Bela Vista, São Paulo - SP")
- **Compatibilidade**: Mantém compatibilidade com planilhas que usam apenas "UF", "Estado" ou "State"
- **Sem quebras**: Alteração mínima e segura
