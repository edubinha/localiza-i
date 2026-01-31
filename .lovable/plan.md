
# Plano: Otimização do Teclado Mobile para Campos CEP e Número

## Objetivo

Melhorar a experiência de preenchimento no celular configurando os teclados virtuais adequados para cada campo.

---

## Comportamentos Desejados

| Campo | Teclado Inicial | Permite Letras? |
|-------|-----------------|-----------------|
| CEP | Numérico | Não |
| Número | Numérico | Sim (usuário pode alternar) |

---

## Solução Técnica

Utilizaremos atributos HTML5 que controlam o comportamento do teclado virtual em dispositivos móveis:

- **`inputMode`**: Define qual tipo de teclado virtual o navegador deve exibir
- **`pattern`**: Define um padrão de validação (também influencia alguns navegadores)

### Valores do inputMode

| Valor | Comportamento |
|-------|---------------|
| `numeric` | Teclado numérico (0-9), usuário pode alternar |
| `tel` | Teclado telefônico (mais restritivo em alguns dispositivos) |
| `text` | Teclado alfanumérico padrão |

---

## Alterações no Código

**Arquivo:** `src/components/AddressForm.tsx`

### Campo CEP (linhas 249-256)

Adicionar `inputMode="numeric"` e `pattern="[0-9]*"` para garantir apenas números:

```tsx
<Input 
  placeholder="00000-000" 
  {...field}
  onChange={(e) => handleCepChange(e.target.value)}
  maxLength={9}
  disabled={isDisabled}
  inputMode="numeric"
  pattern="[0-9]*"
  className={cepError ? 'border-destructive pr-10' : 'pr-10'}
/>
```

### Campo Número (linhas 280-284)

Adicionar `inputMode="numeric"` para mostrar teclado numérico por padrão, mas permitindo alternância:

```tsx
<Input 
  placeholder="Ex: 123" 
  {...field} 
  disabled={isDisabled}
  inputMode="numeric"
/>
```

---

## Diferença de Comportamento

| Configuração | CEP | Número |
|--------------|-----|--------|
| `inputMode` | `numeric` | `numeric` |
| `pattern` | `[0-9]*` | *(não definido)* |
| Resultado | Força teclado numérico | Teclado numérico com opção de alternar |

A combinação de `inputMode="numeric"` + `pattern="[0-9]*"` no campo CEP cria uma experiência mais restritiva, ideal para campos que só aceitam números. Já o campo Número usa apenas `inputMode="numeric"`, o que sugere o teclado numérico mas permite ao usuário alternar para o alfanumérico quando necessário (ex: "123A").

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/AddressForm.tsx` | Adicionar atributos `inputMode` e `pattern` nos campos CEP e Número |

---

## Compatibilidade

Esta solução funciona em:
- iOS Safari
- Chrome Android
- Samsung Internet
- Firefox Mobile

Não afeta o comportamento em desktop (os atributos são ignorados quando não há teclado virtual).
