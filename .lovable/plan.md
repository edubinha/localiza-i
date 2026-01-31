

# Plano: Correção dos Campos CEP e Número

## Problemas Identificados

### 1. CEP - Erro de Validação do Pattern

| Aspecto | Situação |
|---------|----------|
| Valor do campo | `12345-678` (com hífen) |
| Pattern atual | `[0-9]*` (só aceita dígitos) |
| Resultado | Navegador bloqueia o submit |

O atributo `pattern="[0-9]*"` valida o conteúdo do campo, mas o CEP formatado inclui um hífen, causando falha na validação nativa do navegador.

### 2. Número - Teclado Fixo

O `inputMode="numeric"` em dispositivos iOS não oferece opção de alternar para teclado com letras. O teclado fica travado no modo numérico.

---

## Soluções

### Campo CEP

**Opção escolhida:** Atualizar o pattern para aceitar o formato com hífen.

```text
Antes:  pattern="[0-9]*"
Depois: pattern="[0-9]{5}-?[0-9]{3}"
```

Este pattern aceita:
- `12345678` (8 dígitos sem hífen)
- `12345-678` (5 dígitos, hífen, 3 dígitos)

### Campo Número

**Opção escolhida:** Remover o `inputMode="numeric"` para permitir o teclado padrão com possibilidade de alternar.

Como o campo Número precisa aceitar letras (ex: "123A", "S/N"), o teclado deve ser o alfanumérico padrão. O usuário pode digitar números normalmente, mas também tem acesso às letras quando necessário.

---

## Alterações no Código

**Arquivo:** `src/components/AddressForm.tsx`

### Linha 256 - Campo CEP
```tsx
// Antes
pattern="[0-9]*"

// Depois
pattern="[0-9]{5}-?[0-9]{3}"
```

### Linha 286 - Campo Número
```tsx
// Antes
inputMode="numeric"

// Depois (remover a linha)
// (sem inputMode - usa teclado padrão)
```

---

## Resumo das Alterações

| Campo | Alteração | Resultado |
|-------|-----------|-----------|
| CEP | Pattern atualizado para aceitar hífen | Validação funciona com formato "00000-000" |
| Número | Remover inputMode | Teclado alfanumérico com opção de alternar |

---

## Comportamento Final

| Campo | Teclado Mobile | Aceita |
|-------|----------------|--------|
| CEP | Numérico (via `inputMode="numeric"`) | Apenas números, formatado automaticamente |
| Número | Alfanumérico padrão | Números e letras (ex: "123A") |

