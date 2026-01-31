

# Plano: Correção de Erros no Cálculo de Rotas

## Problema Identificado

A aplicação está falhando ao calcular rotas devido a um **problema de CORS (Cross-Origin Resource Sharing)**. A Edge Function está rejeitando requisições vindas do domínio de preview da aplicação.

---

## Diagnóstico Detalhado

### Causa Raiz do Erro Principal

| Aspecto | Valor Atual | Problema |
|---------|-------------|----------|
| Origem da requisição | `https://...lovableproject.com` | Domínio de desenvolvimento |
| Origens permitidas no CORS | `.lovable.app`, `localhost` | Não inclui `.lovableproject.com` |
| Resultado | Requisição bloqueada pelo navegador | Erro "Failed to fetch" |

A verificação CORS atual usa `origin.endsWith('.lovable.app')`, mas o domínio de preview é `.lovableproject.com`.

### Problema Secundário (Warning no Console)

O componente `ResultsList` está recebendo uma ref mas não é um componente que suporta refs (não usa `forwardRef`). Isso causa um warning no console.

---

## Alterações Planejadas

### 1. Corrigir CORS na Edge Function

**Arquivo:** `supabase/functions/calculate-routes/index.ts`

Atualizar a verificação de origens permitidas para incluir tanto `.lovable.app` quanto `.lovableproject.com`:

```text
Antes:
  origin.endsWith('.lovable.app')

Depois:
  origin.endsWith('.lovable.app') || origin.endsWith('.lovableproject.com')
```

### 2. Corrigir Warning de Ref no ResultsList

**Arquivo:** `src/components/ResultsList.tsx`

Atualizar o componente para usar `forwardRef` e evitar o warning do React:

```text
Antes:
  export function ResultsList({ results, isLoading, error }: ResultsListProps) { ... }

Depois:
  export const ResultsList = forwardRef<HTMLDivElement, ResultsListProps>(
    function ResultsList({ results, isLoading, error }, ref) { ... }
  );
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/calculate-routes/index.ts` | Adicionar `.lovableproject.com` à lista de origens CORS |
| `src/components/ResultsList.tsx` | Converter para `forwardRef` |

---

## Resultado Esperado

Após as correções:
- As requisições para calcular rotas funcionarão corretamente
- O warning de ref será eliminado do console
- A aplicação funcionará tanto em preview (`lovableproject.com`) quanto em produção (`lovable.app`)

