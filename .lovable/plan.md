
# Plano: Nome Dinâmico da Planilha via Célula A1

## Resumo

Implementar a leitura dinâmica do nome da planilha a partir da célula A1 do CSV exportado pelo Google Sheets. O nome lido será exibido tanto no botão de importação quanto após a planilha ser carregada.

---

## Estrutura Atual da Planilha

A planilha agora possui a seguinte estrutura:

| Linha | Conteúdo |
|-------|----------|
| 1 | Nome da planilha (ex: "Prestadores CONNAPA - Atualizado JAN-2026") |
| 2 | Cabeçalhos das colunas |
| 3+ | Dados dos prestadores |

---

## Alterações Necessárias

### 1. Atualizar Parser CSV (`src/lib/spreadsheet.ts`)

- Modificar a função `parseSpreadsheetText` para:
  - Extrair o nome da planilha da primeira linha (célula A1)
  - Ajustar o índice dos cabeçalhos para a linha 2
  - Ajustar o índice dos dados para a linha 3+
  - Retornar o nome extraído junto com os dados

- Atualizar a interface `ParseResult` para incluir:
```text
sheetName?: string  // Nome extraído da célula A1
```

### 2. Atualizar Componente de Upload (`src/components/FileUpload.tsx`)

- Modificar a função `handleLoadFromGoogleSheets` para:
  - Primeiro, buscar o CSV e extrair apenas o nome (linha 1)
  - Exibir esse nome no botão dinamicamente
  - Após carregamento completo, usar o nome extraído

- Adicionar um estado para armazenar o nome dinâmico:
```text
const [sheetName, setSheetName] = useState<string | null>(null);
```

- Fazer uma requisição inicial (ao montar o componente) para buscar apenas o nome

### 3. Fluxo de Funcionamento

```text
1. Componente monta
       |
       v
2. Busca CSV do Google Sheets (requisição leve)
       |
       v
3. Extrai nome da linha 1
       |
       v
4. Atualiza botão com nome dinâmico
       |
       v
5. Usuário clica no botão
       |
       v
6. Processa dados (linhas 2+)
       |
       v
7. Exibe nome no card de confirmação
```

---

## Detalhes Técnicos

### Modificações em `spreadsheet.ts`

1. Nova interface de retorno com campo `sheetName`
2. Função `parseRows` ajustada para receber offset de linha inicial
3. Função auxiliar `extractSheetName(csvText)` para extração rápida do nome

### Modificações em `FileUpload.tsx`

1. Hook `useEffect` para buscar o nome ao carregar a página
2. Estado `sheetName` para armazenar o nome dinâmico
3. Fallback para nome padrão caso a requisição falhe
4. Atualização do botão e do card de confirmação para usar `sheetName`

---

## Comportamento Esperado

| Situação | Comportamento |
|----------|---------------|
| Página carrega | Botão mostra "Carregando..." brevemente, depois exibe o nome da A1 |
| Nome na A1 alterado | Próxima visita à página mostra o novo nome |
| Falha na requisição | Mostra nome padrão ("Planilha CONNAPA") |
| Upload manual de arquivo | Continua funcionando normalmente (sem nome dinâmico) |

---

## Arquivos a Serem Modificados

- `src/lib/spreadsheet.ts` - Adicionar extração de nome e ajustar parsing
- `src/components/FileUpload.tsx` - Implementar busca dinâmica do nome

---

## Próximos Passos

Após aprovação, implementarei as alterações para que o nome definido na célula A1 da sua planilha Google Sheets seja automaticamente refletido na aplicação, tanto no botão quanto no card de confirmação após a importação.
