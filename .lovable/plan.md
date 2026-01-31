

# Plano: Suporte às Colunas "ID" e "Situação"

## Objetivo

Adicionar suporte às novas colunas "ID" e "Situação" na planilha, filtrando silenciosamente os locais inativos.

---

## Alterações

### Arquivo: `src/lib/spreadsheet.ts`

**1. Adicionar mapeamento da coluna "Situação"**

Na função `parseRows`, adicionar busca pela coluna de status:

```typescript
const statusColIndex = findColumn(headers, ['situação', 'situacao', 'status']);
```

**2. Filtrar locais inativos silenciosamente**

No loop de parsing, antes de processar o nome, verificar o status:

```typescript
// Check status column - skip inactive locations silently
if (statusColIndex !== -1) {
  const statusValue = String(row[statusColIndex] || '').trim().toLowerCase();
  const normalizedStatus = statusValue.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Only include locations with "ativo" status
  if (normalizedStatus !== 'ativo') {
    continue;
  }
}
```

---

### Arquivo: `public/modelo-prestadores.csv`

Atualizar estrutura com as novas colunas ID e Situação:

```csv
Nome do local,ID,Situação,CEP,Endereço (logradouro),Número,Bairro,Cidade,Estado (UF),Latitude,Longitude
Clínica São Lucas,001,Ativo,01310-100,Avenida Paulista,1000,Bela Vista,São Paulo,SP,-23.5505,-46.6333
...
Clínica Vida Nova,005,Inativo,02012-000,Rua das Flores,300,Santana,São Paulo,SP,-23.5200,-46.6100
...
```

---

## Comportamento

| Situação | Resultado |
|----------|-----------|
| "Ativo" | Incluído na busca |
| "ativo" | Incluído (case insensitive) |
| "Inativo" | Ignorado silenciosamente |
| Célula vazia | Ignorado silenciosamente |
| Coluna não existe | Todos incluídos (compatibilidade) |

---

## Notas

- A coluna "ID" será ignorada (não precisa de mapeamento)
- Locais inativos não serão mencionados na mensagem de sucesso
- A mensagem mostrará apenas os locais ativos carregados

