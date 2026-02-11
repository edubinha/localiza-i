

## Correção: Separador CSV para Excel (pt-BR)

### Problema
O Excel em localidades que usam vírgula como separador decimal (como pt-BR) interpreta **ponto-e-vírgula** (`;`) como delimitador de colunas, não a vírgula. Por isso, todos os dados ficam em uma única célula.

### Solução
Alterar o separador no `handleDownloadCSV` de `,` para `;` em `src/pages/Index.tsx`.

---

### Detalhes Técnicos

**Arquivo:** `src/pages/Index.tsx`

1. Na funcao `escapeField`, trocar a verificacao de `,` por `;`
2. Nas linhas que fazem `.join(',')`, trocar por `.join(';')`

Sao apenas 3 pontos de alteracao dentro da funcao `handleDownloadCSV`:
- `field.includes(',')` -> `field.includes(';')`
- `headers.map(escapeField).join(',')` -> `headers.map(escapeField).join(';')`
- `row.map(escapeField).join(',')` -> `row.map(escapeField).join(';')`

